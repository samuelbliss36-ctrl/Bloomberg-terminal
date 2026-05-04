import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
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

// Eagerly loaded — always in the shell
import AssetView from './pages/Markets/AssetView';
import { MarketSessionBadges } from './components/MarketSessionBadges';

// Lazily loaded — downloaded only when the page is first visited
const CommoditiesDashboard = lazy(() => import('./pages/Commodities/CommoditiesDashboard'));
const CryptoDashboard      = lazy(() => import('./pages/Crypto/CryptoDashboard'));
const FXDashboard          = lazy(() => import('./pages/FX/FXDashboard'));
const SupplyChainDashboard = lazy(() => import('./pages/SupplyChain/SupplyChainDashboard'));
const TechnicalAnalysis    = lazy(() => import('./pages/Technical/TechnicalAnalysis'));
const EyeOfSauron          = lazy(() => import('./pages/Eye/EyeOfSauron'));       // ~500 KB 3D globe
const GlobalMarketsModule  = lazy(() => import('./pages/Markets/GlobalMarketsModule'));
const PortfolioTracker     = lazy(() => import('./pages/Portfolio/PortfolioTracker'));
const StockScreener        = lazy(() => import('./pages/Screener/StockScreener'));
const ResearchBrowser      = lazy(() => import('./pages/Research/ResearchBrowser'));
const EarningsCalendarPage = lazy(() => import('./pages/Earnings/EarningsCalendarPage'));
const MarketHeatmap        = lazy(() => import('./pages/Heatmap/MarketHeatmap'));
const AdminDashboard       = lazy(() => import('./pages/Admin/AdminDashboard'));
const ProPage              = lazy(() => import('./pages/Subscription/ProPage'));

// Maps URL path → sidebar nav key for active highlighting
const PATH_TO_KEY = {
  '/':             'financial',
  '/heatmap':      'heatmap',
  '/commodities':  'commodities',
  '/crypto':       'crypto',
  '/supply-chain': 'supplychain',
  '/technical':    'technical',
  '/eye':          'eye',
  '/fx':           'fx',
  '/markets':      'markets',
  '/portfolio':    'portfolio',
  '/screener':     'screener',
  '/research':     'research',
  '/earnings':     'earnings',
  '/pro':          'pro',
  '/admin':        'admin',
  '/settings':     'settings',
};
const KEY_TO_PATH = Object.fromEntries(
  Object.entries(PATH_TO_KEY).map(([path, key]) => [key, path])
);

