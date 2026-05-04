import { useState, useEffect, useCallback, useMemo } from "react";
import { Treemap, ResponsiveContainer } from "recharts";
import { SP500_STOCKS } from "../../data/sp500Stocks";

// ── Colour scale ──────────────────────────────────────────────────────────────
function changePctColor(pct) {
  if (pct == null) return "#1e293b";
  if (pct >=  3)   return "#047857";
  if (pct >=  1.5) return "#059669";
  if (pct >=  0.5) return "#10b981";
  if (pct >=  0)   return "#14301f";
  if (pct > -0.5)  return "#4c1d2a";
  if (pct > -1.5)  return "#e11d48";
  if (pct > -3)    return "#be123c";
  return "#9f1239";
}
function textColor(bg) {
  // Lighter text on dark/mid backgrounds
  if (bg === "#14301f" || bg === "#4c1d2a") return "#94a3b8";
  return "#fff";
}

const SECTOR_ORDER = [
  "Technology","Healthcare","Financials","Communication",
  "Consumer Discretionary","Industrials","Consumer Staples",
  "Energy","Materials","Utilities","Real Estate",
];

// ── Custom treemap cell ───────────────────────────────────────────────────────
function HeatCell({ x, y, width, height, ticker, name, changePct, onSelect }) {
  const bg    = changePctColor(changePct);
  const fg    = textColor(bg);
  const small = width < 50 || height < 30;
  const tiny  = width < 32 || height < 20;

  if (tiny) {
    return (
      <rect x={x} y={y} width={width} height={height}
        fill={bg} stroke="#0f172a" strokeWidth={1}
        style={{ cursor:"pointer" }}
        onClick={() => onSelect(ticker)}
      />
    );
  }

  return (
    <g onClick={() => onSelect(ticker)} style={{ cursor:"pointer" }}>
      <rect x={x} y={y} width={width} height={height}
        fill={bg} stroke="#0f172a" strokeWidth={1}
        rx={2}
      />
      {!small && (
        <text x={x + width / 2} y={y + height / 2 - 7}
          textAnchor="middle" dominantBaseline="middle"
          fill={fg} fontSize={Math.min(14, width / 4)}
          fontFamily="'IBM Plex Mono',monospace" fontWeight={700}>
          {ticker}
        </text>
      )}
      {!small && (
        <text x={x + width / 2} y={y + height / 2 + 9}
          textAnchor="middle" dominantBaseline="middle"
          fill={fg} fontSize={Math.min(10, width / 6)} opacity={0.8}
          fontFamily="'IBM Plex Mono',monospace">
          {changePct != null ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : "—"}
        </text>
      )}
      {small && (
        <text x={x + width / 2} y={y + height / 2}
          textAnchor="middle" dominantBaseline="middle"
          fill={fg} fontSize={Math.min(10, width / 3.5)}
          fontFamily="'IBM Plex Mono',monospace" fontWeight={700}>
          {ticker}
        </text>
      )}
    </g>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function HoverTooltip({ stock, quote, pos }) {
  if (!stock) return null;
  const q = quote || {};
  const pct = q.changePct;
  const color = changePctColor(pct);
  return (
    <div style={{
      position:"fixed", left: pos.x + 14, top: pos.y - 10,
      background:"var(--surface-2)", border:"1px solid var(--border)",
      borderRadius:8, padding:"8px 12px", pointerEvents:"none", zIndex:9999,
      fontFamily:"'IBM Plex Mono',monospace", minWidth:180,
      boxShadow:"0 8px 24px rgba(0,0,0,0.5)",
    }}>
      <div style={{ fontWeight:700, color:"#e2e8f0", fontSize:13 }}>{stock.ticker}</div>
      <div style={{ color:"var(--text-3)", fontSize:10, marginBottom:6 }}>{stock.name}</div>
      {q.price != null && (
        <div style={{ display:"flex", justifyContent:"space-between", gap:16 }}>
          <span style={{ color:"var(--text-1)", fontSize:12 }}>${q.price?.toFixed(2)}</span>
          <span style={{ color, fontSize:12, fontWeight:700 }}>
            {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}
          </span>
        </div>
      )}
      {q.marketCap != null && (
        <div style={{ color:"var(--text-3)", fontSize:10, marginTop:4 }}>
          Mkt Cap: ${(q.marketCap / 1e9).toFixed(0)}B
        </div>
      )}
      <div style={{ color:"var(--text-3)", fontSize:9, marginTop:4 }}>
        {stock.sector}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MarketHeatmap({ onOpenResearch, onContextUpdate }) {
  const [quotes, setQuotes]           = useState({});
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastUpdate, setLastUpdate]   = useState(null);
  const [activeSector, setActiveSector] = useState("All");
  const [hovered, setHovered]         = useState(null);  // { ticker, pos }
  const [sortBy, setSortBy]           = useState("marketCap"); // "marketCap" | "changePct" | "alpha"

  const fetchQuotes = useCallback(async () => {
    try {
      const r = await fetch("/api/chart?type=heatmap");
      if (!r.ok) throw new Error("API error");
      const d = await r.json();
      setQuotes(d.quotes || {});
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError("Failed to load market data — retrying…");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
    const id = setInterval(fetchQuotes, 60_000);
    return () => clearInterval(id);
  }, [fetchQuotes]);

  useEffect(() => {
    if (onContextUpdate) onContextUpdate({ page: "heatmap", description: "S&P 500 Market Heatmap" });
  }, [onContextUpdate]);

  // Filter + sort stocks
  const displayStocks = useMemo(() => {
    let list = activeSector === "All"
      ? SP500_STOCKS
      : SP500_STOCKS.filter(s => s.sector === activeSector);

    if (sortBy === "changePct") {
      list = [...list].sort((a, b) => {
        const pa = quotes[a.ticker]?.changePct ?? -999;
        const pb = quotes[b.ticker]?.changePct ?? -999;
        return pb - pa;
      });
    } else if (sortBy === "alpha") {
      list = [...list].sort((a, b) => a.ticker.localeCompare(b.ticker));
    }
    // "marketCap" — natural order from SP500_STOCKS (already sorted desc)

    return list;
  }, [activeSector, sortBy, quotes]);

  // Build treemap data grouped by sector
  const treemapData = useMemo(() => {
    const sectorMap = {};
    for (const s of displayStocks) {
      if (!sectorMap[s.sector]) sectorMap[s.sector] = [];
      sectorMap[s.sector].push(s);
    }

    const children = SECTOR_ORDER
      .filter(sec => activeSector === "All" ? sectorMap[sec] : sec === activeSector)
      .map(sec => {
        const stocks = sectorMap[sec] || [];
        return {
          name: sec,
          children: stocks.map(s => ({
            name: s.ticker,
            size: Math.max(s.marketCap, 1),
            ticker: s.ticker,
            fullName: s.name,
            sector: s.sector,
            changePct: quotes[s.ticker]?.changePct ?? null,
          })),
        };
      })
      .filter(sec => sec.children.length > 0);

    return { name: "S&P 500", children };
  }, [displayStocks, quotes, activeSector]);

  // Summary stats
  const stats = useMemo(() => {
    const vals = SP500_STOCKS
      .map(s => quotes[s.ticker]?.changePct)
      .filter(v => v != null);
    if (!vals.length) return null;
    const advancing = vals.filter(v => v > 0).length;
    const declining = vals.filter(v => v < 0).length;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return { advancing, declining, avg, total: vals.length };
  }, [quotes]);

  // Custom treemap content renderer
  const renderContent = useCallback((props) => {
    const { x, y, width, height, depth, name } = props;
    if (depth === 0) return null; // root node

    // Sector label row
    if (depth === 1) {
      if (width < 40) return null;
      return (
        <g>
          <rect x={x} y={y} width={width} height={height} fill="transparent" />
          <text x={x + 4} y={y + 13}
            fill="#64748b" fontSize={9}
            fontFamily="'IBM Plex Mono',monospace"
            fontWeight={700} textTransform="uppercase"
            style={{ letterSpacing: "0.08em" }}>
            {name}
          </text>
        </g>
      );
    }

    // Stock leaf
    const { ticker, changePct } = props;
    return (
      <HeatCell
        x={x} y={y} width={width} height={height}
        ticker={ticker || name}
        changePct={changePct}
        onSelect={(t) => {
          const stock = SP500_STOCKS.find(s => s.ticker === t);
          if (onOpenResearch && stock) {
            onOpenResearch({ type: "equity", ticker: t, label: stock.name });
          }
        }}
      />
    );
  }, [onOpenResearch]);

  // ── Render ──
  const sectors = ["All", ...SECTOR_ORDER];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "12px 16px", gap: 10, overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: 14, color: "var(--text-1)" }}>
            🌡️ S&amp;P 500 Heatmap
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : "Loading…"} · sized by market cap · colored by day change
          </div>
        </div>

        {/* Stats pill */}
        {stats && (
          <div style={{ display: "flex", gap: 12, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>
            <span style={{ color: "#10b981" }}>▲ {stats.advancing}</span>
            <span style={{ color: "#e11d48" }}>▼ {stats.declining}</span>
            <span style={{ color: stats.avg >= 0 ? "#10b981" : "#e11d48", fontWeight: 700 }}>
              avg {stats.avg >= 0 ? "+" : ""}{stats.avg.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Colour legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {[
          ["#047857",">+3%"], ["#059669","+1.5%"], ["#10b981","+0.5%"], ["#14301f","0%"],
          ["#4c1d2a","0%"], ["#e11d48","-0.5%"], ["#be123c","-1.5%"], ["#9f1239","<-3%"],
        ].map(([c, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "var(--text-3)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
        {/* Sector pills */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
          {sectors.map(sec => (
            <button key={sec} onClick={() => setActiveSector(sec)}
              style={{
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 10,
                padding: "3px 9px", borderRadius: 20,
                border: "1px solid " + (activeSector === sec ? "#2563eb" : "var(--border)"),
                background: activeSector === sec ? "#1e3a6e" : "var(--surface-1)",
                color: activeSector === sec ? "#93c5fd" : "var(--text-3)",
                cursor: "pointer", whiteSpace: "nowrap",
              }}>
              {sec === "All" ? "All Sectors" : sec}
            </button>
          ))}
        </div>
        {/* Sort */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {[["marketCap","Cap"],["changePct","Change"],["alpha","A→Z"]].map(([k,label]) => (
            <button key={k} onClick={() => setSortBy(k)}
              style={{
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 10,
                padding: "3px 8px", borderRadius: 4,
                border: "1px solid " + (sortBy === k ? "#7c3aed" : "var(--border)"),
                background: sortBy === k ? "rgba(124,58,237,0.15)" : "var(--surface-1)",
                color: sortBy === k ? "#c4b5fd" : "var(--text-3)",
                cursor: "pointer",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#e11d48",
          background: "rgba(225,29,72,0.06)", border: "1px solid rgba(225,29,72,0.18)",
          borderRadius: 6, padding: "8px 12px", flexShrink: 0 }}>
          ⚠ {error}
        </div>
      )}

      {/* Heatmap */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}
        onMouseMove={e => {
          if (hovered) setHovered(h => h ? { ...h, pos: { x: e.clientX, y: e.clientY } } : null);
        }}
        onMouseLeave={() => setHovered(null)}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%",
            fontFamily: "'IBM Plex Mono',monospace", color: "var(--text-3)", fontSize: 12 }}>
            Loading market data…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treemapData.children}
              dataKey="size"
              aspectRatio={4 / 3}
              isAnimationActive={false}
              content={renderContent}
            />
          </ResponsiveContainer>
        )}
      </div>

      {/* Tooltip */}
      {hovered && (
        <HoverTooltip
          stock={SP500_STOCKS.find(s => s.ticker === hovered.ticker)}
          quote={quotes[hovered.ticker]}
          pos={hovered.pos}
        />
      )}
    </div>
  );
}
