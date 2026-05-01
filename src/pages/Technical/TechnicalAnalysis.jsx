import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, Cell, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function TechnicalAnalysis({ ticker }) {
  const [data, setData] = useState([]);
  const [tf, setTf] = useState("3M");
  const [loading, setLoading] = useState(true);
  // const [indicator, setIndicator] = useState("rsi");
  const TF_RANGE = { "1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y" };

  useEffect(() => {
    setLoading(true);
    fetch("/api/chart?ticker=" + encodeURIComponent(ticker) + "&range=" + TF_RANGE[tf] + "&interval=1d")
      .then(r => r.json())
      .then(d => {
        const result = d?.chart?.result?.[0];
        if (result) {
          const closes = result.indicators.quote[0].close;
          const timestamps = result.timestamp;
          const volumes = result.indicators.quote[0].volume;

          const mapped = timestamps.map((t, i) => ({
            date: new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            close: closes[i] ? +closes[i].toFixed(2) : null,
            volume: volumes[i] || 0,
          })).filter(d => d.close !== null);

          // Calculate RSI (14)
          const calcRSI = (prices, period = 14) => {
            const rsi = new Array(prices.length).fill(null);
            let gains = 0, losses = 0;
            for (let i = 1; i <= period; i++) {
              const diff = prices[i] - prices[i-1];
              if (diff > 0) gains += diff;
              else losses -= diff;
            }
            let avgGain = gains / period;
            let avgLoss = losses / period;
            rsi[period] = 100 - 100 / (1 + avgGain / (avgLoss || 0.001));
            for (let i = period + 1; i < prices.length; i++) {
              const diff = prices[i] - prices[i-1];
              avgGain = (avgGain * (period-1) + Math.max(diff, 0)) / period;
              avgLoss = (avgLoss * (period-1) + Math.max(-diff, 0)) / period;
              rsi[i] = 100 - 100 / (1 + avgGain / (avgLoss || 0.001));
            }
            return rsi;
          };

          // Calculate MACD (12, 26, 9)
          const calcEMA = (prices, period) => {
            const k = 2 / (period + 1);
            const ema = [prices[0]];
            for (let i = 1; i < prices.length; i++) {
              ema.push(prices[i] * k + ema[i-1] * (1-k));
            }
            return ema;
          };

          const prices = mapped.map(d => d.close);
          const ema12 = calcEMA(prices, 12);
          const ema26 = calcEMA(prices, 26);
          const macdLine = ema12.map((v, i) => +(v - ema26[i]).toFixed(4));
          const signal = calcEMA(macdLine, 9).map(v => +v.toFixed(4));
          const histogram = macdLine.map((v, i) => +(v - signal[i]).toFixed(4));

          // Bollinger Bands (20, 2)
          const bb = mapped.map((d, i) => {
            if (i < 19) return { upper: null, middle: null, lower: null };
            const slice = prices.slice(i-19, i+1);
            const mean = slice.reduce((a,b) => a+b, 0) / 20;
            const std = Math.sqrt(slice.reduce((a,b) => a + Math.pow(b-mean,2), 0) / 20);
            return { upper: +(mean + 2*std).toFixed(2), middle: +mean.toFixed(2), lower: +(mean - 2*std).toFixed(2) };
          });

          const rsiValues = calcRSI(prices);

          const finalData = mapped.map((d, i) => ({
            ...d,
            rsi: rsiValues[i] ? +rsiValues[i].toFixed(1) : null,
            macd: macdLine[i],
            signal: signal[i],
            histogram: histogram[i],
            bbUpper: bb[i].upper,
            bbMiddle: bb[i].middle,
            bbLower: bb[i].lower,
          }));

          setData(finalData);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticker, tf]); // eslint-disable-line

  const lastRSI = data[data.length-1]?.rsi;
  const lastMACD = data[data.length-1]?.macd;
  const lastSignal = data[data.length-1]?.signal;
  const lastClose = data[data.length-1]?.close;
  const lastBBU = data[data.length-1]?.bbUpper;
  const lastBBL = data[data.length-1]?.bbLower;

  const rsiColor = lastRSI > 70 ? "#e11d48" : lastRSI < 30 ? "#059669" : "#0f172a";
  const rsiLabel = lastRSI > 70 ? "OVERBOUGHT" : lastRSI < 30 ? "OVERSOLD" : "NEUTRAL";
  const macdSignal = lastMACD > lastSignal ? "BULLISH" : "BEARISH";
  const bbSignal = lastClose > lastBBU ? "OVERBOUGHT" : lastClose < lastBBL ? "OVERSOLD" : "NEUTRAL";

  const minP = data.length ? Math.min(...data.map(d => d.close)) * 0.99 : 0;
  const maxP = data.length ? Math.max(...data.map(d => d.close)) * 1.01 : 0;
  const xi = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "1fr 280px", gridTemplateRows: "280px 180px 180px", height: "calc(100vh - 90px)", overflow: "hidden" }}>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "1/2" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="terminal-header">{ticker} · Price + Bollinger Bands (20,2)</span>
          </div>
          <div className="flex gap-1">
            {Object.keys(TF_RANGE).map(t => (
              <button key={t} onClick={() => setTf(t)} className="px-2 py-0.5 text-xs font-mono rounded transition-colors"
                style={{ background: tf === t ? "#2563eb18" : "transparent", color: tf === t ? "#2563eb" : "#64748b", border: "1px solid " + (tf === t ? "#2563eb" : "#cbd5e1") }}>{t}</button>
            ))}
          </div>
        </div>
        {loading ? <div className="flex items-center justify-center h-48 text-xs font-mono animate-pulse" style={{ color: "var(--text-3)" }}>Loading...</div> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="techGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={xi} />
              <YAxis domain={[minP, maxP]} tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={v => "$" + v.toFixed(0)} width={52} />
              <Tooltip contentStyle={{ background:"var(--surface-2)", border:"1px solid rgba(15,23,42,0.18)", borderRadius:10, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }} labelStyle={{ color: "var(--text-3)" }} />
              <Area type="monotone" dataKey="bbUpper" stroke="#b45309" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} name="BB Upper" />
              <Area type="monotone" dataKey="bbLower" stroke="#b45309" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} name="BB Lower" />
              <Area type="monotone" dataKey="bbMiddle" stroke="#64748b" strokeWidth={1} fill="none" dot={false} name="BB Middle" />
              <Area type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={1.5} fill="url(#techGrad)" dot={false} name="Price" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "1/3" }}>
        <div className="terminal-header mb-3">📊 Technical Signals</div>
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
            <div className="terminal-header mb-1">RSI (14)</div>
            <div className="text-2xl font-mono font-bold" style={{ color: rsiColor }}>{lastRSI?.toFixed(1) || "—"}</div>
            <div className="text-xs font-mono mt-1" style={{ color: rsiColor }}>{rsiLabel}</div>
            <div className="relative h-2 rounded-full mt-2" style={{ background: "#e2e8f0" }}>
              <div style={{ position: "absolute", left: "30%", top: -4, bottom: -4, width: 1, background: "#059669" }} />
              <div style={{ position: "absolute", left: "70%", top: -4, bottom: -4, width: 1, background: "#e11d48" }} />
              <div style={{ position: "absolute", left: Math.min(Math.max((lastRSI||50), 0), 100) + "%", top: -3, width: 8, height: 8, borderRadius: "50%", background: rsiColor, transform: "translateX(-50%)" }} />
            </div>
            <div className="flex justify-between text-xs font-mono mt-1" style={{ color: "var(--text-3)" }}>
              <span>0</span><span>30</span><span>70</span><span>100</span>
            </div>
          </div>

          <div className="p-3 rounded" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
            <div className="terminal-header mb-1">MACD (12,26,9)</div>
            <div className="flex gap-3">
              <div>
                <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>MACD</div>
                <div className="text-sm font-mono font-bold" style={{ color: lastMACD >= 0 ? "#059669" : "#e11d48" }}>{lastMACD?.toFixed(3) || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>Signal</div>
                <div className="text-sm font-mono font-bold" style={{ color: "#b45309" }}>{lastSignal?.toFixed(3) || "—"}</div>
              </div>
            </div>
            <div className="text-xs font-mono mt-2 px-2 py-1 rounded" style={{ background: lastMACD > lastSignal ? "rgba(5,150,105,0.10)" : "rgba(225,29,72,0.10)", color: lastMACD > lastSignal ? "#059669" : "#e11d48" }}>
              {macdSignal} — MACD {lastMACD > lastSignal ? "above" : "below"} signal
            </div>
          </div>

          <div className="p-3 rounded" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
            <div className="terminal-header mb-1">Bollinger Bands (20,2)</div>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {[["Upper", lastBBU, "#b45309"], ["Middle", lastBBL ? ((lastBBU+lastBBL)/2).toFixed(2) : null, "#64748b"], ["Lower", lastBBL, "#2563eb"]].map(([l, v, c]) => (
                <div key={l}>
                  <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{l}</div>
                  <div className="text-xs font-mono font-bold" style={{ color: c }}>{v ? "$" + (+v).toFixed(2) : "—"}</div>
                </div>
              ))}
            </div>
            <div className="text-xs font-mono px-2 py-1 rounded" style={{ background: bbSignal === "NEUTRAL" ? "rgba(125,133,144,0.1)" : bbSignal === "OVERBOUGHT" ? "rgba(225,29,72,0.10)" : "rgba(5,150,105,0.10)", color: bbSignal === "NEUTRAL" ? "#64748b" : bbSignal === "OVERBOUGHT" ? "#e11d48" : "#059669" }}>
              {bbSignal}
            </div>
          </div>

          <div className="p-3 rounded" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
            <div className="terminal-header mb-2">Overall Signal</div>
            {(() => {
              let bull = 0, bear = 0;
              if (lastRSI < 50) bear++; else bull++;
              if (lastRSI < 30) bull += 2;
              if (lastRSI > 70) bear += 2;
              if (lastMACD > lastSignal) bull++; else bear++;
              if (bbSignal === "OVERSOLD") bull++; else if (bbSignal === "OVERBOUGHT") bear++;
              const total = bull + bear;
              const bullPct = Math.round(bull/total*100);
              return (
                <div>
                  <div className="flex gap-1 mb-2" style={{ height: 8, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ width: bullPct + "%", background: "#059669", transition: "width 0.3s" }} />
                    <div style={{ width: (100-bullPct) + "%", background: "#e11d48" }} />
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span style={{ color: "#059669" }}>Bullish {bullPct}%</span>
                    <span style={{ color: "#e11d48" }}>Bearish {100-bullPct}%</span>
                  </div>
                  <div className="text-xs font-mono mt-2 font-bold" style={{ color: bullPct > 60 ? "#059669" : bullPct < 40 ? "#e11d48" : "#b45309" }}>
                    {bullPct > 60 ? "BUY SIGNAL" : bullPct < 40 ? "SELL SIGNAL" : "NEUTRAL"}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "2/3" }}>
        <div className="terminal-header mb-2">RSI (14) — Relative Strength Index</div>
        {loading ? <div className="text-xs font-mono animate-pulse" style={{ color: "var(--text-3)" }}>Loading...</div> : (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={xi} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={{ background:"var(--surface-2)", border:"1px solid rgba(15,23,42,0.18)", borderRadius:10, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }} labelStyle={{ color: "var(--text-3)" }} />
              <ReferenceLine y={70} stroke="#e11d48" strokeDasharray="3 3" strokeWidth={1} />
              <ReferenceLine y={30} stroke="#059669" strokeDasharray="3 3" strokeWidth={1} />
              <Area type="monotone" dataKey="rsi" stroke="#2563eb" strokeWidth={1.5} fill="rgba(37,99,235,0.05)" dot={false} name="RSI" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "3/4" }}>
        <div className="terminal-header mb-2">MACD (12,26,9) — Moving Average Convergence Divergence</div>
        {loading ? <div className="text-xs font-mono animate-pulse" style={{ color: "var(--text-3)" }}>Loading...</div> : (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={xi} />
              <YAxis tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ background:"var(--surface-2)", border:"1px solid rgba(15,23,42,0.18)", borderRadius:10, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }} labelStyle={{ color: "var(--text-3)" }} />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
              <Bar dataKey="histogram" name="Histogram" radius={[1,1,0,0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.histogram >= 0 ? "#059669" : "#e11d48"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "3/4" }}>
        <div className="terminal-header mb-2">📖 Indicator Guide</div>
        <div className="flex flex-col gap-2 text-xs font-mono" style={{ color: "var(--text-3)" }}>
          <div><span style={{ color: "#2563eb" }}>RSI {">"} 70</span> — Overbought, potential sell signal</div>
          <div><span style={{ color: "#059669" }}>RSI {"<"} 30</span> — Oversold, potential buy signal</div>
          <div><span style={{ color: "#059669" }}>MACD above Signal</span> — Bullish momentum</div>
          <div><span style={{ color: "#e11d48" }}>MACD below Signal</span> — Bearish momentum</div>
          <div><span style={{ color: "#b45309" }}>BB Upper breach</span> — Overbought condition</div>
          <div><span style={{ color: "#b45309" }}>BB Lower breach</span> — Oversold condition</div>
        </div>
      </div>

    </div>
  );
}
