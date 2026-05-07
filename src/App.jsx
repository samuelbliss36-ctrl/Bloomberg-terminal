import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertsProvider } from './context/AlertsContext';
import SignInPage from './pages/Auth/SignInPage';
import OnboardingWizard from './pages/Onboarding/OnboardingWizard';
import { watchlist as dbWatchlist } from './lib/db';
import { api } from './lib/api';
import { delay } from './lib/fmt';
import { CopilotPanel } from './components/copilot/CopilotPanel';
import { GlobalTopBar } from './layout/GlobalTopBar';
import { SidebarNav } from './layout/SidebarNav';
import { RightPanelShell } from './layout/RightPanelShell';
import { useLayoutStore } from './store/useLayoutStore';
import { useNavigationStore } from './store/useNavigationStore';
import { useAIStore } from './store/useAIStore';
import { useTickerData } from './hooks/useTickerData';
import { useCopilotData } from './hooks/useCopilotData';

// Eagerly loaded — always in the shell
import AssetView from './pages/Markets/AssetView';
import { MarketSessionBadges } from './components/MarketSessionBadges';

// Lazily loaded — downloaded only when the page is first visited
const CommoditiesDashboard = lazy(() => import('./pages/Commodities/CommoditiesDashboard'));
const CryptoDashboard      = lazy(() => import('./pages/Crypto/CryptoDashboard'));
const FXDashboard          = lazy(() => import('./pages/FX/FXDashboard'));
const SupplyChainDashboard = lazy(() => import('./pages/SupplyChain/SupplyChainDashboard'));
const TechnicalAnalysis    = lazy(() => import('./pages/Technical/TechnicalAnalysis'));
const EyeOfSauron          = lazy(() => import('./pages/Eye/EyeOfSauron'));
const GlobalMarketsModule  = lazy(() => import('./pages/Markets/GlobalMarketsModule'));
const PortfolioTracker     = lazy(() => import('./pages/Portfolio/PortfolioTracker'));
const StockScreener        = lazy(() => import('./pages/Screener/StockScreener'));
const ResearchBrowser      = lazy(() => import('./pages/Research/ResearchBrowser'));
const EarningsCalendarPage = lazy(() => import('./pages/Earnings/EarningsCalendarPage'));
const DayMovers            = lazy(() => import('./pages/Movers/DayMovers'));
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
  '/movers':       'movers',
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

  // ── Zustand stores ────────────────────────────────────────────────────────────
  const { sidebarOpen, toggleSidebar, showTickerTape, darkMode, toggleTape, toggleDark } = useLayoutStore();
  const { ticker, setTicker } = useNavigationStore();
  const { copilotOpen, toggleCopilot, setCopilotOpen } = useAIStore();

  // ── Navigation ────────────────────────────────────────────────────────────────
  const activePage    = PATH_TO_KEY[location.pathname] || 'financial';
  const setActivePage = useCallback((key) => navigate(KEY_TO_PATH[key] || '/'), [navigate]);

  // ── Server state via TanStack Query ──────────────────────────────────────────
  const { quote, metrics, profile, news, earnings, loading } = useTickerData(ticker);
  const copilotData = useCopilotData(ticker);

  // ── Local UI state ────────────────────────────────────────────────────────────
  const [tapeData, setTapeData]                       = useState([]);
  const [pendingResearchItem, setPendingResearchItem] = useState(null);
  const [statusTime, setStatusTime]                   = useState(() => new Date().toLocaleTimeString());
  const [watchlistTickers, setWatchlistTickers]       = useState(() => dbWatchlist.load());
  const [subscribedToast, setSubscribedToast]         = useState(false);
  const [pageContext, setPageContext]                  = useState(null);

  // Settings object for TopBar (sourced from Zustand store)
  const settings = { darkMode, showTickerTape };

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
          const q = await api('/quote?symbol=' + watchlistTickers[i]);
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
  }, [navigate, setTicker]);

  const isFinancialPage = location.pathname === '/';

  return (
    <div className={"app-shell" + (sidebarOpen ? " sidebar-open" : "") + (darkMode ? " dark" : "")} style={{ fontFamily:"'Inter','IBM Plex Sans',sans-serif" }}>

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
        onToggle={toggleSidebar}
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
            <Route path="/movers"       element={<DayMovers onOpenResearch={openResearch} onContextUpdate={setPageContext} />} />
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
          structured={copilotData}
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
            onClick={toggleCopilot}
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
