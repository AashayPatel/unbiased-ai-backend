import os
import pandas as pd
from fastapi import FastAPI, HTTPException
from fairlearn.metrics import demographic_parity_ratio
from google import genai
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import bigquery
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder
import shap
import traceback

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


# ── Data loader (BigQuery → CSV fallback) ─────────────────────────────────────

def load_data() -> pd.DataFrame:
    """Load COMPAS data from BigQuery, falling back to local CSV."""
    try:
        bq_client = bigquery.Client()
        query = """
            SELECT decile_score, race, sex,
                   age, priors_count, juv_fel_count,
                   juv_misd_count, two_year_recid, c_charge_degree
            FROM `unbiased-ai-2026-493219.propublica.compas_data`
            LIMIT 7000
        """
        df = bq_client.query(query).to_dataframe()
        print("Loaded data from BigQuery")
    except Exception as e:
        print(f"BigQuery failed, using local CSV. Error: {e}")
        df = pd.read_csv("compas_fixed.csv")

    # Normalise column names to lowercase with no spaces
    df.columns = df.columns.str.lower().str.strip()

    # Handle alternative column names across different CSV versions
    if "decile_score.1" in df.columns and "decile_score" not in df.columns:
        df = df.rename(columns={"decile_score.1": "decile_score"})
    if "is_recid" in df.columns and "two_year_recid" not in df.columns:
        df = df.rename(columns={"is_recid": "two_year_recid"})
    if "c_charge_degree" not in df.columns and "charge_degree" in df.columns:
        df = df.rename(columns={"charge_degree": "c_charge_degree"})

    # Drop rows missing the columns we need
    required = ["decile_score", "race"]
    df = df.dropna(subset=required)
    df = df.where(pd.notna(df), other=None)
    
    return df


def approval_rate(series: pd.Series) -> float:
    """Fraction of predictions that are NOT flagged high-risk (i.e. 'approved')."""
    return float((series == 0).mean())


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {"status": "Unbiased AI API is Live", "version": "2.2"}


@app.get("/audit")
def run_audit(threshold: float = 0.5):
    """
    Core bias audit endpoint.
    threshold: decision boundary applied to decile_score (0–10 scale).
               A score >= threshold*10 is flagged high-risk (prediction=1).
    """
    try:
        df = load_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data load failed: {str(e)}")

    # Convert 0–1 threshold → 0–10 decile scale
    cutoff = threshold * 10

    # Binary prediction: 1 = high risk, 0 = approved
    df["prediction"] = (df["decile_score"] >= cutoff).astype(int)

    # Per-group approval rates
    def group_rate(race_label):
        subset = df[df["race"] == race_label]
        if len(subset) == 0:
            return None
        return round(approval_rate(subset["prediction"]), 4)

    white_rate    = group_rate("Caucasian")
    black_rate    = group_rate("African-American")
    hispanic_rate = group_rate("Hispanic")
    asian_rate    = group_rate("Asian")
    other_rate    = group_rate("Other")

    # Disparate Impact Ratio = least-approved group / most-approved group
    rates = {k: v for k, v in {
        "Caucasian":        white_rate,
        "African-American": black_rate,
        "Hispanic":         hispanic_rate,
        "Asian":            asian_rate,
    }.items() if v is not None}

    if len(rates) < 2:
        raise HTTPException(status_code=500, detail="Not enough racial groups in data to compute DIR")

    max_rate = max(rates.values())
    min_rate = min(rates.values())
    dir_score = round(min_rate / max_rate, 4) if max_rate > 0 else 0.0

    # Demographic parity ratio via Fairlearn (cross-check)
    try:
        fairlearn_ratio = demographic_parity_ratio(
            y_true=df["prediction"],
            y_pred=df["prediction"],
            sensitive_features=df["race"],
        )
        fairlearn_ratio = round(float(fairlearn_ratio), 4)
    except Exception:
        fairlearn_ratio = dir_score  # fallback to our manual calc

    return {
        "threshold":               round(threshold, 2),
        "disparate_impact_ratio":  dir_score,
        "fairlearn_ratio":         fairlearn_ratio,
        "white_approval_rate":     white_rate,
        "black_approval_rate":     black_rate,
        "hispanic_approval_rate":  hispanic_rate,
        "asian_approval_rate":     asian_rate,
        "other_approval_rate":     other_rate,
        "sample_size":             len(df),
        "pass":                    dir_score >= 0.8,
        "rule":                    "4/5ths (DIR >= 0.8)",
    }


