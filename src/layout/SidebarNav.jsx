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
          style={{ width:"100%", padding:"10px 0", background:"none", border:"none", borderBottom:"1px solid var(--border-subtle)",
            color:"var(--text-3)", fontSize:14, cursor:"pointer", transition:"color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.color="#475569"}
          onMouseLeave={e=>e.currentTarget.style.color="var(--text-3)"}>
          {isOpen ? "◂" : "▸"}
        </button>
        {NAV_ITEMS.map(item => (
          <button key={item.key}
            className={"sidebar-item" + (activePage===item.key ? " active" : "")}
            onClick={() => setActivePage(item.key)}
            style={item.key === "pro" && activePage !== "pro" ? {
              borderLeft: "2px solid #2563eb",
              color: "#2563eb",
            } : {}}>
            <span className="sidebar-icon" style={{ position:"relative" }}>
              {item.icon}
              {item.ai && (
                <span style={{
                  position:"absolute", top:-3, right:-5,
                  width:6, height:6, borderRadius:"50%",
                  background:"linear-gradient(135deg,#7c3aed,#2563eb)",
                  boxShadow:"0 0 5px rgba(124,58,237,0.7)",
                  display:"block",
                }} />
              )}
            </span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </div>
      {/* Bottom: settings + admin (owner only) */}
      <div style={{ borderTop:"1px solid var(--border-subtle)" }}>
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
