import { useState, useEffect, useRef } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_URL = "https://unbiased-ai-api-462056320872.us-central1.run.app/"; // ← your Cloud Run URL

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:          "#F7F5F0",
  surface:     "#FFFFFF",
  border:      "#E8E4DC",
  borderDark:  "#C8C4BC",
  ink:         "#1A1814",
  inkMid:      "#6B6860",
  inkLight:    "#A8A49C",
  risk:        "#C0392B",
  riskLight:   "#FDECEA",
  riskMid:     "#E8776E",
  safe:        "#1A6B4A",
  safeLight:   "#EAF5EF",
  safeMid:     "#5BAF84",
  protected:   "#8B5E00",
  protectedBg: "#FEF7E6",
  accent:      "#2B4EFF",
  accentLight: "#EEF1FF",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function pct(v, max) {
  return Math.min(100, Math.round((Math.abs(v) / max) * 100));
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function Tag({ children, color, bg, border }) {
  return (
    <span style={{
      display: "inline-block",
      fontSize: 11, fontWeight: 600,
      letterSpacing: "0.05em",
      padding: "2px 8px",
      borderRadius: 4,
      color, background: bg,
      border: `1px solid ${border || bg}`,
    }}>
      {children}
    </span>
  );
}

function PersonCard({ person, selected, onClick }) {
  const isHigh = person.prediction === 1;
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left",
      background: selected ? C.accentLight : C.surface,
      border: `1px solid ${selected ? C.accent : C.border}`,
      borderRadius: 8, padding: "10px 14px",
      cursor: "pointer", transition: "all 0.15s",
      marginBottom: 6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: "'Lora', serif" }}>
            Person #{person.person_id}
          </span>
          <span style={{ fontSize: 11, color: C.inkMid, marginLeft: 8 }}>
            {person.race} · Age {person.age} · {person.priors} prior{person.priors !== 1 ? "s" : ""}
          </span>
        </div>
        <Tag
          color={isHigh ? C.risk : C.safe}
          bg={isHigh ? C.riskLight : C.safeLight}
          border={isHigh ? C.riskMid : C.safeMid}
        >
          {person.risk_label}
        </Tag>
      </div>
      <div style={{
        marginTop: 6, height: 3, borderRadius: 2,
        background: C.border, overflow: "hidden",
      }}>
        <div style={{
          width: `${Math.round(person.risk_prob * 100)}%`,
          height: "100%",
          background: isHigh ? C.riskMid : C.safeMid,
          borderRadius: 2,
        }} />
      </div>
    </button>
  );
}