function PageLoader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background:'#2563eb', boxShadow:'0 0 14px rgba(37,99,235,0.80)' }} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AlertsProvider>
          <AppRouter />
        </AlertsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppRouter() {
  const { user, loading: authLoading } = useAuth();

  const isDone = (u) =>
    localStorage.getItem('ov_onboarding_done') === 'true' ||
    u?.user_metadata?.onboarding_done === true;

  const [onboardingDone, setOnboardingDone] = useState(() => isDone(null));

  useEffect(() => {
    if (user && isDone(user)) {
      localStorage.setItem('ov_onboarding_done', 'true');
      setOnboardingDone(true);
    }
  }, [user]); // eslint-disable-line

  if (authLoading) {
    return (
      <div style={{ position:'fixed', inset:0, background:'var(--surface-0)', display:'flex', alignItems:'center', justifyContent:'center' }}>
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
  const navigate  = useNavigate();
  const location  = useLocation();

  // Derive active sidebar key from the current URL
  const activePage = PATH_TO_KEY[location.pathname] || 'financial';
  const setActivePage = useCallback((key) => navigate(KEY_TO_PATH[key] || '/'), [navigate]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settings, setSettings] = useState(() => ({ showTickerTape: true, darkMode: false, ...loadSettings() }));
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [pageContext, setPageContext] = useState(null);
  const [subscribedToast, setSubscribedToast] = useState(false);

  const toggleTape = useCallback(() => setSettings(s => { const n = {...s, showTickerTape: !s.showTickerTape}; saveSettings(n); return n; }), []);
  const toggleDark = useCallback(() => setSettings(s => { const n = {...s, darkMode: !s.darkMode}; saveSettings(n); return n; }), []);

  const [ticker, setTicker] = useState("AAPL");
  const [quote, setQuote]   = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [profile, setProfile] = useState(null);
  const [news, setNews]       = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [earningsHistory, setEarningsHistory] = useState([]);
  const [recommendation, setRecommendation]   = useState(null);
  const [priceTarget, setPriceTarget]         = useState(null);
  const [peerTickers, setPeerTickers]         = useState([]);
  const [peerMetrics, setPeerMetrics]         = useState({});
  const [tapeData, setTapeData]               = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [pendingResearchItem, setPendingResearchItem] = useState(null);
  const [statusTime, setStatusTime]           = useState(() => new Date().toLocaleTimeString());
  const [watchlistTickers, setWatchlistTickers] = useState(() => dbWatchlist.load());

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

  // Live clock
  useEffect(() => {
    const iv = setInterval(() => setStatusTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Fetch main ticker data
  useEffect(() => {
    setLoading(true);
    setQuote(null); setMetrics(null); setProfile(null); setNews(null); setEarnings(null);
    setEarningsHistory([]); setRecommendation(null); setPriceTarget(null); setPeerTickers([]); setPeerMetrics({});
    const today     = new Date().toISOString().split("T")[0];
    const monthAgo  = new Date(Date.now()-30*24*3600*1000).toISOString().split("T")[0];
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

  // Fetch AI copilot context data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const twoYearsAgo = new Date(Date.now() - 730*24*3600*1000).toISOString().split("T")[0];
      const today       = new Date().toISOString().split("T")[0];
      try {
        const [hist, recs, pt] = await Promise.all([
          api("/calendar/earnings?symbol="+ticker+"&from="+twoYearsAgo+"&to="+today),
          delay(150).then(() => api("/stock/recommendation?symbol="+ticker)),
          delay(300).then(() => api("/stock/price-target?symbol="+ticker).catch(() => null)),
        ]);
        if (cancelled) return;
        const histQ = (hist?.earningsCalendar || [])
          .filter(e => e.epsActual != null)
          .sort((a, b) => (b.date > a.date ? 1 : -1))
          .slice(0, 4);
        setEarningsHistory(histQ);
        setRecommendation(Array.isArray(recs) ? (recs[0] || null) : null);
        setPriceTarget(pt?.targetMean ? pt : null);
      } catch(e) {}
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

  // Watchlist tape prices
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

  // Re-read watchlist after cloud sync
  useEffect(() => {
    const handler = () => setWatchlistTickers(dbWatchlist.load());
    window.addEventListener('ov:data-synced', handler);
    return () => window.removeEventListener('ov:data-synced', handler);
  }, []);

  // Clear page context on navigation
  useEffect(() => { setPageContext(null); }, [location.pathname]);

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

  const openResearch = useCallback((item) => {
    setPendingResearchItem(item);
    navigate('/research');
  }, [navigate]);

  const goToTicker = useCallback((t) => {
    setTicker(t);
    navigate('/');
  }, [navigate]);

  const isFinancialPage = location.pathname === '/';

  return (
    <div className={"app-shell" + (sidebarOpen ? " sidebar-open" : "") + (settings.darkMode ? " dark" : "")} style={{ fontFamily:"'Inter','IBM Plex Sans',sans-serif" }}>

      {/* ── Global Top Bar ─────────────────────────────────── */}
      <GlobalTopBar
        ticker={ticker}
        setTicker={goToTicker}
        tapeData={tapeData}
        quote={isFinancialPage ? quote : null}
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
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={
              <AssetView ticker={ticker} quote={quote} metrics={metrics} profile={profile} news={news} />
            } />
            <Route path="/heatmap"      element={<MarketHeatmap onOpenResearch={openResearch} onContextUpdate={setPageContext} />} />
            <Route path="/commodities"  element={<CommoditiesDashboard onContextUpdate={setPageContext} />} />
            <Route path="/crypto"       element={<CryptoDashboard onContextUpdate={setPageContext} />} />
            <Route path="/supply-chain" element={<SupplyChainDashboard onOpenResearch={openResearch} onContextUpdate={setPageContext} />} />
            <Route path="/technical"    element={<TechnicalAnalysis ticker={ticker} onContextUpdate={setPageContext} />} />
            <Route path="/eye"          element={<EyeOfSauron onOpenResearch={openResearch} onContextUpdate={setPageContext} />} />
            <Route path="/fx"           element={<FXDashboard onOpenResearch={openResearch} onContextUpdate={setPageContext} />} />
            <Route path="/markets"      element={<GlobalMarketsModule onOpenResearch={openResearch} onContextUpdate={setPageContext} />} />
            <Route path="/portfolio"    element={<PortfolioTracker onContextUpdate={setPageContext} />} />
            <Route path="/screener"     element={<StockScreener onSelectTicker={goToTicker} onContextUpdate={setPageContext} />} />
            <Route path="/research"     element={<ResearchBrowser pendingItem={pendingResearchItem} onPendingConsumed={() => setPendingResearchItem(null)} onContextUpdate={setPageContext} />} />
            <Route path="/earnings"     element={<EarningsCalendarPage onContextUpdate={setPageContext} />} />
            <Route path="/pro"          element={<ProPage />} />
            <Route path="/admin"        element={<AdminDashboard />} />
            <Route path="/settings"     element={
              <div style={{ padding:24, maxWidth:480 }}>
                <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:13, color:"var(--text-1)", marginBottom:16 }}>Settings</div>
                <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:"var(--text-3)" }}>Use the controls in the top bar to manage your preferences.</div>
              </div>
            } />
            <Route path="*" element={<AssetView ticker={ticker} quote={quote} metrics={metrics} profile={profile} news={news} />} />
          </Routes>
        </Suspense>
      </div>

      {/* ── Right Panel ────────────────────────────────────── */}
      <RightPanelShell
        tapeData={tapeData}
        onSelectTicker={goToTicker}
        earnings={earnings}
        activeTicker={ticker}
        onAddToWatchlist={addToWatchlist}
        onRemoveFromWatchlist={removeFromWatchlist}
      />

      {/* ── Status Bar ─────────────────────────────────────── */}
      <div className="status-bar" style={{ gridArea:"status", display:"flex", alignItems:"center", gap:16, padding:"0 12px", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:"#059669", boxShadow:"0 0 6px rgba(5,150,105,0.60)" }} />
        <span>OMNES VIDENTES · LIVE DATA</span>
        <span style={{ color:"var(--border-hover)" }}>|</span>
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
          pageContext={pageContext}
          structured={{ earningsHistory, recommendation, priceTarget, peerTickers, peerMetrics }}
          onClose={() => setCopilotOpen(false)}
        />
      )}

      {/* Floating AI Copilot launcher */}
      <div style={{ position:"fixed", bottom:48, right:16, zIndex:9997, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
        {!copilotOpen && (
          <div style={{
            background:"linear-gradient(135deg,#7c3aed,#2563eb)",
            color:"#fff", fontFamily:"'IBM Plex Mono',monospace",
            fontSize:9, fontWeight:700, letterSpacing:"0.06em",
            padding:"3px 8px", borderRadius:20, whiteSpace:"nowrap",
            boxShadow:"0 2px 8px rgba(124,58,237,0.4)",
            pointerEvents:"none",
          }}>
            ✦ Ask AI
          </div>
        )}
        <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
          {!copilotOpen && (
            <div style={{
              position:"absolute", inset:-6, borderRadius:"50%",
              border:"2px solid rgba(37,99,235,0.5)",
              animation:"copilot-pulse 2.2s ease-out infinite",
              pointerEvents:"none",
            }} />
          )}
          <button
            onClick={() => setCopilotOpen(o => !o)}
            title="AI Copilot"
            style={{
              width:44, height:44, borderRadius:"50%", border:"none", cursor:"pointer",
              background: copilotOpen ? "#1d4ed8" : "#2563eb",
              color:"#fff", fontSize:20, boxShadow:"0 4px 16px rgba(37,99,235,0.45)",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"background 0.15s, transform 0.15s", position:"relative",
            }}
            onMouseEnter={e => e.currentTarget.style.transform="scale(1.08)"}
            onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}
          >
            🤖
          </button>
        </div>
      </div>

      <style>{`
        @keyframes copilot-pulse {
          0%   { transform: scale(1);   opacity: 0.9; }
          70%  { transform: scale(1.6); opacity: 0;   }
          100% { transform: scale(1.6); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
