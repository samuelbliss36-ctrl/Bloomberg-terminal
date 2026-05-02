import { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertsProvider } from './context/AlertsContext';
import SignInPage from './pages/Auth/SignInPage';
import OnboardingWizard from './pages/Onboarding/OnboardingWizard';
import { watchlist as dbWatchlist } from './lib/db';
import { api } from './lib/api';
import { delay, loadSettings, saveSettings } from './lib/fmt';
import { CopilotPanel } from './components/copilot/CopilotPanel';
import { GlobalTopBar } from './layout/GlobalTopBar';
import { SidebarNav } from './layout/SidebarNav';
import { RightPanelShell } from './layout/RightPanelShell';
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

export default function App() {
  return (
    <AuthProvider>
      <AlertsProvider>
        <AppRouter />
      </AlertsProvider>
    </AuthProvider>
  );
}

// Handles auth gating + onboarding before mounting the heavy terminal shell.
function AppRouter() {
  const { user, loading: authLoading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem('ov_onboarding_done') === 'true'
  );

  if (authLoading) {
    return (
      <div style={{ position:'fixed', inset:0, background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:'#2563eb', boxShadow:'0 0 14px rgba(37,99,235,0.80)' }} />
      </div>
    );
  }
  if (!user) return <SignInPage />;
  if (!onboardingDone) return <OnboardingWizard onComplete={() => setOnboardingDone(true)} />;
  return <AppInner />;
}

