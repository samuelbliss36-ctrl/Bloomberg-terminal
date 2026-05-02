import { useState, useEffect } from "react";
import {
  ComposedChart, Area, Bar, Line, Cell,
  ReferenceLine, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Pure math helpers (module scope — no re-allocation on render)
// ─────────────────────────────────────────────────────────────────────────────

function calcEMA(prices, period) {
  const k = 2 / (period + 1);
  return prices.reduce((acc, p, i) => {
    acc.push(i === 0 ? p : p * k + acc[i - 1] * (1 - k));
    return acc;
  }, []);
}

function calcRSI(prices, period = 14) {
  const rsi = new Array(prices.length).fill(null);
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) ag += d; else al -= d;
  }
  ag /= period; al /= period;
  rsi[period] = 100 - 100 / (1 + ag / (al || 0.001));
  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    rsi[i] = 100 - 100 / (1 + ag / (al || 0.001));
  }
  return rsi;
}

function calcSMA(prices, period) {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    return +(sum / period).toFixed(2);
  });
}

function calcBB(prices, period = 20, mult = 2) {
  return prices.map((_, i) => {
    if (i < period - 1) return { upper: null, middle: null, lower: null, pctB: null, bWidth: null };
    const sl = prices.slice(i - period + 1, i + 1);
    const mean = sl.reduce((a, b) => a + b, 0) / period;
    const std  = Math.sqrt(sl.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    const upper = +(mean + mult * std).toFixed(2);
    const lower = +(mean - mult * std).toFixed(2);
    return {
      upper,
      middle: +mean.toFixed(2),
      lower,
      pctB:   std === 0 ? 0.5 : +((prices[i] - lower) / (upper - lower)).toFixed(3),
      bWidth: mean === 0 ? 0 : +((upper - lower) / mean * 100).toFixed(2),
    };
  });
}

function calcATR(highs, lows, closes, period = 14) {
  const tr = closes.map((c, i) =>
    i === 0
      ? highs[i] - lows[i]
      : Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]))
  );
  const atr = new Array(closes.length).fill(null);
  if (tr.length >= period) {
    atr[period - 1] = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < tr.length; i++)
      atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr.map(v => v != null ? +v.toFixed(3) : null);
}

function calcStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
  const rawK = closes.map((c, i) => {
    if (i < kPeriod - 1) return null;
    const hi = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
    const lo = Math.min(...lows.slice(i  - kPeriod + 1, i + 1));
    return hi === lo ? 50 : +((c - lo) / (hi - lo) * 100).toFixed(1);
  });
  const d = rawK.map((_, i) => {
    const w = rawK.slice(Math.max(0, i - dPeriod + 1), i + 1).filter(v => v != null);
    return w.length === dPeriod ? +(w.reduce((a, b) => a + b, 0) / dPeriod).toFixed(1) : null;
  });
  return { k: rawK, d };
}

/** Count consecutive sessions the series has been moving in `direction` (+1 or -1). */
function countStreak(arr, direction) {
  let n = 0;
  for (let i = arr.length - 1; i > 0; i--) {
    if (arr[i] == null || arr[i - 1] == null) break;
    const delta = arr[i] - arr[i - 1];
    if (direction > 0 && delta > 0.0001) n++;
    else if (direction < 0 && delta < -0.0001) n++;
    else break;
  }
  return n;
}

