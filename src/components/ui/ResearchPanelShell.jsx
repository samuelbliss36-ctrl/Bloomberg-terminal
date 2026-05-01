export function ResearchPanelShell({ title, subtitle, badge, onClose, children }) {
  return (
    <div className="terminal-panel terminal-glow flex flex-col" style={{ minHeight: 360 }}>
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3" style={{ borderBottom:"1px solid rgba(15,23,42,0.09)", flexShrink:0 }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            <div className="font-mono font-bold truncate" style={{ color:"var(--text-1)", fontSize:14, letterSpacing:"-0.01em" }}>{title}</div>
            {subtitle && <div className="font-mono truncate" style={{ color:"var(--text-3)", fontSize:9, marginTop:1 }}>{subtitle}</div>}
          </div>
          {badge && (
            <span className="font-mono" style={{ background:"rgba(15,23,42,0.08)", border:"1px solid rgba(15,23,42,0.14)", borderRadius:20, padding:"2px 8px", fontSize:9, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.06em", flexShrink:0 }}>
              {badge}
            </span>
          )}
        </div>
        <button onClick={onClose}
          style={{ color:"var(--text-3)", background:"rgba(15,23,42,0.07)", border:"none", cursor:"pointer", fontSize:12, marginLeft:8, flexShrink:0, width:24, height:24, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background="rgba(15,23,42,0.12)"; e.currentTarget.style.color="#475569"; }}
          onMouseLeave={e => { e.currentTarget.style.background="rgba(15,23,42,0.07)"; e.currentTarget.style.color="#64748b"; }}>✕</button>
      </div>
      <div className="flex flex-col flex-1 p-4">{children}</div>
    </div>
  );
}

export function ResearchTabBar({ tabs, active, onSelect }) {
  return (
    <div className="flex gap-1 mb-3" style={{ borderBottom:"1px solid rgba(15,23,42,0.09)", paddingBottom:8, flexShrink:0 }}>
      {tabs.map(tab => (
        <button key={tab} onClick={() => onSelect(tab)} className="font-mono"
          style={{ background: active===tab ? "#e2e8f0" : "transparent", border:"none", cursor:"pointer", padding:"2px 10px", fontSize:10, borderRadius:6, color: active===tab ? "#0f172a" : "#64748b" }}>
          {tab}
        </button>
      ))}
    </div>
  );
}
