import { useState, useEffect, useCallback } from "react";
import { InsightChip } from "../../components/InsightChip";

const COL_W = { rank: 32, ticker: 72, name: 180, price: 80, pct: 80 };

function MoversTable({ title, data, loading, color, bgHeader, onRowClick }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", border: "1px solid var(--border-solid, #334155)", borderRadius: 6, overflow: "hidden", fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* Sheet-style header */}
      <div style={{ background: bgHeader, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid var(--border-solid, #334155)" }}>
        <span style={{ fontWeight: 700, fontSize: 12, color, letterSpacing: "0.04em" }}>{title}</span>
        {!loading && data.length > 0 && (
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>Top 10 by day %</span>
        )}
      </div>

      {/* Column headers */}
      <div style={{ display: "flex", background: "var(--surface-1)", borderBottom: "1px solid var(--border-solid, #334155)" }}>
        {[["#", COL_W.rank], ["Ticker", COL_W.ticker], ["Name", COL_W.name], ["Price", COL_W.price], ["Chg %", COL_W.pct]].map(([label, w]) => (
          <div key={label} style={{ width: w, flexShrink: 0, padding: "5px 8px", fontSize: 9, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", borderRight: "1px solid var(--border-solid, #334155)", textAlign: label === "#" ? "center" : label === "Price" || label === "Chg %" ? "right" : "left" }}>
            {label}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: "auto", background: "var(--surface-0)" }}>
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ display: "flex", borderBottom: "1px solid var(--border, #1e293b)", padding: "6px 0" }}>
              {[COL_W.rank, COL_W.ticker, COL_W.name, COL_W.price, COL_W.pct].map((w, j) => (
                <div key={j} style={{ width: w, flexShrink: 0, padding: "0 8px" }}>
                  <div style={{ height: 8, borderRadius: 3, background: "var(--surface-2)", width: j === 2 ? "70%" : "60%" }} />
                </div>
              ))}
            </div>
          ))
        ) : data.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 11 }}>No data available</div>
        ) : (
          data.map((row, i) => (
            <div key={row.symbol} style={{
              display: "flex", alignItems: "center",
              borderBottom: "1px solid var(--border, #1e293b)",
              background: "var(--surface-0)",
              transition: "background 0.1s",
              cursor: onRowClick ? "pointer" : "default",
            }}
              onClick={() => onRowClick && onRowClick(row)}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--surface-0)"}
            >
              {/* Rank */}
              <div style={{ width: COL_W.rank, flexShrink: 0, padding: "7px 8px", textAlign: "center", fontSize: 10, color: "var(--text-3)", borderRight: "1px solid var(--border, #1e293b)" }}>
                {i + 1}
              </div>
              {/* Ticker */}
              <div style={{ width: COL_W.ticker, flexShrink: 0, padding: "7px 8px", fontSize: 11, fontWeight: 700, color, borderRight: "1px solid var(--border, #1e293b)" }}>
                {row.symbol}
              </div>
              {/* Name */}
              <div style={{ width: COL_W.name, flexShrink: 0, padding: "7px 8px", fontSize: 10, color: "var(--text-2)", borderRight: "1px solid var(--border, #1e293b)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.name}
              </div>
              {/* Price */}
              <div style={{ width: COL_W.price, flexShrink: 0, padding: "7px 8px", fontSize: 11, color: "var(--text-1)", textAlign: "right", borderRight: "1px solid var(--border, #1e293b)" }}>
                ${row.price?.toFixed(2)}
              </div>
              {/* Chg % */}
              <div style={{ width: COL_W.pct, flexShrink: 0, padding: "7px 8px", fontSize: 11, textAlign: "right", fontWeight: 700 }}>
                <span style={{
                  background: row.changePct >= 0 ? "rgba(5,150,105,0.15)" : "rgba(225,29,72,0.15)",
                  color,
                  borderRadius: 4,
                  padding: "2px 6px",
                }}>
                  {row.changePct >= 0 ? "+" : ""}{row.changePct?.toFixed(2)}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function DayMovers({ onOpenResearch, onContextUpdate }) {
  const [gainers, setGainers] = useState([]);
  const [losers,  setLosers]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const fetchMovers = useCallback(async () => {
    try {
      const [gRes, lRes] = await Promise.all([
        fetch("/api/chart?type=gainers"),
        fetch("/api/chart?type=losers"),
      ]);
      const [gData, lData] = await Promise.all([gRes.json(), lRes.json()]);
      setGainers(gData.data || []);
      setLosers(lData.data  || []);
      setLastUpdate(new Date());
      setError(null);
    } catch {
      setError("Failed to load — retrying…");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovers();
    const id = setInterval(fetchMovers, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchMovers]);

  useEffect(() => {
    if (onContextUpdate) onContextUpdate({ page: "movers", description: "Day Gainers & Losers" });
  }, [onContextUpdate]);

  const handleRowClick = useCallback((row) => {
    if (onOpenResearch) {
      onOpenResearch({ id: row.symbol, label: row.name, type: "equity", ticker: row.symbol, category: "Equity" });
    }
  }, [onOpenResearch]);

  const insightCtx = gainers.length > 0 && losers.length > 0
    ? `Top gainers: ${gainers.slice(0, 3).map(s => `${s.symbol} +${s.changePct?.toFixed(2)}%`).join(', ')}. Top losers: ${losers.slice(0, 3).map(s => `${s.symbol} ${s.changePct?.toFixed(2)}%`).join(', ')}.`
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "12px 16px", gap: 10, overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: 14, color: "var(--text-1)" }}>
            Day Gainers &amp; Losers
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : "Loading…"} · Top 10 by % change · 5 min refresh
          </div>
        </div>
        <button onClick={fetchMovers} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", color: "var(--text-3)", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, cursor: "pointer" }}>
          ↻ Refresh
        </button>
      </div>

      {/* Insight chip */}
      <InsightChip page="movers" context={insightCtx} style={{ flexShrink: 0 }} />

      {/* Error */}
      {error && (
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#e11d48", background: "rgba(225,29,72,0.06)", border: "1px solid rgba(225,29,72,0.18)", borderRadius: 6, padding: "8px 12px", flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Tables */}
      <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
        <MoversTable
          title="▲ Top Gainers"
          data={gainers}
          loading={loading}
          color="#059669"
          bgHeader="rgba(5,150,105,0.08)"
          onRowClick={handleRowClick}
        />
        <MoversTable
          title="▼ Top Losers"
          data={losers}
          loading={loading}
          color="#e11d48"
          bgHeader="rgba(225,29,72,0.08)"
          onRowClick={handleRowClick}
        />
      </div>
    </div>
  );
}