/** Find the most recent MACD/Signal crossover. */
function findLastCrossover(macd, signal) {
  for (let i = macd.length - 1; i > 0; i--) {
    if (macd[i] == null || signal[i] == null || macd[i-1] == null || signal[i-1] == null) continue;
    const prev = macd[i-1] - signal[i-1];
    const curr = macd[i]   - signal[i];
    if (prev <= 0 && curr > 0) return { type: "bullish", sessionsAgo: macd.length - 1 - i };
    if (prev >= 0 && curr < 0) return { type: "bearish", sessionsAgo: macd.length - 1 - i };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const AXIS   = { fill: "#64748b", fontSize: 9, fontFamily: "monospace" };
const TT     = { background: "var(--surface-2)", border: "1px solid rgba(15,23,42,0.18)", borderRadius: 10, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" };
const MONO   = { fontFamily: "'IBM Plex Mono',monospace" };
const TF_MAP = { "1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y" };

// ── Stable sub-components at module scope (never redefined on render) ─────────
function ChartPanel({ title, height, loading, children }) {
  return (
    <div className="terminal-panel terminal-glow p-3" style={{ flexShrink: 0, height }}>
      <div className="terminal-header mb-2" style={{ fontSize: 10 }}>{title}</div>
      {loading
        ? <div className="flex items-center justify-center h-full text-xs font-mono animate-pulse" style={{ color: "var(--text-3)" }}>Loading…</div>
        : children}
    </div>
  );
}

function SigCard({ title, children }) {
  return (
    <div className="p-3 rounded" style={{ background: "var(--surface-0)", border: "1px solid var(--border)", flexShrink: 0 }}>
      <div className="terminal-header mb-2" style={{ fontSize: 9 }}>{title}</div>
      {children}
    </div>
  );
}

export default function TechnicalAnalysis({ ticker, onContextUpdate }) {
  const [data,    setData]    = useState([]);
  const [tf,      setTf]      = useState("3M");
  const [loading, setLoading] = useState(true);

  // ── Data fetch + indicator computation ──────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    fetch("/api/chart?ticker=" + encodeURIComponent(ticker) + "&range=" + TF_MAP[tf] + "&interval=1d")
      .then(r => r.json())
      .then(d => {
        const result = d?.chart?.result?.[0];
        if (!result) { setLoading(false); return; }

        const q   = result.indicators.quote[0];
        const ts  = result.timestamp || [];
        // filter rows where close is valid
        const raw = ts.map((t, i) => ({
          t,
          c: q.close[i],
          h: q.high?.[i]   ?? q.close[i],
          l: q.low?.[i]    ?? q.close[i],
          v: q.volume?.[i] ?? 0,
        })).filter(p => p.c != null);

        const dates = raw.map(p => new Date(p.t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
        const cs    = raw.map(p => +p.c.toFixed(2));
        const hs    = raw.map(p => +p.h.toFixed(2));
        const ls    = raw.map(p => +p.l.toFixed(2));
        const vs    = raw.map(p => p.v);

        // ── compute all indicators ────────────────────────────────────────────
        const rsiVals   = calcRSI(cs, 14);
        const ema12     = calcEMA(cs, 12);
        const ema26     = calcEMA(cs, 26);
        const macdLine  = ema12.map((v, i) => +(v - ema26[i]).toFixed(4));
        const sigLine   = calcEMA(macdLine, 9).map(v => +v.toFixed(4));
        const histLine  = macdLine.map((v, i) => +(v - sigLine[i]).toFixed(4));
        const bbArr     = calcBB(cs, 20, 2);
        const sma20     = calcSMA(cs, 20);
        const sma50     = calcSMA(cs, 50);
        const atrArr    = calcATR(hs, ls, cs, 14);
        const stoch     = calcStochastic(hs, ls, cs, 14, 3);

        setData(dates.map((date, i) => ({
          date,
          close:     cs[i],
          rsi:       rsiVals[i] != null ? +rsiVals[i].toFixed(1) : null,
          macd:      macdLine[i],
          signal:    sigLine[i],
          histogram: histLine[i],
          bbUpper:   bbArr[i].upper,
          bbMiddle:  bbArr[i].middle,
          bbLower:   bbArr[i].lower,
          pctB:      bbArr[i].pctB,
          bWidth:    bbArr[i].bWidth,
          sma20:     sma20[i],
          sma50:     sma50[i],
          atr:       atrArr[i],
          stochK:    stoch.k[i],
          stochD:    stoch.d[i],
          volume:    +(vs[i] / 1e6).toFixed(2),
        })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticker, tf]); // eslint-disable-line

  // ── Derived values ───────────────────────────────────────────────────────────
  const last = data[data.length - 1] || {};

  const rsiArr    = data.map(d => d.rsi).filter(v => v != null);
  const histArr   = data.map(d => d.histogram).filter(v => v != null);
  const macdArr   = data.map(d => d.macd);
  const sigArr    = data.map(d => d.signal);

  const rsiDir    = rsiArr.length  >= 2 ? Math.sign(rsiArr[rsiArr.length - 1]   - rsiArr[rsiArr.length - 2])   : 0;
  const histDir   = histArr.length >= 2 ? Math.sign(histArr[histArr.length - 1] - histArr[histArr.length - 2]) : 0;
  const rsiStreak  = rsiDir  !== 0 ? countStreak(rsiArr,  rsiDir)  : 0;
  const histStreak = histDir !== 0 ? countStreak(histArr, histDir) : 0;
  const crossover  = findLastCrossover(macdArr, sigArr);

  const rsiLabel   = !last.rsi ? "—" : last.rsi > 70 ? "OVERBOUGHT" : last.rsi < 30 ? "OVERSOLD" : "NEUTRAL";
  const rsiColor   = !last.rsi ? "var(--text-3)" : last.rsi > 70 ? "#e11d48" : last.rsi < 30 ? "#059669" : "#64748b";
  const macdBull   = last.macd != null && last.signal != null && last.macd > last.signal;
  const bbSig      = !last.bbUpper ? "—" : last.close > last.bbUpper ? "ABOVE UPPER" : last.close < last.bbLower ? "BELOW LOWER" : "INSIDE BANDS";
  const squeeze    = last.bWidth != null && last.bWidth < 4;
  const stochLabel = !last.stochK ? "—" : last.stochK > 80 ? "OVERBOUGHT" : last.stochK < 20 ? "OVERSOLD" : "NEUTRAL";
  const stochColor = !last.stochK ? "var(--text-3)" : last.stochK > 80 ? "#e11d48" : last.stochK < 20 ? "#059669" : "#64748b";
  const atrPct     = last.atr && last.close ? (last.atr / last.close * 100).toFixed(1) : null;

  // Bull / bear scoring
  let bull = 0, bear = 0;
  if (last.rsi) { if (last.rsi < 30) bull += 2; else if (last.rsi > 70) bear += 2; else if (last.rsi < 50) bear++; else bull++; }
  if (last.macd != null && last.signal != null) { macdBull ? bull++ : bear++; }
  if (histDir !== 0) { histDir > 0 ? bull++ : bear++; }
  if (last.pctB != null) { if (last.pctB < 0.2) bull++; else if (last.pctB > 0.8) bear++; }
  if (last.stochK != null) { if (last.stochK < 20) bull += 2; else if (last.stochK > 80) bear += 2; else if (last.stochK < 50) bear++; else bull++; }
  if (last.sma20 && last.close) { last.close > last.sma20 ? bull++ : bear++; }
  if (last.sma50 && last.close) { last.close > last.sma50 ? bull++ : bear++; }
  const total      = bull + bear || 1;
  const bullPct    = Math.round(bull / total * 100);
  const overallSig = bullPct > 65 ? "BUY" : bullPct < 35 ? "SELL" : "NEUTRAL";
  const overallClr = bullPct > 65 ? "#059669" : bullPct < 35 ? "#e11d48" : "#b45309";

  // ── AI context string ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!onContextUpdate || !data.length || !last.close) return;

    const s = (n, label) => n !== 1 ? `${n} ${label}s` : `${n} ${label}`;

    const lines = [
      `=== TECHNICAL ANALYSIS: ${ticker} (${tf} timeframe) ===`,
      `Current Price: $${last.close}`,
      "",
      last.rsi != null
        ? `RSI(14): ${last.rsi.toFixed(1)} — ${rsiLabel}; ${rsiDir > 0 ? `rising` : `falling`} for ${s(rsiStreak, "session")} consecutively`
        : "RSI(14): insufficient data",
      "",
      last.macd != null
        ? `MACD(12,26,9): Line=${last.macd.toFixed(4)} | Signal=${last.signal?.toFixed(4)} | Histogram=${last.histogram?.toFixed(4)}`
        : "",
      last.histogram != null
        ? `MACD Histogram ${histDir < 0 ? `DECLINING for ${s(histStreak, "session")} (bearish momentum building)` : `RISING for ${s(histStreak, "session")} (bullish momentum building)`}`
        : "",
      last.macd != null
        ? `MACD is ${macdBull ? "ABOVE" : "BELOW"} signal line — ${macdBull ? "bullish" : "bearish"} crossover stance`
        : "",
      crossover
        ? `Last MACD crossover: ${crossover.type} cross ${s(crossover.sessionsAgo, "session")} ago`
        : "",
      "",
      last.bbUpper
        ? `Bollinger Bands(20,2): Upper=$${last.bbUpper} | Middle=$${last.bbMiddle} | Lower=$${last.bbLower}`
        : "",
      last.pctB != null
        ? `%B=${last.pctB.toFixed(2)} (${last.pctB > 0.8 ? "price pressing upper band" : last.pctB < 0.2 ? "price pressing lower band" : "price within bands"}) | Bandwidth=${last.bWidth?.toFixed(1)}%${squeeze ? " — SQUEEZE DETECTED (low volatility, breakout likely)" : ""}`
        : "",
      last.bbUpper
        ? `BB signal: ${bbSig}`
        : "",
      "",
      last.atr
        ? `ATR(14): $${last.atr.toFixed(2)} (${atrPct}% of price) — ${+atrPct > 3 ? "HIGH" : +atrPct > 1.5 ? "moderate" : "low"} volatility environment`
        : "",
      "",
      last.stochK != null
        ? `Stochastic(14,3): %K=${last.stochK} | %D=${last.stochD} — ${stochLabel}`
        : "",
      "",
      (last.sma20 || last.sma50)
        ? `Moving Averages: SMA(20)=$${last.sma20 ?? "n/a"} | SMA(50)=$${last.sma50 ?? "n/a"} — price is ${
            last.sma20 && last.sma50
              ? last.close > last.sma20 && last.close > last.sma50 ? "ABOVE both (bullish trend)"
              : last.close < last.sma20 && last.close < last.sma50 ? "BELOW both (bearish trend)"
              : last.close > last.sma20 ? "above SMA20 but below SMA50 (mixed)"
              : "below SMA20 but above SMA50 (mixed)"
              : "—"
          }`
        : "",
      "",
      `Overall: ${bull} bullish / ${bear} bearish signal readings → ${overallSig} (${bullPct}% bullish weight)`,
    ].filter(l => l !== "");

    onContextUpdate({
      type: "technical", ticker, range: tf,
      context: lines.join("\n"),
      lastRSI: last.rsi, rsiLabel, macdBull, bbSignal: bbSig,
      overallSignal: overallSig, bullPct,
    });
  }, [data, tf, ticker]); // eslint-disable-line

  // ── Chart helpers ────────────────────────────────────────────────────────────
  const xi   = Math.max(1, Math.floor(data.length / 6));
  const minP = data.length ? Math.min(...data.map(d => d.close)) * 0.99 : 0;
  const maxP = data.length ? Math.max(...data.map(d => d.close)) * 1.01 : 0;

  const val = (v, dp = 2) => v != null ? v.toFixed(dp) : "—";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "calc(100vh - 90px)", overflow: "hidden", background: "var(--surface-0)" }}>

      {/* ── Left column: scrollable chart stack ─────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "10px 6px 10px 12px" }}>

        {/* Ticker + timeframe row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ ...MONO, fontSize: 12, fontWeight: 700, color: "var(--text-1)" }}>
            {ticker} — Technical Analysis
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {Object.keys(TF_MAP).map(t => (
              <button key={t} onClick={() => setTf(t)}
                style={{ padding: "2px 10px", fontSize: 10, ...MONO, borderRadius: 4, cursor: "pointer",
                  background: tf === t ? "rgba(37,99,235,0.12)" : "transparent",
                  color:      tf === t ? "#2563eb" : "#64748b",
                  border:     `1px solid ${tf === t ? "#2563eb" : "#cbd5e1"}` }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 1 ── Price + Bollinger Bands + SMA 20/50 ──────────────────── */}
        <ChartPanel title="Price · Bollinger Bands (20,2) · SMA 20 · SMA 50" height={255} loading={loading}>
          <ResponsiveContainer width="100%" height={202}>
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tcPriceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} interval={xi} />
              <YAxis domain={[minP, maxP]} tick={AXIS} tickLine={false} axisLine={false}
                tickFormatter={v => "$" + v.toFixed(0)} width={52} />
              <Tooltip contentStyle={TT} labelStyle={{ color: "var(--text-3)" }} />
              {/* BB bands */}
              <Line type="monotone" dataKey="bbUpper"  stroke="#b45309" strokeWidth={1} strokeDasharray="4 3" dot={false} name="BB Upper" />
              <Line type="monotone" dataKey="bbMiddle" stroke="#94a3b8" strokeWidth={1} dot={false} name="BB Mid" />
              <Line type="monotone" dataKey="bbLower"  stroke="#b45309" strokeWidth={1} strokeDasharray="4 3" dot={false} name="BB Lower" />
              {/* SMAs */}
              <Line type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="SMA 20" />
              <Line type="monotone" dataKey="sma50" stroke="#a855f7" strokeWidth={1.5} dot={false} name="SMA 50" />
              {/* Price */}
              <Area type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={2}
                fill="url(#tcPriceGrad)" dot={false} name="Price" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* 2 ── RSI (14) ──────────────────────────────────────────────── */}
        <ChartPanel title="RSI (14) — Relative Strength Index" height={185} loading={loading}>
          <ResponsiveContainer width="100%" height={133}>
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} interval={xi} />
              <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={TT} labelStyle={{ color: "var(--text-3)" }} />
              <ReferenceLine y={70} stroke="#e11d48" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: "70", position: "right", fill: "#e11d48", fontSize: 8, fontFamily: "monospace" }} />
              <ReferenceLine y={50} stroke="#cbd5e130" strokeWidth={1} />
              <ReferenceLine y={30} stroke="#059669" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: "30", position: "right", fill: "#059669", fontSize: 8, fontFamily: "monospace" }} />
              <Area type="monotone" dataKey="rsi" stroke="#2563eb" strokeWidth={1.5}
                fill="rgba(37,99,235,0.06)" dot={false} name="RSI" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* 3 ── MACD (12,26,9): histogram + MACD line + signal line ───── */}
        <ChartPanel title="MACD (12,26,9) — Histogram · MACD Line · Signal Line" height={200} loading={loading}>
          <ResponsiveContainer width="100%" height={148}>
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} interval={xi} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={42} />
              <Tooltip contentStyle={TT} labelStyle={{ color: "var(--text-3)" }} />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
              <Bar dataKey="histogram" name="Histogram" maxBarSize={8} radius={[1, 1, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.histogram >= 0 ? "#059669" : "#e11d48"} fillOpacity={0.75} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="macd"   stroke="#2563eb" strokeWidth={1.5} dot={false} name="MACD" />
              <Line type="monotone" dataKey="signal" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Signal" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* 4 ── Stochastic (14,3) ─────────────────────────────────────── */}
        <ChartPanel title="Stochastic Oscillator (14,3) — %K (fast) · %D (slow)" height={185} loading={loading}>
          <ResponsiveContainer width="100%" height={133}>
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} interval={xi} />
              <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={TT} labelStyle={{ color: "var(--text-3)" }} />
              <ReferenceLine y={80} stroke="#e11d48" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: "80", position: "right", fill: "#e11d48", fontSize: 8, fontFamily: "monospace" }} />
              <ReferenceLine y={50} stroke="#cbd5e130" strokeWidth={1} />
              <ReferenceLine y={20} stroke="#059669" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: "20", position: "right", fill: "#059669", fontSize: 8, fontFamily: "monospace" }} />
              <Line type="monotone" dataKey="stochK" stroke="#2563eb" strokeWidth={1.5} dot={false} name="%K" />
              <Line type="monotone" dataKey="stochD" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="%D" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

      </div>

      {/* ── Right column: signals panel ─────────────────────────────── */}
      <div style={{ width: 292, overflow: "auto", display: "flex", flexDirection: "column",
                    gap: 8, padding: "10px 12px 10px 6px", flexShrink: 0 }}>

        <div style={{ ...MONO, fontSize: 9, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.08em", flexShrink: 0 }}>
          📊 TECHNICAL SIGNALS
        </div>

        {/* RSI ─────────────────────────────────────────────────────── */}
        <SigCard title="RSI (14) — Relative Strength Index">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ ...MONO, fontSize: 26, fontWeight: 700, color: rsiColor }}>{val(last.rsi, 1)}</span>
            <span style={{ ...MONO, fontSize: 10, color: rsiColor, fontWeight: 700 }}>{rsiLabel}</span>
          </div>
          {/* gauge */}
          <div style={{ position: "relative", height: 6, borderRadius: 3,
            background: "linear-gradient(to right, #059669 30%, #64748b 30% 70%, #e11d48 70%)",
            marginBottom: 3, opacity: 0.35 }} />
          <div style={{ position: "relative", height: 6, borderRadius: 3, background: "transparent", marginTop: -9, marginBottom: 3 }}>
            <div style={{ position: "absolute", left: Math.min(Math.max(last.rsi ?? 50, 0), 100) + "%",
              top: -2, width: 10, height: 10, borderRadius: "50%",
              background: rsiColor, transform: "translateX(-50%)",
              boxShadow: `0 0 6px ${rsiColor}80` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...MONO, fontSize: 7, color: "var(--text-3)", marginBottom: 6 }}>
            <span>0</span><span>30</span><span>50</span><span>70</span><span>100</span>
          </div>
          {rsiStreak > 0 && (
            <div style={{ ...MONO, fontSize: 9, color: rsiColor }}>
              {rsiDir > 0 ? "↗ Rising" : "↘ Falling"} {rsiStreak} session{rsiStreak !== 1 ? "s" : ""} consecutively
            </div>
          )}
        </SigCard>

        {/* MACD ────────────────────────────────────────────────────── */}
        <SigCard title="MACD (12,26,9)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px", marginBottom: 8 }}>
            {[
              ["MACD LINE", val(last.macd,      4), last.macd      >= 0 ? "#059669" : "#e11d48"],
              ["SIGNAL",    val(last.signal,    4), "#f59e0b"],
              ["HISTOGRAM", val(last.histogram, 4), last.histogram >= 0 ? "#059669" : "#e11d48"],
              ["HIST TREND",
                histStreak > 0 ? `${histDir > 0 ? "↗" : "↘"} ${histStreak}s ${histDir > 0 ? "rising" : "falling"}` : "—",
                histDir > 0 ? "#059669" : "#e11d48"],
            ].map(([label, v, color]) => (
              <div key={label}>
                <div style={{ ...MONO, fontSize: 7, color: "var(--text-3)", marginBottom: 1 }}>{label}</div>
                <div style={{ ...MONO, fontSize: 12, fontWeight: 700, color }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ ...MONO, fontSize: 9, padding: "4px 8px", borderRadius: 4, marginBottom: 6,
            background: macdBull ? "rgba(5,150,105,0.1)" : "rgba(225,29,72,0.1)",
            color:      macdBull ? "#059669" : "#e11d48" }}>
            {macdBull ? "▲ BULLISH" : "▼ BEARISH"} — MACD {macdBull ? "above" : "below"} signal
          </div>
          {crossover && (
            <div style={{ ...MONO, fontSize: 9, color: "var(--text-3)" }}>
              Last cross: {crossover.type === "bullish" ? "🟢" : "🔴"} {crossover.type}{" "}
              {crossover.sessionsAgo} session{crossover.sessionsAgo !== 1 ? "s" : ""} ago
            </div>
          )}
        </SigCard>

        {/* Bollinger Bands ─────────────────────────────────────────── */}
        <SigCard title="Bollinger Bands (20,2)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 6px", marginBottom: 8 }}>
            {[["UPPER", last.bbUpper, "#b45309"], ["MIDDLE", last.bbMiddle, "#94a3b8"], ["LOWER", last.bbLower, "#2563eb"]].map(([l, v, c]) => (
              <div key={l}>
                <div style={{ ...MONO, fontSize: 7, color: "var(--text-3)" }}>{l}</div>
                <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: c }}>{v ? "$" + v.toFixed(2) : "—"}</div>
              </div>
            ))}
          </div>
          {/* %B gauge */}
          {last.pctB != null && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", ...MONO, fontSize: 8, color: "var(--text-3)", marginBottom: 3 }}>
                <span>%B: <span style={{ color: "var(--text-1)" }}>{last.pctB.toFixed(2)}</span></span>
                <span>BW: <span style={{ color: squeeze ? "#b45309" : "var(--text-1)" }}>{last.bWidth?.toFixed(1)}%{squeeze ? " ⚠" : ""}</span></span>
              </div>
              <div style={{ position: "relative", height: 5, borderRadius: 3,
                background: "linear-gradient(to right, #059669, #64748b, #e11d48)", opacity: 0.3 }} />
              <div style={{ position: "relative", height: 5, background: "transparent", marginTop: -5 }}>
                <div style={{ position: "absolute",
                  left: Math.min(Math.max((last.pctB ?? 0.5) * 100, 0), 100) + "%",
                  top: -3, width: 10, height: 10, borderRadius: "50%",
                  background: last.pctB > 0.8 ? "#e11d48" : last.pctB < 0.2 ? "#059669" : "#2563eb",
                  transform: "translateX(-50%)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", ...MONO, fontSize: 7, color: "var(--text-3)", marginTop: 4 }}>
                <span>Lower</span><span>Mid</span><span>Upper</span>
              </div>
            </div>
          )}
          <div style={{ ...MONO, fontSize: 9, padding: "4px 8px", borderRadius: 4,
            background: bbSig !== "INSIDE BANDS" ? "rgba(225,29,72,0.1)" : "rgba(5,150,105,0.08)",
            color:      bbSig !== "INSIDE BANDS" ? "#e11d48" : "#059669" }}>
            {bbSig}
            {squeeze && <span style={{ color: "#b45309" }}> · SQUEEZE ALERT</span>}
          </div>
        </SigCard>

        {/* ATR ─────────────────────────────────────────────────────── */}
        <SigCard title="ATR (14) — Average True Range">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <span style={{ ...MONO, fontSize: 22, fontWeight: 700, color: "var(--text-1)" }}>${val(last.atr)}</span>
            {atrPct && <span style={{ ...MONO, fontSize: 10, color: "var(--text-3)" }}>{atrPct}% of price</span>}
          </div>
          {atrPct && (
            <div style={{ ...MONO, fontSize: 9,
              color:  +atrPct > 3 ? "#e11d48" : +atrPct > 1.5 ? "#b45309" : "#059669" }}>
              {+atrPct > 3 ? "⚠ HIGH VOLATILITY" : +atrPct > 1.5 ? "◇ MODERATE VOLATILITY" : "◆ LOW VOLATILITY"}
            </div>
          )}
        </SigCard>

        {/* Stochastic ─────────────────────────────────────────────── */}
        <SigCard title="Stochastic (14,3)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px", marginBottom: 8 }}>
            <div>
              <div style={{ ...MONO, fontSize: 7, color: "var(--text-3)" }}>%K FAST</div>
              <div style={{ ...MONO, fontSize: 20, fontWeight: 700, color: stochColor }}>{val(last.stochK, 1)}</div>
            </div>
            <div>
              <div style={{ ...MONO, fontSize: 7, color: "var(--text-3)" }}>%D SLOW</div>
              <div style={{ ...MONO, fontSize: 20, fontWeight: 700, color: "#f59e0b" }}>{val(last.stochD, 1)}</div>
            </div>
          </div>
          <div style={{ ...MONO, fontSize: 9, padding: "4px 8px", borderRadius: 4,
            background: stochLabel === "OVERBOUGHT" ? "rgba(225,29,72,0.1)" : stochLabel === "OVERSOLD" ? "rgba(5,150,105,0.1)" : "rgba(100,116,139,0.08)",
            color: stochColor }}>
            {stochLabel}
          </div>
        </SigCard>

        {/* Moving Averages ─────────────────────────────────────────── */}
        <SigCard title="Moving Averages">
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {[["SMA 20", last.sma20, "#f59e0b"], ["SMA 50", last.sma50, "#a855f7"]].map(([label, v, lineColor]) => {
              const above = v != null && last.close > v;
              const diff  = v != null && last.close ? (((last.close - v) / v) * 100).toFixed(2) : null;
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 2, background: lineColor, borderRadius: 1 }} />
                    <span style={{ ...MONO, fontSize: 9, color: "var(--text-3)" }}>{label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ ...MONO, fontSize: 10, color: "var(--text-1)" }}>{v ? "$" + v.toFixed(2) : "—"}</span>
                    {diff != null && (
                      <span style={{ ...MONO, fontSize: 8, padding: "1px 5px", borderRadius: 3,
                        background: above ? "rgba(5,150,105,0.12)" : "rgba(225,29,72,0.12)",
                        color:      above ? "#059669" : "#e11d48" }}>
                        {above ? "▲ " : "▼ "}{Math.abs(+diff)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SigCard>

        {/* Overall Signal ─────────────────────────────────────────── */}
        <SigCard title="Overall Signal">
          <div style={{ display: "flex", height: 8, borderRadius: 10, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ width: bullPct + "%", background: "#059669", transition: "width 0.4s" }} />
            <div style={{ width: (100 - bullPct) + "%", background: "#e11d48" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...MONO, fontSize: 9, marginBottom: 10 }}>
            <span style={{ color: "#059669" }}>Bullish {bullPct}%</span>
            <span style={{ color: "#e11d48" }}>Bearish {100 - bullPct}%</span>
          </div>
          <div style={{ ...MONO, fontSize: 18, fontWeight: 700, color: overallClr, marginBottom: 2 }}>{overallSig}</div>
          <div style={{ ...MONO, fontSize: 9, color: "var(--text-3)" }}>{bull} bullish · {bear} bearish readings across 7 indicators</div>
        </SigCard>

      </div>
    </div>
  );
}
