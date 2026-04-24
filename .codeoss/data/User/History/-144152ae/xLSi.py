import os
import pandas as pd
from fastapi import FastAPI, HTTPException
from fairlearn.metrics import demographic_parity_ratio
from google import genai
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import bigquery

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
    """Inspect dataset shape and column names — useful for diagnosing mismatches."""
    try:
        df = load_data()
        return {
            "columns": list(df.columns),
            "shape":   {"rows": df.shape[0], "cols": df.shape[1]},
            "races":   df["race"].value_counts().to_dict() if "race" in df.columns else "missing",
            "sample":  df.head(3).to_dict(orient="records"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
            f"Black approval rate: {audit_data['black_approval_rate']}, "
            f"White approval rate: {audit_data['white_approval_rate']}.\n\n"
            f"In 3 plain sentences for a legal/policy audience: "
            f"(1) What does this score mean? "
            f"(2) What real-world harm could result? "
            f"(3) What should be done to fix it?"
        )
        response = client.models.generate_content(
            model="gemini-2.0-flash",
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