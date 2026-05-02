/**
 * IntelCard — renders AI-generated intelligence cards for any financial asset.
 *
 * Fields (all AI-generated via /api/intel):
 *   whatThisIs       — plain-English explanation of the asset
 *   currentNarrative — current market narrative and price drivers
 *   keyRisks[]       — array of concise risk factors
 *   bullCase         — conditions for upside
 *   bearCase         — conditions for downside
 */
export function IntelCard({ intel, loading, error, onRefresh, accentColor = "#b45309" }) {
  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2" style={{ padding: "12px 0" }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: "#2563eb",
            display: "inline-block", flexShrink: 0,
            animation: "ov-pulse 1.4s ease-in-out infinite",
          }} />
          <span className="font-mono" style={{ color: "var(--text-3)", fontSize: 10 }}>
            Generating AI intelligence…
          </span>
        </div>
        {/* Shimmer skeleton */}
        {[80, 100, 55, 90, 70].map((w, i) => (
          <div key={i} style={{
            height: 10, width: w + "%", borderRadius: 4,
            background: "var(--surface-3)", opacity: 0.6,
            animation: `ov-shimmer 1.6s ease-in-out ${i * 0.12}s infinite alternate`,
          }} />
        ))}
        <style>{`
          @keyframes ov-pulse {
            0%,100% { opacity:1; transform:scale(1); }
            50%      { opacity:0.4; transform:scale(0.7); }
          }
          @keyframes ov-shimmer {
            from { opacity:0.35; }
            to   { opacity:0.7; }
          }
        `}</style>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{
        background: "rgba(225,29,72,0.05)", border: "1px solid rgba(225,29,72,0.2)",
        borderRadius: 6, padding: "12px 14px",
      }}>
        <div className="font-mono" style={{ color: "#e11d48", fontSize: 11, marginBottom: 8 }}>
          ⚠ {error}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="font-mono"
            style={{
              background: "none", border: "1px solid rgba(225,29,72,0.3)", borderRadius: 4,
              color: "#e11d48", fontSize: 10, padding: "3px 10px", cursor: "pointer",
            }}
          >
            ↺ Retry
          </button>
        )}
      </div>
    );
  }

  // ── No data yet ────────────────────────────────────────────────────────────
  if (!intel) return null;

  return (
    <div className="flex flex-col gap-4">

      {/* What This Is */}
      <div>
        <div className="font-mono mb-1" style={{
          color: "var(--text-3)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          What This Is
        </div>
        <p className="font-mono" style={{ color: "var(--text-1)", fontSize: 11, lineHeight: 1.75, margin: 0 }}>
          {intel.whatThisIs}
        </p>
      </div>

      {/* Current Narrative */}
      <div>
        <div className="font-mono mb-1" style={{
          color: accentColor, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          Current Narrative
        </div>
        <p className="font-mono" style={{ color: "var(--text-1)", fontSize: 11, lineHeight: 1.75, margin: 0 }}>
          {intel.currentNarrative}
        </p>
      </div>

      {/* Key Risk Factors */}
      {Array.isArray(intel.keyRisks) && intel.keyRisks.length > 0 && (
        <div>
          <div className="font-mono mb-2" style={{
            color: "var(--text-3)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            Key Risk Factors
          </div>
          <div className="flex flex-col gap-1">
            {intel.keyRisks.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="font-mono flex-shrink-0" style={{ color: "#e11d48", fontSize: 10, marginTop: 1 }}>▸</span>
                <span className="font-mono" style={{ color: "var(--text-2)", fontSize: 10, lineHeight: 1.65 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bull Case / Bear Case */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div style={{
          background: "rgba(5,150,105,0.05)", border: "1px solid rgba(5,150,105,0.2)",
          borderRadius: 6, padding: "10px 12px",
        }}>
          <div className="font-mono mb-1.5" style={{
            color: "#059669", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            ▲ Bull Case
          </div>
          <p className="font-mono" style={{ color: "var(--text-1)", fontSize: 10, lineHeight: 1.65, margin: 0 }}>
            {intel.bullCase}
          </p>
        </div>
        <div style={{
          background: "rgba(225,29,72,0.05)", border: "1px solid rgba(225,29,72,0.2)",
          borderRadius: 6, padding: "10px 12px",
        }}>
          <div className="font-mono mb-1.5" style={{
            color: "#e11d48", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            ▼ Bear Case
          </div>
          <p className="font-mono" style={{ color: "var(--text-1)", fontSize: 10, lineHeight: 1.65, margin: 0 }}>
            {intel.bearCase}
          </p>
        </div>
      </div>

      {/* AI badge + refresh */}
      <div className="flex items-center justify-between" style={{ paddingTop: 4, borderTop: "1px solid rgba(15,23,42,0.08)" }}>
        <span className="font-mono" style={{ color: "var(--text-3)", fontSize: 9 }}>
          ✦ AI-generated · cached 1h
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="font-mono"
            style={{
              background: "none", border: "none", color: "var(--text-3)", fontSize: 9,
              cursor: "pointer", padding: "2px 6px", borderRadius: 4,
            }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text-1)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}
          >
            ↺ Regenerate
          </button>
        )}
      </div>
    </div>
  );
}
