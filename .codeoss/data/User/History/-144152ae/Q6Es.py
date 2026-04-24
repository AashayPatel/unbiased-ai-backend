import os
import pandas as pd
from fastapi import FastAPI 
from fairlearn.metrics import demographic_parity_ratio
from google import genai
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import bigquery
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
# FIXED: Consistent variable name
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

def run_fairness_audit():
    try:
        # Strategy A: Try BigQuery
        bq_client = bigquery.Client()
        # UPDATED: Using your actual Project ID
        query = """
            SELECT decile_score as score, race 
            FROM `unbiased-ai-2026-493219.propublica.compas_data` 
            LIMIT 1000
        """
        df = bq_client.query(query).to_dataframe()
    except Exception as e:
        # Strategy B: Fallback to local CSV if BigQuery fails
        print(f"BigQuery failed, using local CSV. Error: {e}")
        df = pd.read_csv('compas_fixed.csv')
        df = df.rename(columns={'decile_score': 'score'})

    # Calculate Ratio
    # We convert scores to binary (High Risk >= 5)
    y_pred = (df['score'] >= 5).astype(int)
    ratio = demographic_parity_ratio(
        y_true=y_pred, 
        y_pred=y_pred, 
        sensitive_features=df['race']
    )
    
    status = "PASS" if ratio > 0.8 else "FAIL"
    return {
        "fairness_ratio": round(float(ratio), 3),
        "status": status,
        "sample_size": len(df)
    }

@app.get("/")
def home():
    return {"status": "Unbiased AI API is Live", "version": "2.1"}

@app.get("/audit")
def get_raw_audit():
    return run_fairness_audit()

@app.get("/explain")
def explain_bias():
    audit_data = run_fairness_audit()
    if not client:
        return {"error": "Gemini API key not configured"}
        
    try:
        prompt = (
            f"Analyze this AI fairness score: Ratio {audit_data['fairness_ratio']}, Status {audit_data['status']}. "
            f"Explain what this means for a recidivism prediction model in 3 simple sentences."
        )
        # FIXED: Use 'client' instead of 'genai_client'
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return {"audit": audit_data, "ai_explanation": response.text}
    except Exception as e:
        return {"audit": audit_data, "error": str(e)}

@app.get("/list-models")
def list_available_models():
    if not client:
        return {"error": "Gemini API key not configured"}
    
    try:
        # In the 2026 SDK, client.models.list() returns a Pager of Model objects
        models = client.models.list()
        
        model_list = []
        for m in models:
            # We just grab the name and display name 
            # (Filtering for supported methods is different in the new SDK)
            model_list.append({
                "name": m.name,
                "display_name": getattr(m, 'display_name', 'N/A'),
                "description": getattr(m, 'description', 'N/A')
            })
        
        return {"available_models": model_list}
    except Exception as e:
        return {"error": f"Failed to list models: {str(e)}"}