import { NAV_ITEMS } from '../data/screenerData';
import { useAuth } from '../context/AuthContext';
import { isOwner } from '../lib/subscription';

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
export function SidebarNav({ activePage, setActivePage, isOpen, onToggle }) {
  const { user } = useAuth();
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
      {/* Bottom: settings + admin (owner only) */}
      <div style={{ borderTop:"1px solid rgba(15,23,42,0.08)" }}>
        {isOwner(user) && (
          <button
            className={"sidebar-item" + (activePage==="admin" ? " active" : "")}
            onClick={() => setActivePage("admin")}>
            <span className="sidebar-icon">👁</span>
            <span className="sidebar-label">Admin</span>
          </button>
        )}
        <button className={"sidebar-item" + (activePage==="settings" ? " active" : "")} onClick={() => setActivePage("settings")}>
          <span className="sidebar-icon">⚙</span>
          <span className="sidebar-label">Settings</span>
        </button>
      </div>
    </div>
  );
}
