import { useState, useEffect, useRef } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_URL = "https://unbiased-ai-api-462056320872.us-central1.run.app";

// ─── DESIGN TOKENS — matches WhatIfSimulator exactly ─────────────────────────
const C = {
  bg:        "#0A0D12",
  panel:     "#111520",
  border:    "#1E2535",
  borderMid: "#2A3548",
  accent:    "#00E5A0",
  accentDim: "#00E5A022",
  danger:    "#FF4B6E",
  dangerDim: "#FF4B6E22",
  warn:      "#FFB547",
  warnDim:   "#FFB54722",
  purple:    "#7B8FF5",
  purpleDim: "#7B8FF518",
  text:      "#E2E8F0",
  textMid:   "#A0AEC0",
  textDim:   "#718096",
  white:     "#FFFFFF",
  muted:     "#4A5568",
};

function pct(v, max) {
  return Math.min(98, Math.round((Math.abs(v) / max) * 100));
}

// ─── BADGE ────────────────────────────────────────────────────────────────────
function Badge({ children, color, bg }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 600,
      letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 20,
      color, background: bg, border: `1px solid ${color}44`,
      fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase",
    }}>
      {children}
    </span>
  );
}

// ─── PERSON CARD ──────────────────────────────────────────────────────────────
function PersonCard({ person, selected, onClick }) {
  const isHigh = person.prediction === 1;
  const color  = isHigh ? C.danger : C.accent;
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left",
      background: selected ? `${C.accent}12` : "transparent",
      border: `1px solid ${selected ? C.accent : C.border}`,
      borderRadius: 8, padding: "10px 12px", cursor: "pointer",
      transition: "border-color 0.15s, background 0.15s", marginBottom: 6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <div>
          <span style={{
            fontSize: 12, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace",
            color: selected ? C.accent : C.text,
          }}>
            #{String(person.person_id).padStart(4, "0")}
          </span>
          <span style={{ fontSize: 11, color: C.textDim, marginLeft: 8 }}>
            {person.race}
          </span>
        </div>
        <Badge color={color} bg={isHigh ? C.dangerDim : C.accentDim}>
          {person.risk_label}
        </Badge>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.textDim }}>
          Age {person.age} · {person.priors} prior{person.priors !== 1 ? "s" : ""}
        </span>
        <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color }}>
          {Math.round(person.risk_prob * 100)}%
        </span>
      </div>
      <div style={{ marginTop: 6, height: 2, borderRadius: 1, background: C.border, overflow: "hidden" }}>
        <div style={{
          width: `${Math.round(person.risk_prob * 100)}%`, height: "100%",
          background: color, borderRadius: 1, transition: "width 0.4s ease",
        }} />
      </div>
    </button>
  );
}

