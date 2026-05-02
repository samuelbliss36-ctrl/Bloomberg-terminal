import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { Search, Zap, RefreshCw, Settings, ArrowUpRight, ArrowDownRight, Bell } from 'lucide-react';
import { fmt, clr, bg } from '../lib/fmt';
import { _apiCache } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertsContext';
import { AlertsPanel } from '../components/alerts/AlertsPanel';

// ─── Sign-out button (used in account dropdown) ───────────────────────────────
// Keys that are local-only and should be wiped when switching accounts
const LOCAL_ONLY_KEYS = [
  'ov_onboarding_done', // cleared locally; Supabase metadata is the source of truth
  'ov_alerts',
  'ov_telegram',
  'ov_copilot_key',
];

function SignOutButton({ onClose }) {
  const { signOut } = useAuth();
  const handle = async () => {
    onClose();
    LOCAL_ONLY_KEYS.forEach(k => localStorage.removeItem(k));
    await signOut();
  };
  return (
    <button onClick={handle}
      style={{ width:'100%', padding:'9px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left', fontSize:11, color:'#e11d48', fontWeight:600, fontFamily:"'Inter',sans-serif", display:'flex', alignItems:'center', gap:7, transition:'background 0.12s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(225,29,72,0.06)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
      Sign Out
    </button>
  );
}

// ─── TICKER TAPE (standalone) ─────────────────────────────────────────────────
export const TickerTape = memo(function TickerTape({ tapeData }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let x = 0;
    const animate = () => {
      x -= 0.4;
      if (x < -el.scrollWidth / 2) x = 0;
      el.style.transform = "translateX(" + x + "px)";
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);
  // Duplicate items so seamless loop never shows a gap
  const items = useMemo(() => [...tapeData, ...tapeData], [tapeData]);
  return (
    <div className="ticker-tape overflow-hidden" style={{ height: 28 }}>
      <div ref={ref} className="flex items-center gap-6 whitespace-nowrap" style={{ paddingTop: 5 }}>
        {items.map((t, i) => (
          <span key={t.symbol + i} className="flex items-center gap-1.5 text-xs font-mono">
            <span style={{ color: "var(--text-3)", fontWeight: 600 }}>{t.symbol}</span>
            <span style={{ color: "var(--text-1)" }}>${fmt.price(t.price)}</span>
            <span style={{ color: clr(t.changePct) }}>{t.changePct >= 0 ? "▲" : "▼"}{Math.abs(t.changePct || 0).toFixed(2)}%</span>
            <span style={{ color: "#e2e8f0", marginLeft: 8 }}>|</span>
          </span>
        ))}
      </div>
    </div>
  );
});

// ─── TOP NAV ──────────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
export function TopNav({ ticker, setTicker, quote, loading, onSettingsClick }) {
  const [input, setInput] = useState(ticker);
  const [focused, setFocused] = useState(false);

  // Sync search box when ticker changes externally (watchlist click, etc.)
  useEffect(() => { setInput(ticker); }, [ticker]);

  const handleRefresh = useCallback(() => {
    // Bust cache for current ticker then re-trigger the fetch effect
    _apiCache.forEach((_, k) => { if (k.includes(ticker)) _apiCache.delete(k); });
    setTicker(ticker + " "); // force state change then normalize
    setTimeout(() => setTicker(ticker), 0);
  }, [ticker, setTicker]);

  return (
    <div className="top-nav flex items-center gap-4 px-4 py-2"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
        <Zap size={14} style={{ color: "#2563eb" }} />
        <span className="logo-text" style={{ fontSize: 12 }}>OMNES VIDENTES</span>
      </div>

      <div className="flex items-center gap-2 px-2 py-1.5"
        style={{ background: "var(--surface-0)", border: "1px solid " + (focused ? "#2563eb" : "#cbd5e1"),
          borderRadius: 5, transition: "border-color 0.15s", minWidth: 220, maxWidth: 300 }}>
        <Search size={11} style={{ color: "var(--text-3)", flexShrink: 0 }} />
        <input
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === "Enter") setTicker(input.trim()); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ticker… (Enter to load)"
          style={{ background: "transparent", border: "none", color: "var(--text-1)", fontSize: 12,
            fontFamily: "'IBM Plex Mono', monospace", outline: "none", width: "100%" }}
        />
      </div>

      {quote ? (
        <div className="flex items-center gap-3" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          <span style={{ color: "var(--text-1)", fontWeight: 700, fontSize: 14 }}>{ticker}</span>
          <span style={{ color: "var(--text-1)", fontSize: 16, fontWeight: 600 }}>${fmt.price(quote.c)}</span>
          <span className="flex items-center gap-1" style={{ color: clr(quote.dp), background: bg(quote.dp),
            fontSize: 12, padding: "2px 8px", borderRadius: 10 }}>
            {quote.dp >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {fmt.change(quote.d)} ({fmt.pct(quote.dp)})
          </span>
          <span style={{ color: "var(--text-3)", fontSize: 11 }}>Vol {fmt.volume(quote.v > 0 ? quote.v : null)}</span>
          <span style={{ color: "var(--text-3)", fontSize: 11 }}>O {fmt.price(quote.o)}</span>
          <span style={{ color: "var(--text-3)", fontSize: 11 }}>H {fmt.price(quote.h)}</span>
          <span style={{ color: "var(--text-3)", fontSize: 11 }}>L {fmt.price(quote.l)}</span>
        </div>
      ) : loading ? (
        <span style={{ color: "#b45309", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>● Loading {ticker}…</span>
      ) : null}

      <div className="ml-auto flex items-center gap-3" style={{ flexShrink: 0 }}>
        <button onClick={handleRefresh} title="Refresh data" style={{ color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <RefreshCw size={13} />
        </button>
        <button onClick={onSettingsClick} title="Settings" style={{ color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Settings size={13} />
        </button>
        <div style={{ width: 1, height: 14, background: "#e2e8f0" }} />
        <span style={{ color: "var(--text-3)", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>LIVE</span>
        <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", display: "inline-block" }} />
      </div>
    </div>
  );
}

// ─── TOP BAR CLOCK ────────────────────────────────────────────────────────────
export function TopBarClock() {
  const [t, setT] = useState(() => new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" }));
  useEffect(() => {
    const iv = setInterval(() => setT(new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" })), 15000);
    return () => clearInterval(iv);
  }, []);
  return (
    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"var(--text-3)", marginLeft:12, flexShrink:0 }}>{t}</span>
  );
}

// ─── GLOBAL TOP BAR ───────────────────────────────────────────────────────────
export function GlobalTopBar({ ticker, setTicker, tapeData, quote, loading, settings, onToggleTape, onToggleDark }) {
  const [input, setInput] = useState(ticker);
  const [focused, setFocused] = useState(false);
  const [authOpen,   setAuthOpen]   = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const tapeRef = useRef(null);
  const { user, syncing } = useAuth();
  const { activeCount } = useAlerts();

  useEffect(() => { setInput(ticker); }, [ticker]);

  // Animate ticker tape inside topbar
  useEffect(() => {
    const el = tapeRef.current;
    if (!el || !tapeData.length) return;
    let x = 0;
    const speed = 0.35;
    let raf;
    const animate = () => {
      x -= speed;
      if (x < -el.scrollWidth / 2) x = 0;
      el.style.transform = "translateX(" + x + "px)";
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [tapeData]);

  const tapeItems = useMemo(() => [...tapeData, ...tapeData], [tapeData]);
  const up = quote?.dp >= 0;

  return (
    <div className="global-topbar">
      {/* Logo */}
      <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0, paddingRight:12, borderRight:"1px solid rgba(15,23,42,0.09)", marginRight:12 }}>
        <Zap size={13} style={{ color:"#2563eb" }} />
        <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:12, color:"var(--text-1)", letterSpacing:"0.12em" }}>OMNES</span>
      </div>

      {/* Inline ticker tape — hidden when toggled off */}
      {settings?.showTickerTape !== false && (
        <div style={{ flex:1, overflow:"hidden", height:"100%", display:"flex", alignItems:"center", minWidth:0, maskImage:"linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)" }}>
          <div ref={tapeRef} style={{ display:"flex", alignItems:"center", gap:20, whiteSpace:"nowrap", willChange:"transform" }}>
            {tapeItems.map((t, i) => (
              <span key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:10, color:"var(--text-3)" }}>{t.symbol}</span>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"var(--text-1)" }}>${fmt.price(t.price)}</span>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:clr(t.changePct) }}>
                  {t.changePct >= 0 ? "▲" : "▼"}{Math.abs(t.changePct||0).toFixed(2)}%
                </span>
                <span style={{ color:"rgba(15,23,42,0.20)", marginLeft:6 }}>|</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {settings?.showTickerTape === false && <div style={{ flex:1 }} />}

      {/* Search */}
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 8px", background:"var(--surface-0)",
          border:"1px solid"+(focused?"rgba(37,99,235,0.40)":"rgba(15,23,42,0.16)"), borderRadius:8,
          transition:"border-color 0.15s, box-shadow 0.15s", boxShadow:focused?"0 0 0 3px rgba(37,99,235,0.12)":"none",
          marginLeft:12, flexShrink:0, minWidth:180 }}>
        <Search size={11} style={{ color:"var(--text-3)", flexShrink:0 }} />
        <input value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key==="Enter") setTicker(input.trim()); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Symbol…"
          style={{ background:"none", border:"none", outline:"none", width:100, fontSize:11, color:"var(--text-1)", fontFamily:"'IBM Plex Mono',monospace" }} />
        {loading && <span style={{ color:"var(--text-3)", fontSize:9 }}>…</span>}
      </div>

      {/* Live quote strip */}
      {quote && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:12, flexShrink:0 }}>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:600, fontSize:12, color:"var(--text-1)" }}>${fmt.price(quote.c)}</span>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:up?"#059669":"#e11d48" }}>
            {up?"+":""}{fmt.price(quote.d)} ({fmt.pct(quote.dp||0)})
          </span>
        </div>
      )}

      {/* ── Control toggles ── */}
      <div style={{ display:"flex", alignItems:"center", gap:4, marginLeft:10, flexShrink:0 }}>
        {/* Ticker tape toggle */}
        <button
          onClick={onToggleTape}
          title={settings?.showTickerTape !== false ? "Hide ticker tape" : "Show ticker tape"}
          style={{
            display:"flex", alignItems:"center", gap:4, padding:"3px 8px",
            background: settings?.showTickerTape !== false ? "rgba(37,99,235,0.10)" : "transparent",
            border: `1px solid ${settings?.showTickerTape !== false ? "rgba(37,99,235,0.30)" : "var(--border)"}`,
            borderRadius:6, cursor:"pointer", transition:"all 0.15s",
            color: settings?.showTickerTape !== false ? "var(--blue)" : "var(--text-3)",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <span style={{ fontSize:10 }}>≋</span>
          <span style={{ fontSize:9, fontFamily:"'Inter',sans-serif", fontWeight:600, letterSpacing:"0.05em" }}>
            {settings?.showTickerTape !== false ? "TAPE" : "TAPE"}
          </span>
          <span style={{ fontSize:8, opacity:0.7 }}>{settings?.showTickerTape !== false ? "ON" : "OFF"}</span>
        </button>

        {/* Dark / Light theme toggle */}
        <button
          onClick={onToggleDark}
          title={settings?.darkMode ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            display:"flex", alignItems:"center", gap:4, padding:"3px 8px",
            background: settings?.darkMode ? "rgba(88,166,255,0.12)" : "transparent",
            border: `1px solid ${settings?.darkMode ? "rgba(88,166,255,0.30)" : "var(--border)"}`,
            borderRadius:6, cursor:"pointer", transition:"all 0.15s",
            color: settings?.darkMode ? "#58a6ff" : "var(--text-3)",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <span style={{ fontSize:11 }}>{settings?.darkMode ? "☀" : "🌙"}</span>
          <span style={{ fontSize:9, fontFamily:"'Inter',sans-serif", fontWeight:600, letterSpacing:"0.05em" }}>
            {settings?.darkMode ? "DAY" : "NIGHT"}
          </span>
        </button>

        {/* Price-alerts bell */}
        <button
          onClick={() => setAlertsOpen(o => !o)}
          title="Price Alerts"
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
            background: alertsOpen ? 'rgba(245,158,11,0.12)' : activeCount > 0 ? 'rgba(245,158,11,0.08)' : 'transparent',
            border: `1px solid ${alertsOpen || activeCount > 0 ? 'rgba(245,158,11,0.35)' : 'var(--border)'}`,
            borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
            color: activeCount > 0 ? '#f59e0b' : 'var(--text-3)',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Bell size={12} />
          {activeCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: '#f59e0b', color: '#fff', fontSize: 8, fontWeight: 700,
              borderRadius: 10, minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Inter',sans-serif", lineHeight: 1, padding: '0 3px',
            }}>{activeCount}</span>
          )}
        </button>

        {/* Account button */}
        {user && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setAuthOpen(o => !o)}
              title={`Signed in as ${user.email}`}
              style={{
                display:"flex", alignItems:"center", gap:5, padding:"3px 8px",
                background: authOpen ? "rgba(5,150,105,0.16)" : "rgba(5,150,105,0.08)",
                border: "1px solid rgba(5,150,105,0.28)",
                borderRadius:6, cursor:"pointer", transition:"all 0.15s", color:"#34d399",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.80"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              <span style={{ width:7, height:7, borderRadius:"50%", background: syncing ? "#f59e0b" : "#10b981", display:"inline-block", flexShrink:0 }} />
              <span style={{ fontSize:9, fontFamily:"'Inter',sans-serif", fontWeight:700, letterSpacing:"0.05em", maxWidth:72, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {user.email}
              </span>
            </button>

            {/* Sign-out dropdown */}
            {authOpen && (
              <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:9999, background:'var(--surface-1, #fff)', border:'1px solid rgba(15,23,42,0.12)', borderRadius:8, boxShadow:'0 8px 24px rgba(15,23,42,0.14)', minWidth:160, overflow:'hidden' }}>
                <div style={{ padding:'10px 14px 8px', borderBottom:'1px solid rgba(15,23,42,0.08)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:2 }}>Signed in as</div>
                  <div style={{ fontSize:11, color:'var(--text-1)', fontWeight:600, wordBreak:'break-all' }}>{user.email}</div>
                </div>
                <SignOutButton onClose={() => setAuthOpen(false)} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Price alerts panel */}
      {alertsOpen && <AlertsPanel onClose={() => setAlertsOpen(false)} />}

      {/* Clock */}
      <TopBarClock />
    </div>
  );
}
