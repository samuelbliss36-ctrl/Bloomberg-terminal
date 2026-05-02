import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "../../lib/api";
import { fmt, clr, delay } from "../../lib/fmt";
import { PF_COLORS, SECTOR_CLR } from "../../lib/constants";
import { SCREENER_UNIVERSE } from "../../screenerData";
import { MdText } from "../../components/ui/MdText";
import { useAuth } from "../../context/AuthContext";
import { portfolio as dbPortfolio } from "../../lib/db";

function MarketSessionBadges() {
  const SESSIONS = [
    { name: "NYSE",  open: { h:14, m:30 }, close: { h:21, m:0  }, tz: "America/New_York", flag: "🇺🇸" },
    { name: "LSE",   open: { h:8,  m:0  }, close: { h:16, m:30 }, tz: "Europe/London",    flag: "🇬🇧" },
    { name: "TSE",   open: { h:0,  m:0  }, close: { h:6,  m:0  }, tz: "Asia/Tokyo",       flag: "🇯🇵" },
    { name: "HKEx",  open: { h:1,  m:30 }, close: { h:8,  m:0  }, tz: "Asia/Hong_Kong",   flag: "🇭🇰" },
  ];
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="flex items-center gap-3">
      {SESSIONS.map(s => {
        const now = new Date();
        const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
        const offsets = { "America/New_York": -240, "Europe/London": 60, "Asia/Tokyo": 540, "Asia/Hong_Kong": 480 };
        const localMins = ((utcMins + (offsets[s.tz] || 0)) % 1440 + 1440) % 1440;
        const isOpen = localMins >= (s.open.h * 60 + s.open.m) && localMins < (s.close.h * 60 + s.close.m);
        return (
          <span key={s.name} className="font-mono" style={{ color: isOpen ? "#059669" : "#64748b", fontSize: 9 }}>
            {s.flag} {s.name} {isOpen ? "●" : "○"}
          </span>
        );
      })}
    </div>
  );
}

