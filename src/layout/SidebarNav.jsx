import { NAV_ITEMS } from '../data/screenerData';

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
export function SidebarNav({ activePage, setActivePage, isOpen, onToggle }) {
  return (
    <div className="app-sidebar" style={{ justifyContent:"space-between" }}>
      <div>
        {/* Toggle button */}
        <button onClick={onToggle}
          style={{ width:"100%", padding:"10px 0", background:"none", border:"none", borderBottom:"1px solid rgba(15,23,42,0.08)",
            color:"var(--text-3)", fontSize:14, cursor:"pointer", transition:"color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.color="#475569"}
          onMouseLeave={e=>e.currentTarget.style.color="#64748b"}>
          {isOpen ? "◂" : "▸"}
        </button>
        {NAV_ITEMS.map(item => (
          <button key={item.key}
            className={"sidebar-item" + (activePage===item.key ? " active" : "")}
            onClick={() => setActivePage(item.key)}>
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </div>
      {/* Bottom: settings */}
      <div style={{ borderTop:"1px solid rgba(15,23,42,0.08)" }}>
        <button className="sidebar-item" onClick={() => setActivePage("settings")}>
          <span className="sidebar-icon">⚙</span>
          <span className="sidebar-label">Settings</span>
        </button>
      </div>
    </div>
  );
}
