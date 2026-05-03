import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceArea } from "recharts";
import { api } from "../../lib/api";
import { fmt, clr, delay } from "../../lib/fmt";
import { PF_COLORS, SECTOR_CLR } from "../../lib/constants";
import { SCREENER_UNIVERSE } from "../../screenerData";
import { MdText } from "../../components/ui/MdText";
import { db } from "../../lib/db";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { startCheckout } from "../../lib/subscription";

function MarketSessionBadges() {
  const SESSIONS = [
    { name: "NYSE",   open: { h:14, m:30 }, close: { h:21, m:0  }, tz: "America/New_York",  flag: "🇺🇸" },
    { name: "LSE",    open: { h:8,  m:0  }, close: { h:16, m:30 }, tz: "Europe/London",     flag: "🇬🇧" },
    { name: "TSE",    open: { h:0,  m:0  }, close: { h:6,  m:0  }, tz: "Asia/Tokyo",        flag: "🇯🇵" },
    { name: "HKEx",   open: { h:1,  m:30 }, close: { h:8,  m:0  }, tz: "Asia/Hong_Kong",    flag: "🇭🇰" },
  ];
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t+1), 30000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="flex items-center gap-3">
      {SESSIONS.map(s => {
        const now = new Date();
        const utcH = now.getUTCHours();
        const utcM = now.getUTCMinutes();
        const utcMins = utcH * 60 + utcM;
        const offsets = { "America/New_York":-240, "Europe/London":60, "Asia/Tokyo":540, "Asia/Hong_Kong":480 };
        const off = offsets[s.tz] || 0;
        const localMins = ((utcMins + off) % 1440 + 1440) % 1440;
        const openMins  = s.open.h  * 60 + s.open.m;
        const closeMins = s.close.h * 60 + s.close.m;
        const isOpen = localMins >= openMins && localMins < closeMins;
        return (
          <span key={s.name} className="font-mono" style={{ color: isOpen ? "#059669" : "var(--text-3)", fontSize:9 }}>
            {s.flag} {s.name} {isOpen ? "●" : "○"}
          </span>
        );
      })}
    </div>
  );
}

export { MarketSessionBadges };

