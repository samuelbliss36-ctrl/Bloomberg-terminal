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

// ─── RIGHT PANEL (Watchlist + Order Ticket) ───────────────────────────────────
export function RightPanelShell({ tapeData, onSelectTicker, earnings, activeTicker, onAddToWatchlist, onRemoveFromWatchlist }) {
  const [side, setSide] = useState("BUY");
  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState("MKT");
  const [limitPx, setLimitPx] = useState("");
  const [orderMsg, setOrderMsg] = useState(null);
  const [addInput, setAddInput] = useState("");
  const [addFocused, setAddFocused] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const handleOrder = () => {
    if (!qty || isNaN(qty) || +qty <= 0) { setOrderMsg({ type:"error", text:"Enter valid quantity" }); return; }
    setOrderMsg({ type:"ok", text: side + " " + qty + " " + activeTicker + " @ " + (orderType==="MKT"?"MKT":("$"+limitPx)) + " — Simulated ✓" });
    setTimeout(() => setOrderMsg(null), 3500);
    setQty(""); setLimitPx("");
  };

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
        <div style={{ padding:"6px 10px", borderBottom:"1px solid rgba(15,23,42,0.08)", display:"flex", gap:5 }}>
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
              border:`1px solid ${addFocused ? "#2563eb" : "rgba(15,23,42,0.15)"}`,
              color:"var(--text-1)", outline:"none" }} />
          <button onClick={handleAdd}
            style={{ padding:"4px 8px", fontSize:10, fontWeight:700, borderRadius:5,
              background:"rgba(37,99,235,0.12)", border:"1px solid rgba(37,99,235,0.30)",
              color:"#2563eb", cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace" }}>
            ADD
          </button>
        </div>
      )}

      {/* Watchlist rows */}
      <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
        {tapeData.length === 0 && (
          <div style={{ padding:"12px 12px", fontFamily:"'IBM Plex Mono',monospace", color:"var(--text-3)", fontSize:10 }}>
            {showAdd ? "Add a ticker above to get started" : "Loading…"}
          </div>
        )}
        {tapeData.map(t => (
          <div key={t.symbol}
            style={{ display:"flex", alignItems:"center",
              background: activeTicker===t.symbol?"rgba(37,99,235,0.06)":"transparent",
              borderBottom:"1px solid rgba(15,23,42,0.06)", transition:"background 0.12s" }}
            onMouseEnter={e => { e.currentTarget.querySelector('.wl-remove').style.opacity = "1"; }}
            onMouseLeave={e => { e.currentTarget.querySelector('.wl-remove').style.opacity = "0"; }}>
            <button onClick={() => onSelectTicker(t.symbol)}
              style={{ flex:1, display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"7px 8px 7px 12px", background:"transparent", border:"none", cursor:"pointer" }}>
              <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:11,
                color: activeTicker===t.symbol?"#2563eb":"#0f172a" }}>{t.symbol}</span>
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

      {/* Events */}
      {earnings && (
        <>
          <div className="right-section-header">📅  Upcoming Events</div>
          <div style={{ padding:"4px 0 6px", borderBottom:"1px solid rgba(15,23,42,0.08)" }}>
            <EventsCalendar earnings={earnings} />
          </div>
        </>
      )}

      {/* Order Ticket */}
      <div className="right-section-header">🎫  Order Ticket</div>
      <div style={{ padding:"10px 12px", flexShrink:0 }}>
        <div style={{ display:"flex", marginBottom:8, background:"var(--surface-0)", borderRadius:6, padding:2, border:"1px solid rgba(15,23,42,0.11)" }}>
          {["BUY","SELL"].map(s => (
            <button key={s} onClick={() => setSide(s)}
              style={{ flex:1, padding:"5px 0", border:"none", borderRadius:4, fontFamily:"'Inter',sans-serif",
                fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
                background: side===s ? (s==="BUY"?"rgba(5,150,105,0.15)":"rgba(225,29,72,0.14)") : "transparent",
                color: side===s ? (s==="BUY"?"#059669":"#e11d48") : "#64748b" }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#2563eb", fontWeight:700, marginBottom:6, textAlign:"center" }}>
          {activeTicker}
        </div>
        <div style={{ marginBottom:6 }}>
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:600, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>Quantity</div>
          <input className="order-ticket-input" type="number" placeholder="0" value={qty}
            onChange={e => setQty(e.target.value)} min="1" step="1" />
        </div>
        <div style={{ marginBottom:6 }}>
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:600, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>Type</div>
          <select className="order-ticket-input" value={orderType} onChange={e => setOrderType(e.target.value)}
            style={{ appearance:"none", cursor:"pointer" }}>
            <option value="MKT">Market</option>
            <option value="LMT">Limit</option>
            <option value="STP">Stop</option>
          </select>
        </div>
        {orderType !== "MKT" && (
          <div style={{ marginBottom:6 }}>
            <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:600, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>Price</div>
            <input className="order-ticket-input" type="number" placeholder="0.00" value={limitPx}
              onChange={e => setLimitPx(e.target.value)} step="0.01" />
          </div>
        )}
        <button onClick={handleOrder}
          style={{ width:"100%", padding:"7px 0", border:"none", borderRadius:6, fontFamily:"'Inter',sans-serif",
            fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:"0.06em", marginTop:2,
            background: side==="BUY"?"#059669":"#be123c", color:"#fff", transition:"opacity 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.opacity="0.85"}
          onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          PLACE {side} ORDER
        </button>
        {orderMsg && (
          <div style={{ marginTop:6, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, textAlign:"center",
            color: orderMsg.type==="ok"?"#059669":"#e11d48" }}>
            {orderMsg.text}
          </div>
        )}
        <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:"var(--text-3)", textAlign:"center", marginTop:6 }}>
          Simulated — paper trading only
        </div>
      </div>
    </div>
  );
}
