import { useState, useEffect } from "react";
import { clr, delay, RB_TYPE_COLOR } from "../../../lib/fmt";
import { TOPIC_CONFIG } from "../../../data/researchData";
import { ResearchPanelShell } from "../../../components/ui/ResearchPanelShell";
import RelatedLinks from "./RelatedLinks";

export default function TopicResearchPanel({ item, onClose, onOpen }) {
  const cfg = TOPIC_CONFIG[item.id];
  const [macroData, setMacroData] = useState({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);

  useEffect(() => {
    if (!cfg) return;
    setLoading(true); setError(false);
    Promise.all(
      cfg.macro.map((m, i) =>
        delay(i * 200)
          .then(() => fetch("/api/fred?series=" + m.series).then(r => r.json()))
          .then(d => {
            const obs = (d.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
            const latest = obs[obs.length - 1];
            const prev   = obs[obs.length - 2];
            return { id:m.id, label:m.label, latest:latest ? parseFloat(latest.value) : null, date:latest?.date, prev:prev ? parseFloat(prev.value) : null };
          })
          .catch(() => ({ id:m.id, label:m.label, latest:null }))
      )
    ).then(results => {
      setMacroData(Object.fromEntries(results.map(r => [r.id, r])));
      setLoading(false);
    }).catch(() => { setLoading(false); setError(true); });
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return null;

  return (
    <ResearchPanelShell title={cfg.icon + " " + cfg.title} subtitle={cfg.desc} badge="Topic" onClose={onClose}>
      {loading ? (
        <div className="flex items-center justify-center flex-1 font-mono" style={{ color:"var(--text-3)", fontSize:11 }}>Loading…</div>
      ) : error ? (
        <div className="flex items-center gap-2 font-mono" style={{ color:"#e11d48", background:"rgba(225,29,72,0.06)", border:"1px solid rgba(225,29,72,0.18)", borderRadius:6, padding:"10px 14px", fontSize:11 }}>⚠ Failed to load topic data</div>
      ) : (
        <>
          <div className="grid mb-3" style={{ gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {cfg.macro.map(m => {
              const d = macroData[m.id];
              const mom = d?.latest != null && d?.prev != null ? d.latest - d.prev : null;
              return (
                <button key={m.id} onClick={() => onOpen({ id:m.id, label:m.label, type:"macro", series:m.series, category:"Macro" })}
                  className="text-left p-2"
                  style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:10, cursor:"pointer", transition:"border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#e2e8f0"}>
                  <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>{m.label}</div>
                  <div className="font-mono font-bold" style={{ color:"#7c3aed", fontSize:16 }}>
                    {d?.latest != null ? d.latest.toFixed(2) : "—"}
                  </div>
                  {mom != null && (
                    <div className="font-mono" style={{ color:clr(mom), fontSize:10 }}>
                      {mom >= 0 ? "▲" : "▼"} {Math.abs(mom).toFixed(2)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ borderTop:"1px solid rgba(15,23,42,0.09)", paddingTop:8, marginBottom:4 }}>
            <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Related Assets</div>
            <div className="flex flex-wrap gap-1.5">
              {cfg.assets.map(a => (
                <button key={a.id} onClick={() => onOpen(a)} className="font-mono"
                  style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:6, padding:"3px 8px", fontSize:11, color:RB_TYPE_COLOR[a.type]||"#64748b", cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#e2e8f0"}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <RelatedLinks itemId={item.id} onOpen={onOpen} />
        </>
      )}
    </ResearchPanelShell>
  );
}