@app.get("/audit/intersectional")
def intersectional_audit(threshold: float = 0.5):
    """Check bias across race × sex subgroups."""
    try:
        df = load_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data load failed: {str(e)}")

    cutoff = threshold * 10
    df["prediction"] = (df["decile_score"] >= cutoff).astype(int)

    if "sex" not in df.columns:
        raise HTTPException(status_code=400, detail="sex column not found in dataset")

    results = []
    for (race, sex), group in df.groupby(["race", "sex"]):
        if len(group) < 20:   # skip tiny subgroups
            continue
        rate = approval_rate(group["prediction"])
        results.append({
            "subgroup":       f"{race} / {sex}",
            "race":           race,
            "sex":            sex,
            "approval_rate":  round(rate, 4),
            "sample_size":    len(group),
        })

    if not results:
        raise HTTPException(status_code=500, detail="No subgroups with enough data")

    rates      = [r["approval_rate"] for r in results]
    max_rate   = max(rates)
    min_rate   = min(rates)
    dir_score  = round(min_rate / max_rate, 4) if max_rate > 0 else 0.0

    return {
        "threshold":              round(threshold, 2),
        "intersectional_dir":     dir_score,
        "pass":                   dir_score >= 0.8,
        "best_subgroup":          results[rates.index(max_rate)]["subgroup"],
        "worst_subgroup":         results[rates.index(min_rate)]["subgroup"],
        "subgroups":              sorted(results, key=lambda x: x["approval_rate"], reverse=True),
    }


@app.get("/debug/columns")
def debug_columns():
    try:
        df = load_data()

        # Convert race counts to clean string-keyed dict
        race_counts = {}
        for k, v in df["race"].value_counts().items():
            key = str(k) if k is not None else "null"
            race_counts[key] = int(v)

        # Build sample rows with all NaN/inf replaced
        sample_rows = []
        for _, row in df.head(3).iterrows():
            clean_row = {}
            for col, val in row.items():
                if val is None:
                    clean_row[col] = None
                elif isinstance(val, float):
                    import math
                    clean_row[col] = None if (math.isnan(val) or math.isinf(val)) else round(val, 4)
                else:
                    try:
                        clean_row[col] = val.item()  # numpy scalar → python
                    except AttributeError:
                        clean_row[col] = str(val)
            sample_rows.append(clean_row)

        return {
            "columns": list(df.columns),
            "shape":   {"rows": int(df.shape[0]), "cols": int(df.shape[1])},
            "races":   race_counts,
            "sample":  sample_rows,
        }
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=traceback.format_exc())