export default function PortfolioTracker() {
  const { user } = useAuth();
  // Start empty — populated once we know the user identity (see effect below)
  const [holdings, setHoldings] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ ticker: "", shares: "", avgCost: "", purchaseDate: today });
  const [formError, setFormError] = useState("");
  const [equityHistory, setEquityHistory] = useState([]);
  const [equityLoading, setEquityLoading] = useState(false);
  const [equityTf, setEquityTf] = useState("ALL");
  const [aiAnalysis,        setAiAnalysis]        = useState(null);
  const [aiLoading,         setAiLoading]         = useState(false);
  const [aiError,           setAiError]           = useState("");
  const [aiRequiresUpgrade, setAiRequiresUpgrade] = useState(false);
  const [validatingTicker,  setValidatingTicker]  = useState(false);
  const [refAreaLeft,  setRefAreaLeft]  = useState("");
  const [refAreaRight, setRefAreaRight] = useState("");
  const [isDragging,   setIsDragging]   = useState(false);
  const [measureInfo,  setMeasureInfo]  = useState(null);

  // Load the correct holdings whenever the logged-in user changes.
  // Each account has its own localStorage key so they never bleed into each other.
  useEffect(() => {
    setHoldings(db.portfolio.load(user?.id));
    setQuotes({});
    setEquityHistory([]);
    setAiAnalysis(null);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    db.portfolio.save(holdings, user?.id);
  }, [holdings, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-read from db when cloud sync completes
  useEffect(() => {
    const handler = () => setHoldings(db.portfolio.load(user?.id));
    window.addEventListener('ov:data-synced', handler);
    return () => window.removeEventListener('ov:data-synced', handler);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch live quotes
  const tickerKey = holdings.map(h => h.ticker).join(",");
  useEffect(() => {
    if (!holdings.length) { setQuotes({}); return; }
    setLoadingQuotes(true);
    const fetch_ = async () => {
      const newQuotes = {};
      for (let i = 0; i < holdings.length; i++) {
        if (i > 0) await delay(i * 200);
        try {
          const q = await api("/quote?symbol=" + holdings[i].ticker);
          newQuotes[holdings[i].ticker] = { price: q.c, change: q.d, changePct: q.dp };
        } catch(e) {}
      }
      setQuotes(newQuotes);
      setLoadingQuotes(false);
    };
    fetch_();
  }, [tickerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Equity curve — shows portfolio value over time, respecting each holding's purchase date
  const EQ_TF_DAYS = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };
  const equityKey = holdings.map(h => `${h.ticker}:${h.purchaseDate||""}:${h.shares}`).join("|") + "|" + equityTf;
  useEffect(() => {
    if (!holdings.length) { setEquityHistory([]); return; }
    let cancelled = false;
    setEquityLoading(true);
    const build = async () => {
      // Determine how far back to fetch data
      let fromDate;
      if (equityTf === "ALL") {
        const dates = holdings.map(h => h.purchaseDate).filter(Boolean).sort();
        fromDate = dates[0] || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      } else {
        const days = EQ_TF_DAYS[equityTf] || 90;
        fromDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      }
      const daysAgo = Math.floor((Date.now() - new Date(fromDate)) / 86400000);
      const range = daysAgo <= 30 ? "1mo" : daysAgo <= 90 ? "3mo" : daysAgo <= 180 ? "6mo" : daysAgo <= 365 ? "1y" : daysAgo <= 730 ? "2y" : "5y";

      // Fetch price history for each holding
      const cmap = {};
      for (let i = 0; i < holdings.length; i++) {
        if (i > 0) await delay(350);
        try {
          const r = await fetch(`/api/chart?ticker=${encodeURIComponent(holdings[i].ticker)}&range=${range}&interval=1d`);
          const d = await r.json();
          const result = d?.chart?.result?.[0];
          if (result) {
            const ts     = result.timestamp || [];
            const closes = result.indicators?.quote?.[0]?.close || [];
            cmap[holdings[i].ticker] = {};
            ts.forEach((t, idx) => {
              if (closes[idx] != null)
                cmap[holdings[i].ticker][new Date(t * 1000).toISOString().slice(0, 10)] = closes[idx];
            });
          }
        } catch(e) {}
      }
      if (cancelled) return;

      // Collect all trading days from fromDate onward
      const allDates = new Set();
      Object.values(cmap).forEach(m =>
        Object.keys(m).filter(d => d >= fromDate).forEach(d => allDates.add(d))
      );
      const sorted = [...allDates].sort();

      // Build curve: for each date, only count holdings that were purchased on or before it
      const lastPrice = {};
      const curve = sorted.map(date => {
        // Update forward-filled price for each holding
        holdings.forEach(h => { if (cmap[h.ticker]?.[date]) lastPrice[h.ticker] = cmap[h.ticker][date]; });
        // Holdings active on this date
        const active = holdings.filter(h => !h.purchaseDate || h.purchaseDate <= date);
        const value = active.reduce((s, h) => s + (lastPrice[h.ticker] || h.avgCost) * h.shares, 0);
        const cost  = active.reduce((s, h) => s + h.avgCost * h.shares, 0);
        return { date, value: +value.toFixed(2), cost: +cost.toFixed(2) };
      });

      if (!cancelled) { setEquityHistory(curve); setEquityLoading(false); }
    };
    build();
    return () => { cancelled = true; };
  }, [equityKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const addHolding = async () => {
    const t = form.ticker.trim().toUpperCase();
    const s = parseFloat(form.shares);
    const c = parseFloat(form.avgCost);
    const d = form.purchaseDate;
    if (!t) { setFormError("Enter a ticker symbol"); return; }
    if (t.length > 10) { setFormError("Ticker too long"); return; }
    if (!s || s <= 0) { setFormError("Enter a valid share count"); return; }
    if (!c || c <= 0) { setFormError("Enter a valid average cost"); return; }
    if (!d) { setFormError("Enter a purchase date"); return; }
    if (d > new Date().toISOString().slice(0, 10)) { setFormError("Purchase date cannot be in the future"); return; }

    // Validate the ticker exists by fetching a live quote
    setValidatingTicker(true);
    setFormError("");
    try {
      const q = await api("/quote?symbol=" + t);
      if (!q || q.c == null || q.c === 0) {
        setFormError("Ticker \"" + t + "\" not found — check the symbol and try again");
        setValidatingTicker(false);
        return;
      }
    } catch {
      setFormError("Could not verify ticker — check your connection and try again");
      setValidatingTicker(false);
      return;
    }
    setValidatingTicker(false);

    const idx = holdings.findIndex(h => h.ticker === t);
    if (idx >= 0) {
      // Average down: use weighted avg cost, keep the earlier purchase date
      const old = holdings[idx];
      const totalShares = old.shares + s;
      const newAvg = (old.shares * old.avgCost + s * c) / totalShares;
      const earlierDate = old.purchaseDate && d ? (old.purchaseDate < d ? old.purchaseDate : d) : (old.purchaseDate || d);
      const updated = [...holdings];
      updated[idx] = { ticker: t, shares: totalShares, avgCost: newAvg, purchaseDate: earlierDate };
      setHoldings(updated);
    } else {
      setHoldings([...holdings, { ticker: t, shares: s, avgCost: c, purchaseDate: d }]);
    }
    setForm({ ticker: "", shares: "", avgCost: "", purchaseDate: new Date().toISOString().slice(0, 10) });
    setFormError("");
  };

  const removeHolding = (ticker) => setHoldings(holdings.filter(h => h.ticker !== ticker));

  const refreshQuotes = () => {
    if (!holdings.length || loadingQuotes) return;
    setLoadingQuotes(true);
    const fetch_ = async () => {
      const nq = { ...quotes };
      for (let i = 0; i < holdings.length; i++) {
        if (i > 0) await delay(i * 200);
        try {
          const q = await api("/quote?symbol=" + holdings[i].ticker);
          nq[holdings[i].ticker] = { price: q.c, change: q.d, changePct: q.dp };
        } catch(e) {}
      }
      setQuotes(nq);
      setLoadingQuotes(false);
    };
    fetch_();
  };

  // ── Core portfolio math ──────────────────────────────────────────────────
  let totalValue = 0, totalCost = 0, dayPnlTotal = 0;
  holdings.forEach(h => {
    const q = quotes[h.ticker];
    const price = q?.price || h.avgCost;
    totalValue += price * h.shares;
    totalCost  += h.avgCost * h.shares;
    if (q?.change) dayPnlTotal += q.change * h.shares;
  });
  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const posPerf = useMemo(() => {
    return holdings
      .map(h => {
        const price = quotes[h.ticker]?.price ?? null;
        const pnlPct = price !== null ? ((price - h.avgCost) / h.avgCost) * 100 : null;
        const pnl    = price !== null ? (price - h.avgCost) * h.shares : null;
        return { ...h, price, pnl, pnlPct };
      })
      .filter(h => h.pnlPct !== null)
      .sort((a, b) => b.pnlPct - a.pnlPct);
  }, [holdings, quotes]);

  const donutData = useMemo(() => {
    return holdings
      .map((h, i) => {
        const price = quotes[h.ticker]?.price || h.avgCost;
        return { name: h.ticker, value: +(price * h.shares).toFixed(2), color: PF_COLORS[i % PF_COLORS.length] };
      })
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [holdings, quotes]);

  const sectorData = useMemo(() => {
    const map = {};
    holdings.forEach(h => {
      const info   = SCREENER_UNIVERSE.find(s => s.ticker === h.ticker);
      const sector = info?.sector || "Other";
      const price  = quotes[h.ticker]?.price || h.avgCost;
      const value  = price * h.shares;
      if (!map[sector]) map[sector] = { sector, value: 0, color: SECTOR_CLR[sector] || "#475569" };
      map[sector].value += value;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [holdings, quotes]);

  // ── AI Portfolio Analysis ──────────────────────────────────────────────────
  const runPortfolioAnalysis = async () => {
    if (!holdings.length || aiLoading) return;
    setAiLoading(true);
    setAiAnalysis(null);
    setAiError("");
    setAiRequiresUpgrade(false);

    const lines = [
      "PORTFOLIO SNAPSHOT",
      `Total Value : $${totalValue.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,
      `Total P&L   : ${totalPnl>=0?"+":""}$${Math.abs(totalPnl).toFixed(2)} (${totalPnlPct>=0?"+":""}${totalPnlPct.toFixed(2)}%)`,
      `Today's P&L : ${dayPnlTotal>=0?"+":""}$${Math.abs(dayPnlTotal).toFixed(2)}`,
      "",
      "HOLDINGS (ticker · shares · avg cost → current price · return · % of portfolio):",
    ];
    holdings.forEach(h => {
      const q      = quotes[h.ticker];
      const price  = q?.price || h.avgCost;
      const ret    = ((price - h.avgCost) / h.avgCost) * 100;
      const mktVal = price * h.shares;
      const portPct = totalValue > 0 ? (mktVal / totalValue) * 100 : 0;
      lines.push(`  ${h.ticker}: ${h.shares} sh @ $${h.avgCost.toFixed(2)} → $${price.toFixed(2)} | ${ret>=0?"+":""}${ret.toFixed(1)}% | $${mktVal.toLocaleString("en-US",{maximumFractionDigits:0})} (${portPct.toFixed(1)}%)`);
    });
    lines.push("", "SECTOR EXPOSURE:");
    sectorData.forEach(s => {
      const pct = totalValue > 0 ? (s.value / totalValue) * 100 : 0;
      lines.push(`  ${s.sector}: ${pct.toFixed(1)}%`);
    });
    if (posPerf.length) {
      lines.push("", `BEST PERFORMER  : ${posPerf[0].ticker} +${posPerf[0].pnlPct.toFixed(1)}%`);
      lines.push(`WORST PERFORMER : ${posPerf[posPerf.length-1].ticker} ${posPerf[posPerf.length-1].pnlPct>=0?"+":""}${posPerf[posPerf.length-1].pnlPct.toFixed(1)}%`);
    }
    const context = lines.join("\n");

    const savedKey = localStorage.getItem("ov_copilot_key") || "";
    let authHeader = {};
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
    } catch {}
    try {
      const r = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          messages: [{ role: "user", content:
            "Analyze my portfolio above. Provide:\n" +
            "1. **Sector concentration** — is any sector overweight? What's the risk?\n" +
            "2. **Top 3 risk factors** specific to these holdings\n" +
            "3. **Correlation concerns** — which positions move together and why that matters\n" +
            "4. **Rebalancing suggestions** — specific tickers to trim or add with reasoning\n\n" +
            "Be direct, cite exact percentages from the data, and keep it actionable."
          }],
          context,
          apiKey: savedKey,
        }),
      });
      if (r.status === 402) {
        setAiRequiresUpgrade(true);
        setAiLoading(false);
        return;
      }
      const data = await r.json();
      if (data.error === "no_key") {
        setAiError("No API key found. Open the 🤖 Copilot button and enter your OpenAI or Anthropic key first.");
      } else if (data.error) {
        setAiError(data.error);
      } else {
        setAiAnalysis(data.message);
      }
    } catch (err) {
      setAiError("Request failed: " + err.message);
    }
    setAiLoading(false);
  };

  const inputStyle = { background: "var(--surface-0)", border: "1px solid var(--border-solid)", borderRadius: 10, color: "var(--text-1)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: "6px 8px", width: "100%" };
  const TF_OPTS = ["ALL", "1Y", "6M", "3M", "1M"];

  const curveUp = equityHistory.length > 1 ? equityHistory[equityHistory.length-1].value >= equityHistory[0].value : true;
  const curveClr = curveUp ? "#059669" : "#e11d48";
  const pctChange = equityHistory.length > 1
    ? ((equityHistory[equityHistory.length-1].value - equityHistory[0].value) / equityHistory[0].value * 100).toFixed(2)
    : null;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 90px)", overflowY: "auto", gap: 0 }}>

      {/* ── Row 1 · Summary KPIs ──────────────────────────────────────────── */}
      <div className="p-2 pb-0" style={{ flexShrink: 0 }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "Portfolio Value", value: "$" + totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: "var(--text-1)" },
            { label: "Today's P&L",    value: (dayPnlTotal >= 0 ? "+" : "") + "$" + Math.abs(dayPnlTotal).toFixed(2), color: clr(dayPnlTotal) },
            { label: "Total P&L",      value: (totalPnl >= 0 ? "+" : "") + "$" + Math.abs(totalPnl).toFixed(2), color: clr(totalPnl) },
            { label: "Total Return",   value: totalCost > 0 ? fmt.pct(totalPnlPct) : "—", color: totalCost > 0 ? clr(totalPnlPct) : "var(--text-3)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="terminal-panel p-3">
              <div className="font-mono" style={{ color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 9 }}>{label}</div>
              <div className="font-mono font-bold mt-1" style={{ color, fontSize: 20 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* AI Analyze button + result panel */}
        {holdings.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-2">
              <span style={{
                fontSize:8, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase",
                background:"linear-gradient(135deg,#7c3aed,#2563eb)", color:"#fff",
                borderRadius:4, padding:"2px 6px",
              }}>✦ AI</span>
              <span className="font-mono" style={{ fontSize:10, color:"var(--text-3)" }}>AI-powered portfolio analysis</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Rainbow glow analyze button */}
              <div style={{ position: "relative", display: "inline-flex" }}>
                {/* Crisp border ring */}
                <div style={{
                  position: "relative", display: "inline-flex",
                  padding: 3, borderRadius: 9999, overflow: "hidden",
                }}>
                  {/* Rotating rainbow fill */}
                  {!aiLoading && (
                    <div style={{
                      position: "absolute",
                      top: "50%", left: "50%",
                      width: 500, height: 500,
                      marginTop: -250, marginLeft: -250,
                      background: "conic-gradient(from 0deg,#ff0080,#ff8000,#ffd700,#00ff88,#00cfff,#9333ea,#ff0080)",
                      animation: "pf-rainbow 3s linear infinite",
                    }} />
                  )}
                  <button
                    onClick={runPortfolioAnalysis}
                    disabled={aiLoading}
                    className="font-mono flex items-center gap-2"
                    style={{
                      position: "relative", zIndex: 1,
                      background: aiLoading ? "var(--surface-2)" : "var(--surface-0)",
                      border: "none", borderRadius: 9999,
                      padding: "10px 26px",
                      fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
                      cursor: aiLoading ? "not-allowed" : "pointer",
                      color: aiLoading ? "var(--text-3)" : "var(--text-1)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {aiLoading
                      ? <><span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>⟳</span> Analyzing…</>
                      : <>✦ Analyze Portfolio</>}
                  </button>
                </div>
              </div>

              {aiAnalysis && !aiLoading && (
                <button onClick={() => setAiAnalysis(null)} className="font-mono"
                  style={{ background:"var(--surface-2)", border:"1px solid var(--border-solid)", borderRadius:6, padding:"4px 10px", fontSize:10, cursor:"pointer", color:"var(--text-3)" }}>
                  Clear
                </button>
              )}

              <style>{`
                @keyframes pf-rainbow {
                  from { transform: rotate(0deg); }
                  to   { transform: rotate(360deg); }
                }
              `}</style>
            </div>

            {aiRequiresUpgrade && (
              <div className="mt-2" style={{
                background:"var(--surface-1)", border:"1px solid var(--border-solid)",
                borderRadius:10, padding:"20px", textAlign:"center",
                display:"flex", flexDirection:"column", alignItems:"center", gap:10,
              }}>
                <div style={{ fontSize:22 }}>🔒</div>
                <div>
                  <div className="font-mono" style={{ fontSize:12, fontWeight:700, color:"var(--text-1)", marginBottom:3 }}>Pro Feature</div>
                  <div className="font-mono" style={{ fontSize:10, color:"var(--text-3)", lineHeight:1.5 }}>
                    AI Portfolio Analysis requires a Pro subscription.
                  </div>
                </div>
                <button
                  onClick={() => startCheckout().catch(() => {})}
                  className="font-mono"
                  style={{ background:"#2563eb", color:"#fff", border:"none", borderRadius:8, padding:"8px 20px", fontSize:11, fontWeight:700, cursor:"pointer" }}
                >
                  Start Pro — $9.99/month
                </button>
                <div className="font-mono" style={{ fontSize:9, color:"var(--text-3)" }}>Secure checkout via Stripe · Cancel any time</div>
              </div>
            )}

            {aiError && (
              <div className="font-mono mt-2 p-3" style={{ background:"var(--surface-0)", border:"1px solid #e11d48", borderRadius:8, color:"#e11d48", fontSize:11, lineHeight:1.6 }}>
                ⚠ {aiError}
              </div>
            )}

            {aiAnalysis && (
              <div className="mt-2 terminal-panel p-4" style={{ borderLeft:"3px solid #2563eb" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono font-bold" style={{ color:"var(--text-1)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em" }}>🤖 AI Portfolio Analysis</span>
                </div>
                <div className="font-mono" style={{ color:"var(--text-2)", fontSize:11, lineHeight:1.75 }}>
                  <MdText text={aiAnalysis} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Row 2 · Equity Curve + Donut ─────────────────────────────────── */}
      <div className="flex gap-2 px-2 pb-2" style={{ flexShrink: 0, minHeight: 240 }}>

        {/* Equity Curve */}
        <div className="terminal-panel terminal-glow flex-1 flex flex-col p-3">
          <div className="flex items-center justify-between mb-2" style={{ flexShrink: 0 }}>
            <div className="flex items-center gap-3">
              <span className="terminal-header">📈 Equity Curve</span>
              {pctChange !== null && (
                <span className="font-mono" style={{ fontSize: 12, color: curveClr, fontWeight: 700 }}>
                  {curveUp ? "▲" : "▼"} {Math.abs(pctChange)}% this period
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {TF_OPTS.map(tf => (
                <button key={tf} onClick={() => setEquityTf(tf)}
                  style={{ padding: "2px 8px", fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600,
                    background: equityTf === tf ? curveClr : "transparent",
                    color: equityTf === tf ? "#fff" : "var(--text-3)",
                    border: `1px solid ${equityTf === tf ? curveClr : "var(--border)"}`,
                    borderRadius: 4, cursor: "pointer" }}>
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {holdings.length === 0 ? (
            <div className="flex items-center justify-center flex-1 font-mono" style={{ color: "var(--text-3)", fontSize: 12 }}>
              Add positions to see your equity curve
            </div>
          ) : equityLoading ? (
            <div className="flex items-center justify-center flex-1 font-mono animate-pulse" style={{ color: "var(--text-3)", fontSize: 12 }}>
              Building equity curve…
            </div>
          ) : equityHistory.length < 2 ? (
            <div className="flex items-center justify-center flex-1 font-mono" style={{ color: "var(--text-3)", fontSize: 12 }}>
              Not enough history data
            </div>
          ) : (
            <div style={{ position:"relative" }}>
              <ResponsiveContainer width="100%" height={175}>
                <AreaChart data={equityHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                  onMouseDown={e => { if (e?.activeLabel) { setRefAreaLeft(e.activeLabel); setRefAreaRight(e.activeLabel); setIsDragging(true); setMeasureInfo(null); } }}
                  onMouseMove={e => { if (isDragging && e?.activeLabel) setRefAreaRight(e.activeLabel); }}
                  onMouseUp={() => {
                    if (!isDragging) return;
                    setIsDragging(false);
                    const [l, r] = refAreaLeft <= refAreaRight ? [refAreaLeft, refAreaRight] : [refAreaRight, refAreaLeft];
                    if (l === r) { setRefAreaLeft(""); setRefAreaRight(""); return; }
                    const ptL = equityHistory.find(d => d.date === l) || equityHistory[0];
                    const ptR = equityHistory.find(d => d.date === r) || equityHistory[equityHistory.length - 1];
                    const pct = (ptR.value - ptL.value) / ptL.value * 100;
                    const pts = ptR.value - ptL.value;
                    const color = pct > 0 ? "#059669" : pct < 0 ? "#e11d48" : "#94a3b8";
                    setMeasureInfo({ pct, pts, dateL: l, dateR: r, color });
                    setRefAreaLeft(l); setRefAreaRight(r);
                  }}
                  onMouseLeave={() => { if (isDragging) { setIsDragging(false); setRefAreaLeft(""); setRefAreaRight(""); } }}>
                  <defs>
                    <linearGradient id="pf-eq-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={curveClr} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={curveClr} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-3)", fontFamily: "'IBM Plex Mono',monospace" }}
                    tickFormatter={d => d.slice(5)} minTickGap={30} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-3)", fontFamily: "'IBM Plex Mono',monospace" }}
                    tickFormatter={v => "$" + (v >= 1000 ? (v/1000).toFixed(0) + "k" : v.toFixed(0))}
                    width={52} />
                  <Tooltip
                    contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-solid)", borderRadius: 8, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }}
                    labelStyle={{ color: "var(--text-3)", marginBottom: 4 }}
                    formatter={(v, name) => ["$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), name === "value" ? "Portfolio" : "Cost Basis"]}
                  />
                  <Area type="monotone" dataKey="cost" stroke="var(--text-3)" fill="none" strokeWidth={1} strokeDasharray="5 3" dot={false} />
                  <Area type="monotone" dataKey="value" stroke={curveClr} fill="url(#pf-eq-grad)" strokeWidth={2} dot={false} />
                  {refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight && (() => {
                    const [l, r] = refAreaLeft <= refAreaRight ? [refAreaLeft, refAreaRight] : [refAreaRight, refAreaLeft];
                    const ptL = equityHistory.find(d => d.date === l) || equityHistory[0];
                    const ptR = equityHistory.find(d => d.date === r) || equityHistory[equityHistory.length - 1];
                    const pct = (ptR.value - ptL.value) / ptL.value * 100;
                    const color = pct > 0 ? "#059669" : pct < 0 ? "#e11d48" : "#94a3b8";
                    return <ReferenceArea x1={l} x2={r} fill={color+"18"} stroke={color+"55"} strokeOpacity={0.3} />;
                  })()}
                </AreaChart>
              </ResponsiveContainer>
              {!measureInfo && (
                <div style={{ position:"absolute", bottom:4, right:4, fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:"var(--text-3)", pointerEvents:"none", opacity:0.5 }}>drag to measure</div>
              )}
              {measureInfo && (
                <div style={{ position:"absolute", top:6, left:"50%", transform:"translateX(-50%)", background:"var(--surface-2)", border:"1px solid "+measureInfo.color+"44", borderRadius:6, padding:"4px 10px", fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:measureInfo.color, display:"flex", alignItems:"center", gap:8, zIndex:10, whiteSpace:"nowrap", boxShadow:"0 4px 12px rgba(0,0,0,0.3)" }}>
                  <span style={{ fontWeight:700 }}>{measureInfo.pct >= 0 ? "+" : ""}{measureInfo.pct.toFixed(2)}%</span>
                  <span style={{ color:"var(--text-3)", fontSize:9 }}>{measureInfo.pts >= 0 ? "+" : ""}${Math.abs(measureInfo.pts).toFixed(2)}</span>
                  <span style={{ color:"var(--text-3)", fontSize:9 }}>{measureInfo.dateL} → {measureInfo.dateR}</span>
                  <button onClick={() => { setMeasureInfo(null); setRefAreaLeft(""); setRefAreaRight(""); }} style={{ color:"var(--text-3)", background:"none", border:"none", cursor:"pointer", fontSize:10, padding:"0 0 0 2px" }}>✕</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Allocation Donut */}
        <div className="terminal-panel terminal-glow p-3 flex flex-col" style={{ width: 240, flexShrink: 0 }}>
          <span className="terminal-header mb-2">🍩 Allocation</span>
          {donutData.length === 0 ? (
            <div className="flex items-center justify-center flex-1 font-mono" style={{ color: "var(--text-3)", fontSize: 11 }}>No positions</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                    dataKey="value" paddingAngle={donutData.length > 1 ? 2 : 0} startAngle={90} endAngle={-270}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-solid)", borderRadius: 8, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }}
                    formatter={v => ["$" + v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }), "Value"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5" style={{ overflowY: "auto" }}>
                {donutData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    <span className="font-mono font-bold" style={{ fontSize: 11, color: "var(--text-1)", flex: 1 }}>{d.name}</span>
                    <span className="font-mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) + "%" : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Row 3 · Holdings Table + Right Panel ─────────────────────────── */}
      <div className="flex gap-2 px-2 pb-2" style={{ flexShrink: 0 }}>

        {/* Holdings table */}
        <div className="terminal-panel terminal-glow flex-1 flex flex-col p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="terminal-header">💼 Holdings ({holdings.length})</span>
            <button onClick={refreshQuotes} disabled={loadingQuotes} className="text-xs font-mono px-2 py-1"
              style={{ border: "1px solid var(--border-solid)", borderRadius: 10, background: "transparent",
                color: loadingQuotes ? "var(--text-3)" : "#2563eb", cursor: loadingQuotes ? "wait" : "pointer" }}>
              {loadingQuotes ? "⟳ Updating…" : "⟳ Refresh"}
            </button>
          </div>

          {holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8" style={{ color: "var(--text-3)" }}>
              <div className="font-mono" style={{ fontSize: 11 }}>No positions yet. Add holdings using the form →</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-solid)" }}>
                  {["Ticker", "Shares", "Avg Cost", "Purchased", "Price", "Mkt Value", "P&L ($)", "Return", "Day Chg", ""].map(h => (
                    <th key={h} className="text-left px-2 py-2"
                      style={{ color: "var(--text-3)", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, hi) => {
                  const q      = quotes[h.ticker];
                  const price  = q?.price ?? null;
                  const mktVal = price !== null ? price * h.shares : null;
                  const basis  = h.avgCost * h.shares;
                  const pnl    = mktVal !== null ? mktVal - basis : null;
                  const pnlPct = pnl !== null ? (pnl / basis) * 100 : null;
                  const alloc  = totalValue > 0 && mktVal !== null ? (mktVal / totalValue) * 100 : 0;
                  const dot    = PF_COLORS[hi % PF_COLORS.length];
                  return (
                    <tr key={h.ticker} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                          <span className="font-mono font-bold" style={{ color: dot, fontSize: 12 }}>{h.ticker}</span>
                        </div>
                        <div className="font-mono" style={{ color: "var(--text-3)", fontSize: 10, paddingLeft: 10 }}>{alloc.toFixed(1)}%</div>
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: "var(--text-1)", fontSize: 12 }}>{h.shares.toLocaleString()}</td>
                      <td className="px-2 py-2 font-mono" style={{ color: "var(--text-1)", fontSize: 12 }}>${fmt.price(h.avgCost)}</td>
                      <td className="px-2 py-2 font-mono" style={{ color: h.purchaseDate ? "var(--text-2)" : "var(--text-3)", fontSize: 11 }}>
                        {h.purchaseDate || "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: price !== null ? "var(--text-1)" : "var(--text-3)", fontSize: 12 }}>
                        {price !== null ? "$" + fmt.price(price) : loadingQuotes ? "…" : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: "var(--text-1)", fontSize: 12 }}>
                        {mktVal !== null ? "$" + mktVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: pnl !== null ? clr(pnl) : "var(--text-3)", fontSize: 12 }}>
                        {pnl !== null ? (pnl >= 0 ? "+" : "") + "$" + Math.abs(pnl).toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: pnlPct !== null ? clr(pnlPct) : "var(--text-3)", fontSize: 12 }}>
                        {pnlPct !== null ? fmt.pct(pnlPct) : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: q?.changePct != null ? clr(q.changePct) : "var(--text-3)", fontSize: 12 }}>
                        {q?.changePct != null ? fmt.pct(q.changePct) : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeHolding(h.ticker)}
                          style={{ color: "#e11d48", background: "none", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {holdings.length > 1 && (
                <tfoot>
                  <tr style={{ borderTop: "1px solid var(--border-solid)" }}>
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: "var(--text-3)", fontSize: 11 }} colSpan={5}>TOTAL</td>
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: "var(--text-1)", fontSize: 12 }}>
                      ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: clr(totalPnl), fontSize: 12 }}>
                      {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: clr(totalPnlPct), fontSize: 12 }}>
                      {fmt.pct(totalPnlPct)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* ── Right column ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2" style={{ width: 280, flexShrink: 0 }}>

          {/* Add / Update position form */}
          <div className="terminal-panel terminal-glow p-3">
            <div className="terminal-header mb-3">+ Add / Update Position</div>
            <div className="flex flex-col gap-2">
              {[
                { label: "Ticker", key: "ticker", id: "pf-ticker", placeholder: "AAPL", type: "text",   next: "pf-shares" },
                { label: "Shares", key: "shares", id: "pf-shares", placeholder: "100",  type: "number", next: "pf-cost"   },
                { label: "Avg Cost / Share ($)", key: "avgCost", id: "pf-cost", placeholder: "150.00", type: "number", next: "pf-date" },
              ].map(({ label, key, id, placeholder, type, next }) => (
                <div key={key}>
                  <div className="font-mono mb-1" style={{ color: "var(--text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                  <input id={id} type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "any" : undefined}
                    value={key === "ticker" ? form.ticker : key === "shares" ? form.shares : form.avgCost}
                    onChange={e => setForm(f => ({ ...f, [key]: key === "ticker" ? e.target.value.toUpperCase() : e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && !validatingTicker && (next ? document.getElementById(next)?.focus() : addHolding())}
                    placeholder={placeholder} style={inputStyle} />
                </div>
              ))}
              <div>
                <div className="font-mono mb-1" style={{ color: "var(--text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Purchase Date</div>
                <input id="pf-date" type="date"
                  value={form.purchaseDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && !validatingTicker && addHolding()}
                  style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>
              {formError && <div className="font-mono" style={{ color: "#e11d48", fontSize: 11 }}>{formError}</div>}
              <button onClick={addHolding} disabled={validatingTicker} className="font-mono font-semibold py-2 mt-1"
                style={{ background: validatingTicker ? "#1e3a6e" : "#2563eb", border: "none", borderRadius: 10, color: "#fff", cursor: validatingTicker ? "not-allowed" : "pointer", fontSize: 12, letterSpacing: "0.05em", opacity: validatingTicker ? 0.8 : 1 }}>
                {validatingTicker ? "⟳ Checking ticker…" : "ADD POSITION"}
              </button>
              <div className="font-mono" style={{ color: "var(--text-3)", fontSize: 10 }}>Adding an existing ticker averages your cost basis.</div>
            </div>
          </div>

          {/* Sector Breakdown */}
          {sectorData.length > 0 && (
            <div className="terminal-panel terminal-glow p-3">
              <div className="terminal-header mb-3">🏭 Sector Exposure</div>
              {sectorData.map(s => {
                const pct = totalValue > 0 ? (s.value / totalValue) * 100 : 0;
                return (
                  <div key={s.sector} className="mb-2">
                    <div className="flex justify-between font-mono mb-1" style={{ fontSize: 10 }}>
                      <span style={{ color: s.color, fontWeight: 600 }}>{s.sector}</span>
                      <span style={{ color: "var(--text-3)" }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ background: "var(--surface-3)", borderRadius: 3, height: 5 }}>
                      <div style={{ width: pct + "%", height: "100%", background: s.color, borderRadius: 3, transition: "width 0.4s ease", opacity: 0.85 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Best / Worst Positions */}
          {posPerf.length > 0 && (
            <div className="terminal-panel terminal-glow p-3">
              <div className="terminal-header mb-3">🏆 Best &amp; Worst</div>

              <div className="mb-3">
                <div className="font-mono mb-1" style={{ color: "#059669", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>▲ Winners</div>
                {posPerf.slice(0, Math.min(3, Math.ceil(posPerf.length / 2))).map(h => (
                  <div key={h.ticker} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <div>
                      <span className="font-mono font-bold" style={{ fontSize: 11, color: "var(--text-1)" }}>{h.ticker}</span>
                      <span className="font-mono ml-2" style={{ fontSize: 10, color: "var(--text-3)" }}>
                        {h.pnl >= 0 ? "+" : ""}${Math.abs(h.pnl).toFixed(0)}
                      </span>
                    </div>
                    <div className="font-mono font-bold" style={{ fontSize: 12, color: "#059669" }}>
                      {h.pnlPct >= 0 ? "+" : ""}{h.pnlPct.toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>

              {posPerf.filter(h => h.pnlPct < 0).length > 0 && (
                <div>
                  <div className="font-mono mb-1" style={{ color: "#e11d48", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>▼ Laggards</div>
                  {[...posPerf].reverse().slice(0, Math.min(3, Math.ceil(posPerf.length / 2))).filter(h => h.pnlPct < 0).map(h => (
                    <div key={h.ticker} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <div>
                        <span className="font-mono font-bold" style={{ fontSize: 11, color: "var(--text-1)" }}>{h.ticker}</span>
                        <span className="font-mono ml-2" style={{ fontSize: 10, color: "var(--text-3)" }}>
                          -${Math.abs(h.pnl).toFixed(0)}
                        </span>
                      </div>
                      <div className="font-mono font-bold" style={{ fontSize: 12, color: "#e11d48" }}>
                        {h.pnlPct.toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
