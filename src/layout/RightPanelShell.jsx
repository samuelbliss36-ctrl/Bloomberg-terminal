import { useState } from 'react';
import { Star } from 'lucide-react';
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
export function RightPanelShell({ tapeData, onSelectTicker, earnings, activeTicker }) {
  const [side, setSide] = useState("BUY");
  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState("MKT");
  const [limitPx, setLimitPx] = useState("");
  const [orderMsg, setOrderMsg] = useState(null);

  const handleOrder = () => {
    if (!qty || isNaN(qty) || +qty <= 0) { setOrderMsg({ type:"error", text:"Enter valid quantity" }); return; }
    setOrderMsg({ type:"ok", text: side + " " + qty + " " + activeTicker + " @ " + (orderType==="MKT"?"MKT":("$"+limitPx)) + " — Simulated ✓" });
    setTimeout(() => setOrderMsg(null), 3500);
    setQty(""); setLimitPx("");
  };

  return (
    <div className="app-right">
      {/* Watchlist */}
      <div className="right-section-header" style={{ display:"flex", alignItems:"center", gap:6 }}>
        <Star size={10} style={{ color:"#b45309" }} />  Watchlist
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
        {tapeData.length === 0 && (
          <div style={{ padding:"12px 12px", fontFamily:"'IBM Plex Mono',monospace", color:"var(--text-3)", fontSize:10 }}>Loading…</div>
        )}
        {tapeData.map(t => (
          <button key={t.symbol} onClick={() => onSelectTicker(t.symbol)}
            style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"7px 12px", background: activeTicker===t.symbol?"rgba(37,99,235,0.06)":"transparent",
              border:"none", borderBottom:"1px solid rgba(15,23,42,0.06)", cursor:"pointer",
              transition:"background 0.12s" }}
            onMouseEnter={e=>{if(activeTicker!==t.symbol) e.currentTarget.style.background="rgba(255,255,255,0.025)"}}
            onMouseLeave={e=>{if(activeTicker!==t.symbol) e.currentTarget.style.background="transparent"}}>
            <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:11,
              color: activeTicker===t.symbol?"#2563eb":"#0f172a" }}>{t.symbol}</span>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"var(--text-1)" }}>${fmt.price(t.price)}</div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:clr(t.changePct) }}>
                {t.changePct>=0?"▲":"▼"}{Math.abs(t.changePct||0).toFixed(2)}%
              </div>
            </div>
          </button>
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
        {/* BUY / SELL toggle */}
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
        {/* Ticker display */}
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#2563eb", fontWeight:700, marginBottom:6, textAlign:"center" }}>
          {activeTicker}
        </div>
        {/* Qty */}
        <div style={{ marginBottom:6 }}>
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:600, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>Quantity</div>
          <input className="order-ticket-input" type="number" placeholder="0" value={qty}
            onChange={e => setQty(e.target.value)} min="1" step="1" />
        </div>
        {/* Order type */}
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
