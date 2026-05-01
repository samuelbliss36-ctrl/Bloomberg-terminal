import { useState, useEffect, useRef, useMemo } from "react";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "../../lib/api";
import { fmt, clr, delay } from "../../lib/fmt";
import { PF_COLORS, SECTOR_CLR } from "../../lib/constants";
import { SCREENER_UNIVERSE } from "../../screenerData";
import { MdText } from "../../components/ui/MdText";

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
          <span key={s.name} className="font-mono" style={{ color: isOpen ? "#059669" : "#64748b", fontSize:9 }}>
            {s.flag} {s.name} {isOpen ? "●" : "○"}
          </span>
        );
      })}
    </div>
  );
}

export { MarketSessionBadges };

export default function PortfolioTracker() {
  const [holdings, setHoldings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ov_portfolio") || "[]"); }
    catch { return []; }
  });
  const [quotes, setQuotes] = useState({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [form, setForm] = useState({ ticker: "", shares: "", avgCost: "" });
  const [formError, setFormError] = useState("");
  const [equityHistory, setEquityHistory] = useState([]);
  const [equityLoading, setEquityLoading] = useState(false);
  const [equityTf, setEquityTf] = useState("3M");
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiError,    setAiError]    = useState("");

  useEffect(() => {
    localStorage.setItem("ov_portfolio", JSON.stringify(holdings));
  }, [holdings]);

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

  // Fetch equity curve via Finnhub candles
  const equityKey = tickerKey + "|" + equityTf;
  useEffect(() => {
    if (!holdings.length) { setEquityHistory([]); return; }
    let cancelled = false;
    setEquityLoading(true);
    const tfDays = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 }[equityTf] || 90;
    const from = Math.floor((Date.now() - tfDays * 86400000) / 1000);
    const to   = Math.floor(Date.now() / 1000);
    const build = async () => {
      const cmap = {};
      for (let i = 0; i < holdings.length; i++) {
        if (i > 0) await delay(350);
        try {
          const c = await api(`/stock/candle?symbol=${holdings[i].ticker}&resolution=D&from=${from}&to=${to}`);
          if (c.s === "ok" && c.t?.length) {
            cmap[holdings[i].ticker] = {};
            c.t.forEach((ts, idx) => {
              cmap[holdings[i].ticker][new Date(ts * 1000).toISOString().slice(0,10)] = c.c[idx];
            });
          }
        } catch(e) {}
      }
      if (cancelled) return;
      const allDates = new Set();
      Object.values(cmap).forEach(m => Object.keys(m).forEach(d => allDates.add(d)));
      const sorted = [...allDates].sort();
      const last = {};
      holdings.forEach(h => { last[h.ticker] = h.avgCost; });
      const cost = holdings.reduce((s, h) => s + h.avgCost * h.shares, 0);
      const curve = sorted.map(date => {
        holdings.forEach(h => { if (cmap[h.ticker]?.[date]) last[h.ticker] = cmap[h.ticker][date]; });
        const val = holdings.reduce((s, h) => s + (last[h.ticker] || h.avgCost) * h.shares, 0);
        return { date, value: +val.toFixed(2), cost: +cost.toFixed(2) };
      });
      if (!cancelled) { setEquityHistory(curve); setEquityLoading(false); }
    };
    build();
    return () => { cancelled = true; };
  }, [equityKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const addHolding = () => {
    const t = form.ticker.trim().toUpperCase();
    const s = parseFloat(form.shares);
    const c = parseFloat(form.avgCost);
    if (!t) { setFormError("Enter a ticker symbol"); return; }
    if (!s || s <= 0) { setFormError("Enter a valid share count"); return; }
    if (!c || c <= 0) { setFormError("Enter a valid average cost"); return; }
    const idx = holdings.findIndex(h => h.ticker === t);
    if (idx >= 0) {
      const old = holdings[idx];
      const totalShares = old.shares + s;
      const newAvg = (old.shares * old.avgCost + s * c) / totalShares;
      const updated = [...holdings];
      updated[idx] = { ticker: t, shares: totalShares, avgCost: newAvg };
      setHoldings(updated);
    } else {
      setHoldings([...holdings, { ticker: t, shares: s, avgCost: c }]);
    }
    setForm({ ticker: "", shares: "", avgCost: "" });
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
    try {
      const r = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  const TF_OPTS = ["1M", "3M", "6M", "1Y"];

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
            <div className="flex items-center gap-2">
              <button
                onClick={runPortfolioAnalysis}
                disabled={aiLoading}
                className="font-mono flex items-center gap-1.5"
                style={{
                  background: aiLoading ? "var(--surface-2)" : "linear-gradient(135deg,#1d4ed8,#2563eb)",
                  border: "none", borderRadius: 8, padding: "6px 14px",
                  fontSize: 11, cursor: aiLoading ? "not-allowed" : "pointer",
                  color: "#fff", fontWeight: 600, letterSpacing: "0.03em",
                  opacity: aiLoading ? 0.7 : 1,
                  boxShadow: aiLoading ? "none" : "0 2px 8px rgba(37,99,235,0.35)",
                }}
              >
                {aiLoading
                  ? <><span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>⟳</span> Analyzing…</>
                  : <>🤖 Analyze Portfolio</>}
              </button>
              {aiAnalysis && !aiLoading && (
                <button onClick={() => setAiAnalysis(null)} className="font-mono"
                  style={{ background:"var(--surface-2)", border:"1px solid var(--border-solid)", borderRadius:6, padding:"4px 10px", fontSize:10, cursor:"pointer", color:"var(--text-3)" }}>
                  Clear
                </button>
              )}
            </div>

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
            <ResponsiveContainer width="100%" height={175}>
              <AreaChart data={equityHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
              </AreaChart>
            </ResponsiveContainer>
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
                  {["Ticker", "Shares", "Avg Cost", "Price", "Mkt Value", "P&L ($)", "Return", "Day Chg", ""].map(h => (
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
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: "var(--text-3)", fontSize: 11 }} colSpan={4}>TOTAL</td>
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
                { label: "Avg Cost / Share ($)", key: "avgCost", id: "pf-cost", placeholder: "150.00", type: "number", next: null },
              ].map(({ label, key, id, placeholder, type, next }) => (
                <div key={key}>
                  <div className="font-mono mb-1" style={{ color: "var(--text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                  <input id={id} type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "any" : undefined}
                    value={key === "ticker" ? form.ticker : key === "shares" ? form.shares : form.avgCost}
                    onChange={e => setForm(f => ({ ...f, [key]: key === "ticker" ? e.target.value.toUpperCase() : e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && (next ? document.getElementById(next)?.focus() : addHolding())}
                    placeholder={placeholder} style={inputStyle} />
                </div>
              ))}
              {formError && <div className="font-mono" style={{ color: "#e11d48", fontSize: 11 }}>{formError}</div>}
              <button onClick={addHolding} className="font-mono font-semibold py-2 mt-1"
                style={{ background: "#2563eb", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 12, letterSpacing: "0.05em" }}>
                ADD POSITION
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