// ─── WATERFALL BAR ────────────────────────────────────────────────────────────
function WaterfallBar({ entry, maxAbs, index }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 55);
    return () => clearTimeout(t);
  }, [index]);

  const isPos    = entry.shap > 0;
  const barColor = entry.is_protected ? C.warn : isPos ? C.danger : C.accent;
  const barDim   = entry.is_protected ? C.warnDim : isPos ? C.dangerDim : C.accentDim;
  const w        = pct(entry.shap, maxAbs);

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "148px 1fr 58px",
      alignItems: "center", gap: 10, padding: "7px 0",
      borderBottom: `1px solid ${C.border}`,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateX(0)" : "translateX(-10px)",
      transition: "opacity 0.28s ease, transform 0.28s ease",
    }}>
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {entry.is_protected && (
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.warn, flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 500, color: C.text,
            fontFamily: "'IBM Plex Mono', monospace",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {entry.label}
          </div>
          <div style={{ fontSize: 11, color: C.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>
            {entry.value !== null && entry.value !== undefined ? String(entry.value) : "—"}
          </div>
        </div>
      </div>

      {/* Diverging bar */}
      <div style={{ position: "relative", height: 24 }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.borderMid }} />
        <div style={{
          position: "absolute", top: 3, bottom: 3,
          ...(isPos ? { left: "50%", width: `${w / 2}%` } : { right: "50%", width: `${w / 2}%` }),
          background: barDim, border: `1px solid ${barColor}`,
          borderRadius: isPos ? "0 3px 3px 0" : "3px 0 0 3px",
          minWidth: 3, transition: "width 0.45s ease",
        }}>
          <div style={{
            position: "absolute", top: 0, bottom: 0, width: 3,
            background: barColor,
            ...(isPos
              ? { right: 0, borderRadius: "0 2px 2px 0" }
              : { left: 0, borderRadius: "2px 0 0 2px" }),
          }} />
        </div>
      </div>

      {/* Value */}
      <div style={{
        fontSize: 12, fontWeight: 600,
        fontFamily: "'IBM Plex Mono', monospace",
        color: barColor, textAlign: "right",
      }}>
        {entry.shap > 0 ? "+" : ""}{entry.shap.toFixed(3)}
      </div>
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, warn }) {
  return (
    <div style={{
      background: warn ? C.warnDim : C.bg,
      border: `1px solid ${warn ? C.warn + "44" : C.border}`,
      borderRadius: 8, padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, color: warn ? C.warn : C.textDim, marginBottom: 4, letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: warn ? C.warn : C.text }}>
        {value}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function ShapWaterfall() {
  const [individuals, setIndividuals] = useState([]);
  const [selected, setSelected]       = useState(null);
  const [shapData, setShapData]       = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingShap, setLoadingShap] = useState(false);
  const [filterRace, setFilterRace]   = useState("all");
  const [filterPred, setFilterPred]   = useState("all");
  const [error, setError]             = useState(null);
  const detailRef                     = useRef(null);

  useEffect(() => {
    setLoadingList(true);
    setError(null);
    const p = new URLSearchParams({ n: 30 });
    if (filterRace !== "all") p.set("race", filterRace);
    if (filterPred !== "all") p.set("prediction", filterPred);

    fetch(`${API_URL}/explain/individuals/sample?${p}`)
      .then(r => r.json())
      .then(d => { setIndividuals(d.individuals || []); setSelected(null); setShapData(null); })
      .catch(() => setError("API unreachable — check your Cloud Run URL"))
      .finally(() => setLoadingList(false));
  }, [filterRace, filterPred]);

  useEffect(() => {
    if (selected === null) return;
    setLoadingShap(true);
    setShapData(null);
    setError(null);

    fetch(`${API_URL}/explain/individual/${selected}`)
      .then(r => r.json())
      .then(d => {
        if (d.detail) throw new Error(d.detail);
        setShapData(d);
        setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoadingShap(false));
  }, [selected]);

  const maxAbs    = shapData ? Math.max(...shapData.waterfall.map(w => Math.abs(w.shap)), 0.01) : 1;
  const isHigh    = shapData?.prediction === 1;
  const riskColor = isHigh ? C.danger : C.accent;

  return (
    <div style={{
      background: C.bg, minHeight: "100vh",
      fontFamily: "'IBM Plex Mono', monospace",
      color: C.text, padding: "40px 32px", boxSizing: "border-box",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .shap-sel {
          -webkit-appearance: none; appearance: none;
          background: ${C.panel}; border: 1px solid ${C.border};
          border-radius: 6px; padding: 7px 28px 7px 10px;
          font-size: 12px; font-family: 'IBM Plex Mono', monospace;
          color: ${C.text}; cursor: pointer; width: 100%;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23718096' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 8px center;
        }
        .shap-sel:focus { outline: 1px solid ${C.accent}; outline-offset: 1px; }
        .shap-sel option { background: ${C.panel}; }
        @keyframes shimmer { 0%,100%{opacity:0.25} 50%{opacity:0.5} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .shimmer { animation: shimmer 1.4s ease-in-out infinite; }
        .fade-up { animation: fadeUp 0.3s ease forwards; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.borderMid}; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: C.textDim, textTransform: "uppercase", marginBottom: 8 }}>
          Unbiased AI · Individual Explainability
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.white, lineHeight: 1.2 }}>
          SHAP waterfall<br />
          <span style={{ color: C.accent }}>feature explorer</span>
        </h1>
        <p style={{ fontSize: 12, color: C.textDim, marginTop: 10, lineHeight: 1.7, maxWidth: 480 }}>
          Select any individual to see which features pushed their risk score
          up or down — and whether protected attributes influenced the outcome.
        </p>
      </div>

      {error && (
        <div style={{
          background: C.dangerDim, border: `1px solid ${C.danger}44`,
          borderRadius: 8, padding: "8px 14px", fontSize: 12,
          color: C.danger, marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>

        {/* Left panel */}
        <div>
          <div style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: "16px", marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textDim, textTransform: "uppercase", marginBottom: 12 }}>
              Filter
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 5 }}>Race</div>
                <select className="shap-sel" value={filterRace} onChange={e => setFilterRace(e.target.value)}>
                  <option value="all">All races</option>
                  <option value="African-American">African-American</option>
                  <option value="Caucasian">Caucasian</option>
                  <option value="Hispanic">Hispanic</option>
                  <option value="Asian">Asian</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 5 }}>Prediction</div>
                <select className="shap-sel" value={filterPred} onChange={e => setFilterPred(e.target.value)}>
                  <option value="all">All predictions</option>
                  <option value="1">High risk only</option>
                  <option value="0">Low risk only</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: "14px",
            maxHeight: 500, overflowY: "auto",
          }}>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textDim, textTransform: "uppercase", marginBottom: 10 }}>
              {loadingList ? "Loading..." : `${individuals.length} individuals`}
            </div>
            {loadingList
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="shimmer" style={{ height: 60, background: C.border, borderRadius: 8, marginBottom: 6 }} />
                ))
              : individuals.map(p => (
                  <PersonCard
                    key={p.person_id} person={p}
                    selected={selected === p.person_id}
                    onClick={() => setSelected(p.person_id)}
                  />
                ))
            }
          </div>
        </div>

        {/* Right panel */}
        <div ref={detailRef}>
          {!shapData && !loadingShap && (
            <div style={{
              background: C.panel, border: `1px dashed ${C.border}`,
              borderRadius: 12, padding: "56px 32px", textAlign: "center",
            }}>
              <div style={{ fontSize: 28, color: C.borderMid, marginBottom: 14 }}>←</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.textDim }}>Select a person</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>
                Their SHAP breakdown will appear here
              </div>
            </div>
          )}

          {loadingShap && (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px" }}>
              <div className="shimmer" style={{ height: 120, background: C.border, borderRadius: 8, marginBottom: 12 }} />
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="shimmer" style={{ height: 38, background: C.border, borderRadius: 6, marginBottom: 6 }} />
              ))}
            </div>
          )}

          {shapData && !loadingShap && (
            <div className="fade-up">
              {/* Person header */}
              <div style={{
                background: C.panel, border: `1px solid ${riskColor}44`,
                borderRadius: 12, padding: "20px 22px", marginBottom: 12,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textDim, textTransform: "uppercase", marginBottom: 6 }}>
                      Person #{String(shapData.person_id).padStart(4, "0")}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: riskColor }}>{shapData.risk_label}</div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 5 }}>
                      {shapData.demographics.race} · Age {shapData.demographics.age} · {shapData.demographics.sex}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 44, fontWeight: 700, color: riskColor, lineHeight: 1 }}>
                      {Math.round(shapData.predicted_prob * 100)}%
                    </div>
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>predicted risk</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
                  <StatCard label="Base rate"  value={shapData.base_value.toFixed(3)} />
                  <StatCard label="Top driver" value={shapData.top_driver} />
                  <StatCard
                    label="Protected ±"
                    value={shapData.protected_influence.toFixed(3)}
                    warn={shapData.protected_influence > 0.05}
                  />
                </div>

                {shapData.protected_influence > 0.05 && (
                  <div style={{
                    marginTop: 12, padding: "9px 12px",
                    background: C.warnDim, border: `1px solid ${C.warn}44`,
                    borderRadius: 8, fontSize: 11, color: C.warn, lineHeight: 1.6,
                  }}>
                    Race and sex contributed <strong>±{shapData.protected_influence.toFixed(3)}</strong> SHAP
                    units — protected attributes should not influence risk scores.
                  </div>
                )}
              </div>

              {/* Waterfall */}
              <div style={{
                background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: "20px 22px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textDim, textTransform: "uppercase" }}>
                    Feature contributions
                  </div>
                  <div style={{ display: "flex", gap: 14 }}>
                    {[
                      { color: C.danger, label: "Increases risk" },
                      { color: C.accent, label: "Reduces risk" },
                      { color: C.warn,   label: "Protected", dot: true },
                    ].map(({ color, label, dot }) => (
                      <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{
                          width: dot ? 7 : 10, height: dot ? 7 : 10,
                          borderRadius: dot ? "50%" : 2,
                          background: color, display: "inline-block", flexShrink: 0,
                        }} />
                        <span style={{ color: C.textDim, fontSize: 10 }}>{label}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{
                  display: "grid", gridTemplateColumns: "148px 1fr 58px",
                  gap: 10, paddingBottom: 8,
                  borderBottom: `1px solid ${C.borderMid}`, marginBottom: 2,
                }}>
                  <div style={{ fontSize: 10, color: C.textDim }}>FEATURE / VALUE</div>
                  <div style={{ fontSize: 10, color: C.textDim, textAlign: "center" }}>← SAFE · · · RISK →</div>
                  <div style={{ fontSize: 10, color: C.textDim, textAlign: "right" }}>SHAP</div>
                </div>

                {shapData.waterfall.map((entry, i) => (
                  <WaterfallBar key={entry.feature} entry={entry} maxAbs={maxAbs} index={i} />
                ))}

                {/* Final score */}
                <div style={{
                  marginTop: 10, paddingTop: 12,
                  borderTop: `1px solid ${C.borderMid}`,
                  display: "grid", gridTemplateColumns: "148px 1fr 58px",
                  gap: 10, alignItems: "center",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Final score</div>
                  <div style={{ height: 6, borderRadius: 3, overflow: "hidden", background: C.border }}>
                    <div style={{
                      width: `${Math.round(shapData.predicted_prob * 100)}%`,
                      height: "100%", background: riskColor,
                      borderRadius: 3, transition: "width 0.5s ease",
                    }} />
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: riskColor, textAlign: "right",
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