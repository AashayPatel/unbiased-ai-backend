import os
from fastapi import FastAPI 
import pandas as pd
from fairlearn.metrics import demographic_parity_ratio
from google import genai
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import bigquery

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fetch key from environment (Cloud Run / Secret Manager)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
genai_client = genai.Client(api_key=GEMINI_API_KEY)

def run_fairness_audit():
    """Fetches data from BigQuery and calculates the Disparate Impact Ratio."""
    bq_client = bigquery.Client()
    
    # Update these with your specific GCP project/dataset details
    query = """
        SELECT score_factor, race FROM `your-project.your_dataset.compas_data`
    """
    df = bq_client.query(query).to_dataframe()
    
    # Calculate Demographic Parity Ratio (The '4/5ths Rule' metric)
    # y_true is the model's prediction, sensitive_features is the protected attribute
    ratio = demographic_parity_ratio(
        y_true=df['score_factor'], 
        y_pred=df['score_factor'], 
        sensitive_features=df['race']
    )
    
    status = "PASS" if ratio > 0.8 else "FAIL"
    
    return {
        "fairness_ratio": round(float(ratio), 3),
        "status": status,
        "sample_size": len(df)
    }



@app.get("/audit")
def get_raw_audit():
    return run_fairness_audit()

@app.get("/explain")
def explain_bias():
    audit_data = run_fairness_audit()
    try:
        # Contextual prompt for Gemini 2.0 Flash
        prompt = (
            f"As a legal tech expert, analyze this AI fairness score. "
            f"The Disparate Impact Ratio is {audit_data['fairness_ratio']}. "
            f"The status is {audit_data['status']}. "
            f"Explain what this means for a recidivism prediction model in plain English."
        )
        
        response = genai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        
        return {
            "audit": audit_data,
            "ai_explanation": response.text
        }
    except Exception as e:
        return {
            "audit": audit_data,
            "ai_explanation": (
                f"Technical Summary: A ratio of {audit_data['fairness_ratio']} "
                f"indicates the model {audit_data['status']}es the 4/5ths rule. "
                "This suggests potential systemic bias in the decision-making process."
            ),
            "note": f"Fallback triggered. Error: {str(e)}"
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)