@app.get("/explain")
def explain_bias(threshold: float = 0.5):
    """Run audit then ask Gemini to explain the results in plain English."""
    audit_data = run_audit(threshold)

    if not client:
        return {"audit": audit_data, "error": "Gemini API key not configured"}

    try:
        prompt = (
            f"A recidivism prediction model was audited at decision threshold {threshold}.\n"
            f"Disparate Impact Ratio: {audit_data['disparate_impact_ratio']} "
            f"({'PASS' if audit_data['pass'] else 'FAIL'} — 4/5ths rule requires >= 0.8).\n"
            f"Approval rates by race:\n"
            f"  - White: {audit_data['white_approval_rate']}\n"
            f"  - Black: {audit_data['black_approval_rate']}\n"
            f"  - Hispanic: {audit_data['hispanic_approval_rate']}\n"
            f"  - Asian: {audit_data['asian_approval_rate']}\n\n"
            f"In 3 plain sentences for a legal/policy audience: "
            f"(1) What does this score mean in practice? "
            f"(2) What real-world harm does the gap between Black ({audit_data['black_approval_rate']}) "
            f"and Asian ({audit_data['asian_approval_rate']}) approval rates represent? "
            f"(3) What should be done to fix it?"
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return {"audit": audit_data, "ai_explanation": response.text}
    except Exception as e:
        return {"audit": audit_data, "error": str(e)}


@app.get("/list-models")
def list_available_models():
    if not client:
        return {"error": "Gemini API key not configured"}
    try:
        model_list = [
            {
                "name":         m.name,
                "display_name": getattr(m, "display_name", "N/A"),
                "description":  getattr(m, "description",  "N/A"),
            }
            for m in client.models.list()
        ]
        return {"available_models": model_list}
    except Exception as e:
        return {"error": f"Failed to list models: {str(e)}"}


# ── Feature config ────────────────────────────────────────────────────────────

FEATURES = ["age", "priors_count", "juv_fel_count", "juv_misd_count",
            "juv_other_count", "c_charge_degree", "sex", "race"]

FEATURE_LABELS = {
    "age":             "Age",
    "priors_count":    "Prior offences",
    "juv_fel_count":   "Juvenile felonies",
    "juv_misd_count":  "Juvenile misdemeanours",
    "juv_other_count": "Other juvenile charges",
    "c_charge_degree": "Charge degree",
    "sex":             "Sex",
    "race":            "Race",
}

PROTECTED = {"race", "sex"}

# ── Model cache (train once per process, reuse) ───────────────────────────────

_model_cache: dict = {}


def _get_model_and_data():
    """Train a GBM on COMPAS and cache it for the process lifetime."""
    if "model" in _model_cache:
        return _model_cache["model"], _model_cache["X"], _model_cache["df_raw"]

    df = load_data()   # your existing loader from main.py

    # Keep only rows that have all required columns
    available = [f for f in FEATURES if f in df.columns]
    target_col = "two_year_recid" if "two_year_recid" in df.columns else None
    if target_col is None:
        raise ValueError("two_year_recid column not found — check your dataset")

    df_model = df[available + [target_col]].dropna().reset_index(drop=True)

    # Encode categoricals
    encoders = {}
    for col in ["c_charge_degree", "sex", "race"]:
        if col in df_model.columns:
            le = LabelEncoder()
            df_model[col] = le.fit_transform(df_model[col].astype(str))
            encoders[col] = le

    X = df_model[available].values
    y = df_model[target_col].values

    model = GradientBoostingClassifier(
        n_estimators=120, max_depth=4, learning_rate=0.08,
        random_state=42, subsample=0.8
    )
    model.fit(X, y)

    _model_cache["model"]    = model
    _model_cache["X"]        = X
    _model_cache["df_raw"]   = df_model
    _model_cache["features"] = available
    _model_cache["encoders"] = encoders

    return model, X, df_model


# ── Endpoint 1: global feature importance ─────────────────────────────────────

@app.get("/explain/features")
def explain_features():
    """
    Global SHAP importance — which features drive bias across the whole dataset.
    Returns mean |SHAP value| per feature, flagging protected attributes.
    """
    try:
        model, X, df_raw = _get_model_and_data()
        features = _model_cache["features"]

        explainer   = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X)          # shape (n_samples, n_features)
        mean_shap   = np.abs(shap_values).mean(axis=0)  # shape (n_features,)

        results = []
        for i, feat in enumerate(features):
            results.append({
                "feature":      feat,
                "label":        FEATURE_LABELS.get(feat, feat),
                "importance":   round(float(mean_shap[i]), 4),
                "is_protected": feat in PROTECTED,
            })

        results.sort(key=lambda x: x["importance"], reverse=True)

        protected_impact = sum(r["importance"] for r in results if r["is_protected"])
        total_impact     = sum(r["importance"] for r in results)

        return {
            "features":           results,
            "protected_impact":   round(protected_impact, 4),
            "total_impact":       round(total_impact, 4),
            "protected_share_pct": round(100 * protected_impact / total_impact, 1),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Endpoint 2: per-individual waterfall ──────────────────────────────────────

@app.get("/explain/individual/{person_id}")
def explain_individual(person_id: int):
    """
    Per-person SHAP waterfall — which features pushed THIS individual's
    risk score up or down, and by how much.

    person_id: row index in the dataset (0-based).
               Use /explain/individuals/sample to browse available people.
    """
    try:
        model, X, df_raw = _get_model_and_data()
        features = _model_cache["features"]
        encoders = _model_cache["encoders"]

        if person_id < 0 or person_id >= len(df_raw):
            raise HTTPException(
                status_code=404,
                detail=f"person_id {person_id} out of range. Dataset has {len(df_raw)} rows."
            )

        x_individual = X[person_id].reshape(1, -1)  # shape (1, n_features)

        # FIXED — handles both single and multi-output SHAP correctly
        explainer   = shap.TreeExplainer(model)
        raw_shap    = explainer.shap_values(x_individual)

        # GradientBoostingClassifier returns a single 2D array (not a list)
        # shape is (n_samples, n_features) — take row 0
        if isinstance(raw_shap, list):
            # Multi-output: take class 1 (high risk), then first sample
            shap_values = np.array(raw_shap[1][0])
        else:
            # Single output: just take first sample
            shap_values = np.array(raw_shap[0])

        # expected_value can also be an array for some SHAP versions
        ev = explainer.expected_value
        base_value = float(ev[1] if isinstance(ev, (list, np.ndarray)) and len(np.atleast_1d(ev)) > 1 else np.asarray(ev).flat[0])
        pred_prob   = float(model.predict_proba(x_individual)[0][1])
        prediction  = int(model.predict(x_individual)[0])

        # Decode categoricals back to human-readable labels
        row_raw = df_raw.iloc[person_id].to_dict()
        decoded = {}
        # WITH this — handles numpy scalar types safely:
        for feat in features:
            val = row_raw.get(feat)
            if val is None:
                decoded[feat] = None
                continue
            # Convert numpy types to native Python first
            if hasattr(val, 'item'):
                val = val.item()
            if feat in encoders:
                try:
                    decoded[feat] = encoders[feat].inverse_transform([int(val)])[0]
                except Exception:
                    decoded[feat] = str(val)
            else:
                try:
                    decoded[feat] = round(float(val), 2)
                except Exception:
                    decoded[feat] = str(val)

        # Build waterfall entries — positive SHAP = pushes toward high risk
        waterfall = []
        for i, feat in enumerate(features):
            sv = float(np.asarray(shap_values[i]).flat[0])
            waterfall.append({
                "feature":      feat,
                "label":        FEATURE_LABELS.get(feat, feat),
                "value":        decoded.get(feat),
                "shap":         round(sv, 4),
                "direction":    "risk" if sv > 0 else "safe",
                "is_protected": feat in PROTECTED,
            })

        waterfall.sort(key=lambda x: abs(x["shap"]), reverse=True)

        # Dominant reason (top non-protected feature)
        top_legit = next((w for w in waterfall if not w["is_protected"]), waterfall[0])
        top_prot  = next((w for w in waterfall if w["is_protected"]), None)

        return {
            "person_id":    person_id,
            "base_value":   round(base_value, 4),
            "predicted_prob": round(pred_prob, 4),
            "prediction":   prediction,
            "risk_label":   "High risk" if prediction == 1 else "Low risk",
            "waterfall":    waterfall,
            "top_driver":   top_legit["label"],
            "protected_influence": round(
                sum(abs(w["shap"]) for w in waterfall if w["is_protected"]), 4
            ),
            "demographics": {
                "race": str(decoded.get("race", "Unknown")),
                "sex":  str(decoded.get("sex", "Unknown")),
                "age":  int(decoded.get("age", 0)) if decoded.get("age") is not None else 0,
            },
        }  

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=traceback.format_exc())


