import { useState, useEffect } from 'react';
import { fetchChart } from '../../lib/api';
import { TIMEFRAMES, TF_CFG } from '../../lib/constants';

// Candlestick bar rendered as a custom Recharts shape
export function CandlestickBar(props) {
  const { x, y, width, payload } = props;
  if (!payload || payload.open == null) return null;
  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? "#059669" : "#e11d48";
  const bodyTop    = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const bodyH = Math.max(1, bodyBottom - bodyTop);
  const cx = x + width / 2;
  // y scale: props gives us the Y coordinate of the bar's "value", which is the high.
  // We get yScale via the scaleLinear from recharts internal.
  // Instead we rely on the parent ComposedChart's YAxis domain being set to [minL, maxH].
  // The "y" prop here is the pixel top of the bar rect — recharts computes it from the dataKey.
  // We use a custom approach: pass yScale via the shape function's numeric props.
  // recharts passes: x (left edge), y (pixel top of high), width, height (pixel span high→low)
  const totalH = props.height; // pixel height from high to low
  if (totalH <= 0 || isNaN(totalH)) return null;
  const domainSpan = high - low;
  if (domainSpan <= 0) return null;
  const pxPerUnit = totalH / domainSpan;
  const bodyTopPx    = y + (high - bodyBottom) * pxPerUnit;
  const bodyH_px     = Math.max(1, bodyH * pxPerUnit);
  const wickTopPx    = y;
  const wickBottomPx = y + totalH;
  return (
    <g>
      {/* Wick */}
      <line x1={cx} y1={wickTopPx} x2={cx} y2={wickBottomPx} stroke={color} strokeWidth={1} />
      {/* Body */}
      <rect x={x + 1} y={bodyTopPx} width={Math.max(1, width - 2)} height={bodyH_px}
        fill={isUp ? "rgba(5,150,105,0.85)" : "rgba(225,29,72,0.85)"}
        stroke={color} strokeWidth={0.5} />
    </g>
  );
}

export function useOHLC(ticker, tf) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { range, interval } = TF_CFG[tf] || TF_CFG["3M"];
    fetchChart(ticker, range, interval).then(d => {
      if (cancelled) return;
      const result = d?.chart?.result?.[0];
      if (result) {
        const q       = result.indicators.quote[0];
        const ts      = result.timestamp || [];
        const closes  = q.close  || [];
        const opens   = q.open   || [];
        const highs   = q.high   || [];
        const lows    = q.low    || [];
        const volumes = q.volume || [];
        const raw = ts.map((t, i) => ({
          ts:    t,
          date:  new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          close:  closes[i]  != null ? +closes[i].toFixed(4)  : null,
          open:   opens[i]   != null ? +opens[i].toFixed(4)   : null,
          high:   highs[i]   != null ? +highs[i].toFixed(4)   : null,
          low:    lows[i]    != null ? +lows[i].toFixed(4)    : null,
          volume: volumes[i] || 0,
        })).filter(d => d.close != null && d.open != null && d.high != null && d.low != null);

        // SMA-20 on close
        raw.forEach((item, i) => {
          if (i >= 19) {
            const slice = raw.slice(i - 19, i + 1);
            item.sma20 = +(slice.reduce((s, x) => s + x.close, 0) / 20).toFixed(4);
          }
        });

        setData(raw);
      }
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, tf]);

  return { data, loading };
}

export function ChartTypeBtn({ value, active, onClick, children }) {
  return (
    <button onClick={() => onClick(value)} className="font-mono"
      style={{ padding:"2px 8px", fontSize:10, borderRadius:6, border:"1px solid",
        background: active ? "#eff6ff" : "transparent",
        borderColor: active ? "#2563eb" : "#e2e8f0",
        color: active ? "#2563eb" : "#64748b", cursor:"pointer" }}>
      {children}
    </button>
  );
}

export { TIMEFRAMES, TF_CFG };
