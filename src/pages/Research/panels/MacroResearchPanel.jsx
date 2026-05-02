import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmt, clr } from "../../../lib/fmt";
import { ENTITY_INTEL } from "../../../data/researchData";
import { ResearchPanelShell, ResearchTabBar } from "../../../components/ui/ResearchPanelShell";
import { IntelCard } from "../../../components/ui/IntelCard";
import RelatedLinks from "./RelatedLinks";

export default function MacroResearchPanel({ item, onClose, onOpen }) {
  const TABS = ["Chart","Context"];
  const [activeTab, setActiveTab] = useState("Chart");
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);
  const intel = ENTITY_INTEL[item.id];

  useEffect(() => {
    setLoading(true); setError(false); setActiveTab("Chart");
    fetch("/api/fred?series=" + item.series)
      .then(r => r.json())
      .then(d => {
        const obs = (d.observations || [])
          .filter(o => o.value !== "." && !isNaN(parseFloat(o.value)))
          .slice(-60)
          .map(o => ({ t: o.date, v: parseFloat(o.value) }));
        setData(obs);
        setLoading(false);
      }).catch(() => { setLoading(false); setError(true); });
  }, [item.series]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest  = data[data.length - 1];
  const prev    = data[data.length - 2];
  const yearAgo = data[Math.max(0, data.length - 13)];
  const yoyPct  = latest && yearAgo && yearAgo.v !== 0 ? ((latest.v - yearAgo.v) / Math.abs(yearAgo.v)) * 100 : null;
  const mom     = latest && prev ? latest.v - prev.v : null;

  const trend = (() => {
    if (data.length < 4) return null;
    const pts = data.slice(-12), n = pts.length;
    const xm = (n-1)/2, ym = pts.reduce((s,d)=>s+d.v,0)/n;
    const num = pts.reduce((s,d,i)=>s+(i-xm)*(d.v-ym),0);
    const den = pts.reduce((s,d,i)=>s+(i-xm)**2,0);
    return den===0 ? 0 : num/den;
  })();

  const renderChart = () => {
    if (loading) return <div className="flex items-center justify-center py-8 font-mono" style={{ color:"var(--text-3)" }}>Loading…</div>;
    if (error)   return <div className="flex items-center gap-2 font-mono" style={{ color:"#e11d48", background:"rgba(225,29,72,0.06)", border:"1px solid rgba(225,29,72,0.18)", borderRadius:6, padding:"10px 14px", fontSize:11 }}>⚠ Failed to load — check your connection</div>;
    if (!data.length) return <div className="flex items-center justify-center py-8 font-mono" style={{ color:"#e11d48" }}>No data available</div>;
    return (
      <div>
        <div className="flex items-baseline justify-between mb-0.5">
          <span className="font-mono font-bold" style={{ color:"#7c3aed", fontSize:26 }}>{latest?.v?.toFixed(2)}</span>
          <div className="text-right">
            {yoyPct != null && <div className="font-mono" style={{ color:clr(yoyPct), fontSize:11 }}>YoY {fmt.pct(yoyPct)}</div>}
            {mom != null && <div className="font-mono" style={{ color:clr(mom), fontSize:10 }}>MoM {mom>=0?"+":""}{mom.toFixed(2)}</div>}
          </div>
        </div>
        <div className="font-mono mb-3" style={{ color:"var(--text-3)", fontSize:10 }}>As of {latest?.t}</div>

        {trend != null && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5" style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:4 }}>
            <span className="font-mono" style={{ color:Math.abs(trend)<0.01?"#64748b":trend>0?"#059669":"#e11d48", fontSize:14 }}>
              {Math.abs(trend)<0.01?"→":trend>0?"↗":"↘"}
            </span>
            <span className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>
              12-period trend: <span style={{ color:"#1e293b" }}>{trend>0.01?"Rising":trend<-0.01?"Declining":"Flat"}</span>
              <span style={{ color:"var(--text-3)" }}> ({trend>=0?"+":""}{trend.toFixed(3)}/period)</span>
            </span>
          </div>
        )}

        <div style={{ height:155, marginBottom:12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top:4, right:2, bottom:0, left:0 }}>
              <defs>
                <linearGradient id={"mcg_"+item.series.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{fill:"#64748b",fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}} tickLine={false} axisLine={false} interval={11}/>
              <YAxis domain={["auto","auto"]} hide/>
              <Tooltip contentStyle={{background:"var(--surface-2)",border:"1px solid rgba(15,23,42,0.18)",borderRadius:10,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}} formatter={v=>[v?.toFixed(2),item.label]}/>
              <Area type="monotone" dataKey="v" stroke="#7c3aed" strokeWidth={1.5} fill={"url(#mcg_"+item.series.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid mb-3" style={{ gridTemplateColumns:"repeat(3,1fr)", gap:"4px 8px" }}>
          {[
            ["Previous",  prev?.v?.toFixed(2)||"—"],
            ["1Y Ago",    yearAgo?.v?.toFixed(2)||"—"],
            ["5Y Min",    data.length>=12?Math.min(...data.slice(-60).map(d=>d.v)).toFixed(2):"—"],
          ].map(([k,v])=>(
            <div key={k}>
              <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>{k}</div>
              <div className="font-mono" style={{ color:"var(--text-1)", fontSize:11 }}>{v}</div>
            </div>
          ))}
        </div>
        <RelatedLinks itemId={item.id} onOpen={onOpen}/>
      </div>
    );
  };

  return (
    <ResearchPanelShell title={item.label} subtitle={item.series} badge="Macro" onClose={onClose}>
      <ResearchTabBar tabs={TABS} active={activeTab} onSelect={setActiveTab}/>
      {activeTab === "Chart"   && renderChart()}
      {activeTab === "Context" && (
        <div>
          {intel ? <IntelCard intel={intel} accentColor="#7c3aed"/> : <div className="font-mono py-4" style={{color:"var(--text-3)"}}>No context data available.</div>}
          <div className="mt-4"><RelatedLinks itemId={item.id} onOpen={onOpen}/></div>
        </div>
      )}
    </ResearchPanelShell>
  );
}