function WaterfallBar({ entry, maxAbs, index }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 60);
    return () => clearTimeout(t);
  }, [index]);

  const isRisk      = entry.direction === "risk";
  const barColor    = entry.is_protected
    ? C.protected
    : isRisk ? C.riskMid : C.safeMid;
  const barBg       = entry.is_protected
    ? C.protectedBg
    : isRisk ? C.riskLight : C.safeLight;
  const width       = pct(entry.shap, maxAbs);
  const isPos       = entry.shap > 0;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "160px 1fr 60px",
      alignItems: "center",
      gap: 12,
      padding: "8px 0",
      borderBottom: `1px solid ${C.border}`,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateX(0)" : "translateX(-12px)",
      transition: "opacity 0.3s ease, transform 0.3s ease",
    }}>
      {/* Feature label */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {entry.is_protected && (
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: C.protected, flexShrink: 0,
          }} />
        )}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{entry.label}</div>
          <div style={{ fontSize: 11, color: C.inkMid }}>
            {entry.value !== null && entry.value !== undefined
              ? String(entry.value)
              : "—"}
          </div>
        </div>
      </div>

      {/* Bar — diverging from center */}
      <div style={{ position: "relative", height: 28 }}>
        {/* Center line */}
        <div style={{
          position: "absolute", left: "50%", top: 0, bottom: 0,
          width: 1, background: C.borderDark,
        }} />
        {/* Bar */}
        <div style={{
          position: "absolute",
          top: 4, bottom: 4,
          left:  isPos ? "50%" : `calc(50% - ${width / 2}%)`,
          width: `${width / 2}%`,
          background: barColor,
          borderRadius: isPos ? "0 3px 3px 0" : "3px 0 0 3px",
          backgroundColor: barBg,
          border: `1px solid ${barColor}`,
          transition: "width 0.4s ease",
          minWidth: 2,
        }}>
          <div style={{
            position: "absolute",
            top: 0, bottom: 0,
            left: isPos ? 0 : "auto",
            right: isPos ? "auto" : 0,
            width: 3,
            background: barColor,
            borderRadius: isPos ? "0 2px 2px 0" : "2px 0 0 2px",
          }} />
        </div>
      </div>

      {/* SHAP value */}
      <div style={{
        fontSize: 12, fontWeight: 600, fontFamily: "'Lora', serif",
        color: barColor, textAlign: "right",
      }}>
        {entry.shap > 0 ? "+" : ""}{entry.shap.toFixed(3)}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ShapWaterfall() {
  const [individuals, setIndividuals]   = useState([]);
  const [selected, setSelected]         = useState(null);
  const [shapData, setShapData]         = useState(null);
  const [loadingList, setLoadingList]   = useState(false);
  const [loadingShap, setLoadingShap]   = useState(false);
  const [filterRace, setFilterRace]     = useState("all");
  const [filterPred, setFilterPred]     = useState("all");
  const [error, setError]               = useState(null);
  const detailRef                       = useRef(null);

  // Load individual list
  useEffect(() => {
    setLoadingList(true);
    const params = new URLSearchParams({ n: 30 });
    if (filterRace !== "all") params.set("race", filterRace);
    if (filterPred !== "all") params.set("prediction", filterPred);

    fetch(`${API_URL}/explain/individuals/sample?${params}`)
      .then(r => r.json())
      .then(d => {
        setIndividuals(d.individuals || []);
        setSelected(null);
        setShapData(null);
      })
      .catch(() => setError("Could not reach API — check your Cloud Run URL"))
      .finally(() => setLoadingList(false));
  }, [filterRace, filterPred]);

  // Load SHAP for selected person
  useEffect(() => {
    if (selected === null) return;
    setLoadingShap(true);
    setShapData(null);

    fetch(`${API_URL}/explain/individual/${selected}`)
      .then(r => r.json())
      .then(d => {
        if (d.detail) throw new Error(d.detail);
        setShapData(d);
        setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoadingShap(false));
  }, [selected]);

  const maxAbs = shapData
    ? Math.max(...shapData.waterfall.map(w => Math.abs(w.shap)), 0.01)
    : 1;

  const isHighRisk = shapData?.prediction === 1;

  return (
    <div style={{
      background: C.bg,
      minHeight: "100vh",
      fontFamily: "'DM Sans', sans-serif",
      color: C.ink,
      padding: "36px 28px",
      boxSizing: "border-box",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select { 
          appearance: none; background: ${C.surface}; 
          border: 1px solid ${C.border}; border-radius: 6px;
          padding: 6px 28px 6px 10px; font-size: 13px;
          font-family: 'DM Sans', sans-serif; color: ${C.ink};
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B6860' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
        }
        select:focus { outline: 2px solid ${C.accent}; outline-offset: 1px; }
        @keyframes shimmer {
          0% { opacity: 0.4; } 50% { opacity: 0.8; } 100% { opacity: 0.4; }
        }
        .shimmer { animation: shimmer 1.4s ease-in-out infinite; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.35s ease forwards; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.borderDark}; border-radius: 2px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 11, letterSpacing: "0.15em", color: C.inkLight,
          textTransform: "uppercase", marginBottom: 6,
        }}>
          Unbiased AI · Individual Explainability
        </div>
        <h1 style={{
          fontFamily: "'Lora', serif", fontSize: 28,
          fontWeight: 700, color: C.ink, lineHeight: 1.25,
        }}>
          SHAP Waterfall Explorer
        </h1>
        <p style={{
          fontSize: 14, color: C.inkMid, marginTop: 8,
          lineHeight: 1.65, maxWidth: 540,
        }}>
          Select any individual from the COMPAS dataset to see exactly which features
          pushed their risk score up or down — and by how much.
        </p>
      </div>

      {error && (
        <div style={{
          background: C.riskLight, border: `1px solid ${C.riskMid}`,
          borderRadius: 8, padding: "10px 14px", fontSize: 13,
          color: C.risk, marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Left: person selector ── */}
        <div>
          {/* Filters */}
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "14px 16px", marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 10 }}>
              FILTER INDIVIDUALS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label style={{ fontSize: 12, color: C.inkMid, display: "block", marginBottom: 4 }}>Race</label>
                <select value={filterRace} onChange={e => setFilterRace(e.target.value)} style={{ width: "100%" }}>
                  <option value="all">All races</option>
                  <option value="African-American">African-American</option>
                  <option value="Caucasian">Caucasian</option>
                  <option value="Hispanic">Hispanic</option>
                  <option value="Asian">Asian</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.inkMid, display: "block", marginBottom: 4 }}>Prediction</label>
                <select value={filterPred} onChange={e => setFilterPred(e.target.value)} style={{ width: "100%" }}>
                  <option value="all">All predictions</option>
                  <option value="1">High risk only</option>
                  <option value="0">Low risk only</option>
                </select>
              </div>
            </div>
          </div>

          {/* List */}
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "14px 16px",
            maxHeight: 520, overflowY: "auto",
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 10 }}>
              {loadingList ? "LOADING..." : `${individuals.length} INDIVIDUALS`}
            </div>

            {loadingList ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shimmer" style={{
                  height: 56, background: C.bg, borderRadius: 8,
                  marginBottom: 6,
                }} />
              ))
            ) : individuals.map(p => (
              <PersonCard
                key={p.person_id}
                person={p}
                selected={selected === p.person_id}
                onClick={() => setSelected(p.person_id)}
              />
            ))}
          </div>
        </div>

        {/* ── Right: waterfall ── */}
        <div ref={detailRef}>
          {!shapData && !loadingShap && (
            <div style={{
              background: C.surface, border: `1px dashed ${C.borderDark}`,
              borderRadius: 10, padding: "48px 32px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>←</div>
              <div style={{ fontFamily: "'Lora', serif", fontSize: 18, color: C.inkMid }}>
                Select a person to see their SHAP breakdown
              </div>
              <div style={{ fontSize: 13, color: C.inkLight, marginTop: 8 }}>
                Each feature's contribution to the risk score will appear here
              </div>
            </div>
          )}

          {loadingShap && (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "24px",
            }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="shimmer" style={{
                  height: 44, background: C.bg, borderRadius: 6,
                  marginBottom: 8,
                }} />
              ))}
            </div>
          )}

          {shapData && !loadingShap && (
            <div className="fade-in">
              {/* Person header card */}
              <div style={{
                background: isHighRisk ? C.riskLight : C.safeLight,
                border: `1px solid ${isHighRisk ? C.riskMid : C.safeMid}`,
                borderRadius: 10, padding: "18px 22px", marginBottom: 16,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{
                      fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 700,
                      color: isHighRisk ? C.risk : C.safe,
                    }}>
                      {shapData.risk_label}
                    </div>
                    <div style={{ fontSize: 13, color: C.inkMid, marginTop: 4 }}>
                      Person #{shapData.person_id} ·{" "}
                      {shapData.demographics.race} ·{" "}
                      Age {shapData.demographics.age} ·{" "}
                      {shapData.demographics.sex}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{
                      fontSize: 32, fontWeight: 700,
                      fontFamily: "'Lora', serif",
                      color: isHighRisk ? C.risk : C.safe,
                    }}>
                      {Math.round(shapData.predicted_prob * 100)}%
                    </div>
                    <div style={{ fontSize: 11, color: C.inkMid }}>predicted risk</div>
                  </div>
                </div>

                {/* Protected influence warning */}
                {shapData.protected_influence > 0.05 && (
                  <div style={{
                    marginTop: 14, padding: "8px 12px",
                    background: C.protectedBg,
                    border: `1px solid ${C.protected}44`,
                    borderRadius: 6, fontSize: 12, color: C.protected,
                  }}>
                    Protected attributes (race/sex) contributed{" "}
                    <strong>±{shapData.protected_influence.toFixed(3)}</strong> SHAP units
                    to this prediction — these features should not influence risk scores.
                  </div>
                )}
              </div>

              {/* Waterfall chart */}
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "20px 22px",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 16,
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.inkLight, letterSpacing: "0.1em" }}>
                      FEATURE CONTRIBUTIONS
                    </div>
                    <div style={{ fontSize: 13, color: C.inkMid, marginTop: 2 }}>
                      Base rate: <strong>{shapData.base_value.toFixed(3)}</strong>
                      {" "}· Top driver: <strong>{shapData.top_driver}</strong>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 10, height: 10, background: C.riskMid, borderRadius: 2, display: "inline-block" }} />
                      <span style={{ color: C.inkMid }}>Increases risk</span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 10, height: 10, background: C.safeMid, borderRadius: 2, display: "inline-block" }} />
                      <span style={{ color: C.inkMid }}>Reduces risk</span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 8, height: 8, background: C.protected, borderRadius: "50%", display: "inline-block" }} />
                      <span style={{ color: C.inkMid }}>Protected attribute</span>
                    </span>
                  </div>
                </div>

                {/* Column headers */}
                <div style={{
                  display: "grid", gridTemplateColumns: "160px 1fr 60px",
                  gap: 12, paddingBottom: 8,
                  borderBottom: `2px solid ${C.borderDark}`,
                  marginBottom: 4,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.inkLight }}>FEATURE / VALUE</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.inkLight, textAlign: "center" }}>
                    ← SAFE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; RISK →
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.inkLight, textAlign: "right" }}>SHAP</div>
                </div>

                {shapData.waterfall.map((entry, i) => (
                  <WaterfallBar key={entry.feature} entry={entry} maxAbs={maxAbs} index={i} />
                ))}

                {/* Final prediction bar */}
                <div style={{
                  marginTop: 12, padding: "12px 0 0",
                  borderTop: `2px solid ${C.borderDark}`,
                  display: "grid", gridTemplateColumns: "160px 1fr 60px",
                  gap: 12, alignItems: "center",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>Final score</div>
                  <div style={{
                    height: 8, borderRadius: 4, overflow: "hidden",
                    background: C.border,
                  }}>
                    <div style={{
                      width: `${Math.round(shapData.predicted_prob * 100)}%`,
                      height: "100%",
                      background: isHighRisk ? C.riskMid : C.safeMid,
                      borderRadius: 4,
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    fontFamily: "'Lora', serif",
                    color: isHighRisk ? C.risk : C.safe,
                    textAlign: "right",
                  }}>
                    {shapData.predicted_prob.toFixed(3)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}