import { useState, useEffect, useCallback } from "react";
import { api } from './lib/api';
import { delay, loadSettings, saveSettings } from './lib/fmt';
import { WATCHLIST } from './lib/constants';
import { CopilotPanel } from './components/copilot/CopilotPanel';
import { GlobalTopBar } from './layout/GlobalTopBar';
import { SidebarNav } from './layout/SidebarNav';
import { RightPanelShell } from './layout/RightPanelShell';
import { AuthProvider } from './context/AuthContext';
import CommoditiesDashboard from './pages/Commodities/CommoditiesDashboard';
import CryptoDashboard from './pages/Crypto/CryptoDashboard';
import FXDashboard from './pages/FX/FXDashboard';
import SupplyChainDashboard from './pages/SupplyChain/SupplyChainDashboard';
import TechnicalAnalysis from './pages/Technical/TechnicalAnalysis';
import EyeOfSauron from './pages/Eye/EyeOfSauron';
import GlobalMarketsModule from './pages/Markets/GlobalMarketsModule';
import AssetView from './pages/Markets/AssetView';
import PortfolioTracker, { MarketSessionBadges } from './pages/Portfolio/PortfolioTracker';
import StockScreener from './pages/Screener/StockScreener';
import ResearchBrowser from './pages/Research/ResearchBrowser';
import EarningsCalendarPage from './pages/Earnings/EarningsCalendarPage';
import AdminDashboard from './pages/Admin/AdminDashboard';

