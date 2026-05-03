import { useState } from 'react';
import { Star, Plus, X } from 'lucide-react';
import { fmt, clr } from '../lib/fmt';

// ─── EVENTS CALENDAR (used inside RightPanelShell) ───────────────────────────
function EventsCalendar({ earnings }) {
  if (!earnings) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading events...</div>;
  const upcoming = earnings.filter(e => new Date(e.date) >= new Date()).slice(0, 5);
  return (
    <div className="flex flex-col gap-2">
      {upcoming.length === 0 && <div className="text-gray-600 text-xs font-mono">No upcoming events found.</div>}
      {upcoming.map((e, i) => {
        const daysAway = Math.ceil((new Date(e.date) - new Date()) / (1000*60*60*24));
        return (
          <div key={i} className="flex items-center gap-3 border border-gray-800 rounded p-2.5">
            <div className="flex flex-col items-center justify-center w-10 h-10 rounded bg-gray-900 flex-shrink-0">
              <span className="text-yellow-500 text-xs font-mono font-bold">{daysAway}d</span>
              <span className="text-yellow-500 text-xs">💰</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-gray-200 font-semibold">Earnings Report</div>
              <div className="text-xs font-mono text-gray-600">{e.date}</div>
              {e.epsEstimate && <div className="text-xs font-mono text-gray-500">EPS Est: ${e.epsEstimate}</div>}
            </div>
            <span className="text-xs font-mono text-yellow-500 border border-yellow-800 rounded px-1.5 py-0.5">KEY</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── RIGHT PANEL (Watchlist + Events) ────────────────────────────────────────
export function RightPanelShell({ tapeData, onSelectTicker, earnings, activeTicker, onAddToWatchlist, onRemoveFromWatchlist }) {
  const [addInput, setAddInput] = useState("");
  const [addFocused, setAddFocused] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const handleAdd = () => {
    const sym = addInput.trim().toUpperCase();
    if (!sym) return;
    onAddToWatchlist?.(sym);
    setAddInput("");
    setShowAdd(false);
  };

  return (
    <div className="app-right">
      {/* Watchlist header */}
      <div className="right-section-header" style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <Star size={10} style={{ color:"#b45309" }} /> Watchlist
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          title="Add ticker"
          style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center",
            color: showAdd ? "#2563eb" : "var(--text-3)", padding:"0 2px", transition:"color 0.15s" }}>
          <Plus size={11} />
        </button>
      </div>

      {/* Add ticker input */}
      {showAdd && (
        <div style={{ padding:"6px 10px", borderBottom:"1px solid var(--border-subtle)", display:"flex", gap:5 }}>
          <input
            autoFocus
            value={addInput}
            onChange={e => setAddInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setShowAdd(false); }}
            onFocus={() => setAddFocused(true)}
            onBlur={() => setAddFocused(false)}
            placeholder="Ticker…"
            style={{ flex:1, fontSize:11, padding:"4px 7px", borderRadius:5,
              background:"var(--surface-0)", fontFamily:"'IBM Plex Mono',monospace",
              border:`1px solid ${addFocused ? "#2563eb" : "var(--border)"}`,
              color:"var(--text-1)", outline:"none" }} />
          <button onClick={handleAdd}
            style={{ padding:"4px 8px", fontSize:10, fontWeight:700, borderRadius:5,
              background:"rgba(37,99,235,0.12)", border:"1px solid rgba(37,99,235,0.30)",
              color:"#2563eb", cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace" }}>
            ADD
          </button>
        </div>
      )}

      {/* Watchlist rows — capped so events can fill remaining space */}
      <div style={{ flexShrink:0, maxHeight:"42%", overflowY:"auto" }}>
        {tapeData.length === 0 && (
          <div style={{ padding:"12px 12px", fontFamily:"'IBM Plex Mono',monospace", color:"var(--text-3)", fontSize:10 }}>
            {showAdd ? "Add a ticker above to get started" : "Loading…"}
          </div>
        )}
        {tapeData.map(t => (
          <div key={t.symbol}
            style={{ display:"flex", alignItems:"center",
              background: activeTicker===t.symbol?"rgba(37,99,235,0.06)":"transparent",
              borderBottom:"1px solid var(--border-subtle)", transition:"background 0.12s" }}
            onMouseEnter={e => { e.currentTarget.querySelector('.wl-remove').style.opacity = "1"; }}
            onMouseLeave={e => { e.currentTarget.querySelector('.wl-remove').style.opacity = "0"; }}>
            <button onClick={() => onSelectTicker(t.symbol)}
              style={{ flex:1, display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"7px 8px 7px 12px", background:"transparent", border:"none", cursor:"pointer" }}>
              <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:11,
                color: activeTicker===t.symbol?"var(--blue)":"var(--text-1)" }}>{t.symbol}</span>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"var(--text-1)" }}>${fmt.price(t.price)}</div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:clr(t.changePct) }}>
                  {t.changePct>=0?"▲":"▼"}{Math.abs(t.changePct||0).toFixed(2)}%
                </div>
              </div>
            </button>
            <button className="wl-remove"
              onClick={() => onRemoveFromWatchlist?.(t.symbol)}
              title={`Remove ${t.symbol}`}
              style={{ opacity:0, transition:"opacity 0.15s", background:"none", border:"none",
                cursor:"pointer", padding:"0 8px", color:"#94a3b8", display:"flex", alignItems:"center" }}>
              <X size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Events — fills all remaining space */}
      {earnings && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
          <div className="right-section-header">📅  Upcoming Events</div>
          <div style={{ flex:1, overflowY:"auto", padding:"8px 10px" }}>
            <EventsCalendar earnings={earnings} />
          </div>
        </div>
      )}

    </div>
  );
}
