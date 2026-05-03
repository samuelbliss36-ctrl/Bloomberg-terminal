import { useState } from 'react';
import { Area, BarChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
         ResponsiveContainer, ComposedChart, ReferenceArea } from 'recharts';
import { CandlestickBar, useOHLC, ChartTypeBtn } from './CandlestickBar';
import { TIMEFRAMES } from '../../lib/constants';

export function UniversalChart({ ticker, height = 220, showVolume = false, colorUp = "#059669", colorDown = "#e11d48", defaultType = "area", defaultTf = "3M", prefix = "$", decimals = 2, label }) {
  const [tf,        setTf]        = useState(defaultTf);
  const [chartType, setChartType] = useState(defaultType);
  const { data, loading } = useOHLC(ticker, tf);

  // ── Drag-to-measure state ──────────────────────────────────────────────────
  const [refAreaLeft,  setRefAreaLeft]  = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [isDragging,   setIsDragging]   = useState(false);
  const [measureInfo,  setMeasureInfo]  = useState(null);

  const onChartMouseDown = (e) => {
    if (!e?.activeLabel) return;
    setRefAreaLeft(e.activeLabel);
    setRefAreaRight(null);
    setMeasureInfo(null);
    setIsDragging(true);
  };

  const onChartMouseMove = (e) => {
    if (!isDragging || !e?.activeLabel) return;
    setRefAreaRight(e.activeLabel);
  };

  const onChartMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (!refAreaLeft || !refAreaRight || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null); setRefAreaRight(null); setMeasureInfo(null);
      return;
    }
    const i1 = data.findIndex(d => d.date === refAreaLeft);
    const i2 = data.findIndex(d => d.date === refAreaRight);
    if (i1 === -1 || i2 === -1) return;
    const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
    const p1 = data[lo].close, p2 = data[hi].close;
    const chgPts = p2 - p1;
    const pct    = (chgPts / p1) * 100;
    setMeasureInfo({ pct, chgPts, startDate: data[lo].date, endDate: data[hi].date, startPrice: p1, endPrice: p2 });
  };

  const clearMeasure = () => {
    setRefAreaLeft(null); setRefAreaRight(null); setMeasureInfo(null); setIsDragging(false);
  };

  // ── Chart internals ────────────────────────────────────────────────────────
  const startC  = data[0]?.close  || 0;
  const endC    = data[data.length - 1]?.close || 0;
  const chg     = endC - startC;
  const pct     = startC ? (chg / startC) * 100 : 0;
  const lc      = chg >= 0 ? colorUp : colorDown;
  const allLows  = data.map(d => d.low);
  const allHighs = data.map(d => d.high);
  const minP = data.length ? Math.min(...allLows)  * 0.9995 : 0;
  const maxP = data.length ? Math.max(...allHighs) * 1.0005 : 0;
  const xi   = Math.max(1, Math.floor(data.length / 6));
  const gradId = "ucg_" + ticker.replace(/[^a-z0-9]/gi, "") + "_" + tf;
  const tooltipStyle = { background:"var(--surface-0)", border:"1px solid var(--border)", borderRadius:10, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" };
  const tickStyle    = { fill:"var(--text-3)", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" };
  const fmt2 = v => v != null ? prefix + (+v).toFixed(decimals) : "—";

  // Live drag color — updates in real-time as user drags
  const getDragColor = () => {
    if (!refAreaLeft || !refAreaRight) return "#64748b";
    const i1 = data.findIndex(d => d.date === refAreaLeft);
    const i2 = data.findIndex(d => d.date === refAreaRight);
    if (i1 === -1 || i2 === -1) return "#64748b";
    const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
    const diff = data[hi].close - data[lo].close;
    return diff > 0 ? "#059669" : diff < 0 ? "#e11d48" : "#64748b";
  };
  const dragColor    = getDragColor();
  const measureColor = measureInfo
    ? (measureInfo.chgPts > 0 ? "#059669" : measureInfo.chgPts < 0 ? "#e11d48" : "#64748b")
    : dragColor;

  // Shared props injected into every ComposedChart for drag-to-measure
  const dragProps = {
    onMouseDown: onChartMouseDown,
    onMouseMove: onChartMouseMove,
    onMouseUp:   onChartMouseUp,
  };

  // ReferenceArea — color reflects positive/negative/neutral in real-time
  const refArea = (refAreaLeft && (refAreaRight || isDragging)) ? (
    <ReferenceArea
      x1={refAreaLeft}
      x2={refAreaRight || refAreaLeft}
      fill={measureColor + "18"}
      stroke={measureColor + "55"}
      strokeWidth={1}
      ifOverflow="visible"
    />
  ) : null;

  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" vertical={false} />
      <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} interval={xi} />
      <YAxis domain={[minP, maxP]} tick={tickStyle} tickLine={false} axisLine={false}
        tickFormatter={v => prefix + v.toFixed(decimals <= 2 ? 0 : decimals)} width={decimals > 2 ? 68 : 52} />
      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color:"var(--text-3)" }}
        formatter={(v, name) => [fmt2(v), name]}
        active={isDragging ? false : undefined} />
    </>
  );

  const renderChart = () => {
    if (chartType === "candle") {
      return (
        <ComposedChart data={data} margin={{ top:4, right:2, left:0, bottom:0 }} {...dragProps}>
          {commonAxes}
          <Bar dataKey="high" shape={<CandlestickBar />} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={d.close >= d.open ? colorUp : colorDown} />)}
          </Bar>
          {data.some(d => d.sma20) && (
            <Line type="monotone" dataKey="sma20" stroke="#b45309" strokeWidth={1} dot={false} isAnimationActive={false} name="SMA 20" connectNulls />
          )}
          {refArea}
        </ComposedChart>
      );
    }
    if (chartType === "line") {
      return (
        <ComposedChart data={data} margin={{ top:4, right:2, left:0, bottom:0 }} {...dragProps}>
          {commonAxes}
          <Line type="monotone" dataKey="close" stroke={lc} strokeWidth={1.5} dot={false} isAnimationActive={false} name="Price" />
          {data.some(d => d.sma20) && (
            <Line type="monotone" dataKey="sma20" stroke="#b45309" strokeWidth={1} dot={false} isAnimationActive={false} name="SMA 20" connectNulls strokeDasharray="4 2" />
          )}
          {refArea}
        </ComposedChart>
      );
    }
    // area (default)
    return (
      <ComposedChart data={data} margin={{ top:4, right:2, left:0, bottom:0 }} {...dragProps}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={lc} stopOpacity={0.18} />
            <stop offset="95%" stopColor={lc} stopOpacity={0}    />
          </linearGradient>
        </defs>
        {commonAxes}
        <Area type="monotone" dataKey="close" stroke={lc} strokeWidth={1.5} fill={"url(#" + gradId + ")"} dot={false} isAnimationActive={false} name="Price" />
        {data.some(d => d.sma20) && (
          <Line type="monotone" dataKey="sma20" stroke="#b45309" strokeWidth={1} dot={false} isAnimationActive={false} name="SMA 20" connectNulls strokeDasharray="4 2" />
        )}
        {refArea}
      </ComposedChart>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls row */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <div className="flex items-center gap-2">
          {label && <span className="font-mono" style={{ color:"var(--text-3)", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</span>}
          {data.length > 0 && (
            <span className="font-mono" style={{ fontSize:10, color:lc, background:lc+"18", border:"1px solid "+lc+"33", borderRadius:6, padding:"1px 6px" }}>
              {chg >= 0 ? "+" : ""}{fmt2(chg)} ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%) {tf}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Chart type */}
          <div className="flex gap-1">
            <ChartTypeBtn value="area"   active={chartType==="area"}   onClick={setChartType}>Area</ChartTypeBtn>
            <ChartTypeBtn value="line"   active={chartType==="line"}   onClick={setChartType}>Line</ChartTypeBtn>
            <ChartTypeBtn value="candle" active={chartType==="candle"} onClick={setChartType}>Candle</ChartTypeBtn>
          </div>
          {/* Timeframe */}
          <div className="flex overflow-hidden rounded" style={{ border:"1px solid var(--border)" }}>
            {TIMEFRAMES.map(t => (
              <button key={t} onClick={() => setTf(t)} className="font-mono"
                style={{ padding:"2px 8px", fontSize:10, background:tf===t?"var(--blue-dim)":"transparent", color:tf===t?"#2563eb":"var(--text-3)", borderRight:"1px solid var(--border)", cursor:"pointer" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div style={{ flex:1, minHeight: height, position:"relative",
                    cursor: isDragging ? "col-resize" : "crosshair",
                    userSelect: isDragging ? "none" : "auto" }}>

        {/* ── Measurement badge ──────────────────────────────────────────── */}
        {measureInfo && !isDragging && (
          <div style={{
            position:"absolute", top:6, left:"50%", transform:"translateX(-50%)",
            background:"var(--surface-1)",
            border:`1px solid ${measureColor}55`,
            borderRadius:8, padding:"6px 14px",
            display:"flex", alignItems:"center", gap:14,
            zIndex:20, boxShadow:"0 2px 16px rgba(0,0,0,0.18)",
            whiteSpace:"nowrap",
          }}>
            <span className="font-mono" style={{ fontSize:12, fontWeight:700, color:measureColor }}>
              {measureInfo.chgPts >= 0 ? "▲" : "▼"}&nbsp;
              {prefix}{Math.abs(measureInfo.chgPts).toFixed(decimals)}&nbsp;&nbsp;
              {measureInfo.pct >= 0 ? "+" : ""}{measureInfo.pct.toFixed(2)}%
            </span>
            <span className="font-mono" style={{ fontSize:9, color:"var(--text-3)" }}>
              {measureInfo.startDate} → {measureInfo.endDate}
            </span>
            <button
              onClick={clearMeasure}
              style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-3)",
                       fontSize:11, padding:"0 2px", lineHeight:1 }}
              onMouseEnter={e => e.currentTarget.style.color="var(--text-1)"}
              onMouseLeave={e => e.currentTarget.style.color="var(--text-3)"}
            >✕</button>
          </div>
        )}

        {/* ── Hint (shown when no measurement active) ───────────────────── */}
        {!measureInfo && !isDragging && data.length > 0 && (
          <div style={{
            position:"absolute", bottom:4, right:4, zIndex:10,
            fontFamily:"'IBM Plex Mono',monospace", fontSize:8,
            color:"var(--text-3)", pointerEvents:"none", opacity:0.6,
          }}>
            drag to measure
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-full font-mono" style={{ color:"var(--text-3)", fontSize:11 }}>Loading…</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-full font-mono" style={{ color:"var(--text-3)", fontSize:11 }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>

      {/* Volume bar (optional) */}
      {showVolume && !loading && data.length > 0 && (
        <div style={{ height:36, marginTop:2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top:0, right:2, left:0, bottom:0 }}>
              <YAxis hide domain={[0,"auto"]} />
              <Bar dataKey="volume" isAnimationActive={false} radius={[1,1,0,0]}>
                {data.map((d, i) => <Cell key={i} fill={d.close >= d.open ? "rgba(5,150,105,0.50)" : "rgba(225,29,72,0.50)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
export function PriceChart({ ticker }) {
  return <UniversalChart ticker={ticker} height={200} showVolume defaultTf="3M" label="Price Chart" />;
}
