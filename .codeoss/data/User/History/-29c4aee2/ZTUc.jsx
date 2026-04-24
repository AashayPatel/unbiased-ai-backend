import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";

const API_URL = "https://unbiased-ai-api-462056320872.us-central1.run.app"; // replace this

export default function WhatIfSimulator() {
  const [threshold, setThreshold] = useState(0.5);
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const debounce = setTimeout(() => fetchAudit(threshold), 300);
    return () => clearTimeout(debounce);
  }, [threshold]);

  async function fetchAudit(t) {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/audit?threshold=${t}`);
      const data = await res.json();
      setAuditData(data);
    } finally {
      setLoading(false);
    }
  }

  const pass = auditData?.disparate_impact_ratio >= 0.8;

  return (
    <div style={{ padding: "2rem", maxWidth: 700 }}>
      <h2>What-If Threshold Simulator</h2>

      <label>Decision Threshold: <strong>{threshold.toFixed(2)}</strong></label>
      <input
        type="range" min="0.1" max="0.9" step="0.01"
        value={threshold}
        onChange={e => setThreshold(parseFloat(e.target.value))}
        style={{ width: "100%", margin: "12px 0" }}
      />

      {auditData && (
        <>
          <div style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: pass ? "#d4edda" : "#f8d7da",
            color: pass ? "#155724" : "#721c24",
            fontWeight: 500,
            marginBottom: 16
          }}>
            {pass ? "PASS" : "FAIL"} — Disparate Impact Ratio: {auditData.disparate_impact_ratio?.toFixed(3)}
            {!pass && " (below 4/5ths rule threshold of 0.8)"}
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={[
              { group: "White", rate: auditData.white_approval_rate },
              { group: "Black", rate: auditData.black_approval_rate },
              { group: "Hispanic", rate: auditData.hispanic_approval_rate },
            ]}>
              <XAxis dataKey="group" />
              <YAxis domain={[0, 1]} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
              <Tooltip formatter={v => `${(v*100).toFixed(1)}%`} />
              <ReferenceLine y={0.8} stroke="#dc3545" strokeDasharray="4 4" label="4/5ths rule" />
              <Bar dataKey="rate" fill="#4285F4" />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {loading && <p style={{ color: "#888", fontSize: 13 }}>Recalculating...</p>}
    </div>
  );
}