# ── Endpoint 3: browse individuals ────────────────────────────────────────────

@app.get("/explain/individuals/sample")
def sample_individuals(
    n: int = 20,
    race: str = None,
    prediction: int = None
):
    """
    Returns a sample of individuals to select in the waterfall UI.
    Filter by race (e.g. 'African-American') or prediction (0 or 1).
    """
    try:
        model, X, df_raw = _get_model_and_data()
        features = _model_cache["features"]
        encoders = _model_cache["encoders"]

        preds = model.predict(X)
        probs = model.predict_proba(X)[:, 1]

        results = []
        for i in range(len(df_raw)):
            row = df_raw.iloc[i]

            # Decode race for filtering
            race_val = row.get("race")
            if "race" in encoders:
                try:
                    race_val = encoders["race"].inverse_transform([int(race_val)])[0]
                except Exception:
                    pass

            if race and str(race_val) != race:
                continue
            if prediction is not None and int(preds[i]) != prediction:
                continue

            # FIXED — safely converts any numpy scalar or array to Python native type
            def _safe_int(val):
                try:
                    return int(np.asarray(val).flat[0])
                except Exception:
                    return 0

            def _safe_float(val):
                try:
                    return round(float(np.asarray(val).flat[0]), 3)
                except Exception:
                    return 0.0

            results.append({
                "person_id":  i,
                "race":       str(race_val),
                "age":        _safe_int(row.get("age", 0)),
                "priors":     _safe_int(row.get("priors_count", 0)),
                "prediction": _safe_int(preds[i]),
                "risk_prob":  _safe_float(probs[i]),
                "risk_label": "High risk" if _safe_int(preds[i]) == 1 else "Low risk",
            })

            if len(results) >= n:
                break

        return {"individuals": results, "total_returned": len(results)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))