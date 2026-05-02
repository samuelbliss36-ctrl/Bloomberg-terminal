import { useState, useEffect, useRef, useMemo } from "react";
import { AreaChart, Area, ReferenceLine, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmt, clr } from "../../../lib/fmt";
import { FX_RATE_PAIRS } from "../../../data/researchData";
import { ResearchPanelShell, ResearchTabBar } from "../../../components/ui/ResearchPanelShell";
import { IntelCard } from "../../../components/ui/IntelCard";
import { useIntelCard } from "../../../hooks/useIntelCard";
import RelatedLinks from "./RelatedLinks";

export default function FXResearchPanel({ item, onClose, onOpen }) {
  const TABS = ["Overview","Rate Differential","Intelligence"];
  const [activeTab, setActiveTab] = useState("Overview");
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [rateData, setRateData]   = useState({ base:[], quote:[] });
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError]   = useState(false);
  const loadedTabs = useRef(new Set(["Overview"]));
  const pair  = FX_RATE_PAIRS[item.id];

  useEffect(() => {
    setLoading(true); setError(false); setChartData([]); setSummary(null);
    setActiveTab("Overview"); loadedTabs.current = new Set(["Overview"]);
    fetch("/api/chart?ticker=" + encodeURIComponent(item.ticker) + "&range=1y&interval=1d")
      .then(r => r.json())
      .then(c => {
        const result = c?.chart?.result?.[0];
        if (result) {
          const ts     = result.timestamp || [];
          const closes = result.indicators?.quote?.[0]?.close || [];
          const data   = ts.map((t,i) => ({ t, v: closes[i] != null ? +closes[i].toFixed(4) : null })).filter(d => d.v != null);
          setChartData(data);
          if (data.length >= 2) {
            const cur = data[data.length-1].v, prev = data[data.length-2].v;
            const m1 = data[Math.max(0,data.length-22)].v, m3 = data[Math.max(0,data.length-66)].v;
            const hi52 = Math.max(...data.map(d=>d.v)), lo52 = Math.min(...data.map(d=>d.v));
            setSummary({ cur, prev, dayPct:((cur-prev)/prev)*100, m1Pct:((cur-m1)/m1)*100, m3Pct:((cur-m3)/m3)*100, hi52, lo52 });
          }
        }
        setLoading(false);
      }).catch(() => { setLoading(false); setError(true); });
  }, [item.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loadedTabs.current.has(activeTab)) return;
    loadedTabs.current.add(activeTab);
    if (activeTab === "Rate Differential" && pair) {
      setRateLoading(true); setRateError(false);
      Promise.all([
        fetch("/api/fred?series=" + pair.baseSeries).then(r => r.json()),
        pair.quoteSeries ? fetch("/api/fred?series=" + pair.quoteSeries).then(r => r.json()) : Promise.resolve(null),
      ]).then(([baseRaw, quoteRaw]) => {
        const parse = raw => (raw?.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value))).slice(-60).map(o => ({ t:o.date, v:parseFloat(o.value) }));
        setRateData({ base: parse(baseRaw), quote: parse(quoteRaw) });
        setRateLoading(false);
      }).catch(() => { setRateLoading(false); setRateError(true); });
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build context string for AI intel (once price data is ready)
  const intelContext = useMemo(() => {
    if (!summary) return null;
    const lines = [
      `Asset: ${item.id} — ${item.label}`,
      `Type: FX Currency Pair`,
      `Ticker: ${item.ticker}`,
      `Current Rate: ${summary.cur.toFixed(4)}`,
      `1-Day Change: ${summary.dayPct >= 0 ? "+" : ""}${summary.dayPct.toFixed(2)}%`,
      `1-Month Change: ${summary.m1Pct >= 0 ? "+" : ""}${summary.m1Pct.toFixed(2)}%`,
      `3-Month Change: ${summary.m3Pct >= 0 ? "+" : ""}${summary.m3Pct.toFixed(2)}%`,
      `52-Week High: ${summary.hi52.toFixed(4)} | 52-Week Low: ${summary.lo52.toFixed(4)}`,
    ];
    if (pair) {
      lines.push(`Base Currency Rate Series: ${pair.baseSeries} (${pair.baseLabel})`);
      if (pair.quoteSeries) lines.push(`Quote Currency Rate Series: ${pair.quoteSeries} (${pair.quoteLabel})`);
    }
    return lines.join("\n");
  }, [summary, item.id, item.label, item.ticker, pair]);

  const { intel, loading: intelLoading, error: intelError, refresh: intelRefresh } = useIntelCard(
    item.id,
    intelContext,
    { enabled: activeTab === "Intelligence" }
  );

  const dp = 4;
  const priceColor = summary ? (summary.dayPct >= 0 ? "#059669" : "#e11d48") : "#059669";
  const pct52 = summary ? Math.min(100, Math.max(0, ((summary.cur-summary.lo52)/(summary.hi52-summary.lo52))*100)) : null;

  const renderOverview = () => {
    if (loading) return <div className="flex items-center justify-center py-8 font-mono" style={{ color:"var(--text-3)" }}>Loading…</div>;
    if (error)   return <div className="flex items-center gap-2 font-mono" style={{ color:"#e11d48", background:"rgba(225,29,72,0.06)", border:"1px solid rgba(225,29,72,0.18)", borderRadius:6, padding:"10px 14px", fontSize:11 }}>⚠ Failed to load — check your connection</div>;
    return (
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <span className="font-mono font-bold" style={{ color:"var(--text-1)", fontSize:26 }}>{summary?.cur.toLocaleString("en-US",{minimumFractionDigits:dp,maximumFractionDigits:dp})||"—"}</span>
          <div className="text-right">
            {summary && <div className="font-mono" style={{ color:clr(summary.dayPct), fontSize:13 }}>Day {fmt.pct(summary.dayPct)}</div>}
            {summary && <div className="font-mono" style={{ color:clr(summary.m1Pct), fontSize:10 }}>1M {fmt.pct(summary.m1Pct)}</div>}
          </div>
        </div>

        {chartData.length > 0 && (
          <div style={{ height:190, marginBottom:12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top:4, right:2, bottom:0, left:0 }}>
                <defs>
                  <linearGradient id={"fxg_"+item.id.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={priceColor} stopOpacity={0.22}/>
                    <stop offset="95%" stopColor={priceColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tickFormatter={t=>{const d=new Date(t*1000);return(d.getMonth()+1)+"/"+d.getDate();}} tick={{fill:"#64748b",fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}} tickLine={false} axisLine={false} interval={35}/>
                <YAxis domain={["auto","auto"]} hide/>
                <Tooltip contentStyle={{background:"var(--surface-2)",border:"1px solid rgba(15,23,42,0.18)",borderRadius:10,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}} labelFormatter={t=>new Date(t*1000).toLocaleDateString()} formatter={v=>[v?.toFixed(dp),"Rate"]}/>
                <Area type="monotone" dataKey="v" stroke={priceColor} strokeWidth={1.5} fill={"url(#fxg_"+item.id.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {pct52 != null && (
          <div className="mb-4">
            <div className="flex justify-between font-mono mb-1" style={{ color:"var(--text-3)", fontSize:9 }}>
              <span>52W LOW {summary.lo52.toFixed(dp)}</span>
              <span style={{ color:"var(--text-3)" }}>52-WEEK RANGE</span>
              <span>{summary.hi52.toFixed(dp)} 52W HIGH</span>
            </div>
            <div style={{ position:"relative", height:4, background:"var(--surface-3)", borderRadius:2 }}>
              <div style={{ position:"absolute", left:0, width:pct52+"%", height:"100%", background:pct52>70?"#059669":pct52<30?"#e11d48":"#b45309", borderRadius:2 }}/>
              <div style={{ position:"absolute", left:pct52+"%", top:-3, width:2, height:10, background:"#0f172a", borderRadius:1, transform:"translateX(-50%)" }}/>
            </div>
          </div>
        )}

        {summary && (
          <div className="grid mb-4" style={{ gridTemplateColumns:"repeat(3,1fr)", gap:"4px 8px" }}>
            {[["1D",summary.dayPct],["1M",summary.m1Pct],["3M",summary.m3Pct]].map(([label,val])=>(
              <div key={label} style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:10, padding:"6px 8px" }}>
                <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>{label}</div>
                <div className="font-mono font-bold" style={{ color:clr(val), fontSize:13 }}>{fmt.pct(val)}</div>
              </div>
            ))}
          </div>
        )}
        <RelatedLinks itemId={item.id} onOpen={onOpen}/>
      </div>
    );
  };

  const renderRateDiff = () => {
    if (!pair)        return <div className="font-mono py-4" style={{ color:"var(--text-3)" }}>Rate differential data not available for this pair.</div>;
    if (rateLoading)  return <div className="flex items-center justify-center py-8 font-mono" style={{ color:"var(--text-3)" }}>Loading rates…</div>;
    if (rateError)    return <div className="flex items-center gap-2 font-mono" style={{ color:"#e11d48", background:"rgba(225,29,72,0.06)", border:"1px solid rgba(225,29,72,0.18)", borderRadius:6, padding:"10px 14px", fontSize:11 }}>⚠ Failed to load rate data</div>;

    const baseLatest  = rateData.base[rateData.base.length-1];
    const quoteLatest = rateData.quote[rateData.quote.length-1];
    const diff = baseLatest && quoteLatest ? +(baseLatest.v - quoteLatest.v).toFixed(2) : null;

    const baseMap  = Object.fromEntries(rateData.base.map(d=>[d.t,d.v]));
    const quoteMap = Object.fromEntries(rateData.quote.map(d=>[d.t,d.v]));
    const allDates = [...new Set([...rateData.base.map(d=>d.t),...rateData.quote.map(d=>d.t)])].sort();
    let lb=null, lq=null;
    const diffData = allDates.map(t => {
      if (baseMap[t]!=null)  lb=baseMap[t];
      if (quoteMap[t]!=null) lq=quoteMap[t];
      return { t, base:lb, quote:lq, diff: lb!=null&&lq!=null ? +(lb-lq).toFixed(2) : null };
    }).filter(d=>d.diff!=null).slice(-48);

    return (
      <div>
        <div className="grid mb-4" style={{ gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[{ label:pair.baseLabel, val:baseLatest?.v, color:"#2563eb", date:baseLatest?.t },
            { label:pair.quoteLabel||"N/A", val:quoteLatest?.v, color:"#b45309", date:quoteLatest?.t }].map(({label,val,color,date})=>(
            <div key={label} style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:6, padding:"10px 12px" }}>
              <div className="font-mono mb-1" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>{label}</div>
              <div className="font-mono font-bold" style={{ color, fontSize:20 }}>{val!=null?val.toFixed(2)+"%":"—"}</div>
              {date && <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>as of {date}</div>}
            </div>
          ))}
        </div>

        {diff != null && (
          <div className="mb-4 p-3" style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:6 }}>
            <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>Differential (USD minus {pair.quoteCCY})</div>
            <div className="font-mono font-bold" style={{ color:diff>=0?"#2563eb":"#b45309", fontSize:20 }}>{diff>=0?"+":""}{diff} pp</div>
            <div className="font-mono mt-0.5" style={{ color:"var(--text-3)", fontSize:10 }}>
              {diff>1?"USD yield premium — supports USD strength":diff<-1?"Foreign yield premium — USD headwind":"Rates near parity"}
            </div>
          </div>
        )}

        {diffData.length > 0 && (
          <div>
            <div className="font-mono mb-1" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>Rate Differential Over Time</div>
            <div style={{ height:150, marginBottom:12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={diffData} margin={{ top:4, right:2, bottom:0, left:0 }}>
                  <defs>
                    <linearGradient id={"rdg_"+item.id.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{fill:"#64748b",fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}} tickLine={false} axisLine={false} interval={11}/>
                  <YAxis domain={["auto","auto"]} hide/>
                  <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3"/>
                  <Tooltip contentStyle={{background:"var(--surface-2)",border:"1px solid rgba(15,23,42,0.18)",borderRadius:10,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}} formatter={v=>[v?.toFixed(2)+"pp","Differential"]}/>
                  <Area type="monotone" dataKey="diff" stroke="#2563eb" strokeWidth={1.5} fill={"url(#rdg_"+item.id.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <RelatedLinks itemId={item.id} onOpen={onOpen}/>
      </div>
    );
  };

  return (
    <ResearchPanelShell title={item.label} subtitle={item.ticker} badge="FX" onClose={onClose}>
      <ResearchTabBar tabs={TABS} active={activeTab} onSelect={setActiveTab}/>
      {activeTab === "Overview"          && renderOverview()}
      {activeTab === "Rate Differential" && renderRateDiff()}
      {activeTab === "Intelligence"      && (
        <div>
          <IntelCard
            intel={intel}
            loading={intelLoading}
            error={intelError}
            onRefresh={intelRefresh}
            accentColor="#059669"
          />
          {!intelLoading && !intelError && (
            <div className="mt-4"><RelatedLinks itemId={item.id} onOpen={onOpen}/></div>
          )}
        </div>
      )}
    </ResearchPanelShell>
  );
}