function AppInner() {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState("financial");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(() => ({ showTickerTape: true, darkMode: false, ...loadSettings() }));
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [pageContext, setPageContext] = useState(null);

  const toggleTape = useCallback(() => setSettings(s => { const n = {...s, showTickerTape: !s.showTickerTape}; saveSettings(n); return n; }), []);
  const toggleDark = useCallback(() => setSettings(s => { const n = {...s, darkMode: !s.darkMode}; saveSettings(n); return n; }), []);
  const [ticker, setTicker] = useState("AAPL");
  const [quote, setQuote] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [profile, setProfile] = useState(null);
  const [news, setNews] = useState(null);
  const [earnings, setEarnings] = useState(null);
  // Structured financial data for AI copilot context
  const [earningsHistory, setEarningsHistory] = useState([]);
  const [recommendation,  setRecommendation]  = useState(null);
  const [priceTarget,     setPriceTarget]     = useState(null);
  const [peerTickers,     setPeerTickers]     = useState([]);
  const [peerMetrics,     setPeerMetrics]     = useState({});
  const [tapeData, setTapeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingResearchItem, setPendingResearchItem] = useState(null);
  const [statusTime, setStatusTime] = useState(() => new Date().toLocaleTimeString());
  const [watchlistTickers, setWatchlistTickers] = useState(() => dbWatchlist.load());

  // Live clock in status bar
  useEffect(() => {
    const iv = setInterval(() => setStatusTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    setLoading(true);
    setQuote(null); setMetrics(null); setProfile(null); setNews(null); setEarnings(null);
    setEarningsHistory([]); setRecommendation(null); setPriceTarget(null); setPeerTickers([]); setPeerMetrics({});
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

  // Structured AI-context data: earnings history, analyst consensus, price target, peer multiples.
  // Runs in parallel with the main UI fetch but is kept separate so main data renders immediately.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const twoYearsAgo = new Date(Date.now() - 730*24*3600*1000).toISOString().split("T")[0];
      const today       = new Date().toISOString().split("T")[0];
      // ── 1. Historical earnings + analyst data (parallel, staggered) ──
      try {
        const [hist, recs, pt] = await Promise.all([
          api("/calendar/earnings?symbol="+ticker+"&from="+twoYearsAgo+"&to="+today),
          delay(150).then(() => api("/stock/recommendation?symbol="+ticker)),
          delay(300).then(() => api("/stock/price-target?symbol="+ticker).catch(() => null)),
        ]);
        if (cancelled) return;
        // Keep last 4 reported quarters (epsActual present), newest first
        const histQ = (hist?.earningsCalendar || [])
          .filter(e => e.epsActual != null)
          .sort((a, b) => (b.date > a.date ? 1 : -1))
          .slice(0, 4);
        setEarningsHistory(histQ);
        setRecommendation(Array.isArray(recs) ? (recs[0] || null) : null);
        setPriceTarget(pt?.targetMean ? pt : null);
      } catch(e) {}
      // ── 2. Peer list then per-peer metrics (sequential to respect rate limits) ──
      try {
        const list = await delay(400).then(() => api("/stock/peers?symbol="+ticker));
        if (cancelled) return;
        const top4 = (list || []).filter(x => x !== ticker).slice(0, 4);
        setPeerTickers(top4);
        const mMap = {};
        for (let i = 0; i < top4.length; i++) {
          if (cancelled) return;
          if (i > 0) await delay(220);
          try {
            const pm = await api("/stock/metric?symbol="+top4[i]+"&metric=all");
            mMap[top4[i]] = pm?.metric || {};
          } catch(e) {}
        }
        if (!cancelled) setPeerMetrics({ ...mMap });
      } catch(e) {}
    };
    load();
    return () => { cancelled = true; };
  }, [ticker]); // eslint-disable-line

  // Fetch live prices for watchlist — re-runs when tickers change
  useEffect(() => {
    if (!watchlistTickers.length) { setTapeData([]); return; }
    let cancelled = false;
    const fetchTape = async () => {
      const results = [];
      for (let i = 0; i < watchlistTickers.length; i++) {
        if (cancelled) return;
        if (i > 0) await delay(150);
        try {
          const q = await api("/quote?symbol=" + watchlistTickers[i]);
          if (!cancelled) results.push({ symbol: watchlistTickers[i], price: q.c, changePct: q.dp });
        } catch(e) {}
      }
      if (!cancelled) setTapeData(results);
    };
    fetchTape();
    return () => { cancelled = true; };
  }, [watchlistTickers]); // eslint-disable-line

  // Re-read watchlist when cloud sync completes
  useEffect(() => {
    const handler = () => setWatchlistTickers(dbWatchlist.load());
    window.addEventListener('ov:data-synced', handler);
    return () => window.removeEventListener('ov:data-synced', handler);
  }, []);

  const addToWatchlist = useCallback((sym) => {
    const s = sym.trim().toUpperCase();
    if (!s || watchlistTickers.includes(s)) return;
    const updated = [...watchlistTickers, s];
    setWatchlistTickers(updated);
    dbWatchlist.save(updated, user?.id);
  }, [watchlistTickers, user]);

  const removeFromWatchlist = useCallback((sym) => {
    const updated = watchlistTickers.filter(t => t !== sym);
    setWatchlistTickers(updated);
    dbWatchlist.save(updated, user?.id);
  }, [watchlistTickers, user]);

  // Clear stale page context whenever the user navigates to a different page
  useEffect(() => { setPageContext(null); }, [activePage]);

  const openResearch = (item) => { setPendingResearchItem(item); setActivePage("research"); };

  return (
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
        {activePage === "commodities"  && <CommoditiesDashboard onContextUpdate={setPageContext} />}
        {activePage === "crypto"       && <CryptoDashboard onContextUpdate={setPageContext} />}
        {activePage === "supplychain"  && <SupplyChainDashboard onOpenResearch={openResearch} onContextUpdate={setPageContext} />}
        {activePage === "fx"           && <FXDashboard onOpenResearch={openResearch} onContextUpdate={setPageContext} />}
        {activePage === "technical"    && <TechnicalAnalysis ticker={ticker} onContextUpdate={setPageContext} />}
        {activePage === "eye"          && <EyeOfSauron onOpenResearch={openResearch} onContextUpdate={setPageContext} />}
        {activePage === "markets"      && <GlobalMarketsModule onOpenResearch={openResearch} onContextUpdate={setPageContext} />}
        {activePage === "portfolio"    && <PortfolioTracker onContextUpdate={setPageContext} />}
        {activePage === "screener"     && <StockScreener onSelectTicker={t => { setTicker(t); setActivePage("financial"); }} onContextUpdate={setPageContext} />}
        {activePage === "research"     && <ResearchBrowser pendingItem={pendingResearchItem} onPendingConsumed={() => setPendingResearchItem(null)} onContextUpdate={setPageContext} />}
        {activePage === "earnings"     && <EarningsCalendarPage onContextUpdate={setPageContext} />}
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
        onAddToWatchlist={addToWatchlist}
        onRemoveFromWatchlist={removeFromWatchlist}
      />

      {/* ── Status Bar ─────────────────────────────────────── */}
      <div className="status-bar" style={{ gridArea:"status", display:"flex", alignItems:"center", gap:16, padding:"0 12px", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:"#059669", boxShadow:"0 0 6px rgba(5,150,105,0.60)" }} />
        <span>OMNES VIDENTES · LIVE DATA</span>
        <span style={{ color:"rgba(15,23,42,0.20)" }}>|</span>
        <MarketSessionBadges />
        <span style={{ marginLeft:"auto" }}>{statusTime}</span>
      </div>

      {/* ── AI Copilot ─────────────────────────────────────── */}
      {copilotOpen && (
        <CopilotPanel
          activePage={activePage}
          ticker={ticker}
          quote={quote}
          metrics={metrics}
          profile={profile}
          news={news}
          pageContext={pageContext}
          structured={{ earningsHistory, recommendation, priceTarget, peerTickers, peerMetrics }}
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
  );
}