export default function App() {
  const [activePage, setActivePage] = useState("financial");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(() => ({ showTickerTape: true, darkMode: false, ...loadSettings() }));
  const [copilotOpen, setCopilotOpen] = useState(false);

  const toggleTape = useCallback(() => setSettings(s => { const n = {...s, showTickerTape: !s.showTickerTape}; saveSettings(n); return n; }), []);
  const toggleDark = useCallback(() => setSettings(s => { const n = {...s, darkMode: !s.darkMode}; saveSettings(n); return n; }), []);
  const [ticker, setTicker] = useState("AAPL");
  const [quote, setQuote] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [profile, setProfile] = useState(null);
  const [news, setNews] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [tapeData, setTapeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingResearchItem, setPendingResearchItem] = useState(null);
  const [statusTime, setStatusTime] = useState(() => new Date().toLocaleTimeString());
  const [subscribedToast, setSubscribedToast] = useState(false);

  // Check for ?subscribed=true after Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscribed') === 'true') {
      setSubscribedToast(true);
      window.history.replaceState({}, '', window.location.pathname);
      const t = setTimeout(() => setSubscribedToast(false), 5000);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line

  // Live clock in status bar
  useEffect(() => {
    const iv = setInterval(() => setStatusTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    setLoading(true);
    setQuote(null); setMetrics(null); setProfile(null); setNews(null); setEarnings(null);
    const today = new Date().toISOString().split("T")[0];
    const monthAgo = new Date(Date.now()-30*24*3600*1000).toISOString().split("T")[0];
    const yearAhead = new Date(Date.now()+365*24*3600*1000).toISOString().split("T")[0];
    Promise.all([
      api("/quote?symbol="+ticker),
      api("/stock/metric?symbol="+ticker+"&metric=all"),
      api("/stock/profile2?symbol="+ticker),
      api("/company-news?symbol="+ticker+"&from="+monthAgo+"&to="+today),
      api("/calendar/earnings?symbol="+ticker+"&from="+today+"&to="+yearAhead),
    ]).then(([q,m,p,n,e]) => {
      setQuote(q); setMetrics(m); setProfile(p);
      setNews(Array.isArray(n)?n:[]);
      setEarnings(e?.earningsCalendar||[]);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, [ticker]);

  useEffect(() => {
    // Stagger to respect Finnhub rate limits; single state update at end to avoid 8 re-renders
    const fetchTape = async () => {
      const results = [];
      for (let i = 0; i < WATCHLIST.length; i++) {
        if (i > 0) await delay(150);
        try {
          const q = await api("/quote?symbol=" + WATCHLIST[i]);
          results.push({ symbol: WATCHLIST[i], price: q.c, changePct: q.dp });
        } catch(e) {}
      }
      setTapeData(results);
    };
    fetchTape();
  }, []);

  const openResearch = (item) => { setPendingResearchItem(item); setActivePage("research"); };

  return (
    <AuthProvider>
    <div className={"app-shell" + (sidebarOpen ? " sidebar-open" : "") + (settings.darkMode ? " dark" : "")} style={{ fontFamily:"'Inter','IBM Plex Sans',sans-serif" }}>
      {/* ── Global Top Bar ─────────────────────────────────── */}
      <GlobalTopBar
        ticker={ticker}
        setTicker={t => { setTicker(t); setActivePage("financial"); }}
        tapeData={tapeData}
        quote={activePage==="financial" ? quote : null}
        loading={loading}
        settings={settings}
        onToggleTape={toggleTape}
        onToggleDark={toggleDark}
      />

      {/* ── Left Sidebar ───────────────────────────────────── */}
      <SidebarNav
        activePage={activePage}
        setActivePage={setActivePage}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      {/* ── Main Content ───────────────────────────────────── */}
      <div className="app-main">
        {activePage === "financial" && (
          <AssetView
            ticker={ticker}
            quote={quote}
            metrics={metrics}
            profile={profile}
            news={news}
          />
        )}
        {activePage === "commodities"  && <CommoditiesDashboard />}
        {activePage === "crypto"       && <CryptoDashboard />}
        {activePage === "supplychain"  && <SupplyChainDashboard onOpenResearch={openResearch} />}
        {activePage === "fx"           && <FXDashboard onOpenResearch={openResearch} />}
        {activePage === "technical"    && <TechnicalAnalysis ticker={ticker} />}
        {activePage === "eye"          && <EyeOfSauron onOpenResearch={openResearch} />}
        {activePage === "markets"      && <GlobalMarketsModule onOpenResearch={openResearch} />}
        {activePage === "portfolio"    && <PortfolioTracker />}
        {activePage === "screener"     && <StockScreener onSelectTicker={t => { setTicker(t); setActivePage("financial"); }} />}
        {activePage === "research"     && <ResearchBrowser pendingItem={pendingResearchItem} onPendingConsumed={() => setPendingResearchItem(null)} />}
        {activePage === "earnings"     && <EarningsCalendarPage />}
        {activePage === "admin" && <AdminDashboard />}
        {activePage === "settings" && (
          <div style={{ padding:24, maxWidth:480 }}>
            <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:13, color:"var(--text-1)", marginBottom:16 }}>Settings</div>
            <div style={{ background:"var(--surface-1)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:10, padding:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:"var(--text-1)", fontWeight:500 }}>Ticker Tape</div>
                  <div style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:"var(--text-3)" }}>Scrolling prices in top bar</div>
                </div>
                <button onClick={() => setSettings(s => { const n={...s, showTickerTape:!s.showTickerTape}; saveSettings(n); return n; })}
                  style={{ width:40, height:22, borderRadius:11, border:"none", cursor:"pointer", background:settings.showTickerTape?"#2563eb":"#cbd5e1", position:"relative", transition:"background 0.2s" }}>
                  <div style={{ position:"absolute", top:3, left:settings.showTickerTape?21:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Panel ────────────────────────────────────── */}
      <RightPanelShell
        tapeData={tapeData}
        onSelectTicker={t => { setTicker(t); setActivePage("financial"); }}
        earnings={earnings}
        activeTicker={ticker}
      />

      {/* ── Status Bar ─────────────────────────────────────── */}
      <div className="status-bar" style={{ gridArea:"status", display:"flex", alignItems:"center", gap:16, padding:"0 12px", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:"#059669", boxShadow:"0 0 6px rgba(5,150,105,0.60)" }} />
        <span>OMNES VIDENTES · LIVE DATA</span>
        <span style={{ color:"rgba(15,23,42,0.20)" }}>|</span>
        <MarketSessionBadges />
        <span style={{ marginLeft:"auto" }}>{statusTime}</span>
      </div>

      {/* ── Subscription success toast ─────────────────────── */}
      {subscribedToast && (
        <div style={{
          position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", zIndex:10000,
          background:"#059669", color:"#fff", borderRadius:8, padding:"10px 20px",
          fontSize:12, fontWeight:600, boxShadow:"0 4px 16px rgba(5,150,105,0.40)",
          display:"flex", alignItems:"center", gap:8,
        }}>
          <span>✓</span>
          <span>Welcome to Pro! Your subscription is now active.</span>
          <button onClick={() => setSubscribedToast(false)}
            style={{ background:"none", border:"none", color:"#fff", cursor:"pointer", fontSize:14, marginLeft:4 }}>✕</button>
        </div>
      )}

      {/* ── AI Copilot ─────────────────────────────────────── */}
      {copilotOpen && (
        <CopilotPanel
          activePage={activePage}
          ticker={ticker}
          quote={quote}
          metrics={metrics}
          profile={profile}
          news={news}
          onClose={() => setCopilotOpen(false)}
        />
      )}
      {/* Floating launcher button */}
      <button
        onClick={() => setCopilotOpen(o => !o)}
        title="AI Copilot"
        style={{
          position:"fixed", bottom:48, right:16, zIndex:9997,
          width:44, height:44, borderRadius:"50%", border:"none", cursor:"pointer",
          background: copilotOpen ? "#1d4ed8" : "#2563eb",
          color:"#fff", fontSize:20, boxShadow:"0 4px 16px rgba(37,99,235,0.45)",
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"background 0.15s, transform 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.transform="scale(1.08)"}
        onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}
      >
        🤖
      </button>
    </div>
    </AuthProvider>
  );
}
