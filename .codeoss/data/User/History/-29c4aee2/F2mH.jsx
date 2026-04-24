import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell, CartesianGrid
} from "recharts";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_URL = "https://your-cloud-run-url.a.run.app"; // ← replace with your Cloud Run URL
const DEBOUNCE_MS = 320;

// ─── MOCK DATA (used when API is unreachable) ─────────────────────────────────
function getMockData(threshold) {
  const t = threshold;
  return {
    threshold: t,
    disparate_impact_ratio: Math.max(0.1, Math.min(1.2, 0.314 + (t - 0.5) * 1.1)),
    white_approval_rate:    Math.max(0.05, Math.min(0.98, 0.72 - t * 0.45)),
    black_approval_rate:    Math.max(0.02, Math.min(0.95, 0.38 - t * 0.55)),
    hispanic_approval_rate: Math.max(0.03, Math.min(0.96, 0.51 - t * 0.50)),
    asian_approval_rate:    Math.max(0.04, Math.min(0.97, 0.68 - t * 0.46)),
    pass: (0.314 + (t - 0.5) * 1.1) >= 0.8,
  };
}

// ─── COLOURS ──────────────────────────────────────────────────────────────────
const PALETTE = {
  bg:        "#0A0D12",
  panel:     "#111520",
  border:    "#1E2535",
  accent:    "#00E5A0",
  accentDim: "#00E5A022",
  danger:    "#FF4B6E",
  dangerDim: "#FF4B6E22",
  warn:      "#FFB547",
  muted:     "#4A5568",
  text:      "#E2E8F0",
  textDim:   "#718096",
  white:     "#FFFFFF",
};