export { MarketSessionBadges };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function betaLabel(b) {
  if (b > 1.5) return "High-beta";
  if (b > 1.1) return "Above-market";
  if (b < 0.6) return "Defensive";
  if (b < 0.9) return "Below-market";
  return "Near-market";
}
function hhiLabel(h) {
  if (h > 2500) return "Highly concentrated";
  if (h > 1500) return "Moderately concentrated";
  return "Well diversified";
}
function sharpeLabel(s) {
  if (s > 2)  return "Excellent";
  if (s > 1)  return "Good";
  if (s > 0)  return "Positive";
  return "Poor";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function PortfolioTracker({ onContextUpdate }) {
  const { user } = useAuth();
  const [holdings, setHoldings] = useState(() => dbPortfolio.load());
  const [quotes,        setQuotes]        = useState({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [form,          setForm]          = useState({ ticker: "", shares: "", avgCost: "" });
  const [formError,     setFormError]     = useState("");
  const [equityHistory, setEquityHistory] = useState([]);
  const [equityLoading, setEquityLoading] = useState(false);
  const [equityTf,      setEquityTf]      = useState("3M");
  const [aiAnalysis,    setAiAnalysis]    = useState(null);
  const [aiLoading,     setAiLoading]     = useState(false);
  const [aiError,       setAiError]       = useState("");

  // Persist holdings on every change (localStorage + background Supabase sync)
  useEffect(() => {
    dbPortfolio.save(holdings, user?.id);
  }, [holdings, user?.id]);

  // Re-read from localStorage when cloud sync completes
  useEffect(() => {
    const handler = () => setHoldings(dbPortfolio.load());
    window.addEventListener('ov:data-synced', handler);
    return () => window.removeEventListener('ov:data-synced', handler);
  }, []);

  // ── Live quotes ────────────────────────────────────────────────────────────
  const tickerKey = holdings.map(h => h.ticker).join(",");
  useEffect(() => {
    if (!holdings.length) { setQuotes({}); return; }
    setLoadingQuotes(true);
    (async () => {
      const nq = {};
      for (let i = 0; i < holdings.length; i++) {
        if (i > 0) await delay(i * 200);
        try {
          const q = await api("/quote?symbol=" + holdings[i].ticker);
          nq[holdings[i].ticker] = { price: q.c, change: q.d, changePct: q.dp };
        } catch {}
      }
      setQuotes(nq);
      setLoadingQuotes(false);
    })();
  }, [tickerKey]); // eslint-disable-line

  // ── Equity curve (Finnhub candles) ─────────────────────────────────────────
  const equityKey = tickerKey + "|" + equityTf;
  useEffect(() => {
    if (!holdings.length) { setEquityHistory([]); return; }
    let cancelled = false;
    setEquityLoading(true);
    const tfDays = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 }[equityTf] || 90;
    const from   = Math.floor((Date.now() - tfDays * 86400000) / 1000);
    const to     = Math.floor(Date.now() / 1000);
    (async () => {
      const cmap = {};
      for (let i = 0; i < holdings.length; i++) {
        if (i > 0) await delay(350);
        try {
          const c = await api(`/stock/candle?symbol=${holdings[i].ticker}&resolution=D&from=${from}&to=${to}`);
          if (c.s === "ok" && c.t?.length) {
            cmap[holdings[i].ticker] = {};
            c.t.forEach((ts, idx) => { cmap[holdings[i].ticker][new Date(ts * 1000).toISOString().slice(0, 10)] = c.c[idx]; });
          }
        } catch {}
      }
      if (cancelled) return;
      const allDates = new Set();
      Object.values(cmap).forEach(m => Object.keys(m).forEach(d => allDates.add(d)));
      const sorted = [...allDates].sort();
      const last_ = {};
      holdings.forEach(h => { last_[h.ticker] = h.avgCost; });
      const cost = holdings.reduce((s, h) => s + h.avgCost * h.shares, 0);
      const curve = sorted.map(date => {
        holdings.forEach(h => { if (cmap[h.ticker]?.[date]) last_[h.ticker] = cmap[h.ticker][date]; });
        const val = holdings.reduce((s, h) => s + (last_[h.ticker] || h.avgCost) * h.shares, 0);
        return { date, value: +val.toFixed(2), cost: +cost.toFixed(2) };
      });
      if (!cancelled) { setEquityHistory(curve); setEquityLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [equityKey]); // eslint-disable-line

  // ── Portfolio math (inline, runs every render) ────────────────────────────
  let totalValue = 0, totalCost = 0, dayPnlTotal = 0;
  holdings.forEach(h => {
    const price = quotes[h.ticker]?.price || h.avgCost;
    totalValue   += price * h.shares;
    totalCost    += h.avgCost * h.shares;
    if (quotes[h.ticker]?.change) dayPnlTotal += quotes[h.ticker].change * h.shares;
  });
  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // ── Beta map from known universe ───────────────────────────────────────────
  const betaMap = useMemo(() => {
    const m = {};
    SCREENER_UNIVERSE.forEach(s => { if (s.beta != null) m[s.ticker] = s.beta; });
    return m;
  }, []);

  // ── Full analytics (beta, HHI, concentration) ─────────────────────────────
  const analytics = useMemo(() => {
    if (!holdings.length) return null;
    // recompute totalValue inside memo so it's a stable dep
    let tv = 0;
    holdings.forEach(h => { tv += (quotes[h.ticker]?.price || h.avgCost) * h.shares; });
    if (tv === 0) return null;

    const positions = holdings.map(h => {
      const price  = quotes[h.ticker]?.price || h.avgCost;
      const mktVal = price * h.shares;
      const weight = mktVal / tv;
      const pnl    = (price - h.avgCost) * h.shares;
      const pnlPct = ((price - h.avgCost) / h.avgCost) * 100;
      const beta   = betaMap[h.ticker] ?? 1.0;
      const info   = SCREENER_UNIVERSE.find(s => s.ticker === h.ticker);
      const sector = info?.sector || "Other";
      return { ticker: h.ticker, shares: h.shares, avgCost: h.avgCost, price, mktVal, weight, pnl, pnlPct, beta, sector };
    });

    // Weighted portfolio beta
    const portfolioBeta = +positions.reduce((s, p) => s + p.weight * p.beta, 0).toFixed(2);

    // Herfindahl-Hirschman Index (0–10000, higher = more concentrated)
    const hhi = Math.round(positions.reduce((s, p) => s + p.weight ** 2, 0) * 10000);

    // Sorted by market value weight
    const byWeight = [...positions].sort((a, b) => b.mktVal - a.mktVal);
    const top1     = byWeight[0];
    const top3Pct  = byWeight.slice(0, Math.min(3, byWeight.length)).reduce((s, p) => s + p.weight, 0) * 100;
    const top5Pct  = byWeight.slice(0, Math.min(5, byWeight.length)).reduce((s, p) => s + p.weight, 0) * 100;

    // Sector concentration
    const sectorWeights = {};
    positions.forEach(p => { sectorWeights[p.sector] = (sectorWeights[p.sector] || 0) + p.weight; });
    const topSector = Object.entries(sectorWeights).sort((a, b) => b[1] - a[1])[0];

    // Tickers where beta falls back to 1.0
    const betaEstimated = positions.filter(p => betaMap[p.ticker] == null).map(p => p.ticker);

    return { positions, byWeight, portfolioBeta, hhi, top1, top3Pct, top5Pct, sectorWeights, topSector, betaEstimated };
  }, [holdings, quotes, betaMap]); // eslint-disable-line

  // ── Sharpe ratio + max drawdown from equity curve ─────────────────────────
  const { sharpe, maxDrawdown } = useMemo(() => {
    if (equityHistory.length < 10) return { sharpe: null, maxDrawdown: null };
    const returns = [];
    for (let i = 1; i < equityHistory.length; i++) {
      const prev = equityHistory[i - 1].value;
      if (prev > 0) returns.push((equityHistory[i].value - prev) / prev);
    }
    const n    = returns.length;
    const mean = returns.reduce((s, r) => s + r, 0) / n;
    const std  = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / n);
    const rfD  = 0.05 / 252; // 5% annual risk-free rate
    const sharpe = std > 0 ? +((mean - rfD) / std * Math.sqrt(252)).toFixed(2) : null;

    let peak = equityHistory[0].value, maxDD = 0;
    equityHistory.forEach(d => {
      if (d.value > peak) peak = d.value;
      const dd = (d.value - peak) / peak;
      if (dd < maxDD) maxDD = dd;
    });
    return { sharpe, maxDrawdown: +(maxDD * 100).toFixed(1) };
  }, [equityHistory]);

  // ── Existing derived data ──────────────────────────────────────────────────
  const posPerf = useMemo(() => holdings
    .map(h => {
      const price  = quotes[h.ticker]?.price ?? null;
      const pnlPct = price !== null ? ((price - h.avgCost) / h.avgCost) * 100 : null;
      const pnl    = price !== null ? (price - h.avgCost) * h.shares : null;
      return { ...h, price, pnl, pnlPct };
    })
    .filter(h => h.pnlPct !== null)
    .sort((a, b) => b.pnlPct - a.pnlPct),
  [holdings, quotes]);

  const donutData = useMemo(() => holdings
    .map((h, i) => {
      const price = quotes[h.ticker]?.price || h.avgCost;
      return { name: h.ticker, value: +(price * h.shares).toFixed(2), color: PF_COLORS[i % PF_COLORS.length] };
    })
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value),
  [holdings, quotes]);

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

  // ── Rich AI copilot context ────────────────────────────────────────────────
  useEffect(() => {
    if (!onContextUpdate) return;
    if (!holdings.length || !analytics) {
      onContextUpdate({ type: "portfolio", summary: "No positions in portfolio." });
      return;
    }

    const d2  = v => v.toFixed(2);
    const pct = v => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
    const $   = v => "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const lines = [
      "=== LIVE PORTFOLIO ANALYTICS ===",
      `Total Market Value : ${$(totalValue)}`,
      `Cost Basis         : ${$(totalCost)}`,
      `Total P&L          : ${totalPnl >= 0 ? "+" : ""}${$(totalPnl)} (${pct(totalPnlPct)} return on cost)`,
      `Today's P&L        : ${dayPnlTotal >= 0 ? "+" : ""}${$(dayPnlTotal)}`,
      "",
      "RISK METRICS:",
      `Portfolio Beta     : ${d2(analytics.portfolioBeta)} — ${betaLabel(analytics.portfolioBeta)} ` +
        `(portfolio moves ~${d2(analytics.portfolioBeta)}x the broad market)`,
      `Concentration (HHI): ${analytics.hhi} — ${hhiLabel(analytics.hhi)} ` +
        `(diversified <1500, concentrated >2500)`,
      `Largest Position   : ${analytics.top1.ticker} at ${(analytics.top1.weight * 100).toFixed(1)}% ` +
        `(${$(analytics.top1.mktVal)}) — ` +
        `${analytics.top1.weight > 0.30 ? "SIGNIFICANT concentration risk" : analytics.top1.weight > 0.20 ? "notable weight" : "reasonable size"}`,
      analytics.byWeight.length >= 3
        ? `Top 3 Positions    : ${analytics.byWeight.slice(0, 3).map(p => `${p.ticker} ${(p.weight * 100).toFixed(1)}%`).join(", ")} = ${analytics.top3Pct.toFixed(1)}% of portfolio`
        : "",
      analytics.topSector
        ? `Top Sector         : ${analytics.topSector[0]} at ${(analytics.topSector[1] * 100).toFixed(1)}% — ` +
            `${analytics.topSector[1] > 0.6 ? "high sector concentration risk" : analytics.topSector[1] > 0.4 ? "moderate sector tilt" : "reasonable exposure"}`
        : "",
      sharpe != null
        ? `Sharpe Ratio (${equityTf})  : ${sharpe} — ${sharpeLabel(sharpe)} risk-adjusted return (annualized, rf=5%)`
        : "",
      maxDrawdown != null && maxDrawdown < 0
        ? `Max Drawdown (${equityTf}) : ${maxDrawdown}% peak-to-trough`
        : "",
      "",
      `POSITIONS (${analytics.positions.length}) — sorted by weight:`,
    ];

    analytics.byWeight.forEach(p => {
      const betaNote = betaMap[p.ticker] == null ? " [β estimated]" : "";
      lines.push(
        `  ${p.ticker.padEnd(6)}: ${p.shares} sh · cost ${$(p.avgCost)} → ${$(p.price)} · ` +
        `P&L ${p.pnl >= 0 ? "+" : ""}${$(p.pnl)} (${pct(p.pnlPct)}) · ` +
        `${(p.weight * 100).toFixed(1)}% of port · β ${d2(p.beta)}${betaNote} · ${p.sector}`
      );
    });

    lines.push("", "SECTOR EXPOSURE:");
    Object.entries(analytics.sectorWeights)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sector, w]) => lines.push(`  ${sector}: ${(w * 100).toFixed(1)}%`));

    if (analytics.betaEstimated.length > 0) {
      lines.push("", `NOTE: Beta defaulted to 1.0 for: ${analytics.betaEstimated.join(", ")} (not in static universe — actual beta may differ)`);
    }

    onContextUpdate({
      type: "portfolio",
      summary: lines.filter(l => l !== "").join("\n"),
      totalValue, totalPnl, totalPnlPct,
      portfolioBeta: analytics.portfolioBeta,
      hhi: analytics.hhi,
      topSector: analytics.topSector?.[0],
      topSectorPct: analytics.topSector ? analytics.topSector[1] * 100 : null,
      sharpe, maxDrawdown,
      posCount: holdings.length,
    });
  }, [holdings, quotes, analytics, sharpe, maxDrawdown, equityTf]); // eslint-disable-line

  // ── Mutations ──────────────────────────────────────────────────────────────
  const addHolding = () => {
    const t = form.ticker.trim().toUpperCase();
    const s = parseFloat(form.shares);
    const c = parseFloat(form.avgCost);
    if (!t)      { setFormError("Enter a ticker symbol"); return; }
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

  const removeHolding = ticker => setHoldings(holdings.filter(h => h.ticker !== ticker));

  const refreshQuotes = () => {
    if (!holdings.length || loadingQuotes) return;
    setLoadingQuotes(true);
    (async () => {
      const nq = { ...quotes };
      for (let i = 0; i < holdings.length; i++) {
        if (i > 0) await delay(i * 200);
        try {
          const q = await api("/quote?symbol=" + holdings[i].ticker);
          nq[holdings[i].ticker] = { price: q.c, change: q.d, changePct: q.dp };
        } catch {}
      }
      setQuotes(nq);
      setLoadingQuotes(false);
    })();
  };

  // ── AI analysis ────────────────────────────────────────────────────────────
  const runPortfolioAnalysis = async () => {
    if (!holdings.length || aiLoading) return;
    setAiLoading(true); setAiAnalysis(null); setAiError("");

    // Build the same rich context that goes to the copilot
    const d2  = v => v.toFixed(2);
    const pct = v => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
    const $   = v => "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const lines = [
      "PORTFOLIO SNAPSHOT",
      `Total Value    : ${$(totalValue)}`,
      `Cost Basis     : ${$(totalCost)}`,
      `Total P&L      : ${totalPnl >= 0 ? "+" : ""}${$(totalPnl)} (${pct(totalPnlPct)})`,
      `Today's P&L    : ${dayPnlTotal >= 0 ? "+" : ""}${$(dayPnlTotal)}`,
      "",
    ];

    if (analytics) {
      lines.push(
        "RISK METRICS:",
        `Portfolio Beta : ${d2(analytics.portfolioBeta)} (${betaLabel(analytics.portfolioBeta)})`,
        `HHI Index      : ${analytics.hhi} (${hhiLabel(analytics.hhi)})`,
        `Largest Name   : ${analytics.top1.ticker} ${(analytics.top1.weight * 100).toFixed(1)}%`,
        analytics.byWeight.length >= 3
          ? `Top 3 Weight   : ${analytics.top3Pct.toFixed(1)}% (${analytics.byWeight.slice(0,3).map(p=>p.ticker).join(", ")})`
          : "",
        analytics.topSector ? `Top Sector     : ${analytics.topSector[0]} ${(analytics.topSector[1]*100).toFixed(1)}%` : "",
        sharpe  != null ? `Sharpe (${equityTf})  : ${sharpe} — ${sharpeLabel(sharpe)}` : "",
        maxDrawdown != null && maxDrawdown < 0 ? `Max Drawdown   : ${maxDrawdown}% (${equityTf})` : "",
        "",
        "HOLDINGS (ticker · shares · cost → price · P&L · return · weight · beta):",
      );
      analytics.byWeight.forEach(p => {
        lines.push(
          `  ${p.ticker}: ${p.shares} sh @ ${$(p.avgCost)} → ${$(p.price)} | ` +
          `${p.pnl >= 0 ? "+" : ""}${$(p.pnl)} (${pct(p.pnlPct)}) | ` +
          `${(p.weight*100).toFixed(1)}% | β ${d2(p.beta)} | ${p.sector}`
        );
      });
      lines.push("", "SECTOR EXPOSURE:");
      Object.entries(analytics.sectorWeights)
        .sort((a, b) => b[1] - a[1])
        .forEach(([sec, w]) => lines.push(`  ${sec}: ${(w*100).toFixed(1)}%`));
    }

    const context = lines.filter(Boolean).join("\n");
    const savedKey = localStorage.getItem("ov_copilot_key") || "";

    try {
      const r = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content:
            "Analyze my portfolio. Use the exact numbers from the data. Provide:\n" +
            "1. **Overall assessment** — total return, beta interpretation, is this portfolio aligned with typical investor risk tolerance?\n" +
            "2. **Concentration risk** — call out specific overweights (single-name and sector), cite exact percentages\n" +
            "3. **Beta and volatility profile** — what does beta " + (analytics?.portfolioBeta?.toFixed(2) || "?") + " mean in a down 10% market scenario?\n" +
            "4. **Position-level highlights** — best performer, worst performer, and any positions with unusual risk/reward\n" +
            "5. **Actionable rebalancing** — specific tickers to trim or add, with sizing suggestion\n\n" +
            "Be precise. Cite the actual P&L dollars, beta values, and percentages. Avoid generic advice."
          }],
          context,
          apiKey: savedKey,
        }),
      });
      const data = await r.json();
      if (data.error === "no_key") setAiError("No API key found. Open the 🤖 Copilot and enter your OpenAI or Anthropic key first.");
      else if (data.error) setAiError(data.error);
      else setAiAnalysis(data.message);
    } catch (err) {
      setAiError("Request failed: " + err.message);
    }
    setAiLoading(false);
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const inputStyle = {
    background: "var(--surface-0)", border: "1px solid var(--border-solid)", borderRadius: 10,
    color: "var(--text-1)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
    padding: "6px 8px", width: "100%",
  };
  const TF_OPTS  = ["1M", "3M", "6M", "1Y"];
  const curveUp  = equityHistory.length > 1 && equityHistory[equityHistory.length-1].value >= equityHistory[0].value;
  const curveClr = curveUp ? "#059669" : "#e11d48";
  const pctChange = equityHistory.length > 1
    ? ((equityHistory[equityHistory.length-1].value - equityHistory[0].value) / equityHistory[0].value * 100).toFixed(2)
    : null;

  const MONO = { fontFamily: "'IBM Plex Mono',monospace" };

  // ── KPI card data ──────────────────────────────────────────────────────────
  const betaClr = analytics
    ? analytics.portfolioBeta > 1.5 ? "#e11d48"
      : analytics.portfolioBeta > 1.1 ? "#b45309"
      : analytics.portfolioBeta < 0.7 ? "#059669"
      : "var(--text-1)"
    : "var(--text-3)";

  const kpiCards = [
    { label: "Portfolio Value", value: "$" + totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: "var(--text-1)", sub: null },
    { label: "Today's P&L",    value: (dayPnlTotal >= 0 ? "+" : "") + "$" + Math.abs(dayPnlTotal).toFixed(2), color: clr(dayPnlTotal), sub: null },
    { label: "Total P&L",      value: (totalPnl >= 0 ? "+" : "") + "$" + Math.abs(totalPnl).toFixed(2), color: clr(totalPnl), sub: null },
    { label: "Total Return",   value: totalCost > 0 ? fmt.pct(totalPnlPct) : "—", color: totalCost > 0 ? clr(totalPnlPct) : "var(--text-3)", sub: null },
    {
      label: "Portfolio Beta",
      value: analytics ? analytics.portfolioBeta.toFixed(2) : "—",
      color: betaClr,
      sub: analytics ? betaLabel(analytics.portfolioBeta) : null,
    },
    {
      label: "Top Concentration",
      value: analytics ? (analytics.top1.weight * 100).toFixed(1) + "%" : "—",
      color: analytics
        ? analytics.top1.weight > 0.3 ? "#e11d48"
          : analytics.top1.weight > 0.2 ? "#b45309"
          : "#059669"
        : "var(--text-3)",
      sub: analytics ? analytics.top1.ticker + " · HHI " + analytics.hhi : null,
    },
  ];

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 90px)", overflowY: "auto", gap: 0 }}>

      {/* ── Row 1 · KPI cards ─────────────────────────────────────────────── */}
      <div className="p-2 pb-0" style={{ flexShrink: 0 }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
          {kpiCards.map(({ label, value, color, sub }) => (
            <div key={label} className="terminal-panel p-3">
              <div style={{ ...MONO, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 9 }}>{label}</div>
              <div style={{ ...MONO, color, fontSize: 18, fontWeight: 700, marginTop: 3 }}>{value}</div>
              {sub && <div style={{ ...MONO, color: "var(--text-3)", fontSize: 9, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>

        {/* AI Analyze button */}
        {holdings.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <button onClick={runPortfolioAnalysis} disabled={aiLoading} className="font-mono flex items-center gap-1.5"
                style={{ background: aiLoading ? "var(--surface-2)" : "linear-gradient(135deg,#1d4ed8,#2563eb)", border: "none",
                  borderRadius: 8, padding: "6px 14px", fontSize: 11, cursor: aiLoading ? "not-allowed" : "pointer",
                  color: "#fff", fontWeight: 600, letterSpacing: "0.03em", opacity: aiLoading ? 0.7 : 1,
                  boxShadow: aiLoading ? "none" : "0 2px 8px rgba(37,99,235,0.35)" }}>
                {aiLoading
                  ? <><span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>⟳</span> Analyzing…</>
                  : <>🤖 Deep Portfolio Analysis</>}
              </button>
              {aiAnalysis && !aiLoading && (
                <button onClick={() => setAiAnalysis(null)} style={{ background:"var(--surface-2)", border:"1px solid var(--border-solid)",
                  borderRadius:6, padding:"4px 10px", fontSize:10, cursor:"pointer", color:"var(--text-3)", ...MONO }}>Clear</button>
              )}
            </div>
            {aiError && (
              <div style={{ ...MONO, background:"var(--surface-0)", border:"1px solid #e11d48", borderRadius:8, color:"#e11d48", fontSize:11, lineHeight:1.6, marginTop:8, padding:"10px 12px" }}>⚠ {aiError}</div>
            )}
            {aiAnalysis && (
              <div className="mt-2 terminal-panel p-4" style={{ borderLeft:"3px solid #2563eb" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ ...MONO, color:"var(--text-1)", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>🤖 AI Portfolio Analysis</span>
                </div>
                <div style={{ ...MONO, color:"var(--text-2)", fontSize:11, lineHeight:1.75 }}>
                  <MdText text={aiAnalysis} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Row 2 · Equity Curve + Donut ──────────────────────────────────── */}
      <div className="flex gap-2 px-2 pb-2" style={{ flexShrink: 0, minHeight: 240 }}>

        <div className="terminal-panel terminal-glow flex-1 flex flex-col p-3">
          <div className="flex items-center justify-between mb-2" style={{ flexShrink: 0 }}>
            <div className="flex items-center gap-3">
              <span className="terminal-header">📈 Equity Curve</span>
              {pctChange !== null && (
                <span style={{ ...MONO, fontSize: 12, color: curveClr, fontWeight: 700 }}>
                  {curveUp ? "▲" : "▼"} {Math.abs(pctChange)}% this period
                </span>
              )}
              {sharpe !== null && (
                <span style={{ ...MONO, fontSize: 10, color: "var(--text-3)" }}>
                  · Sharpe <span style={{ color: sharpe > 1 ? "#059669" : sharpe > 0 ? "#b45309" : "#e11d48" }}>{sharpe}</span>
                </span>
              )}
              {maxDrawdown !== null && maxDrawdown < 0 && (
                <span style={{ ...MONO, fontSize: 10, color: "var(--text-3)" }}>
                  · Max DD <span style={{ color: "#e11d48" }}>{maxDrawdown}%</span>
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {TF_OPTS.map(tf => (
                <button key={tf} onClick={() => setEquityTf(tf)}
                  style={{ padding:"2px 8px", fontSize:10, ...MONO, fontWeight:600,
                    background: equityTf===tf ? curveClr : "transparent",
                    color: equityTf===tf ? "#fff" : "var(--text-3)",
                    border:`1px solid ${equityTf===tf ? curveClr : "var(--border)"}`,
                    borderRadius:4, cursor:"pointer" }}>{tf}</button>
              ))}
            </div>
          </div>

          {holdings.length === 0 ? (
            <div className="flex items-center justify-center flex-1 font-mono" style={{ color:"var(--text-3)", fontSize:12 }}>Add positions to see your equity curve</div>
          ) : equityLoading ? (
            <div className="flex items-center justify-center flex-1 font-mono animate-pulse" style={{ color:"var(--text-3)", fontSize:12 }}>Building equity curve…</div>
          ) : equityHistory.length < 2 ? (
            <div className="flex items-center justify-center flex-1 font-mono" style={{ color:"var(--text-3)", fontSize:12 }}>Not enough history data</div>
          ) : (
            <ResponsiveContainer width="100%" height={175}>
              <AreaChart data={equityHistory} margin={{ top:4, right:4, bottom:0, left:0 }}>
                <defs>
                  <linearGradient id="pf-eq-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={curveClr} stopOpacity={0.22}/>
                    <stop offset="95%" stopColor={curveClr} stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)"/>
                <XAxis dataKey="date" tick={{ fontSize:9, fill:"var(--text-3)", ...MONO }} tickFormatter={d => d.slice(5)} minTickGap={30}/>
                <YAxis tick={{ fontSize:9, fill:"var(--text-3)", ...MONO }} tickFormatter={v => "$"+(v>=1000?(v/1000).toFixed(0)+"k":v.toFixed(0))} width={52}/>
                <Tooltip contentStyle={{ background:"var(--surface-2)", border:"1px solid var(--border-solid)", borderRadius:8, fontSize:10, ...MONO }} labelStyle={{ color:"var(--text-3)", marginBottom:4 }}
                  formatter={(v, name) => ["$"+v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}), name==="value"?"Portfolio":"Cost Basis"]}/>
                <Area type="monotone" dataKey="cost"  stroke="var(--text-3)" fill="none" strokeWidth={1} strokeDasharray="5 3" dot={false}/>
                <Area type="monotone" dataKey="value" stroke={curveClr} fill="url(#pf-eq-grad)" strokeWidth={2} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Allocation Donut */}
        <div className="terminal-panel terminal-glow p-3 flex flex-col" style={{ width:240, flexShrink:0 }}>
          <span className="terminal-header mb-2">🍩 Allocation</span>
          {donutData.length === 0 ? (
            <div className="flex items-center justify-center flex-1 font-mono" style={{ color:"var(--text-3)", fontSize:11 }}>No positions</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                    dataKey="value" paddingAngle={donutData.length>1?2:0} startAngle={90} endAngle={-270}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} stroke="none"/>)}
                  </Pie>
                  <Tooltip contentStyle={{ background:"var(--surface-2)", border:"1px solid var(--border-solid)", borderRadius:8, fontSize:10, ...MONO }}
                    formatter={v => ["$"+v.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0}),"Value"]}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5" style={{ overflowY:"auto" }}>
                {donutData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div style={{ width:8, height:8, borderRadius:2, background:d.color, flexShrink:0 }}/>
                    <span style={{ ...MONO, fontSize:11, color:"var(--text-1)", flex:1, fontWeight:700 }}>{d.name}</span>
                    <span style={{ ...MONO, fontSize:11, color:"var(--text-3)" }}>
                      {totalValue>0?((d.value/totalValue)*100).toFixed(1)+"%":"—"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Row 3 · Holdings Table + Right Panel ──────────────────────────── */}
      <div className="flex gap-2 px-2 pb-2" style={{ flexShrink:0 }}>

        {/* Holdings table */}
        <div className="terminal-panel terminal-glow flex-1 flex flex-col p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="terminal-header">💼 Holdings ({holdings.length})</span>
            <button onClick={refreshQuotes} disabled={loadingQuotes}
              style={{ ...MONO, border:"1px solid var(--border-solid)", borderRadius:10, background:"transparent",
                color:loadingQuotes?"var(--text-3)":"#2563eb", cursor:loadingQuotes?"wait":"pointer", fontSize:11, padding:"2px 10px" }}>
              {loadingQuotes ? "⟳ Updating…" : "⟳ Refresh"}
            </button>
          </div>

          {holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8" style={{ color:"var(--text-3)" }}>
              <div style={{ ...MONO, fontSize:11 }}>No positions yet. Add holdings using the form →</div>
            </div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--border-solid)" }}>
                  {["Ticker","Shares","Avg Cost","Price","Mkt Value","P&L ($)","Return","Beta","Day Chg",""].map(h => (
                    <th key={h} className="text-left px-2 py-2"
                      style={{ ...MONO, color:"var(--text-3)", fontSize:9, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
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
                  const beta   = betaMap[h.ticker];
                  const dot    = PF_COLORS[hi % PF_COLORS.length];
                  return (
                    <tr key={h.ticker} style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <div style={{ width:6, height:6, borderRadius:"50%", background:dot, flexShrink:0 }}/>
                          <span style={{ ...MONO, fontWeight:700, color:dot, fontSize:12 }}>{h.ticker}</span>
                        </div>
                        <div style={{ ...MONO, color:"var(--text-3)", fontSize:9, paddingLeft:10 }}>{alloc.toFixed(1)}%</div>
                      </td>
                      <td className="px-2 py-2" style={{ ...MONO, color:"var(--text-1)", fontSize:12 }}>{h.shares.toLocaleString()}</td>
                      <td className="px-2 py-2" style={{ ...MONO, color:"var(--text-1)", fontSize:12 }}>${fmt.price(h.avgCost)}</td>
                      <td className="px-2 py-2" style={{ ...MONO, color:price!==null?"var(--text-1)":"var(--text-3)", fontSize:12 }}>
                        {price!==null?"$"+fmt.price(price):loadingQuotes?"…":"—"}
                      </td>
                      <td className="px-2 py-2" style={{ ...MONO, color:"var(--text-1)", fontSize:12 }}>
                        {mktVal!==null?"$"+mktVal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"}
                      </td>
                      <td className="px-2 py-2" style={{ ...MONO, color:pnl!==null?clr(pnl):"var(--text-3)", fontSize:12 }}>
                        {pnl!==null?(pnl>=0?"+":"")+"$"+Math.abs(pnl).toFixed(2):"—"}
                      </td>
                      <td className="px-2 py-2" style={{ ...MONO, color:pnlPct!==null?clr(pnlPct):"var(--text-3)", fontSize:12 }}>
                        {pnlPct!==null?fmt.pct(pnlPct):"—"}
                      </td>
                      <td className="px-2 py-2" style={{ ...MONO, fontSize:12,
                        color:beta==null?"var(--text-3)":beta>1.5?"#e11d48":beta>1.1?"#b45309":"#059669" }}>
                        {beta!=null?beta.toFixed(2):<span style={{ color:"var(--text-3)", fontSize:10 }}>~1.0</span>}
                      </td>
                      <td className="px-2 py-2" style={{ ...MONO, color:q?.changePct!=null?clr(q.changePct):"var(--text-3)", fontSize:12 }}>
                        {q?.changePct!=null?fmt.pct(q.changePct):"—"}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeHolding(h.ticker)}
                          style={{ color:"#e11d48", background:"none", border:"none", cursor:"pointer", fontSize:14, lineHeight:1 }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {holdings.length > 1 && (
                <tfoot>
                  <tr style={{ borderTop:"1px solid var(--border-solid)" }}>
                    <td className="px-2 py-2" style={{ ...MONO, color:"var(--text-3)", fontSize:11, fontWeight:700 }} colSpan={4}>TOTAL</td>
                    <td className="px-2 py-2" style={{ ...MONO, color:"var(--text-1)", fontSize:12, fontWeight:700 }}>
                      ${totalValue.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
                    </td>
                    <td className="px-2 py-2" style={{ ...MONO, color:clr(totalPnl), fontSize:12, fontWeight:700 }}>
                      {totalPnl>=0?"+":""}${Math.abs(totalPnl).toFixed(2)}
                    </td>
                    <td className="px-2 py-2" style={{ ...MONO, color:clr(totalPnlPct), fontSize:12, fontWeight:700 }}>
                      {fmt.pct(totalPnlPct)}
                    </td>
                    <td className="px-2 py-2" style={{ ...MONO, color:"var(--text-3)", fontSize:11 }}>
                      {analytics ? "β " + analytics.portfolioBeta.toFixed(2) : ""}
                    </td>
                    <td colSpan={2}/>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* ── Right column ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2" style={{ width:280, flexShrink:0 }}>

          {/* Add position form */}
          <div className="terminal-panel terminal-glow p-3">
            <div className="terminal-header mb-3">+ Add / Update Position</div>
            <div className="flex flex-col gap-2">
              {[
                { label:"Ticker",                key:"ticker",  id:"pf-ticker", placeholder:"AAPL",   type:"text",   next:"pf-shares" },
                { label:"Shares",                key:"shares",  id:"pf-shares", placeholder:"100",    type:"number", next:"pf-cost"   },
                { label:"Avg Cost / Share ($)",  key:"avgCost", id:"pf-cost",   placeholder:"150.00", type:"number", next:null        },
              ].map(({ label, key, id, placeholder, type, next }) => (
                <div key={key}>
                  <div style={{ ...MONO, color:"var(--text-3)", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>{label}</div>
                  <input id={id} type={type} min={type==="number"?"0":undefined} step={type==="number"?"any":undefined}
                    value={key==="ticker"?form.ticker:key==="shares"?form.shares:form.avgCost}
                    onChange={e => setForm(f => ({...f,[key]:key==="ticker"?e.target.value.toUpperCase():e.target.value}))}
                    onKeyDown={e => e.key==="Enter"&&(next?document.getElementById(next)?.focus():addHolding())}
                    placeholder={placeholder} style={inputStyle}/>
                </div>
              ))}
              {formError && <div style={{ ...MONO, color:"#e11d48", fontSize:11 }}>{formError}</div>}
              <button onClick={addHolding} style={{ background:"#2563eb", border:"none", borderRadius:10, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600, letterSpacing:"0.05em", padding:"8px 0", ...MONO }}>
                ADD POSITION
              </button>
              <div style={{ ...MONO, color:"var(--text-3)", fontSize:10 }}>Adding an existing ticker averages your cost basis.</div>
            </div>
          </div>

          {/* ── Risk Analytics ─────────────────────────────────────────────── */}
          {analytics && (
            <div className="terminal-panel terminal-glow p-3">
              <div className="terminal-header mb-3">⚡ Risk Analytics</div>

              {/* Portfolio Beta gauge */}
              <div className="mb-3">
                <div className="flex justify-between" style={{ marginBottom:4 }}>
                  <span style={{ ...MONO, fontSize:9, color:"var(--text-3)", textTransform:"uppercase" }}>Portfolio Beta</span>
                  <span style={{ ...MONO, fontSize:11, fontWeight:700, color:betaClr }}>{analytics.portfolioBeta.toFixed(2)}</span>
                </div>
                <div style={{ position:"relative", height:6, borderRadius:3, background:"var(--surface-3)" }}>
                  {/* reference line at β=1 */}
                  <div style={{ position:"absolute", left:"50%", top:-2, bottom:-2, width:1, background:"#94a3b8", opacity:0.5 }}/>
                  <div style={{
                    position:"absolute", left:0,
                    width: Math.min((analytics.portfolioBeta / 2) * 100, 100) + "%",
                    height:"100%", borderRadius:3,
                    background: analytics.portfolioBeta > 1.5 ? "#e11d48" : analytics.portfolioBeta > 1.1 ? "#b45309" : "#059669",
                    transition:"width 0.4s",
                  }}/>
                </div>
                <div className="flex justify-between" style={{ marginTop:3 }}>
                  <span style={{ ...MONO, fontSize:7, color:"var(--text-3)" }}>0 (defensive)</span>
                  <span style={{ ...MONO, fontSize:7, color:"#94a3b8" }}>β=1</span>
                  <span style={{ ...MONO, fontSize:7, color:"var(--text-3)" }}>2 (aggressive)</span>
                </div>
                <div style={{ ...MONO, fontSize:9, color:betaClr, marginTop:2 }}>
                  {betaLabel(analytics.portfolioBeta)} — down 10% market → ~{(analytics.portfolioBeta * 10).toFixed(1)}% portfolio loss
                </div>
              </div>

              {/* HHI Concentration */}
              <div className="mb-3">
                <div className="flex justify-between" style={{ marginBottom:4 }}>
                  <span style={{ ...MONO, fontSize:9, color:"var(--text-3)", textTransform:"uppercase" }}>Concentration (HHI)</span>
                  <span style={{ ...MONO, fontSize:11, fontWeight:700, color:analytics.hhi>2500?"#e11d48":analytics.hhi>1500?"#b45309":"#059669" }}>{analytics.hhi}</span>
                </div>
                <div style={{ position:"relative", height:6, borderRadius:3, background:"var(--surface-3)" }}>
                  <div style={{
                    position:"absolute", left:0,
                    width:Math.min((analytics.hhi / 5000)*100, 100)+"%",
                    height:"100%", borderRadius:3,
                    background:analytics.hhi>2500?"#e11d48":analytics.hhi>1500?"#b45309":"#059669",
                    transition:"width 0.4s",
                  }}/>
                </div>
                <div style={{ ...MONO, fontSize:9, marginTop:3,
                  color:analytics.hhi>2500?"#e11d48":analytics.hhi>1500?"#b45309":"#059669" }}>
                  {hhiLabel(analytics.hhi)}
                </div>
              </div>

              {/* Top N concentration */}
              <div className="mb-3">
                <div style={{ ...MONO, fontSize:9, color:"var(--text-3)", textTransform:"uppercase", marginBottom:4 }}>Position Concentration</div>
                {[
                  { label:"Top 1", pct:(analytics.top1.weight*100), name:analytics.top1.ticker },
                  ...(analytics.byWeight.length>=3?[{label:"Top 3",pct:analytics.top3Pct,name:analytics.byWeight.slice(0,3).map(p=>p.ticker).join("+")}]:[]),
                  ...(analytics.byWeight.length>=5?[{label:"Top 5",pct:analytics.top5Pct,name:analytics.byWeight.slice(0,5).map(p=>p.ticker).join("+")}]:[]),
                ].map(({ label, pct, name }) => (
                  <div key={label} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                    <span style={{ ...MONO, fontSize:8, color:"var(--text-3)", width:32 }}>{label}</span>
                    <div style={{ flex:1, height:4, borderRadius:2, background:"var(--surface-3)", position:"relative" }}>
                      <div style={{ position:"absolute", left:0, width:pct+"%", height:"100%", borderRadius:2,
                        background:pct>50?"#e11d48":pct>30?"#b45309":"#2563eb", transition:"width 0.4s" }}/>
                    </div>
                    <span style={{ ...MONO, fontSize:9, color:"var(--text-1)", width:36, textAlign:"right" }}>{pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>

              {/* Sharpe + Max DD if available */}
              {(sharpe !== null || (maxDrawdown !== null && maxDrawdown < 0)) && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:4, paddingTop:8, borderTop:"1px solid var(--border-subtle)" }}>
                  {sharpe !== null && (
                    <div>
                      <div style={{ ...MONO, fontSize:8, color:"var(--text-3)", textTransform:"uppercase" }}>Sharpe ({equityTf})</div>
                      <div style={{ ...MONO, fontSize:16, fontWeight:700, color:sharpe>1?"#059669":sharpe>0?"#b45309":"#e11d48", marginTop:1 }}>{sharpe}</div>
                      <div style={{ ...MONO, fontSize:8, color:"var(--text-3)" }}>{sharpeLabel(sharpe)}</div>
                    </div>
                  )}
                  {maxDrawdown !== null && maxDrawdown < 0 && (
                    <div>
                      <div style={{ ...MONO, fontSize:8, color:"var(--text-3)", textTransform:"uppercase" }}>Max Drawdown</div>
                      <div style={{ ...MONO, fontSize:16, fontWeight:700, color:"#e11d48", marginTop:1 }}>{maxDrawdown}%</div>
                      <div style={{ ...MONO, fontSize:8, color:"var(--text-3)" }}>Peak-to-trough ({equityTf})</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sector Exposure */}
          {sectorData.length > 0 && (
            <div className="terminal-panel terminal-glow p-3">
              <div className="terminal-header mb-3">🏭 Sector Exposure</div>
              {sectorData.map(s => {
                const pct = totalValue > 0 ? (s.value / totalValue) * 100 : 0;
                return (
                  <div key={s.sector} className="mb-2">
                    <div className="flex justify-between font-mono mb-1" style={{ fontSize:10 }}>
                      <span style={{ color:s.color, fontWeight:600 }}>{s.sector}</span>
                      <span style={{ color:"var(--text-3)" }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ background:"var(--surface-3)", borderRadius:3, height:5 }}>
                      <div style={{ width:pct+"%", height:"100%", background:s.color, borderRadius:3, transition:"width 0.4s ease", opacity:0.85 }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Best / Worst */}
          {posPerf.length > 0 && (
            <div className="terminal-panel terminal-glow p-3">
              <div className="terminal-header mb-3">🏆 Best &amp; Worst</div>
              <div className="mb-3">
                <div style={{ ...MONO, color:"#059669", fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>▲ Winners</div>
                {posPerf.slice(0, Math.min(3, Math.ceil(posPerf.length/2))).map(h => (
                  <div key={h.ticker} className="flex items-center justify-between py-1.5" style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                    <div>
                      <span style={{ ...MONO, fontWeight:700, fontSize:11, color:"var(--text-1)" }}>{h.ticker}</span>
                      <span style={{ ...MONO, marginLeft:6, fontSize:10, color:"var(--text-3)" }}>
                        {h.pnl>=0?"+":"-"}${Math.abs(h.pnl).toFixed(0)}
                      </span>
                    </div>
                    <div style={{ ...MONO, fontWeight:700, fontSize:12, color:"#059669" }}>
                      {h.pnlPct>=0?"+":""}{h.pnlPct.toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
              {posPerf.filter(h => h.pnlPct < 0).length > 0 && (
                <div>
                  <div style={{ ...MONO, color:"#e11d48", fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>▼ Laggards</div>
                  {[...posPerf].reverse().slice(0, Math.min(3, Math.ceil(posPerf.length/2))).filter(h => h.pnlPct<0).map(h => (
                    <div key={h.ticker} className="flex items-center justify-between py-1.5" style={{ borderBottom:"1px solid var(--border-subtle)" }}>
                      <div>
                        <span style={{ ...MONO, fontWeight:700, fontSize:11, color:"var(--text-1)" }}>{h.ticker}</span>
                        <span style={{ ...MONO, marginLeft:6, fontSize:10, color:"var(--text-3)" }}>
                          -${Math.abs(h.pnl).toFixed(0)}
                        </span>
                      </div>
                      <div style={{ ...MONO, fontWeight:700, fontSize:12, color:"#e11d48" }}>
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