const GROUP_COLORS = {
  "White":    "#00E5A0",
  "Black":    "#FF4B6E",
  "Hispanic": "#FFB547",
  "Asian":    "#7B8FF5",
};

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div style={{
      background: PALETTE.panel,
      border: `1px solid ${PALETTE.border}`,
      borderRadius: 8,
      padding: "10px 14px",
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <div style={{ color: PALETTE.textDim, fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ color: GROUP_COLORS[label] || PALETTE.accent, fontSize: 20, fontWeight: 700 }}>
        {(val * 100).toFixed(1)}%
      </div>
      <div style={{ color: PALETTE.textDim, fontSize: 11, marginTop: 2 }}>approval rate</div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function WhatIfSimulator() {
  const [threshold, setThreshold]   = useState(0.5);
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [isMock, setIsMock]         = useState(false);
  const [prevDir, setPrevDir]       = useState(null);
  const debounceRef                 = useRef(null);

  const fetchAudit = useCallback(async (t) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/audit?threshold=${t}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPrevDir(data?.disparate_impact_ratio ?? null);
      setData(json);
      setIsMock(false);
    } catch {
      const mock = getMockData(t);
      setPrevDir(data?.disparate_impact_ratio ?? null);
      setData(mock);
      setIsMock(true);
      setError("API unreachable — showing simulated data");
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchAudit(threshold), DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [threshold]);

  // Chart data
  const chartData = data ? [
    { group: "White",    rate: data.white_approval_rate },
    { group: "Black",    rate: data.black_approval_rate },
    { group: "Hispanic", rate: data.hispanic_approval_rate },
    { group: "Asian",    rate: data.asian_approval_rate ?? 0.65 },
  ] : [];

  const dir         = data?.disparate_impact_ratio ?? 0;
  const pass        = dir >= 0.8;
  const dirDelta    = prevDir !== null ? dir - prevDir : 0;
  const statusColor = pass ? PALETTE.accent : PALETTE.danger;
  const statusBg    = pass ? PALETTE.accentDim : PALETTE.dangerDim;

  return (
    <div style={{
      background: PALETTE.bg,
      minHeight: "100vh",
      fontFamily: "'IBM Plex Mono', monospace",
      color: PALETTE.text,
      padding: "40px 32px",
      boxSizing: "border-box",
    }}>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .slider-track {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
          background: linear-gradient(
            to right,
            ${PALETTE.accent} 0%,
            ${PALETTE.accent} calc(${((threshold - 0.1) / 0.8) * 100}%),
            ${PALETTE.border} calc(${((threshold - 0.1) / 0.8) * 100}%),
            ${PALETTE.border} 100%
          );
        }
        .slider-track::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px; height: 20px;
          border-radius: 50%;
          background: ${PALETTE.white};
          border: 3px solid ${PALETTE.accent};
          cursor: grab;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .slider-track::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.2);
          box-shadow: 0 0 0 6px ${PALETTE.accentDim};
        }
        .slider-track::-moz-range-thumb {
          width: 20px; height: 20px;
          border-radius: 50%;
          background: ${PALETTE.white};
          border: 3px solid ${PALETTE.accent};
          cursor: grab;
        }

        @keyframes pulse-pass {
          0%,100% { box-shadow: 0 0 0 0 ${PALETTE.accent}40; }
          50%      { box-shadow: 0 0 0 8px ${PALETTE.accent}00; }
        }
        @keyframes pulse-fail {
          0%,100% { box-shadow: 0 0 0 0 ${PALETTE.danger}40; }
          50%      { box-shadow: 0 0 0 8px ${PALETTE.danger}00; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.3s ease forwards; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{
          fontSize: 11, letterSpacing: "0.2em", color: PALETTE.textDim,
          textTransform: "uppercase", marginBottom: 8,
        }}>
          Unbiased AI · What-If Simulator
        </div>
        <h1 style={{
          fontSize: 26, fontWeight: 700, color: PALETTE.white,
          lineHeight: 1.2,
        }}>
          Decision threshold<br />
          <span style={{ color: PALETTE.accent }}>impact analysis</span>
        </h1>
        <p style={{ fontSize: 13, color: PALETTE.textDim, marginTop: 10, lineHeight: 1.6 }}>
          Drag the slider to adjust the model's decision threshold. See in real time
          how each group's approval rate and the disparate impact ratio respond.
        </p>
      </div>

      {/* ── Mock warning ── */}
      {isMock && (
        <div style={{
          background: "#2D1F0A", border: `1px solid ${PALETTE.warn}44`,
          borderRadius: 8, padding: "8px 14px",
          fontSize: 12, color: PALETTE.warn, marginBottom: 20,
        }}>
          {error} — connect your Cloud Run URL in <code>API_URL</code>
        </div>
      )}

      {/* ── Slider panel ── */}
      <div style={{
        background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
        borderRadius: 12, padding: "24px 28px", marginBottom: 20,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 11, color: PALETTE.textDim, marginBottom: 4, letterSpacing: "0.1em" }}>
              THRESHOLD
            </div>
            <div style={{ fontSize: 44, fontWeight: 700, color: PALETTE.white, lineHeight: 1 }}>
              {threshold.toFixed(2)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: PALETTE.textDim, letterSpacing: "0.1em", marginBottom: 4 }}>
              BIAS VERDICT
            </div>
            <div style={{
              fontSize: 13, fontWeight: 600,
              background: statusBg, color: statusColor,
              padding: "5px 14px", borderRadius: 20,
              border: `1px solid ${statusColor}44`,
              animation: `${pass ? "pulse-pass" : "pulse-fail"} 2.5s ease infinite`,
              display: "inline-block",
            }}>
              {loading ? "···" : pass ? "PASS  4/5ths" : "FAIL  4/5ths"}
            </div>
          </div>
        </div>

        <input
          type="range" min="0.1" max="0.9" step="0.01"
          value={threshold}
          onChange={e => setThreshold(parseFloat(e.target.value))}
          className="slider-track"
        />

        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 11, color: PALETTE.muted, marginTop: 8,
        }}>
          <span>0.10 — lenient</span>
          <span>0.50 — neutral</span>
          <span>0.90 — strict</span>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 12, marginBottom: 20,
      }}>
        {/* DIR */}
        <div style={{
          background: PALETTE.panel, border: `1px solid ${pass ? PALETTE.accent + "44" : PALETTE.danger + "44"}`,
          borderRadius: 12, padding: "18px 20px",
        }}>
          <div style={{ fontSize: 11, color: PALETTE.textDim, letterSpacing: "0.1em", marginBottom: 8 }}>
            DIR SCORE
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: statusColor, lineHeight: 1 }}>
            {loading ? "—" : dir.toFixed(3)}
          </div>
          {dirDelta !== 0 && !loading && (
            <div style={{
              fontSize: 11, color: dirDelta > 0 ? PALETTE.accent : PALETTE.danger,
              marginTop: 6,
            }} className="fade-up">
              {dirDelta > 0 ? "▲" : "▼"} {Math.abs(dirDelta).toFixed(3)} from last
            </div>
          )}
          <div style={{ fontSize: 11, color: PALETTE.muted, marginTop: 4 }}>
            target ≥ 0.800
          </div>
        </div>

        {/* Gap to target */}
        <div style={{
          background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
          borderRadius: 12, padding: "18px 20px",
        }}>
          <div style={{ fontSize: 11, color: PALETTE.textDim, letterSpacing: "0.1em", marginBottom: 8 }}>
            GAP TO PASS
          </div>
          <div style={{
            fontSize: 32, fontWeight: 700, lineHeight: 1,
            color: pass ? PALETTE.accent : PALETTE.warn,
          }}>
            {loading ? "—" : pass ? "0.000" : (0.8 - dir).toFixed(3)}
          </div>
          <div style={{ fontSize: 11, color: PALETTE.muted, marginTop: 10 }}>
            {pass ? "already passing" : "points needed"}
          </div>
        </div>

        {/* Threshold label */}
        <div style={{
          background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
          borderRadius: 12, padding: "18px 20px",
        }}>
          <div style={{ fontSize: 11, color: PALETTE.textDim, letterSpacing: "0.1em", marginBottom: 8 }}>
            REGIME
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700, lineHeight: 1, color: PALETTE.white,
          }}>
            {threshold < 0.35 ? "Lenient"
              : threshold < 0.55 ? "Balanced"
              : threshold < 0.75 ? "Moderate"
              : "Strict"}
          </div>
          <div style={{ fontSize: 11, color: PALETTE.muted, marginTop: 10 }}>
            {threshold < 0.35 ? "high approval overall"
              : threshold < 0.55 ? "neutral territory"
              : threshold < 0.75 ? "tighter decisions"
              : "restrictive — high risk of bias"}
          </div>
        </div>
      </div>

      {/* ── Bar chart ── */}
      <div style={{
        background: PALETTE.panel, border: `1px solid ${PALETTE.border}`,
        borderRadius: 12, padding: "24px 28px", marginBottom: 20,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 11, color: PALETTE.textDim, letterSpacing: "0.1em" }}>
              APPROVAL RATES BY DEMOGRAPHIC
            </div>
          </div>
          {loading && (
            <div style={{
              width: 16, height: 16, borderRadius: "50%",
              border: `2px solid ${PALETTE.accent}`,
              borderTopColor: "transparent",
              animation: "spin 0.7s linear infinite",
            }} />
          )}
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={PALETTE.border} strokeDasharray="3 3" />
            <XAxis
              dataKey="group"
              tick={{ fill: PALETTE.textDim, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={v => `${Math.round(v * 100)}%`}
              tick={{ fill: PALETTE.textDim, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: PALETTE.border + "88" }} />
            <ReferenceLine
              y={0.8} stroke={PALETTE.warn} strokeDasharray="5 4" strokeWidth={1.5}
              label={{
                value: "4/5ths rule  0.80",
                position: "insideTopRight",
                fill: PALETTE.warn, fontSize: 10,
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            />
            <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={64}>
              {chartData.map(entry => (
                <Cell
                  key={entry.group}
                  fill={GROUP_COLORS[entry.group] || PALETTE.accent}
                  fillOpacity={loading ? 0.4 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div style={{
          display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap",
        }}>
          {Object.entries(GROUP_COLORS).map(([g, c]) => (
            <div key={g} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
              <span style={{ fontSize: 11, color: PALETTE.textDim }}>{g}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Interpretation strip ── */}
      <div style={{
        background: pass ? PALETTE.accentDim : PALETTE.dangerDim,
        border: `1px solid ${statusColor}33`,
        borderRadius: 12, padding: "16px 22px",
        fontSize: 13, color: statusColor, lineHeight: 1.7,
      }}>
        {loading
          ? "Recalculating..."
          : pass
            ? `At threshold ${threshold.toFixed(2)}, the model meets the 4/5ths rule (DIR = ${dir.toFixed(3)}). The least-approved group is within acceptable range of the most-approved group.`
            : `At threshold ${threshold.toFixed(2)}, the model fails the 4/5ths rule (DIR = ${dir.toFixed(3)}). The least-approved group receives approval at less than 80% of the rate of the highest-approved group — a legally significant disparity.`
        }
      </div>
    </div>
  );
}