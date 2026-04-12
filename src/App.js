import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { AreaChart, Area, BarChart, Bar, Line, Cell, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from "recharts";
import { Search, Settings, RefreshCw, Zap, ArrowUpRight, ArrowDownRight, Newspaper, Building2, DollarSign, BarChart2, Activity, Star } from "lucide-react";

const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_KEY;
const BASE = "https://finnhub.io/api/v1";

// In-memory API cache — 60 s TTL for Finnhub, 5 min for chart data
const _apiCache = new Map();
const api = (path) => {
  const hit = _apiCache.get(path);
  if (hit && Date.now() - hit.ts < 60_000) return Promise.resolve(hit.data);
  return fetch(BASE + path + "&token=" + FINNHUB_KEY)
    .then(r => r.json())
    .then(data => { _apiCache.set(path, { data, ts: Date.now() }); return data; });
};

// Chart data cache — 5 min TTL (OHLCV data doesn't change rapidly)
const _chartCache = new Map();
const fetchChart = (ticker, range, interval) => {
  const key = ticker + "|" + range + "|" + interval;
  const hit = _chartCache.get(key);
  if (hit && Date.now() - hit.ts < 300_000) return Promise.resolve(hit.data);
  return fetch("/api/chart?ticker=" + encodeURIComponent(ticker) + "&range=" + range + "&interval=" + interval)
    .then(r => r.json())
    .then(data => { _chartCache.set(key, { data, ts: Date.now() }); return data; });
};

// Persistent settings helpers
const loadSettings = () => {
  try { return JSON.parse(localStorage.getItem("ov_settings") || "{}"); } catch { return {}; }
};
const saveSettings = (s) => {
  try { localStorage.setItem("ov_settings", JSON.stringify(s)); } catch {}
};

const fmt = {
  price: (v) => v?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pct: (v) => (v >= 0 ? "+" : "") + v?.toFixed(2) + "%",
  change: (v) => (v >= 0 ? "+" : "") + v?.toFixed(2),
  large: (v) => { if (!v) return "N/A"; if (v >= 1e12) return "$" + (v/1e12).toFixed(2) + "T"; if (v >= 1e9) return "$" + (v/1e9).toFixed(2) + "B"; if (v >= 1e6) return "$" + (v/1e6).toFixed(2) + "M"; return "$" + v?.toLocaleString(); },
  volume: (v) => { if (!v) return "N/A"; if (v >= 1e6) return (v/1e6).toFixed(2) + "M"; if (v >= 1e3) return (v/1e3).toFixed(1) + "K"; return v?.toString(); },
};
const clr = (v) => (v >= 0 ? "#3fb950" : "#f85149");
const bg = (v) => (v >= 0 ? "rgba(63,185,80,0.1)" : "rgba(248,81,73,0.1)");
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const WATCHLIST = ["SPY", "QQQ", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN", "META"];


function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
      
      * { box-sizing: border-box; }
      
      body {
        background: #0d1117;
        color: #cdd6f4;
        font-family: 'IBM Plex Mono', monospace;
      }

      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: #0d1117; }
      ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }
      ::-webkit-scrollbar-thumb:hover { background: #484f58; }

      .terminal-glow {
        box-shadow: none;
      }

      .terminal-panel {
        background: #161b22 !important;
        border: 1px solid #21262d !important;
        border-radius: 4px !important;
        position: relative;
      }

      .terminal-header {
        color: #7d8590 !important;
        font-family: 'IBM Plex Mono', monospace !important;
        letter-spacing: 0.08em !important;
        font-size: 10px !important;
        text-transform: uppercase !important;
        font-weight: 500 !important;
      }

      .terminal-value {
        color: #e6edf3 !important;
        font-family: 'IBM Plex Mono', monospace !important;
      }

      .terminal-muted {
        color: #484f58 !important;
        font-family: 'IBM Plex Mono', monospace !important;
      }

      .terminal-nav {
        background: #010409 !important;
        border-bottom: 1px solid #21262d !important;
      }

      .terminal-nav button {
        font-family: 'IBM Plex Mono', monospace !important;
        letter-spacing: 0.05em !important;
      }

      .terminal-nav button:hover {
        color: #e6edf3 !important;
        background: #21262d !important;
      }

      .terminal-active {
        color: #58a6ff !important;
        border-bottom-color: #1f6feb !important;
      }

      .ticker-tape {
        background: #010409 !important;
        border-bottom: 1px solid #21262d !important;
      }

      .top-nav {
        background: #010409 !important;
        border-bottom: 1px solid #21262d !important;
      }

      .search-box {
        background: #0d1117 !important;
        border: 1px solid #30363d !important;
        border-radius: 6px !important;
      }

      .search-box:focus-within {
        border-color: #1f6feb !important;
      }

      input {
        font-family: 'IBM Plex Mono', monospace !important;
        color: #e6edf3 !important;
      }

      input::placeholder {
        color: #484f58 !important;
      }

      button {
        font-family: 'IBM Plex Mono', monospace !important;
        cursor: pointer;
      }

      .status-bar {
        background: #010409 !important;
        border-top: 1px solid #21262d !important;
        color: #484f58 !important;
      }

      .metric-row {
        border-bottom: 1px solid #21262d !important;
      }

      .crypto-card {
        background: #0d1117 !important;
        border: 1px solid #21262d !important;
        border-radius: 4px !important;
        transition: all 0.15s !important;
      }

      .crypto-card:hover {
        border-color: #30363d !important;
      }

      .crypto-card.active {
        border-color: #1f6feb !important;
        background: #0c2044 !important;
      }

      .tf-button {
        font-family: 'IBM Plex Mono', monospace !important;
        font-size: 10px !important;
      }

      .tf-button.active {
        background: #0c2044 !important;
        color: #58a6ff !important;
      }

      .news-card {
        border: 1px solid #21262d !important;
        border-radius: 4px !important;
        transition: border-color 0.15s !important;
      }

      .news-card:hover {
        border-color: #30363d !important;
        background: #161b22 !important;
      }

      .watchlist-row:hover {
        background: #161b22 !important;
      }

      .eye-card {
        background: #0d1117 !important;
        border: 1px solid #21262d !important;
        border-radius: 4px !important;
        transition: all 0.15s !important;
      }

      .eye-card:hover {
        border-color: #1f6feb !important;
        background: #0c2044 !important;
      }

      .logo-text {
        font-family: 'IBM Plex Sans', sans-serif !important;
        font-weight: 600 !important;
        color: #e6edf3 !important;
        letter-spacing: 0.15em !important;
      }

      .live-dot {
        background: #3fb950 !important;
        box-shadow: none !important;
      }

      .positive { color: #3fb950 !important; }
      .negative { color: #f85149 !important; }

      .coming-soon-badge {
        border-color: #30363d !important;
        color: #7d8590 !important;
      }

      .feature-badge {
        border-color: #21262d !important;
        color: #484f58 !important;
      }

      .holding-row:hover {
        background: #0d1117 !important;
      }

      .pf-input:focus {
        border-color: #1f6feb !important;
        outline: none !important;
      }
    `}</style>
  );
}


function CommoditiesDashboard() {
  const COMMODITIES = [
    { ticker: "GC=F", label: "Gold", symbol: "XAU", unit: "$/oz", category: "Metals" },
    { ticker: "SI=F", label: "Silver", symbol: "XAG", unit: "$/oz", category: "Metals" },
    { ticker: "HG=F", label: "Copper", symbol: "XCU", unit: "$/lb", category: "Metals" },
    { ticker: "PL=F", label: "Platinum", symbol: "XPT", unit: "$/oz", category: "Metals" },
    { ticker: "CL=F", label: "WTI Crude", symbol: "WTI", unit: "$/bbl", category: "Energy" },
    { ticker: "BZ=F", label: "Brent Crude", symbol: "BRT", unit: "$/bbl", category: "Energy" },
    { ticker: "NG=F", label: "Natural Gas", symbol: "NG", unit: "$/MMBtu", category: "Energy" },
    { ticker: "RB=F", label: "Gasoline", symbol: "RB", unit: "$/gal", category: "Energy" },
    { ticker: "ZW=F", label: "Wheat", symbol: "ZW", unit: "$/bu", category: "Agriculture" },
    { ticker: "ZC=F", label: "Corn", symbol: "ZC", unit: "$/bu", category: "Agriculture" },
    { ticker: "ZS=F", label: "Soybeans", symbol: "ZS", unit: "$/bu", category: "Agriculture" },
    { ticker: "KC=F", label: "Coffee", symbol: "KC", unit: "$/lb", category: "Agriculture" },
  ];

  const [prices,   setPrices]   = useState({});
  const [active,   setActive]   = useState("GC=F");
  const [category, setCategory] = useState("Metals");

  useEffect(() => {
    Promise.all(
      COMMODITIES.map(c =>
        fetchChart(c.ticker, "1d", "1m")
          .then(d => {
            const meta = d?.chart?.result?.[0]?.meta;
            const price = meta?.regularMarketPrice;
            const prev  = meta?.previousClose;
            const changePct = price && prev ? ((price - prev) / prev) * 100 : null;
            return [c.ticker, { price, changePct }];
          })
          .catch(() => [c.ticker, null])
      )
    ).then(results => setPrices(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  const activeCommodity = COMMODITIES.find(c => c.ticker === active);
  const categories = ["Metals", "Energy", "Agriculture"];
  const filtered = COMMODITIES.filter(c => c.category === category);

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "340px 1fr", gridTemplateRows: "auto 1fr" }}>
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "1/3", overflowY: "auto" }}>
        <div className="terminal-header mb-3">🛢 Commodities Futures</div>
        <div className="flex gap-2 mb-3">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className="px-3 py-1 text-xs font-mono border rounded transition-colors"
              style={{ borderColor: category === cat ? "#58a6ff" : "#21262d", color: category === cat ? "#58a6ff" : "#7d8590", background: category === cat ? "#0c2044" : "transparent" }}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {filtered.map(c => {
            const d = prices[c.ticker];
            const isActive = active === c.ticker;
            return (
              <div key={c.ticker} onClick={() => setActive(c.ticker)}
                className="flex items-center justify-between p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#0c2044" : "transparent", border: "1px solid", borderColor: isActive ? "#58a6ff44" : "#1c2128" }}>
                <div>
                  <div className="text-xs font-mono font-bold" style={{ color: isActive ? "#58a6ff" : "#e6edf3" }}>{c.label}</div>
                  <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{c.symbol} · {c.unit}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{d ? "$" + fmt.price(d.price) : "..."}</div>
                  {d && (
                    <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#58a6ff" : "#f85149" }}>
                      {d.changePct >= 0 ? "▲" : "▼"} {Math.abs(d.changePct).toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "1/2" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="terminal-header">{activeCommodity?.label}</span>
          <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>{activeCommodity?.unit}</span>
          {prices[active]?.price && (
            <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:14, marginLeft:4 }}>${fmt.price(prices[active].price)}</span>
          )}
          {prices[active]?.changePct != null && (
            <span className="font-mono" style={{ color:clr(prices[active].changePct), fontSize:11 }}>
              {prices[active].changePct >= 0 ? "▲" : "▼"} {Math.abs(prices[active].changePct).toFixed(2)}%
            </span>
          )}
        </div>
        <div style={{ height: 280 }}>
          <UniversalChart ticker={active} height={280} showVolume defaultTf="3M" />
        </div>
      </div>
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "2/3" }}>
        <div className="terminal-header mb-3">Market Summary</div>
        <div className="grid grid-cols-3 gap-2">
          {COMMODITIES.map(c => {
            const d = prices[c.ticker];
            return (
              <div key={c.ticker} onClick={() => { setActive(c.ticker); setCategory(c.category); }}
                className="p-2 rounded cursor-pointer transition-colors"
                style={{ background: "#0d1117", border: "1px solid #1c2128" }}>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{c.symbol}</div>
                <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{d ? "$" + fmt.price(d.price) : "..."}</div>
                {d && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#58a6ff" : "#f85149" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function CryptoDashboard() {
  const COINS = [
    { ticker: "BTC-USD", label: "Bitcoin", symbol: "BTC" },
    { ticker: "ETH-USD", label: "Ethereum", symbol: "ETH" },
    { ticker: "SOL-USD", label: "Solana", symbol: "SOL" },
    { ticker: "BNB-USD", label: "BNB", symbol: "BNB" },
    { ticker: "XRP-USD", label: "XRP", symbol: "XRP" },
    { ticker: "DOGE-USD", label: "Dogecoin", symbol: "DOGE" },
    { ticker: "ADA-USD", label: "Cardano", symbol: "ADA" },
    { ticker: "AVAX-USD", label: "Avalanche", symbol: "AVAX" },
    { ticker: "LINK-USD", label: "Chainlink", symbol: "LINK" },
    { ticker: "DOT-USD", label: "Polkadot", symbol: "DOT" },
    { ticker: "MATIC-USD", label: "Polygon", symbol: "MATIC" },
    { ticker: "UNI7083-USD", label: "Uniswap", symbol: "UNI" },
  ];

  const [prices, setPrices] = useState({});
  const [active, setActive] = useState("BTC-USD");
  const activeCoin = COINS.find(c => c.ticker === active);

  useEffect(() => {
    Promise.all(
      COINS.map(c =>
        fetchChart(c.ticker, "1d", "1m")
          .then(d => {
            const meta = d?.chart?.result?.[0]?.meta;
            const price = meta?.regularMarketPrice;
            const prev  = meta?.previousClose;
            const changePct = price && prev ? ((price - prev) / prev) * 100 : null;
            return [c.ticker, { price, changePct }];
          })
          .catch(() => [c.ticker, null])
      )
    ).then(results => setPrices(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "280px 1fr", gridTemplateRows: "1fr auto" }}>
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "1/3", overflowY: "auto" }}>
        <div className="terminal-header mb-3">₿ Crypto Markets</div>
        <div className="flex flex-col gap-1">
          {COINS.map(c => {
            const d = prices[c.ticker];
            const isActive = active === c.ticker;
            return (
              <div key={c.ticker} onClick={() => setActive(c.ticker)}
                className="flex items-center justify-between p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#0c2044" : "transparent", border: "1px solid", borderColor: isActive ? "#58a6ff44" : "#1c2128" }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold"
                    style={{ background: "#1c2128", color: isActive ? "#58a6ff" : "#7d8590" }}>{c.symbol.slice(0,1)}</div>
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: isActive ? "#58a6ff" : "#e6edf3" }}>{c.label}</div>
                    <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{c.symbol}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{d?.price ? "$" + fmt.price(d.price) : "..."}</div>
                  {d?.changePct != null && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#58a6ff" : "#f85149" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3 flex flex-col" style={{ gridColumn: "2/3", gridRow: "1/2" }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="terminal-header">{activeCoin?.label} ({activeCoin?.symbol})</span>
          {prices[active]?.price && <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:18 }}>${fmt.price(prices[active].price)}</span>}
          {prices[active]?.changePct != null && <span className="font-mono" style={{ color:clr(prices[active].changePct), fontSize:12 }}>{prices[active].changePct>=0?"▲":"▼"}{Math.abs(prices[active].changePct).toFixed(2)}%</span>}
        </div>
        <div style={{ flex:1, minHeight:280 }}>
          <UniversalChart ticker={active} height={280} showVolume defaultTf="1M" />
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "2/3" }}>
        <div className="terminal-header mb-3">24h Market Overview</div>
        <div className="grid grid-cols-4 gap-2">
          {COINS.slice(0, 8).map(c => {
            const d = prices[c.ticker];
            return (
              <div key={c.ticker} onClick={() => setActive(c.ticker)}
                className="p-2 rounded cursor-pointer"
                style={{ background: "#0d1117", border: "1px solid #1c2128" }}>
                <div className="text-xs font-mono font-bold" style={{ color: "#7d8590" }}>{c.symbol}</div>
                <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{d?.price ? "$" + fmt.price(d.price) : "..."}</div>
                {d?.changePct != null && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#58a6ff" : "#f85149" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}





function FXDashboard({ onOpenResearch }) {
  const FX_PAIRS = [
    { ticker: "EURUSD=X",  label: "EUR/USD",  region: "Eurozone", dec: 4 },
    { ticker: "GBPUSD=X",  label: "GBP/USD",  region: "UK",       dec: 4 },
    { ticker: "USDJPY=X",  label: "USD/JPY",  region: "Japan",    dec: 2 },
    { ticker: "USDCHF=X",  label: "USD/CHF",  region: "Switzerland", dec: 4 },
    { ticker: "AUDUSD=X",  label: "AUD/USD",  region: "Australia",dec: 4 },
    { ticker: "USDCAD=X",  label: "USD/CAD",  region: "Canada",   dec: 4 },
    { ticker: "USDCNY=X",  label: "USD/CNY",  region: "China",    dec: 4 },
    { ticker: "DX=F",      label: "DXY Index",region: "Global",   dec: 3 },
    { ticker: "USDINR=X",  label: "USD/INR",  region: "India",    dec: 2 },
    { ticker: "USDMXN=X",  label: "USD/MXN",  region: "Mexico",   dec: 4 },
    { ticker: "USDBRL=X",  label: "USD/BRL",  region: "Brazil",   dec: 4 },
    { ticker: "USDKRW=X",  label: "USD/KRW",  region: "S. Korea", dec: 0 },
  ];

  const CB_SERIES = [
    { id: "FEDFUNDS",          label: "Fed Funds",    flag: "🇺🇸", bank: "Federal Reserve"  },
    { id: "ECBDFR",            label: "ECB Rate",     flag: "🇪🇺", bank: "ECB"              },
    { id: "INTDSRGBM193N",     label: "BoE Rate",     flag: "🇬🇧", bank: "Bank of England"  },
    { id: "IRSTCI01CHM156N",   label: "SNB Rate",     flag: "🇨🇭", bank: "Swiss Natl Bank"  },
    { id: "IRSTCI01AUM156N",   label: "RBA Rate",     flag: "🇦🇺", bank: "Reserve Bank Au"  },
    { id: "IRSTCI01CAM156N",   label: "BoC Rate",     flag: "🇨🇦", bank: "Bank of Canada"   },
  ];

  const [prices,    setPrices]    = useState({});
  const [active,    setActive]    = useState("EURUSD=X");
  const [cbRates,   setCbRates]   = useState({});

  // Fetch all FX prices (Yahoo Finance via /api/chart)
  useEffect(() => {
    Promise.all(
      FX_PAIRS.map(p =>
        fetch("/api/chart?ticker=" + encodeURIComponent(p.ticker) + "&range=1d&interval=1m")
          .then(r => r.json())
          .then(d => {
            const meta = d?.chart?.result?.[0]?.meta;
            const price = meta?.regularMarketPrice;
            const prev  = meta?.previousClose;
            const changePct = price && prev ? ((price - prev) / prev) * 100 : null;
            return [p.ticker, { price, changePct }];
          })
          .catch(() => [p.ticker, null])
      )
    ).then(results => setPrices(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  // Fetch central bank rates from FRED
  useEffect(() => {
    Promise.all(
      CB_SERIES.map(s =>
        fetch("/api/fred?series=" + s.id)
          .then(r => r.json())
          .then(d => {
            const valid = (d.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
            const latest = valid[valid.length - 1];
            return [s.id, { ...s, value: latest ? parseFloat(latest.value) : null, date: latest?.date }];
          })
          .catch(() => [s.id, { ...s, value: null }])
      )
    ).then(results => setCbRates(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  const activePairCfg = FX_PAIRS.find(p => p.ticker === active);
  const activeDec = activePairCfg?.dec ?? 4;
  const activePrice = prices[active];

  return (
    <div className="flex-1 p-3" style={{ display:"grid", gridTemplateColumns:"240px 1fr 200px", gridTemplateRows:"1fr auto", gap:12, height:"calc(100vh - 90px)", overflow:"hidden" }}>

      {/* Left: FX pairs list */}
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn:"1/2", gridRow:"1/3", overflowY:"auto" }}>
        <div className="terminal-header mb-3">💱 FX Pairs</div>
        <div className="flex flex-col gap-1">
          {FX_PAIRS.map(p => {
            const d = prices[p.ticker];
            const isActive = active === p.ticker;
            return (
              <div key={p.ticker} onClick={() => setActive(p.ticker)}
                className="flex items-center justify-between p-2 rounded cursor-pointer"
                style={{ background:isActive?"#0c2044":"transparent", border:"1px solid", borderColor:isActive?"#3fb95044":"#1c2128" }}>
                <div>
                  <div className="text-xs font-mono font-bold" style={{ color:isActive?"#3fb950":"#e6edf3" }}>{p.label}</div>
                  <div className="text-xs font-mono" style={{ color:"#484f58" }}>{p.region}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold" style={{ color:"#e6edf3" }}>
                    {d?.price != null ? d.price.toFixed(p.dec) : "…"}
                  </div>
                  {d?.changePct != null && (
                    <div className="text-xs font-mono" style={{ color:d.changePct>=0?"#3fb950":"#f85149" }}>
                      {d.changePct>=0?"▲":"▼"}{Math.abs(d.changePct).toFixed(3)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center: Chart */}
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn:"2/3", gridRow:"1/2" }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="terminal-header">{activePairCfg?.label} · {activePairCfg?.region}</div>
            {activePrice && (
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:22 }}>
                  {activePrice.price != null ? activePrice.price.toFixed(activeDec) : "—"}
                </span>
                {activePrice.changePct != null && (
                  <span className="text-xs font-mono" style={{ color:clr(activePrice.changePct) }}>
                    {activePrice.changePct>=0?"▲":"▼"} {Math.abs(activePrice.changePct).toFixed(3)}%
                  </span>
                )}
              </div>
            )}
          </div>
          {onOpenResearch && (
            <button onClick={() => onOpenResearch({ id:active, label:activePairCfg?.label||active, type:"fx", ticker:active, category:"FX" })}
              className="font-mono px-2 py-1 text-xs rounded"
              style={{ background:"#0c2044", border:"1px solid #3fb95033", color:"#3fb950", cursor:"pointer" }}>
              → Research
            </button>
          )}
        </div>
        <UniversalChart ticker={active} height={260} defaultTf="3M" prefix="" decimals={activeDec} label={activePairCfg?.label} />
      </div>

      {/* Right: Central bank rates */}
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn:"3/4", gridRow:"1/2", overflowY:"auto" }}>
        <div className="terminal-header mb-3">🏦 Central Bank Rates</div>
        <div className="flex flex-col gap-2">
          {CB_SERIES.map(s => {
            const r = cbRates[s.id];
            return (
              <div key={s.id} className="p-2 rounded" style={{ background:"#0d1117", border:"1px solid #1c2128" }}>
                <div className="text-xs font-mono" style={{ color:"#484f58" }}>{s.flag} {s.bank}</div>
                <div className="font-mono font-bold text-sm mt-0.5" style={{ color:"#e3b341" }}>
                  {r?.value != null ? r.value.toFixed(2) + "%" : "—"}
                </div>
                <div className="text-xs font-mono" style={{ color:"#7d8590" }}>{s.label}</div>
                {r?.date && <div className="text-xs font-mono" style={{ color:"#21262d" }}>As of {r.date}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom: FX heat map */}
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn:"2/4", gridRow:"2/3" }}>
        <div className="terminal-header mb-3">📊 Day Change Heat Map</div>
        <div className="grid gap-2" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(110px, 1fr))" }}>
          {FX_PAIRS.map(p => {
            const d = prices[p.ticker];
            const pct = d?.changePct;
            const intensity = pct != null ? Math.min(Math.abs(pct)/0.8, 1) : 0;
            const bgColor = pct == null ? "#0d1117"
              : pct >= 0 ? "rgba(63,185,80," + (0.08 + intensity*0.15) + ")"
              : "rgba(248,81,73," + (0.08 + intensity*0.15) + ")";
            return (
              <div key={p.ticker} onClick={() => setActive(p.ticker)} className="p-2 rounded cursor-pointer"
                style={{ background:bgColor, border:"1px solid", borderColor:active===p.ticker?"#3fb95066":"#1c2128" }}>
                <div className="text-xs font-mono font-bold" style={{ color:"#e6edf3" }}>{p.label}</div>
                <div className="text-xs font-mono" style={{ color:pct==null?"#7d8590":clr(pct) }}>
                  {pct != null ? (pct>=0?"▲":"▼") + Math.abs(pct).toFixed(3)+"%" : "…"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SupplyChainDashboard({ onOpenResearch }) {
  const FRED_SERIES = [
    { id: "FEDFUNDS",    label: "Fed Funds Rate",          note: "FOMC policy rate",                src: "Federal Reserve", suffix: "%",  freq: "Monthly" },
    { id: "DGS10",       label: "US 10Y Treasury",         note: "Risk-free rate benchmark",        src: "US Treasury",     suffix: "%",  freq: "Daily"   },
    { id: "DGS2",        label: "US 2Y Treasury",          note: "Short-term rate expectation",     src: "US Treasury",     suffix: "%",  freq: "Daily"   },
    { id: "T10Y2Y",      label: "Yield Curve (10Y-2Y)",    note: "Inversion = recession signal",    src: "Fed",             suffix: "%",  freq: "Daily"   },
    { id: "T10YIE",      label: "10Y Breakeven Inflation", note: "Market inflation expectation",    src: "Fed",             suffix: "%",  freq: "Daily"   },
    { id: "CPIAUCSL",    label: "CPI (Urban)",             note: "Consumer price inflation",        src: "BLS",             suffix: "",   freq: "Monthly" },
    { id: "PCEPI",       label: "PCE Price Index",         note: "Fed's preferred inflation gauge", src: "BEA",             suffix: "",   freq: "Monthly" },
    { id: "PPIACO",      label: "PPI All Commodities",     note: "Producer price inflation",        src: "BLS",             suffix: "",   freq: "Monthly" },
    { id: "UNRATE",      label: "Unemployment Rate",       note: "US labor market health",          src: "BLS",             suffix: "%",  freq: "Monthly" },
    { id: "GDP",         label: "US Real GDP",             note: "Quarterly economic output",       src: "BEA",             suffix: "",   freq: "Quarterly"},
    { id: "M2SL",        label: "M2 Money Supply",         note: "Broad money supply ($B)",         src: "Federal Reserve", suffix: "B",  freq: "Monthly" },
    { id: "BOPGSTB",     label: "US Trade Balance",        note: "Monthly goods trade deficit",     src: "Census",          suffix: "M",  freq: "Monthly" },
  ];

  const INDICES = [
    { ticker: "HG=F", label: "Copper (Dr. Copper)", symbol: "HG", desc: "Global economic health proxy" },
    { ticker: "NG=F", label: "Natural Gas", symbol: "NG", desc: "Energy & heating cost" },
    { ticker: "CL=F", label: "WTI Crude Oil", symbol: "WTI", desc: "Global transport cost" },
    { ticker: "ZW=F", label: "Wheat", symbol: "ZW", desc: "Food supply stress indicator" },
  ];





  const [prices, setPrices] = useState({});
  const [active, setActive] = useState("CL=F");
  const [fredData, setFredData] = useState({});

  useEffect(() => {
    Promise.all(
      FRED_SERIES.map(s =>
        fetch("/api/fred?series=" + s.id)
          .then(r => r.json())
          .then(d => {
            const valid = (d.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
            const latest = valid[valid.length - 1];
            const prev   = valid[valid.length - 2];
            const val    = latest ? parseFloat(latest.value) : NaN;
            const prevVal = prev ? parseFloat(prev.value) : NaN;
            const change = !isNaN(val) && !isNaN(prevVal) ? val - prevVal : null;
            return [s.id, { value: !isNaN(val) ? val : null, change, date: latest?.date }];
          })
          .catch(() => [s.id, null])
      )
    ).then(results => setFredData(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  useEffect(() => {
    Promise.all(
      INDICES.map(c =>
        fetch("/api/chart?ticker=" + encodeURIComponent(c.ticker) + "&range=1d&interval=1m")
          .then(r => r.json())
          .then(d => {
            const meta = d?.chart?.result?.[0]?.meta;
            const price = meta?.regularMarketPrice;
            const prev = meta?.previousClose;
            const change = price - prev;
            const changePct = (change / prev) * 100;
            return [c.ticker, { price, change, changePct }];
          })
          .catch(() => [c.ticker, null])
      )
    ).then(results => setPrices(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  const activeIndex = INDICES.find(c => c.ticker === active);

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "280px 1fr" }}>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "1/3", overflowY: "auto" }}>
        <div className="terminal-header mb-1">📊 Macro Indicators</div>
        <div className="text-xs font-mono mb-3" style={{ color: "#7d8590" }}>Monthly published figures</div>
        <div className="flex flex-col gap-1">
          {FRED_SERIES.map(s => {
            const d = fredData[s.id];
            const val = d?.value;
            const chg = d?.change;
            const display = val != null
              ? s.id === "BOPGSTB" ? "$" + (val/1000).toFixed(1) + "B"
              : s.id === "M2SL"    ? "$" + (val/1000).toFixed(2) + "T"
              : s.id === "GDP"     ? "$" + (val/1000).toFixed(1) + "T"
              : val.toFixed(2) + s.suffix
              : "Loading...";
            const chgDisplay = chg != null ? (chg >= 0 ? "+" : "") + chg.toFixed(2) + s.suffix : "—";
            const chgColor = chg == null ? "#7d8590" : chg >= 0 ? "#58a6ff" : "#f85149";
            const researchItem = { id: s.id, label: s.label, type: "macro", series: s.id, category: "Macro" };
            return (
              <div key={s.id} className="p-2 rounded" onClick={() => onOpenResearch && onOpenResearch(researchItem)}
                style={{ background: "#0d1117", border: "1px solid #1c2128", cursor: onOpenResearch ? "pointer" : "default" }}
                onMouseEnter={e => { if (onOpenResearch) e.currentTarget.style.borderColor="#30363d"; }}
                onMouseLeave={e => { if (onOpenResearch) e.currentTarget.style.borderColor="#1c2128"; }}>
                <div className="flex items-center justify-between mb-0.5">
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{s.label}</div>
                    <div className="text-xs font-mono" style={{ color: "#21262d" }}>{s.src} · {s.freq}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold" style={{ color: "#e3b341" }}>{display}</div>
                    <div className="text-xs font-mono" style={{ color: chgColor }}>{chgDisplay}</div>
                  </div>
                </div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{s.note}</div>
                {d?.date && <div className="text-xs font-mono" style={{ color: "#21262d" }}>As of {d.date}</div>}
              </div>
            );
          })}
        </div>

        <div className="terminal-header mt-4 mb-2">⚡ Live Market Proxies</div>
        <div className="flex flex-col gap-1">
          {INDICES.map(c => {
            const d = prices[c.ticker];
            const isActive = active === c.ticker;
            return (
              <div key={c.ticker} onClick={() => setActive(c.ticker)}
                className="p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#0c2044" : "#0d1117", border: "1px solid", borderColor: isActive ? "#58a6ff44" : "#1c2128" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: isActive ? "#58a6ff" : "#e6edf3" }}>{c.label}</div>
                    <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{c.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{d ? (d.price > 100 ? d.price.toFixed(0) : d.price.toFixed(2)) : "..."}</div>
                    {d && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#58a6ff" : "#f85149" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "1/2" }}>
        <div className="mb-2">
          <div className="terminal-header">{activeIndex?.label}</div>
          <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{activeIndex?.desc}</div>
          {prices[active] && (
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono font-bold" style={{ color: "#e6edf3", fontSize: 20 }}>
                {prices[active]?.price > 100 ? prices[active]?.price?.toFixed(0) : prices[active]?.price?.toFixed(2)}
              </span>
              <span className="text-xs font-mono" style={{ color: clr(prices[active]?.changePct) }}>
                {prices[active]?.changePct >= 0 ? "▲" : "▼"} {Math.abs(prices[active]?.changePct || 0).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <UniversalChart ticker={active} height={240} showVolume defaultTf="1Y" label={activeIndex?.label} />
      </div>



    </div>
  );
}


function TechnicalAnalysis({ ticker }) {
  const [data, setData] = useState([]);
  const [tf, setTf] = useState("3M");
  const [loading, setLoading] = useState(true);
  // const [indicator, setIndicator] = useState("rsi");
  const TF_RANGE = { "1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y" };

  useEffect(() => {
    setLoading(true);
    fetch("/api/chart?ticker=" + encodeURIComponent(ticker) + "&range=" + TF_RANGE[tf] + "&interval=1d")
      .then(r => r.json())
      .then(d => {
        const result = d?.chart?.result?.[0];
        if (result) {
          const closes = result.indicators.quote[0].close;
          const timestamps = result.timestamp;
          const volumes = result.indicators.quote[0].volume;

          const mapped = timestamps.map((t, i) => ({
            date: new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            close: closes[i] ? +closes[i].toFixed(2) : null,
            volume: volumes[i] || 0,
          })).filter(d => d.close !== null);

          // Calculate RSI (14)
          const calcRSI = (prices, period = 14) => {
            const rsi = new Array(prices.length).fill(null);
            let gains = 0, losses = 0;
            for (let i = 1; i <= period; i++) {
              const diff = prices[i] - prices[i-1];
              if (diff > 0) gains += diff;
              else losses -= diff;
            }
            let avgGain = gains / period;
            let avgLoss = losses / period;
            rsi[period] = 100 - 100 / (1 + avgGain / (avgLoss || 0.001));
            for (let i = period + 1; i < prices.length; i++) {
              const diff = prices[i] - prices[i-1];
              avgGain = (avgGain * (period-1) + Math.max(diff, 0)) / period;
              avgLoss = (avgLoss * (period-1) + Math.max(-diff, 0)) / period;
              rsi[i] = 100 - 100 / (1 + avgGain / (avgLoss || 0.001));
            }
            return rsi;
          };

          // Calculate MACD (12, 26, 9)
          const calcEMA = (prices, period) => {
            const k = 2 / (period + 1);
            const ema = [prices[0]];
            for (let i = 1; i < prices.length; i++) {
              ema.push(prices[i] * k + ema[i-1] * (1-k));
            }
            return ema;
          };

          const prices = mapped.map(d => d.close);
          const ema12 = calcEMA(prices, 12);
          const ema26 = calcEMA(prices, 26);
          const macdLine = ema12.map((v, i) => +(v - ema26[i]).toFixed(4));
          const signal = calcEMA(macdLine, 9).map(v => +v.toFixed(4));
          const histogram = macdLine.map((v, i) => +(v - signal[i]).toFixed(4));

          // Bollinger Bands (20, 2)
          const bb = mapped.map((d, i) => {
            if (i < 19) return { upper: null, middle: null, lower: null };
            const slice = prices.slice(i-19, i+1);
            const mean = slice.reduce((a,b) => a+b, 0) / 20;
            const std = Math.sqrt(slice.reduce((a,b) => a + Math.pow(b-mean,2), 0) / 20);
            return { upper: +(mean + 2*std).toFixed(2), middle: +mean.toFixed(2), lower: +(mean - 2*std).toFixed(2) };
          });

          const rsiValues = calcRSI(prices);

          const finalData = mapped.map((d, i) => ({
            ...d,
            rsi: rsiValues[i] ? +rsiValues[i].toFixed(1) : null,
            macd: macdLine[i],
            signal: signal[i],
            histogram: histogram[i],
            bbUpper: bb[i].upper,
            bbMiddle: bb[i].middle,
            bbLower: bb[i].lower,
          }));

          setData(finalData);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticker, tf]); // eslint-disable-line

  const lastRSI = data[data.length-1]?.rsi;
  const lastMACD = data[data.length-1]?.macd;
  const lastSignal = data[data.length-1]?.signal;
  const lastClose = data[data.length-1]?.close;
  const lastBBU = data[data.length-1]?.bbUpper;
  const lastBBL = data[data.length-1]?.bbLower;

  const rsiColor = lastRSI > 70 ? "#f85149" : lastRSI < 30 ? "#3fb950" : "#e6edf3";
  const rsiLabel = lastRSI > 70 ? "OVERBOUGHT" : lastRSI < 30 ? "OVERSOLD" : "NEUTRAL";
  const macdSignal = lastMACD > lastSignal ? "BULLISH" : "BEARISH";
  const bbSignal = lastClose > lastBBU ? "OVERBOUGHT" : lastClose < lastBBL ? "OVERSOLD" : "NEUTRAL";

  const minP = data.length ? Math.min(...data.map(d => d.close)) * 0.99 : 0;
  const maxP = data.length ? Math.max(...data.map(d => d.close)) * 1.01 : 0;
  const xi = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "1fr 280px", gridTemplateRows: "280px 180px 180px", height: "calc(100vh - 90px)", overflow: "hidden" }}>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "1/2" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="terminal-header">{ticker} · Price + Bollinger Bands (20,2)</span>
          </div>
          <div className="flex gap-1">
            {Object.keys(TF_RANGE).map(t => (
              <button key={t} onClick={() => setTf(t)} className="px-2 py-0.5 text-xs font-mono rounded transition-colors"
                style={{ background: tf === t ? "#1f6feb22" : "transparent", color: tf === t ? "#58a6ff" : "#7d8590", border: "1px solid " + (tf === t ? "#1f6feb" : "#30363d") }}>{t}</button>
            ))}
          </div>
        </div>
        {loading ? <div className="flex items-center justify-center h-48 text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>Loading...</div> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="techGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={xi} />
              <YAxis domain={[minP, maxP]} tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={v => "$" + v.toFixed(0)} width={52} />
              <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 4, fontSize: 10, fontFamily: "monospace" }} labelStyle={{ color: "#7d8590" }} />
              <Area type="monotone" dataKey="bbUpper" stroke="#e3b341" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} name="BB Upper" />
              <Area type="monotone" dataKey="bbLower" stroke="#e3b341" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} name="BB Lower" />
              <Area type="monotone" dataKey="bbMiddle" stroke="#7d8590" strokeWidth={1} fill="none" dot={false} name="BB Middle" />
              <Area type="monotone" dataKey="close" stroke="#58a6ff" strokeWidth={1.5} fill="url(#techGrad)" dot={false} name="Price" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "1/3" }}>
        <div className="terminal-header mb-3">📊 Technical Signals</div>
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            <div className="terminal-header mb-1">RSI (14)</div>
            <div className="text-2xl font-mono font-bold" style={{ color: rsiColor }}>{lastRSI?.toFixed(1) || "—"}</div>
            <div className="text-xs font-mono mt-1" style={{ color: rsiColor }}>{rsiLabel}</div>
            <div className="relative h-2 rounded-full mt-2" style={{ background: "#21262d" }}>
              <div style={{ position: "absolute", left: "30%", top: -4, bottom: -4, width: 1, background: "#3fb950" }} />
              <div style={{ position: "absolute", left: "70%", top: -4, bottom: -4, width: 1, background: "#f85149" }} />
              <div style={{ position: "absolute", left: Math.min(Math.max((lastRSI||50), 0), 100) + "%", top: -3, width: 8, height: 8, borderRadius: "50%", background: rsiColor, transform: "translateX(-50%)" }} />
            </div>
            <div className="flex justify-between text-xs font-mono mt-1" style={{ color: "#484f58" }}>
              <span>0</span><span>30</span><span>70</span><span>100</span>
            </div>
          </div>

          <div className="p-3 rounded" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            <div className="terminal-header mb-1">MACD (12,26,9)</div>
            <div className="flex gap-3">
              <div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>MACD</div>
                <div className="text-sm font-mono font-bold" style={{ color: lastMACD >= 0 ? "#3fb950" : "#f85149" }}>{lastMACD?.toFixed(3) || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Signal</div>
                <div className="text-sm font-mono font-bold" style={{ color: "#e3b341" }}>{lastSignal?.toFixed(3) || "—"}</div>
              </div>
            </div>
            <div className="text-xs font-mono mt-2 px-2 py-1 rounded" style={{ background: lastMACD > lastSignal ? "rgba(63,185,80,0.1)" : "rgba(248,81,73,0.1)", color: lastMACD > lastSignal ? "#3fb950" : "#f85149" }}>
              {macdSignal} — MACD {lastMACD > lastSignal ? "above" : "below"} signal
            </div>
          </div>

          <div className="p-3 rounded" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            <div className="terminal-header mb-1">Bollinger Bands (20,2)</div>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {[["Upper", lastBBU, "#e3b341"], ["Middle", lastBBL ? ((lastBBU+lastBBL)/2).toFixed(2) : null, "#7d8590"], ["Lower", lastBBL, "#58a6ff"]].map(([l, v, c]) => (
                <div key={l}>
                  <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{l}</div>
                  <div className="text-xs font-mono font-bold" style={{ color: c }}>{v ? "$" + (+v).toFixed(2) : "—"}</div>
                </div>
              ))}
            </div>
            <div className="text-xs font-mono px-2 py-1 rounded" style={{ background: bbSignal === "NEUTRAL" ? "rgba(125,133,144,0.1)" : bbSignal === "OVERBOUGHT" ? "rgba(248,81,73,0.1)" : "rgba(63,185,80,0.1)", color: bbSignal === "NEUTRAL" ? "#7d8590" : bbSignal === "OVERBOUGHT" ? "#f85149" : "#3fb950" }}>
              {bbSignal}
            </div>
          </div>

          <div className="p-3 rounded" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            <div className="terminal-header mb-2">Overall Signal</div>
            {(() => {
              let bull = 0, bear = 0;
              if (lastRSI < 50) bear++; else bull++;
              if (lastRSI < 30) bull += 2;
              if (lastRSI > 70) bear += 2;
              if (lastMACD > lastSignal) bull++; else bear++;
              if (bbSignal === "OVERSOLD") bull++; else if (bbSignal === "OVERBOUGHT") bear++;
              const total = bull + bear;
              const bullPct = Math.round(bull/total*100);
              return (
                <div>
                  <div className="flex gap-1 mb-2" style={{ height: 8, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: bullPct + "%", background: "#3fb950", transition: "width 0.3s" }} />
                    <div style={{ width: (100-bullPct) + "%", background: "#f85149" }} />
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span style={{ color: "#3fb950" }}>Bullish {bullPct}%</span>
                    <span style={{ color: "#f85149" }}>Bearish {100-bullPct}%</span>
                  </div>
                  <div className="text-xs font-mono mt-2 font-bold" style={{ color: bullPct > 60 ? "#3fb950" : bullPct < 40 ? "#f85149" : "#e3b341" }}>
                    {bullPct > 60 ? "BUY SIGNAL" : bullPct < 40 ? "SELL SIGNAL" : "NEUTRAL"}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "2/3" }}>
        <div className="terminal-header mb-2">RSI (14) — Relative Strength Index</div>
        {loading ? <div className="text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>Loading...</div> : (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={xi} />
              <YAxis domain={[0, 100]} tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 4, fontSize: 10, fontFamily: "monospace" }} labelStyle={{ color: "#7d8590" }} />
              <ReferenceLine y={70} stroke="#f85149" strokeDasharray="3 3" strokeWidth={1} />
              <ReferenceLine y={30} stroke="#3fb950" strokeDasharray="3 3" strokeWidth={1} />
              <Area type="monotone" dataKey="rsi" stroke="#58a6ff" strokeWidth={1.5} fill="rgba(88,166,255,0.05)" dot={false} name="RSI" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "3/4" }}>
        <div className="terminal-header mb-2">MACD (12,26,9) — Moving Average Convergence Divergence</div>
        {loading ? <div className="text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>Loading...</div> : (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={xi} />
              <YAxis tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 4, fontSize: 10, fontFamily: "monospace" }} labelStyle={{ color: "#7d8590" }} />
              <ReferenceLine y={0} stroke="#30363d" strokeWidth={1} />
              <Bar dataKey="histogram" name="Histogram" radius={[1,1,0,0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.histogram >= 0 ? "#3fb950" : "#f85149"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "3/4" }}>
        <div className="terminal-header mb-2">📖 Indicator Guide</div>
        <div className="flex flex-col gap-2 text-xs font-mono" style={{ color: "#7d8590" }}>
          <div><span style={{ color: "#58a6ff" }}>RSI {">"} 70</span> — Overbought, potential sell signal</div>
          <div><span style={{ color: "#3fb950" }}>RSI {"<"} 30</span> — Oversold, potential buy signal</div>
          <div><span style={{ color: "#3fb950" }}>MACD above Signal</span> — Bullish momentum</div>
          <div><span style={{ color: "#f85149" }}>MACD below Signal</span> — Bearish momentum</div>
          <div><span style={{ color: "#e3b341" }}>BB Upper breach</span> — Overbought condition</div>
          <div><span style={{ color: "#e3b341" }}>BB Lower breach</span> — Oversold condition</div>
        </div>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GEOPOLITICAL EVENTS INTELLIGENCE MODULE
// ─────────────────────────────────────────────────────────────

// Keywords are intentionally multi-word or unambiguous to prevent cross-category pollution.
// "war" / "attack" / "strike" are NOT in Conflict — they appear in "trade war", "oil price attack" etc.
const GEO_CATEGORIES = {
  "Central Bank": {
    keywords: [
      "federal reserve","interest rate","rate hike","rate cut","fomc",
      "ecb","bank of japan","boj","pboc","monetary policy","basis point",
      "central bank","powell","lagarde","ueda","rate decision","hawkish",
      "dovish","rate pause","fed funds","bond yield","yield curve",
      "treasury yield","quantitative easing","quantitative tightening",
      "rate increase","rate decrease","inflation target","fed meeting",
      "rate hold","rate outlook","fed chair","rate cycle","fed pivot",
    ],
    color: "#bc8cff", bg: "rgba(188,140,255,0.08)",
    assets: [
      { id:"DGS10", label:"10Y Treasury", type:"macro",     series:"DGS10", category:"Macro" },
      { id:"SPY",   label:"S&P 500",      type:"equity",    ticker:"SPY",   category:"Indices" },
      { id:"GC=F",  label:"Gold",         type:"commodity", ticker:"GC=F",  category:"Commodities" },
      { id:"DX=F",  label:"USD Index",    type:"fx",        ticker:"DX=F",  category:"FX" },
    ],
    why: "Rate decisions move bond yields, equity discount rates, and currency strength simultaneously across all asset classes.",
  },
  "Trade / Sanctions": {
    keywords: [
      "tariff","sanction","trade war","embargo","export ban","import ban",
      "wto","trade deal","export control","trade restriction","trade deficit",
      "decoupling","blacklist","trade dispute","import duty","trade policy",
      "trade tension","economic sanction","trade barrier","trade agreement",
      "trade war","counter-tariff","technology ban","chip ban","export license",
    ],
    color: "#e3b341", bg: "rgba(227,179,65,0.08)",
    assets: [
      { id:"EURUSD=X", label:"EUR/USD",  type:"fx",        ticker:"EURUSD=X", category:"FX" },
      { id:"HG=F",     label:"Copper",   type:"commodity", ticker:"HG=F",     category:"Commodities" },
      { id:"SPY",      label:"S&P 500",  type:"equity",    ticker:"SPY",      category:"Indices" },
      { id:"USDCNY=X", label:"USD/CNY",  type:"fx",        ticker:"USDCNY=X", category:"FX" },
    ],
    why: "Trade barriers raise input costs, compress corporate margins, and force currency adjustments in affected economies.",
  },
  "Elections / Politics": {
    keywords: [
      "election","referendum","snap election","general election","presidential election",
      "political crisis","impeachment","government collapse","political turmoil",
      "election result","coup","regime change","political instability","civil unrest",
      "protest","opposition leader","ballot","polling","vote count","political tension",
      "legislative","parliament","head of state","prime minister","chancellor",
    ],
    color: "#58a6ff", bg: "rgba(88,166,255,0.08)",
    assets: [
      { id:"SPY",      label:"S&P 500", type:"equity",    ticker:"SPY",      category:"Indices" },
      { id:"EURUSD=X", label:"EUR/USD", type:"fx",        ticker:"EURUSD=X", category:"FX" },
      { id:"GC=F",     label:"Gold",    type:"commodity", ticker:"GC=F",     category:"Commodities" },
    ],
    why: "Political uncertainty elevates risk premia, weakens local currencies, and can abruptly reverse fiscal and regulatory trajectories.",
  },
  "Energy": {
    keywords: [
      "opec","crude oil","oil price","natural gas","brent crude","wti crude",
      "oil barrel","energy crisis","oil production","gas supply","lng",
      "oil output","refinery","oil supply","energy supply","energy market",
      "gas pipeline","oil reserves","energy security","production quota",
      "oil demand","gas price","electricity price","oil cut","oil output cut",
      "energy price","gas shortage","fuel price","opec+","oil inventory",
    ],
    color: "#f0883e", bg: "rgba(240,136,62,0.08)",
    assets: [
      { id:"CL=F",     label:"Crude Oil (WTI)", type:"commodity", ticker:"CL=F",     category:"Commodities" },
      { id:"NG=F",     label:"Natural Gas",      type:"commodity", ticker:"NG=F",     category:"Commodities" },
      { id:"CPIAUCSL", label:"CPI Inflation",    type:"macro",     series:"CPIAUCSL", category:"Macro" },
    ],
    why: "Energy supply disruptions feed directly into CPI, widen trade deficits in import-dependent economies, and pressure corporate margins globally.",
  },
  "Supply Chain": {
    keywords: [
      "supply chain","chip shortage","semiconductor","freight rate","shipping disruption",
      "port strike","container ship","manufacturing slowdown","inventory shortage",
      "supply disruption","chip supply","logistics","factory shutdown","supply bottleneck",
      "global shortage","production delay","microchip","fab","foundry","chip maker",
      "wafer","shortage","congestion","cargo","freight","ocean freight",
    ],
    color: "#3fb950", bg: "rgba(63,185,80,0.08)",
    assets: [
      { id:"HG=F", label:"Copper",     type:"commodity", ticker:"HG=F", category:"Commodities" },
      { id:"NVDA", label:"NVIDIA",     type:"equity",    ticker:"NVDA", category:"Equities" },
      { id:"QQQ",  label:"Nasdaq 100", type:"equity",    ticker:"QQQ",  category:"Indices" },
    ],
    why: "Supply constraints elevate input costs, delay product cycles, and create concentrated earnings risk in technology and manufacturing sectors.",
  },
  "Conflict": {
    // Only unambiguous military terms — "war"/"attack"/"strike" intentionally excluded
    keywords: [
      "troops","ceasefire","airstrike","air strike","artillery","frontline",
      "shelling","drone strike","rocket fire","military operation","armed forces",
      "warplane","missile launch","military offensive","war crimes","bombardment",
      "invasion","fighter jet","ground troops","naval battle","military escalation",
      "military conflict","armed attack","military base","casualt","hostage",
      "nato forces","peacekeeping","demilitariz","occupied territory","siege",
    ],
    color: "#f85149", bg: "rgba(248,81,73,0.08)",
    assets: [
      { id:"GC=F", label:"Gold",             type:"commodity", ticker:"GC=F", category:"Commodities" },
      { id:"CL=F", label:"Crude Oil",         type:"commodity", ticker:"CL=F", category:"Commodities" },
      { id:"ITA",  label:"Defense ETF (ITA)", type:"equity",    ticker:"ITA",  category:"Equities" },
      { id:"DX=F", label:"USD Index",         type:"fx",        ticker:"DX=F", category:"FX" },
    ],
    why: "Military escalation drives safe-haven flows into gold and USD, lifts energy prices on supply-risk fears, and boosts defense sector revenues.",
  },
};

const GEO_REGIONS = {
  "🇺🇸 US":         ["united states","u.s. ","american","washington dc","biden","trump","congress","federal reserve","white house","pentagon","u.s. economy","u.s. dollar","treasury secretary"],
  "🇨🇳 China":       ["china","chinese","beijing","xi jinping","pboc","ccp","taiwan","hong kong","shanghai","yuan","renminbi","chinese economy"],
  "🇷🇺 Russia":      ["russia","russian","moscow","putin","kremlin","ukraine","rouble","gazprom","russian economy"],
  "🇪🇺 Europe":      ["europe","european","eurozone","ecb","germany","france","united kingdom","britain","euro zone","sterling","european union","eu trade"],
  "🌍 Middle East":  ["iran","israel","saudi","opec","gulf state","iraq","syria","yemen","palestin","hamas","hezbollah","middle east","riyadh","tehran"],
  "🌏 Asia Pacific": ["japan","south korea","india","australia","singapore","bank of japan","asia pacific","southeast asia","asean","indian rupee","japanese yen"],
  "🌎 LatAm":        ["brazil","mexico","argentina","venezuela","chile","colombia","latin america","brazilian real","mexican peso"],
};

const GEO_ASSET_COLOR = { equity:"#58a6ff", commodity:"#e3b341", fx:"#3fb950", macro:"#bc8cff", topic:"#f0883e" };

const BULLISH_WORDS = ["ceasefire","peace deal","diplomatic agreement","de-escalat","easing tension","recovery","stimulus","rate cut","rate cuts","trade deal signed","accord","truce","resolution","normalization"];
const BEARISH_WORDS = ["invasion","crisis","default","collapse","recession","escalat","new sanction","tariff hike","production cut","blockade","restrict","ultimatum","hostile","military offensive","coup","regime collapse"];

function classifyGeoArticle(article) {
  const text = ((article.headline || "") + " " + (article.summary || "")).toLowerCase();

  // Score each category; higher score = better match
  const scores = {};
  for (const [cat, cfg] of Object.entries(GEO_CATEGORIES)) {
    scores[cat] = cfg.keywords.filter(kw => text.includes(kw)).length;
  }
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return null;

  // Pick category with highest score; on tie prefer the non-Conflict category
  // (Conflict is last in the object, so iterating in reverse for tie-breaking)
  const entries = Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];           // higher score wins
    if (a[0] === "Conflict") return 1;                // Conflict loses ties
    if (b[0] === "Conflict") return -1;
    return 0;
  });
  const category = entries[0][0];

  const regions = Object.entries(GEO_REGIONS)
    .filter(([, kws]) => kws.some(kw => text.includes(kw)))
    .map(([r]) => r);

  let impact = maxScore >= 4 ? "High" : maxScore >= 2 ? "Medium" : "Low";

  const bullish = BULLISH_WORDS.filter(w => text.includes(w)).length;
  const bearish = BEARISH_WORDS.filter(w => text.includes(w)).length;
  const signal = bearish > bullish + 1 ? "Bearish" : bullish > bearish + 1 ? "Bullish" : "Neutral";

  const catCfg = GEO_CATEGORIES[category];
  return { category, regions, impact, signal, assets: catCfg.assets, why: catCfg.why };
}

function geoTimeAgo(ts) {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return "Just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

const GEO_IMPACT_COLOR = { High:"#f85149", Medium:"#e3b341", Low:"#3fb950" };
const GEO_SIGNAL_COLOR = { Bullish:"#3fb950", Bearish:"#f85149", Neutral:"#7d8590" };
const GEO_SIGNAL_ICON  = { Bullish:"▲", Bearish:"▼", Neutral:"◆" };

function GeopoliticalEvents({ onOpenResearch }) {
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filterImpact, setFilterImpact] = useState("All");
  const [filterCat, setFilterCat]   = useState("All");
  const [filterTime, setFilterTime] = useState("24H");

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const [general, forex] = await Promise.all([
        api("/news?category=general"),
        delay(300).then(() => api("/news?category=forex")),
      ]);
      const raw = [...(Array.isArray(general) ? general : []), ...(Array.isArray(forex) ? forex : [])];
      const seen = new Set();
      const unique = raw.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
      const classified = unique
        .map(a => { const m = classifyGeoArticle(a); return m ? { ...a, ...m } : null; })
        .filter(Boolean);
      const order = { High:0, Medium:1, Low:2 };
      classified.sort((a, b) => order[a.impact] !== order[b.impact] ? order[a.impact] - order[b.impact] : b.datetime - a.datetime);
      setEvents(classified);
      if (classified.length > 0) setSelected(classified[0]);
      setLastRefresh(Date.now());
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
    const iv = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line

  const nowSec = Date.now() / 1000;
  const timeWindow = { "1H":3600, "6H":21600, "24H":86400 }[filterTime];
  const filtered = events.filter(e =>
    (filterImpact === "All" || e.impact === filterImpact) &&
    (filterCat    === "All" || e.category === filterCat) &&
    (nowSec - e.datetime <= timeWindow)
  );


  return (
    <div className="flex flex-col" style={{ height:"100%", overflow:"hidden" }}>

      {/* ── Filter bar ── */}
      <div className="px-4 py-2 flex items-center gap-3 flex-wrap" style={{ borderBottom:"1px solid #21262d", background:"#010409", flexShrink:0 }}>
        <span className="font-mono" style={{ background:"#0c2044", color:"#58a6ff", border:"1px solid #58a6ff33", borderRadius:3, padding:"2px 8px", fontSize:10 }}>● LIVE</span>

        <div className="flex items-center gap-1">
          <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>IMPACT:</span>
          {["All","High","Medium","Low"].map(v => (
            <button key={v} onClick={() => setFilterImpact(v)} className="font-mono"
              style={{ padding:"2px 8px", fontSize:10, borderRadius:3, border:"1px solid", cursor:"pointer",
                background: filterImpact===v ? (GEO_IMPACT_COLOR[v]||"#21262d")+"22" : "transparent",
                borderColor: filterImpact===v ? (GEO_IMPACT_COLOR[v]||"#58a6ff") : "#21262d",
                color: filterImpact===v ? (GEO_IMPACT_COLOR[v]||"#58a6ff") : "#7d8590" }}>
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>CATEGORY:</span>
          {["All",...Object.keys(GEO_CATEGORIES)].map(v => {
            const cfg = GEO_CATEGORIES[v];
            return (
              <button key={v} onClick={() => setFilterCat(v)} className="font-mono"
                style={{ padding:"2px 8px", fontSize:10, borderRadius:3, border:"1px solid", cursor:"pointer",
                  background: filterCat===v ? (cfg?.bg||"#21262d") : "transparent",
                  borderColor: filterCat===v ? (cfg?.color||"#58a6ff") : "#21262d",
                  color: filterCat===v ? (cfg?.color||"#58a6ff") : "#7d8590" }}>
                {v}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>TIME:</span>
          {["1H","6H","24H"].map(v => (
            <button key={v} onClick={() => setFilterTime(v)} className="font-mono"
              style={{ padding:"2px 8px", fontSize:10, borderRadius:3, border:"1px solid", cursor:"pointer",
                background: filterTime===v ? "#0c2044" : "transparent",
                borderColor: filterTime===v ? "#58a6ff" : "#21262d",
                color: filterTime===v ? "#58a6ff" : "#7d8590" }}>
              {v}
            </button>
          ))}
        </div>

        <button onClick={fetchEvents} disabled={loading} className="font-mono"
          style={{ padding:"2px 10px", fontSize:10, borderRadius:3, border:"1px solid #30363d", background:"transparent", color:loading?"#7d8590":"#58a6ff", cursor:loading?"wait":"pointer", marginLeft:"auto" }}>
          {loading ? "⟳ Updating…" : "⟳ Refresh"}
        </button>
        {lastRefresh && (
          <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>
            {filtered.length} events · {new Date(lastRefresh).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* ── Two-column workspace ── */}
      <div className="flex flex-1" style={{ overflow:"hidden" }}>

        {/* Left: scrollable event feed */}
        <div style={{ width:460, flexShrink:0, borderRight:"1px solid #21262d", overflowY:"auto" }}>
          {loading && events.length === 0 ? (
            <div className="flex items-center justify-center p-10 font-mono" style={{ color:"#7d8590", fontSize:12 }}>Fetching intelligence feed…</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center p-10 font-mono" style={{ color:"#7d8590", fontSize:12 }}>No events match current filters.</div>
          ) : filtered.map(event => {
            const cfg = GEO_CATEGORIES[event.category];
            const isSelected = selected?.id === event.id;
            const ageSec = nowSec - event.datetime;
            const isBreaking = event.impact === "High" && ageSec < 3600;
            const isNew      = ageSec < 1800 && !isBreaking;
            return (
              <div key={event.id} onClick={() => setSelected(event)}
                style={{ borderBottom:"1px solid #161b22", borderLeft:"3px solid " + (isSelected ? cfg.color : GEO_IMPACT_COLOR[event.impact]),
                  background: isSelected ? cfg.bg : "transparent", padding:"10px 14px", cursor:"pointer", transition:"background 0.15s" }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background="#0d1117"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background="transparent"; }}>

                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  {isBreaking && <span className="font-mono" style={{ background:"#f8514922", border:"1px solid #f85149", borderRadius:2, padding:"0 5px", fontSize:8, color:"#f85149", textTransform:"uppercase" }}>⚡ Breaking</span>}
                  {isNew      && <span className="font-mono" style={{ background:"#3fb95022", border:"1px solid #3fb950", borderRadius:2, padding:"0 5px", fontSize:8, color:"#3fb950", textTransform:"uppercase" }}>● New</span>}
                  <span className="font-mono" style={{ background:cfg.bg, border:"1px solid "+cfg.color+"55", borderRadius:2, padding:"0 6px", fontSize:9, color:cfg.color, textTransform:"uppercase" }}>{event.category}</span>
                  <span className="font-mono" style={{ border:"1px solid "+GEO_IMPACT_COLOR[event.impact]+"44", borderRadius:2, padding:"0 5px", fontSize:9, color:GEO_IMPACT_COLOR[event.impact] }}>{event.impact}</span>
                  <span className="font-mono ml-auto" style={{ color:"#484f58", fontSize:9 }}>{geoTimeAgo(event.datetime)}</span>
                </div>

                <div className="font-mono leading-snug mb-1.5" style={{ color:"#e6edf3", fontSize:12, fontWeight:isBreaking?600:400 }}>
                  {event.headline}
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>{event.source}</span>
                  {event.regions.slice(0,3).map(r => <span key={r} className="font-mono" style={{ color:"#484f58", fontSize:10 }}>{r}</span>)}
                </div>

                <div className="flex flex-wrap gap-1 items-center">
                  {event.assets.slice(0,3).map(a => (
                    <span key={a.id} className="font-mono" style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:2, padding:"1px 6px", fontSize:9, color:"#7d8590" }}>
                      {a.label}
                    </span>
                  ))}
                  <span className="font-mono ml-auto" style={{ fontSize:10, color:GEO_SIGNAL_COLOR[event.signal] }}>
                    {GEO_SIGNAL_ICON[event.signal]} {event.signal}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: event detail */}
        <div className="flex-1 p-5" style={{ overflowY:"auto" }}>
          {!selected ? (
            <div className="flex items-center justify-center h-full font-mono" style={{ color:"#484f58", fontSize:12 }}>
              Select an event to view intelligence detail
            </div>
          ) : (() => {
            const cfg = GEO_CATEGORIES[selected.category];
            const ageSec = nowSec - selected.datetime;
            const isBreaking = selected.impact === "High" && ageSec < 3600;
            return (
              <div>
                {/* Badges */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {isBreaking && <span className="font-mono" style={{ background:"#f8514922", border:"1px solid #f85149", borderRadius:3, padding:"3px 10px", fontSize:10, color:"#f85149" }}>⚡ BREAKING</span>}
                  <span className="font-mono" style={{ background:cfg.bg, border:"1px solid "+cfg.color, borderRadius:3, padding:"3px 10px", fontSize:10, color:cfg.color }}>{selected.category.toUpperCase()}</span>
                  <span className="font-mono" style={{ border:"1px solid "+GEO_IMPACT_COLOR[selected.impact], borderRadius:3, padding:"3px 10px", fontSize:10, color:GEO_IMPACT_COLOR[selected.impact] }}>{selected.impact.toUpperCase()} IMPACT</span>
                  <span className="font-mono ml-auto" style={{ color:"#7d8590", fontSize:10 }}>{selected.source} · {geoTimeAgo(selected.datetime)}</span>
                </div>

                {/* Headline */}
                <h2 className="font-mono font-bold leading-snug mb-3" style={{ color:"#e6edf3", fontSize:16 }}>{selected.headline}</h2>

                {/* Regions */}
                {selected.regions.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>Region:</span>
                    {selected.regions.map(r => (
                      <span key={r} className="font-mono" style={{ background:"#21262d", borderRadius:3, padding:"2px 8px", fontSize:11, color:"#7d8590" }}>{r}</span>
                    ))}
                  </div>
                )}

                {/* Summary */}
                {selected.summary && (
                  <div className="mb-4 p-3" style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:4 }}>
                    <div className="font-mono mb-1.5" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Summary</div>
                    <p className="font-mono leading-relaxed" style={{ color:"#7d8590", fontSize:12 }}>{selected.summary}</p>
                  </div>
                )}

                {/* Why it matters */}
                <div className="mb-4 p-3" style={{ background:cfg.bg, border:"1px solid "+cfg.color+"44", borderRadius:4 }}>
                  <div className="font-mono mb-1.5" style={{ color:cfg.color, fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Why It Matters</div>
                  <p className="font-mono leading-relaxed" style={{ color:"#e6edf3", fontSize:12 }}>{cfg.why}</p>
                </div>

                {/* Signal + link row */}
                <div className="flex items-center gap-4 mb-4 p-3" style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:4 }}>
                  <div>
                    <div className="font-mono mb-1" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>Directional Signal</div>
                    <div className="font-mono font-bold" style={{ color:GEO_SIGNAL_COLOR[selected.signal], fontSize:18 }}>
                      {GEO_SIGNAL_ICON[selected.signal]} {selected.signal}
                    </div>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <a href={selected.url} target="_blank" rel="noopener noreferrer"
                      className="font-mono"
                      style={{ background:"#1f6feb", borderRadius:4, padding:"7px 14px", color:"#fff", fontSize:11, textDecoration:"none" }}>
                      Full Article ↗
                    </a>
                  </div>
                </div>

                {/* Impacted assets */}
                <div className="mb-4">
                  <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                    Impacted Assets {onOpenResearch ? "— Click to Research" : ""}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.assets.map(a => (
                      <button key={a.id}
                        onClick={() => onOpenResearch && onOpenResearch(a)}
                        className="font-mono"
                        style={{ background:"#0d1117", border:"1px solid #30363d", borderRadius:4, padding:"7px 14px", fontSize:12, color:GEO_ASSET_COLOR[a.type]||"#7d8590", cursor:onOpenResearch?"pointer":"default", transition:"all 0.15s" }}
                        onMouseEnter={e => { if (onOpenResearch) { e.currentTarget.style.borderColor=cfg.color; e.currentTarget.style.background=cfg.bg; } }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor="#30363d"; e.currentTarget.style.background="#0d1117"; }}>
                        {a.label}{onOpenResearch ? " ↗" : ""}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intelligence metadata grid */}
                <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Intelligence Classification</div>
                <div className="grid" style={{ gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                  {[
                    ["Category",  selected.category],
                    ["Impact",    selected.impact],
                    ["Signal",    selected.signal],
                    ["Source",    selected.source],
                    ["Regions",   selected.regions.length ? selected.regions.map(r => r.split(" ").slice(1).join(" ")).join(", ") : "Global"],
                    ["Published", geoTimeAgo(selected.datetime)],
                  ].map(([k, v]) => (
                    <div key={k} className="p-2" style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:4 }}>
                      <div className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>{k}</div>
                      <div className="font-mono" style={{ color:"#e6edf3", fontSize:11 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function EyeOfSauron({ onOpenResearch }) {
  const [active, setActive] = useState(null);

  const MODULES = [
    { id: "weather", icon: "🌦", title: "Global Weather", desc: "Live weather across major financial centers worldwide" },
    { id: "vessels", icon: "🛢", title: "Vessel Tracker", desc: "Live oil tankers and cargo ships via MarineTraffic" },
    { id: "flights", icon: "✈️", title: "Flight Tracker", desc: "Real-time global flight tracking via ADS-B Exchange" },
    { id: "energy", icon: "⚡", title: "Energy Grid", desc: "Live US electricity grid demand and generation mix" },
    { id: "tankers", icon: "🚢", title: "Shipping Routes", desc: "Major shipping lane congestion and freight rates", tag: "Coming Soon" },
    { id: "geo", icon: "🌍", title: "Geopolitical Events", desc: "Live intelligence feed — market-moving events classified by impact and region" },
  ];

  const renderModule = (id) => {
    if (id === "weather") return <WeatherDashboard />;
    if (id === "vessels") return <TankerMap />;
    if (id === "flights") return <FlightTracker />;
    if (id === "energy") return <EnergyGrid />;
    if (id === "geo")    return <GeopoliticalEvents onOpenResearch={onOpenResearch} />;
    return null;
  };

  if (active) {
    const mod = MODULES.find(m => m.id === active);
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: "1px solid #21262d" }}>
          <button onClick={() => setActive(null)}
            className="text-xs font-mono px-3 py-1 rounded transition-colors"
            style={{ background: "#0c2044", color: "#58a6ff", border: "1px solid #58a6ff33" }}>
            ← Back
          </button>
          <span style={{ fontSize: 18 }}>{mod.icon}</span>
          <span className="terminal-header">{mod.title}</span>
        </div>
        <div className="flex-1">
          {renderModule(active)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4">
      <div className="mb-4">
        <div className="terminal-header text-lg mb-1">👁 Eye of Sauron</div>
        <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Global intelligence feeds — click any module to expand</div>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        {MODULES.map(mod => (
          <div key={mod.id}
            onClick={() => !mod.tag && setActive(mod.id)}
            className="eye-card p-4 transition-all"
            style={{ cursor: mod.tag ? "default" : "pointer", minHeight: 140 }}>
            <div style={{ fontSize: 36 }} className="mb-3">{mod.icon}</div>
            <div className="font-mono font-bold text-sm mb-1" style={{ color: mod.tag ? "#7d8590" : "#e6edf3" }}>{mod.title}</div>
            <div className="font-mono text-xs leading-relaxed mb-3" style={{ color: "#7d8590" }}>{mod.desc}</div>
            {mod.tag ? (
              <span className="text-xs font-mono px-2 py-1 rounded" style={{ border: "1px solid #7d8590", color: "#58a6ff44" }}>Coming Soon</span>
            ) : (
              <span className="text-xs font-mono px-2 py-1 rounded" style={{ border: "1px solid #58a6ff33", color: "#58a6ff" }}>● Click to Open</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TankerMap() {
  return (
    <div className="flex flex-col" style={{ borderTop: "1px solid #21262d" }}>
      <div className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid #21262d" }}>
        <span className="terminal-header">🛢 Live Vessel Tracker — MarineTraffic</span>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#0c2044", color: "#58a6ff", border: "1px solid #58a6ff33" }}>● LIVE</span>
      </div>
      <iframe
        src="https://www.marinetraffic.com/en/ais/embed/maptype:0/mmsi:0/vesseltype:80/zoom:4/shownames:true/bgcolor:000000"
        style={{ width: "100%", height: 450, border: "none" }}
        title="Live Vessel Tracker"
      />
    </div>
  );
}


function FlightTracker() {
  return (
    <div className="flex flex-col" style={{ borderTop: "1px solid #21262d" }}>
      <div className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid #21262d" }}>
        <span className="terminal-header">✈️ Live Flight Tracker — FlightRadar24</span>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#0c2044", color: "#58a6ff", border: "1px solid #58a6ff33" }}>● LIVE</span>
      </div>
      <iframe
        src="https://globe.adsbexchange.com/?largeMode=1"
        style={{ width: "100%", height: 450, border: "none" }}
        title="Live Flight Tracker"
      />
    </div>
  );
}


function EnergyGrid() {
  return (
    <div className="flex flex-col" style={{ borderTop: "1px solid #21262d" }}>
      <div className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid #21262d" }}>
        <span className="terminal-header">⚡ Live Energy Grid — Electricity Maps</span>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#0c2044", color: "#58a6ff", border: "1px solid #58a6ff33" }}>● LIVE</span>
        <span className="text-xs font-mono" style={{ color: "#7d8590" }}>Carbon intensity & energy mix by country</span>
      </div>
      <iframe
        src="https://www.eia.gov/electricity/gridmonitor/dashboard/electric_overview/US48/US48"
        style={{ width: "100%", height: 450, border: "none" }}
        title="Live Energy Grid"
      />
    </div>
  );
}

function WeatherDashboard() {
  const CITIES = [
    { name: "New York", lat: 40.71, lon: -74.01, tz: "America/New_York", flag: "🇺🇸" },
    { name: "London", lat: 51.51, lon: -0.13, tz: "Europe/London", flag: "🇬🇧" },
    { name: "Tokyo", lat: 35.68, lon: 139.69, tz: "Asia/Tokyo", flag: "🇯🇵" },
    { name: "Hong Kong", lat: 22.32, lon: 114.17, tz: "Asia/Hong_Kong", flag: "🇭🇰" },
    { name: "Dubai", lat: 25.20, lon: 55.27, tz: "Asia/Dubai", flag: "🇦🇪" },
    { name: "Shanghai", lat: 31.23, lon: 121.47, tz: "Asia/Shanghai", flag: "🇨🇳" },
    { name: "Frankfurt", lat: 50.11, lon: 8.68, tz: "Europe/Berlin", flag: "🇩🇪" },
    { name: "Singapore", lat: 1.35, lon: 103.82, tz: "Asia/Singapore", flag: "🇸🇬" },
    { name: "Sydney", lat: -33.87, lon: 151.21, tz: "Australia/Sydney", flag: "🇦🇺" },
    { name: "Toronto", lat: 43.65, lon: -79.38, tz: "America/Toronto", flag: "🇨🇦" },
    { name: "Riyadh", lat: 24.69, lon: 46.72, tz: "Asia/Riyadh", flag: "🇸🇦" },
    { name: "Mumbai", lat: 19.08, lon: 72.88, tz: "Asia/Kolkata", flag: "🇮🇳" },
  ];

  const WMO = {
    0: { label: "Clear", icon: "☀️" },
    1: { label: "Mostly Clear", icon: "🌤" },
    2: { label: "Partly Cloudy", icon: "⛅️" },
    3: { label: "Overcast", icon: "☁️" },
    45: { label: "Foggy", icon: "🌫" },
    48: { label: "Icy Fog", icon: "🌫" },
    51: { label: "Light Drizzle", icon: "🌦" },
    53: { label: "Drizzle", icon: "🌦" },
    55: { label: "Heavy Drizzle", icon: "🌧" },
    61: { label: "Light Rain", icon: "🌧" },
    63: { label: "Rain", icon: "🌧" },
    65: { label: "Heavy Rain", icon: "🌧" },
    71: { label: "Light Snow", icon: "🌨" },
    73: { label: "Snow", icon: "❄️" },
    75: { label: "Heavy Snow", icon: "❄️" },
    80: { label: "Showers", icon: "🌦" },
    81: { label: "Showers", icon: "🌧" },
    82: { label: "Heavy Showers", icon: "⛈" },
    95: { label: "Thunderstorm", icon: "⛈" },
    99: { label: "Hail Storm", icon: "⛈" },
  };

  const [weather, setWeather] = useState({});
  const [active, setActive] = useState("New York");
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lats = CITIES.map(c => c.lat).join(",");
    const lons = CITIES.map(c => c.lon).join(",");
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lats + "&longitude=" + lons + "&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m&temperature_unit=celsius&windspeed_unit=mph")
      .then(r => r.json())
      .then(results => {
        const arr = Array.isArray(results) ? results : [results];
        const weatherMap = {};
        CITIES.forEach((c, i) => {
          const d = arr[i];
          weatherMap[c.name] = {
            temp: d?.current?.temperature_2m,
            code: d?.current?.weathercode,
            wind: d?.current?.windspeed_10m,
            humidity: d?.current?.relativehumidity_2m,
          };
        });
        setWeather(weatherMap);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => {
    const city = CITIES.find(c => c.name === active);
    if (!city) return;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + city.lat + "&longitude=" + city.lon + "&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=celsius&timezone=" + city.tz)
      .then(r => r.json())
      .then(d => {
        if (d.daily) {
          const days = d.daily.time.map((t, i) => ({
            date: new Date(t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            max: d.daily.temperature_2m_max[i],
            min: d.daily.temperature_2m_min[i],
            code: d.daily.weathercode[i],
          }));
          setForecast(days);
        }
      })
      .catch(() => {});
  }, [active]); // eslint-disable-line

  const activeCity = CITIES.find(c => c.name === active);
  // const activeWeather = weather[active];
  const wmo = (code) => WMO[code] || WMO[Math.floor(code/10)*10] || { label: "Clear", icon: "🌤" };

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", gridTemplateRows: "auto auto" }}>
      
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/3", gridRow: "1/2" }}>
        <div className="terminal-header mb-3">🌍 Global Financial Centers — Weather</div>
        <div className="grid grid-cols-3 gap-2">
          {CITIES.slice(0, 6).map(c => {
            const w = weather[c.name];
            const isActive = active === c.name;
            return (
              <div key={c.name} onClick={() => setActive(c.name)}
                className="p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#0c2044" : "#0d1117", border: "1px solid", borderColor: isActive ? "#58a6ff44" : "#1c2128" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold" style={{ color: isActive ? "#58a6ff" : "#e6edf3" }}>{c.flag} {c.name}</span>
                  <span style={{ fontSize: 16 }}>{wmo(w?.code).icon}</span>
                </div>
                <div className="text-lg font-mono font-bold" style={{ color: "#e6edf3" }}>{w ? w.temp + "°C" : "..."}</div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{wmo(w?.code).label}</div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>💨 {w?.wind || "—"} mph</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "3/5", gridRow: "1/2" }}>
        <div className="terminal-header mb-3">🌍 Asia Pacific & Middle East</div>
        <div className="grid grid-cols-3 gap-2">
          {CITIES.slice(6, 12).map(c => {
            const w = weather[c.name];
            const isActive = active === c.name;
            return (
              <div key={c.name} onClick={() => setActive(c.name)}
                className="p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#0c2044" : "#0d1117", border: "1px solid", borderColor: isActive ? "#58a6ff44" : "#1c2128" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold" style={{ color: isActive ? "#58a6ff" : "#e6edf3" }}>{c.flag} {c.name}</span>
                  <span style={{ fontSize: 16 }}>{wmo(w?.code).icon}</span>
                </div>
                <div className="text-lg font-mono font-bold" style={{ color: "#e6edf3" }}>{w ? w.temp + "°C" : "..."}</div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{wmo(w?.code).label}</div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>💨 {w?.wind || "—"} mph</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/3", gridRow: "2/3" }}>
        <div className="terminal-header mb-3">{activeCity?.flag} {active} — 7 Day Forecast</div>
        <div className="grid grid-cols-7 gap-1">
          {forecast.slice(0, 7).map((f, i) => (
            <div key={i} className="flex flex-col items-center p-1.5 rounded" style={{ background: "#0d1117", border: "1px solid #1c2128" }}>
              <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{f.date.split(",")[0]}</div>
              <div style={{ fontSize: 20, margin: "4px 0" }}>{wmo(f.code).icon}</div>
              <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{f.max}°</div>
              <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{f.min}°</div>
            </div>
          ))}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "3/5", gridRow: "2/3" }}>
        <div className="terminal-header mb-3">⚠️ Market Weather Alerts</div>
        <div className="flex flex-col gap-2">
          {loading ? (
            <div className="text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>Loading weather data...</div>
          ) : (
            CITIES.map(c => {
              const w = weather[c.name];
              if (!w) return null;
              const alerts = [];
              if (w.temp > 38) alerts.push({ msg: "Extreme heat may affect energy demand", color: "#f85149" });
              if (w.temp < -10) alerts.push({ msg: "Extreme cold driving heating demand", color: "#4444ff" });
              if (w.wind > 40) alerts.push({ msg: "High winds may disrupt operations", color: "#e3b341" });
              if ([95, 99, 82].includes(w.code)) alerts.push({ msg: "Severe storms reported", color: "#f85149" });
              if (alerts.length === 0) return null;
              return alerts.map((alert, i) => (
                <div key={c.name + i} className="flex items-start gap-2 p-2 rounded" style={{ background: "#0d1117", border: "1px solid #1a0a0a" }}>
                  <span className="text-xs" style={{ color: alert.color }}>⚠</span>
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{c.flag} {c.name}</div>
                    <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{alert.msg}</div>
                  </div>
                </div>
              ));
            })
          )}
          {!loading && CITIES.every(c => {
            const w = weather[c.name];
            if (!w) return true;
            return w.temp <= 38 && w.temp >= -10 && w.wind <= 40 && ![95,99,82].includes(w.code);
          }) && (
            <div className="text-xs font-mono" style={{ color: "#7d8590" }}>✓ No significant weather alerts across major financial centers</div>
          )}
        </div>
      </div>
    </div>
  );
}



function AnalystData({ ticker }) {
  const [data, setData] = useState(null);
  const [targets, setTargets] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [insider, setInsider] = useState(null);

  useEffect(() => {
    Promise.all([
      api("/stock/recommendation?symbol=" + ticker),
      api("/stock/price-target?symbol=" + ticker),
      api("/stock/earnings?symbol=" + ticker + "&limit=4"),
      api("/stock/insider-transactions?symbol=" + ticker),
    ]).then(([rec, tgt, earn, ins]) => {
      setData(rec?.[0] || null);
      setTargets(tgt || null);
      setEarnings(earn?.data?.slice(0, 4) || []);
      setInsider(ins?.data?.slice(0, 6) || []);
    }).catch(() => {});
  }, [ticker]);

  const total = data ? (data.buy + data.hold + data.sell + data.strongBuy + data.strongSell) : 0;
  const bullPct = total ? Math.round(((data.buy + data.strongBuy) / total) * 100) : 0;
  const bearPct = total ? Math.round(((data.sell + data.strongSell) / total) * 100) : 0;
  const holdPct = total ? Math.round((data.hold / total) * 100) : 0;

  return (
    <div className="h-full grid gap-2" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
      
      <div>
        <div className="terminal-header mb-2">📊 Analyst Ratings</div>
        {!data ? <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Loading...</div> : (
          <div>
            <div className="flex gap-1 mb-2" style={{ height: 8, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: bullPct + "%", background: "#3fb950" }} />
              <div style={{ width: holdPct + "%", background: "#e3b341" }} />
              <div style={{ width: bearPct + "%", background: "#f85149" }} />
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[["Strong Buy", data.strongBuy, "#3fb950"], ["Buy", data.buy, "#3fb950"], ["Hold", data.hold, "#e3b341"], ["Sell", data.sell, "#f85149"], ["Strong Sell", data.strongSell, "#f85149"]].map(([l, v, c]) => (
                <div key={l} className="p-1 rounded" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                  <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{l}</div>
                  <div className="text-sm font-mono font-bold" style={{ color: c }}>{v}</div>
                </div>
              ))}
              <div className="p-1 rounded" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Period</div>
                <div className="text-xs font-mono" style={{ color: "#e6edf3" }}>{data.period}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="terminal-header mb-2">🎯 Price Targets</div>
        {!targets ? <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Loading...</div> : 
         !targets.targetMean ? <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Not available on free tier</div> : (
          <div className="flex flex-col gap-1">
            {[["High", targets.targetHigh, "#3fb950"], ["Average", targets.targetMean, "#58a6ff"], ["Low", targets.targetLow, "#f85149"], ["Updated", targets.lastUpdated, "#7d8590"]].map(([l, v, c]) => (
              <div key={l} className="flex justify-between py-1" style={{ borderBottom: "1px solid #21262d" }}>
                <span className="text-xs font-mono" style={{ color: "#7d8590" }}>{l}</span>
                <span className="text-xs font-mono font-bold" style={{ color: c }}>{l === "Updated" ? v?.slice(0,10) : v ? "$" + v.toFixed(2) : "N/A"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ overflowY: "auto" }}>
        <div className="terminal-header mb-2">📈 Earnings Surprises</div>
        {!earnings ? <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Loading...</div> : (
          <div className="flex flex-col gap-1">
            {earnings.map((e, i) => {
              const surprise = e.actual - e.estimate;
              const pct = e.estimate ? (surprise / Math.abs(e.estimate) * 100).toFixed(1) : 0;
              return (
                <div key={i} className="flex justify-between items-center py-1" style={{ borderBottom: "1px solid #21262d" }}>
                  <span className="text-xs font-mono" style={{ color: "#7d8590" }}>{e.period}</span>
                  <span className="text-xs font-mono" style={{ color: "#7d8590" }}>Est: ${e.estimate?.toFixed(2)}</span>
                  <span className="text-xs font-mono" style={{ color: "#e6edf3" }}>Act: ${e.actual?.toFixed(2)}</span>
                  <span className="text-xs font-mono font-bold" style={{ color: surprise >= 0 ? "#3fb950" : "#f85149" }}>{surprise >= 0 ? "+" : ""}{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ overflowY: "auto" }}>
        <div className="terminal-header mb-2">🏦 Insider Transactions</div>
        {!insider ? <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Loading...</div> : (
          <div className="flex flex-col gap-1">
            {insider.map((t, i) => (
              <div key={i} className="flex justify-between items-center py-1" style={{ borderBottom: "1px solid #21262d" }}>
                <div>
                  <div className="text-xs font-mono" style={{ color: "#e6edf3" }}>{t.name?.split(" ").slice(-1)[0]}</div>
                  <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{t.transactionDate}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold" style={{ color: t.change > 0 ? "#3fb950" : "#f85149" }}>
                    {t.change > 0 ? "BUY" : "SELL"} {Math.abs(t.change).toLocaleString()}
                  </div>
                  <div className="text-xs font-mono" style={{ color: "#7d8590" }}>${t.transactionPrice?.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function PeerComparison({ ticker, metrics, quote }) {
  const [peers, setPeers] = useState([]);
  const [peerData, setPeerData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/stock/peers?symbol=" + ticker)
      .then(p => {
        const peerList = (p || []).slice(0, 6);
        setPeers(peerList);
        return Promise.all(
          peerList.map((s, i) =>
            delay(i * 300).then(() =>
              Promise.all([
                api("/quote?symbol=" + s),
                api("/stock/metric?symbol=" + s + "&metric=all"),
              ]).then(([q, m]) => [s, { quote: q, metrics: m }])
            )
          )
        );
      })
      .then(results => {
        setPeerData(Object.fromEntries(results));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticker]); // eslint-disable-line

  const allTickers = [ticker, ...peers.filter(p => p !== ticker)];
  const allData = {
    [ticker]: { quote, metrics },
    ...peerData,
  };

  const METRICS = [
    { label: "Price", fn: (q, m) => q?.c ? "$" + fmt.price(q.c) : "N/A", compare: false },
    { label: "Change %", fn: (q, m) => q?.dp ? fmt.pct(q.dp) : "N/A", compare: true, higher: true },
    { label: "Market Cap", fn: (q, m) => m?.metric?.marketCapitalization ? fmt.large(m.metric.marketCapitalization * 1e6) : "N/A", compare: false },
    { label: "P/E (TTM)", fn: (q, m) => m?.metric?.peBasicExclExtraTTM ? m.metric.peBasicExclExtraTTM.toFixed(1) : "N/A", compare: true, higher: false },
    { label: "Fwd P/E", fn: (q, m) => m?.metric?.peExclExtraAnnual ? m.metric.peExclExtraAnnual.toFixed(1) : "N/A", compare: true, higher: false },
    { label: "EPS (TTM)", fn: (q, m) => m?.metric?.epsBasicExclExtraItemsTTM ? "$" + m.metric.epsBasicExclExtraItemsTTM.toFixed(2) : "N/A", compare: true, higher: true },
    { label: "Revenue TTM", fn: (q, m) => m?.metric?.revenuePerShareTTM ? fmt.large(m.metric.revenuePerShareTTM * (m.metric.marketCapitalization || 0) / (m.metric?.["52WeekHigh"] || 1)) : (m?.metric?.revenue ? fmt.large(m.metric.revenue) : "N/A"), compare: false },
    { label: "Gross Margin", fn: (q, m) => m?.metric?.grossMarginTTM ? m.metric.grossMarginTTM.toFixed(1) + "%" : "N/A", compare: true, higher: true },
    { label: "Net Margin", fn: (q, m) => m?.metric?.netProfitMarginTTM ? m.metric.netProfitMarginTTM.toFixed(1) + "%" : "N/A", compare: true, higher: true },
    { label: "ROE", fn: (q, m) => m?.metric?.roeTTM ? m.metric.roeTTM.toFixed(1) + "%" : "N/A", compare: true, higher: true },
    { label: "Beta", fn: (q, m) => m?.metric?.beta ? m.metric.beta.toFixed(2) : "N/A", compare: false },
    { label: "Div Yield", fn: (q, m) => m?.metric?.dividendYieldIndicatedAnnual ? m.metric.dividendYieldIndicatedAnnual.toFixed(2) + "%" : "N/A", compare: true, higher: true },
    { label: "52W High", fn: (q, m) => m?.metric?.["52WeekHigh"] ? "$" + fmt.price(m.metric["52WeekHigh"]) : "N/A", compare: false },
    { label: "52W Low", fn: (q, m) => m?.metric?.["52WeekLow"] ? "$" + fmt.price(m.metric["52WeekLow"]) : "N/A", compare: false },
    { label: "Price/Book", fn: (q, m) => m?.metric?.pbAnnual ? m.metric.pbAnnual.toFixed(1) : "N/A", compare: true, higher: false },
  ];

  const getBest = (metric, tickers, data) => {
    if (!metric.compare) return null;
    let best = null;
    let bestVal = metric.higher ? -Infinity : Infinity;
    tickers.forEach(t => {
      const d = data[t];
      if (!d) return;
      const raw = metric.fn(d.quote, d.metrics);
      const num = parseFloat(raw.replace(/[$%,]/g, ""));
      if (isNaN(num)) return;
      if (metric.higher ? num > bestVal : num < bestVal) {
        bestVal = num;
        best = t;
      }
    });
    return best;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>
      Loading peer data...
    </div>
  );

  return (
    <div style={{ overflowX: "auto", overflowY: "auto", height: "100%" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace", minWidth: 600 }}>
        <thead>
          <tr style={{ position: "sticky", top: 0, background: "#161b22", zIndex: 1 }}>
            <th style={{ textAlign: "left", padding: "6px 10px", color: "#7d8590", fontWeight: 500, borderBottom: "2px solid #30363d", minWidth: 120 }}>Metric</th>
            {allTickers.map(t => (
              <th key={t} style={{ textAlign: "right", padding: "6px 10px", borderBottom: "2px solid #30363d", minWidth: 90, color: t === ticker ? "#58a6ff" : "#7d8590", fontWeight: t === ticker ? 700 : 500 }}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map(m => {
            const best = getBest(m, allTickers, allData);
            return (
              <tr key={m.label} style={{ borderBottom: "1px solid #21262d" }}
                onMouseEnter={e => e.currentTarget.style.background = "#161b22"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "5px 10px", color: "#7d8590", fontWeight: 500 }}>{m.label}</td>
                {allTickers.map(t => {
                  const d = allData[t];
                  const val = d ? m.fn(d.quote, d.metrics) : "...";
                  const isBest = best === t;
                  const isMain = t === ticker;
                  return (
                    <td key={t} style={{ textAlign: "right", padding: "5px 10px", color: isBest ? "#3fb950" : isMain ? "#e6edf3" : "#7d8590", fontWeight: isMain ? 600 : 400, background: isBest ? "rgba(63,185,80,0.05)" : "transparent" }}>
                      {val}
                      {isBest && " ★"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TickerTape = memo(function TickerTape({ tapeData }) {
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
            <span style={{ color: "#7d8590", fontWeight: 600 }}>{t.symbol}</span>
            <span style={{ color: "#e6edf3" }}>${fmt.price(t.price)}</span>
            <span style={{ color: clr(t.changePct) }}>{t.changePct >= 0 ? "▲" : "▼"}{Math.abs(t.changePct || 0).toFixed(2)}%</span>
            <span style={{ color: "#21262d", marginLeft: 8 }}>|</span>
          </span>
        ))}
      </div>
    </div>
  );
});

function TopNav({ ticker, setTicker, quote, loading, onSettingsClick }) {
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
        <Zap size={14} style={{ color: "#58a6ff" }} />
        <span className="logo-text" style={{ fontSize: 12 }}>OMNES VIDENTES</span>
      </div>

      <div className="flex items-center gap-2 px-2 py-1.5"
        style={{ background: "#0d1117", border: "1px solid " + (focused ? "#1f6feb" : "#30363d"),
          borderRadius: 5, transition: "border-color 0.15s", minWidth: 220, maxWidth: 300 }}>
        <Search size={11} style={{ color: "#7d8590", flexShrink: 0 }} />
        <input
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === "Enter") setTicker(input.trim()); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ticker… (Enter to load)"
          style={{ background: "transparent", border: "none", color: "#e6edf3", fontSize: 12,
            fontFamily: "'IBM Plex Mono', monospace", outline: "none", width: "100%" }}
        />
      </div>

      {quote ? (
        <div className="flex items-center gap-3" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          <span style={{ color: "#e6edf3", fontWeight: 700, fontSize: 14 }}>{ticker}</span>
          <span style={{ color: "#e6edf3", fontSize: 16, fontWeight: 600 }}>${fmt.price(quote.c)}</span>
          <span className="flex items-center gap-1" style={{ color: clr(quote.dp), background: bg(quote.dp),
            fontSize: 12, padding: "2px 8px", borderRadius: 4 }}>
            {quote.dp >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {fmt.change(quote.d)} ({fmt.pct(quote.dp)})
          </span>
          <span style={{ color: "#484f58", fontSize: 11 }}>Vol {fmt.volume(quote.v > 0 ? quote.v : null)}</span>
          <span style={{ color: "#484f58", fontSize: 11 }}>O {fmt.price(quote.o)}</span>
          <span style={{ color: "#484f58", fontSize: 11 }}>H {fmt.price(quote.h)}</span>
          <span style={{ color: "#484f58", fontSize: 11 }}>L {fmt.price(quote.l)}</span>
        </div>
      ) : loading ? (
        <span style={{ color: "#e3b341", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>● Loading {ticker}…</span>
      ) : null}

      <div className="ml-auto flex items-center gap-3" style={{ flexShrink: 0 }}>
        <button onClick={handleRefresh} title="Refresh data" style={{ color: "#7d8590", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <RefreshCw size={13} />
        </button>
        <button onClick={onSettingsClick} title="Settings" style={{ color: "#7d8590", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Settings size={13} />
        </button>
        <div style={{ width: 1, height: 14, background: "#21262d" }} />
        <span style={{ color: "#484f58", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>LIVE</span>
        <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", display: "inline-block" }} />
      </div>
    </div>
  );
}

const TIMEFRAMES = ["1W", "1M", "3M", "1Y"];
const TF_CFG = {
  "1W": { range: "5d",  interval: "1h",  days: 7   },
  "1M": { range: "1mo", interval: "1d",  days: 30  },
  "3M": { range: "3mo", interval: "1d",  days: 90  },
  "1Y": { range: "1y",  interval: "1d",  days: 365 },
};

// Candlestick bar rendered as a custom Recharts shape
function CandlestickBar(props) {
  const { x, y, width, payload } = props;
  if (!payload || payload.open == null) return null;
  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? "#3fb950" : "#f85149";
  const bodyTop    = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const bodyH = Math.max(1, bodyBottom - bodyTop);
  const cx = x + width / 2;
  // y scale: props gives us the Y coordinate of the bar's "value", which is the high.
  // We get yScale via the scaleLinear from recharts internal.
  // Instead we rely on the parent ComposedChart's YAxis domain being set to [minL, maxH].
  // The "y" prop here is the pixel top of the bar rect — recharts computes it from the dataKey.
  // We use a custom approach: pass yScale via the shape function's numeric props.
  // recharts passes: x (left edge), y (pixel top of high), width, height (pixel span high→low)
  const totalH = props.height; // pixel height from high to low
  if (totalH <= 0 || isNaN(totalH)) return null;
  const domainSpan = high - low;
  if (domainSpan <= 0) return null;
  const pxPerUnit = totalH / domainSpan;
  const bodyTopPx    = y + (high - bodyBottom) * pxPerUnit;
  const bodyH_px     = Math.max(1, bodyH * pxPerUnit);
  const wickTopPx    = y;
  const wickBottomPx = y + totalH;
  return (
    <g>
      {/* Wick */}
      <line x1={cx} y1={wickTopPx} x2={cx} y2={wickBottomPx} stroke={color} strokeWidth={1} />
      {/* Body */}
      <rect x={x + 1} y={bodyTopPx} width={Math.max(1, width - 2)} height={bodyH_px}
        fill={isUp ? "rgba(63,185,80,0.85)" : "rgba(248,81,73,0.85)"}
        stroke={color} strokeWidth={0.5} />
    </g>
  );
}

function useOHLC(ticker, tf) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { range, interval } = TF_CFG[tf] || TF_CFG["3M"];
    fetchChart(ticker, range, interval).then(d => {
      if (cancelled) return;
      const result = d?.chart?.result?.[0];
      if (result) {
        const q       = result.indicators.quote[0];
        const ts      = result.timestamp || [];
        const closes  = q.close  || [];
        const opens   = q.open   || [];
        const highs   = q.high   || [];
        const lows    = q.low    || [];
        const volumes = q.volume || [];
        const raw = ts.map((t, i) => ({
          ts:    t,
          date:  new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          close:  closes[i]  != null ? +closes[i].toFixed(4)  : null,
          open:   opens[i]   != null ? +opens[i].toFixed(4)   : null,
          high:   highs[i]   != null ? +highs[i].toFixed(4)   : null,
          low:    lows[i]    != null ? +lows[i].toFixed(4)    : null,
          volume: volumes[i] || 0,
        })).filter(d => d.close != null && d.open != null && d.high != null && d.low != null);

        // SMA-20 on close
        raw.forEach((item, i) => {
          if (i >= 19) {
            const slice = raw.slice(i - 19, i + 1);
            item.sma20 = +(slice.reduce((s, x) => s + x.close, 0) / 20).toFixed(4);
          }
        });

        setData(raw);
      }
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, tf]);

  return { data, loading };
}

function ChartTypeBtn({ value, active, onClick, children }) {
  return (
    <button onClick={() => onClick(value)} className="font-mono"
      style={{ padding:"2px 8px", fontSize:10, borderRadius:3, border:"1px solid",
        background: active ? "#0c2044" : "transparent",
        borderColor: active ? "#58a6ff" : "#21262d",
        color: active ? "#58a6ff" : "#7d8590", cursor:"pointer" }}>
      {children}
    </button>
  );
}

function UniversalChart({ ticker, height = 220, showVolume = false, colorUp = "#3fb950", colorDown = "#f85149", defaultType = "area", defaultTf = "3M", prefix = "$", decimals = 2, label }) {
  const [tf,        setTf]        = useState(defaultTf);
  const [chartType, setChartType] = useState(defaultType);
  const { data, loading } = useOHLC(ticker, tf);

  const startC  = data[0]?.close  || 0;
  const endC    = data[data.length - 1]?.close || 0;
  const chg     = endC - startC;
  const pct     = startC ? (chg / startC) * 100 : 0;
  const lc      = chg >= 0 ? colorUp : colorDown;
  const allLows  = data.map(d => d.low);
  const allHighs = data.map(d => d.high);
  const minP = data.length ? Math.min(...allLows)  * 0.9995 : 0;
  const maxP = data.length ? Math.max(...allHighs) * 1.0005 : 0;
  const xi   = Math.max(1, Math.floor(data.length / 6));
  const gradId = "ucg_" + ticker.replace(/[^a-z0-9]/gi, "") + "_" + tf;
  const tooltipStyle = { background:"#0d1117", border:"1px solid #21262d", borderRadius:4, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" };
  const tickStyle    = { fill:"#484f58", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" };
  const fmt2 = v => v != null ? prefix + (+v).toFixed(decimals) : "—";

  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#161b22" vertical={false} />
      <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} interval={xi} />
      <YAxis domain={[minP, maxP]} tick={tickStyle} tickLine={false} axisLine={false}
        tickFormatter={v => prefix + v.toFixed(decimals <= 2 ? 0 : decimals)} width={decimals > 2 ? 68 : 52} />
      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color:"#7d8590" }}
        formatter={(v, name) => [fmt2(v), name]} />
    </>
  );

  const renderChart = () => {
    if (chartType === "candle") {
      return (
        <ComposedChart data={data} margin={{ top:4, right:2, left:0, bottom:0 }}>
          {commonAxes}
          {/* Candlestick via Bar with custom shape */}
          <Bar dataKey="high" shape={<CandlestickBar />} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={d.close >= d.open ? colorUp : colorDown} />)}
          </Bar>
          {data.some(d => d.sma20) && (
            <Line type="monotone" dataKey="sma20" stroke="#e3b341" strokeWidth={1} dot={false} isAnimationActive={false} name="SMA 20" connectNulls />
          )}
        </ComposedChart>
      );
    }
    if (chartType === "line") {
      return (
        <ComposedChart data={data} margin={{ top:4, right:2, left:0, bottom:0 }}>
          {commonAxes}
          <Line type="monotone" dataKey="close" stroke={lc} strokeWidth={1.5} dot={false} isAnimationActive={false} name="Price" />
          {data.some(d => d.sma20) && (
            <Line type="monotone" dataKey="sma20" stroke="#e3b341" strokeWidth={1} dot={false} isAnimationActive={false} name="SMA 20" connectNulls strokeDasharray="4 2" />
          )}
        </ComposedChart>
      );
    }
    // area (default)
    return (
      <ComposedChart data={data} margin={{ top:4, right:2, left:0, bottom:0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={lc} stopOpacity={0.18} />
            <stop offset="95%" stopColor={lc} stopOpacity={0}    />
          </linearGradient>
        </defs>
        {commonAxes}
        <Area type="monotone" dataKey="close" stroke={lc} strokeWidth={1.5} fill={"url(#" + gradId + ")"} dot={false} isAnimationActive={false} name="Price" />
        {data.some(d => d.sma20) && (
          <Line type="monotone" dataKey="sma20" stroke="#e3b341" strokeWidth={1} dot={false} isAnimationActive={false} name="SMA 20" connectNulls strokeDasharray="4 2" />
        )}
      </ComposedChart>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls row */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <div className="flex items-center gap-2">
          {label && <span className="font-mono" style={{ color:"#7d8590", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</span>}
          {data.length > 0 && (
            <span className="font-mono" style={{ fontSize:10, color:lc, background:lc+"18", border:"1px solid "+lc+"33", borderRadius:3, padding:"1px 6px" }}>
              {chg >= 0 ? "+" : ""}{fmt2(chg)} ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%) {tf}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Chart type */}
          <div className="flex gap-1">
            <ChartTypeBtn value="area"   active={chartType==="area"}   onClick={setChartType}>Area</ChartTypeBtn>
            <ChartTypeBtn value="line"   active={chartType==="line"}   onClick={setChartType}>Line</ChartTypeBtn>
            <ChartTypeBtn value="candle" active={chartType==="candle"} onClick={setChartType}>Candle</ChartTypeBtn>
          </div>
          {/* Timeframe */}
          <div className="flex overflow-hidden rounded" style={{ border:"1px solid #21262d" }}>
            {TIMEFRAMES.map(t => (
              <button key={t} onClick={() => setTf(t)} className="font-mono"
                style={{ padding:"2px 8px", fontSize:10, background:tf===t?"#0c2044":"transparent", color:tf===t?"#58a6ff":"#7d8590", borderRight:"1px solid #21262d", cursor:"pointer" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Chart area */}
      <div style={{ flex:1, minHeight: height }}>
        {loading ? (
          <div className="flex items-center justify-center h-full font-mono" style={{ color:"#484f58", fontSize:11 }}>Loading…</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-full font-mono" style={{ color:"#484f58", fontSize:11 }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>
      {/* Volume bar (optional) */}
      {showVolume && !loading && data.length > 0 && (
        <div style={{ height:36, marginTop:2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top:0, right:2, left:0, bottom:0 }}>
              <YAxis hide domain={[0,"auto"]} />
              <Bar dataKey="volume" isAnimationActive={false} radius={[1,1,0,0]}>
                {data.map((d, i) => <Cell key={i} fill={d.close >= d.open ? "rgba(63,185,80,0.5)" : "rgba(248,81,73,0.5)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function PriceChart({ ticker }) {
  return <UniversalChart ticker={ticker} height={200} showVolume defaultTf="3M" label="Price Chart" />;
}

function KeyMetrics({ quote, metrics }) {
  if (!quote || !metrics) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading metrics...</div>;
  const m = metrics.metric || {};
  const high = m["52WeekHigh"] || quote.c;
  const low = m["52WeekLow"] || quote.c;
  const pct = ((quote.c - low) / (high - low) * 100).toFixed(1);
  const rows1 = [["Current Price", "$" + fmt.price(quote.c)], ["52W High", m["52WeekHigh"] ? "$" + fmt.price(m["52WeekHigh"]) : "N/A"], ["52W Low", m["52WeekLow"] ? "$" + fmt.price(m["52WeekLow"]) : "N/A"], ["Market Cap", m.marketCapitalization ? fmt.large(m.marketCapitalization * 1e6) : "N/A"], ["Volume", fmt.volume(quote.v)], ["Avg Vol", m["10DayAverageTradingVolume"] ? fmt.volume(m["10DayAverageTradingVolume"] * 1e6) : "N/A"]];
  const rows2 = [["Trailing P/E", m.peBasicExclExtraTTM ? m.peBasicExclExtraTTM.toFixed(1) : "N/A"], ["Forward P/E", m.peExclExtraAnnual ? m.peExclExtraAnnual.toFixed(1) : "N/A"], ["EPS (TTM)", m.epsBasicExclExtraItemsTTM ? "$" + m.epsBasicExclExtraItemsTTM.toFixed(2) : "N/A"], ["Beta", m.beta ? m.beta.toFixed(2) : "N/A"], ["Div Yield", m.dividendYieldIndicatedAnnual ? m.dividendYieldIndicatedAnnual.toFixed(2) + "%" : "N/A"], ["Price/Book", m.pbAnnual ? m.pbAnnual.toFixed(1) : "N/A"]];
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2"><span className="terminal-header"><BarChart2 size={12} /></span><span className="terminal-header">Key Metrics</span></div>
      <div className="grid grid-cols-2 gap-x-6 mt-2">
        <div>{rows1.map(([l, v]) => <div key={l} className="metric-row flex justify-between items-center py-1.5"><span className="text-gray-500 text-xs font-mono">{l}</span><span className="text-gray-200 text-xs font-mono font-semibold">{v}</span></div>)}</div>
        <div>{rows2.map(([l, v]) => <div key={l} className="metric-row flex justify-between items-center py-1.5"><span className="text-gray-500 text-xs font-mono">{l}</span><span className="text-gray-200 text-xs font-mono font-semibold">{v}</span></div>)}</div>
      </div>
      <div className="mt-3">
        <div className="text-xs font-mono text-gray-500 mb-1">52-Week Range</div>
        <div className="relative h-1.5 bg-gray-800 rounded-full">
          <div className="h-full bg-blue-900 rounded-full" style={{ width: pct + "%" }} />
          <div style={{ position: "absolute", top: -2, left: pct + "%", width: 8, height: 8, borderRadius: "50%", background: "#60a5fa", transform: "translateX(-50%)" }} />
        </div>
        <div className="flex justify-between text-xs font-mono text-gray-600 mt-1"><span>${fmt.price(low)}</span><span>${fmt.price(high)}</span></div>
      </div>
    </div>
  );
}

function CompanyProfile({ profile }) {
  if (!profile) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading profile...</div>;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2"><span className="terminal-header"><Building2 size={12} /></span><span className="terminal-header">Company Profile</span></div>
      <div className="grid grid-cols-3 gap-2 mt-2 mb-3">
        {[["Sector", profile.finnhubIndustry], ["Country", profile.country], ["Employees", profile.employeeTotal ? profile.employeeTotal.toLocaleString() : (profile.shareOutstanding ? (profile.shareOutstanding/1000).toFixed(0)+"K shares" : "N/A")], ["Founded", profile.ipo?.split("-")[0]], ["Exchange", profile.exchange], ["Currency", profile.currency]].map(([k, v]) => (
          <div key={k} className="terminal-panel p-1.5"><div className="text-gray-600 text-xs font-mono">{k}</div><div className="text-gray-200 text-xs font-mono font-semibold truncate">{v || "N/A"}</div></div>
        ))}
      </div>
      <div className="flex items-center gap-3 bg-gray-900 rounded p-2">
        {profile.logo && <img src={profile.logo} alt="logo" className="w-8 h-8 rounded object-contain bg-white p-0.5" />}
        <div><div className="text-gray-200 text-xs font-mono font-semibold">{profile.name}</div><a href={profile.weburl} target="_blank" rel="noreferrer" className="text-blue-400 text-xs font-mono hover:underline">{profile.weburl}</a></div>
        <div className="ml-auto text-right"><div className="text-gray-400 text-xs font-mono">{fmt.large((profile.marketCapitalization || 0) * 1e6)}</div><div className="text-gray-600 text-xs font-mono">Mkt Cap</div></div>
      </div>
    </div>
  );
}

const sentimentStyle = {
  bullish: { color: "#3fb950", bg: "rgba(63,185,80,0.1)", label: "BULLISH" },
  bearish: { color: "#f85149", bg: "rgba(248,81,73,0.1)", label: "BEARISH" },
  neutral: { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", label: "NEUTRAL" },
};
function getSentiment(headline) {
  const h = headline.toLowerCase();
  if (["beat", "record", "surge", "growth", "profit", "gain", "rise", "strong", "buy", "upgrade"].some(w => h.includes(w))) return "bullish";
  if (["miss", "fall", "drop", "loss", "weak", "cut", "probe", "lawsuit", "fine", "sell", "downgrade"].some(w => h.includes(w))) return "bearish";
  return "neutral";
}

function NewsFeed({ news }) {
  if (!news) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading news...</div>;
  return (
    <div className="flex flex-col gap-2">
      {news.slice(0, 6).map((n, i) => {
        const s = sentimentStyle[getSentiment(n.headline)];
        return (
          <a key={i} href={n.url} target="_blank" rel="noreferrer" className="news-card block p-2.5">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-xs font-mono text-gray-200 leading-snug">{n.headline}</span>
              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: s.color, background: s.bg }}>{s.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-xs font-mono">{n.source}</span>
              <span className="text-gray-700">·</span>
              <span className="text-gray-600 text-xs font-mono">{Math.floor((Date.now()/1000 - n.datetime)/3600)}h ago</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

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

function FinancialStatements({ ticker }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState("income");
  const [data, setData] = useState(null);
  useEffect(() => {
    api("/stock/financials-reported?symbol=" + ticker + "&freq=quarterly").then(d => setData(d.data?.slice(0,40) || []));
  }, [ticker]);
  const tabs = [{ key: "income", label: "Income Stmt" }, { key: "balance", label: "Balance Sheet" }, { key: "cashflow", label: "Cash Flow" }];
  const find = (arr, key) => arr?.find(x=>x.concept.includes(key))?.value/1e9||0;
  const extractIC = r => ({ revenue: find(r?.ic,"RevenueFromContractWithCustomer"), netIncome: find(r?.ic,"NetIncomeLoss"), grossProfit: find(r?.ic,"GrossProfit") });
  const extractBS = r => ({ totalAssets: find(r?.bs,"Assets"), totalLiabilities: find(r?.bs,"Liabilities"), cash: find(r?.bs,"CashAndCashEquivalentsAtCarryingValue") });
  const extractCF = r => ({ operatingCF: find(r?.cf,"NetCashProvidedByUsedInOperatingActivities"), capEx: find(r?.cf,"PaymentsToAcquirePropertyPlantAndEquipment") });
  if (!data) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading financials...</div>;
  const getQuarter = (d) => {
    const end = d.endDate || d.startDate || d.filed || "";
    const date = new Date(end);
    const month = date.getMonth() + 1;
    const yr = date.getFullYear();
    if (month <= 3) return "Q1 " + yr;
    if (month <= 6) return "Q2 " + yr;
    if (month <= 9) return "Q3 " + yr;
    return "Q4 " + yr;
  };
  const rows = data.map(d => ({ period: getQuarter(d), ...(tab==="income"?extractIC(d.report):tab==="balance"?extractBS(d.report):extractCF(d.report)) }));
  const colMap = { income: [["revenue","Revenue"],["grossProfit","Gross Profit"],["netIncome","Net Income"]], balance: [["totalAssets","Total Assets"],["totalLiabilities","Total Liab."],["cash","Cash"]], cashflow: [["operatingCF","Operating CF"],["capEx","CapEx"]] };
  const cols = colMap[tab];
  if (expanded) {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: "#0d1117", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid #21262d" }}>
          <div className="flex items-center gap-3">
            <span className="terminal-header">📊 Financial Statements — {ticker}</span>
            <div className="flex">
              {tabs.map(t => <button key={t.key} onClick={()=>setTab(t.key)} className="px-3 py-1 text-xs font-mono border-b-2 transition-colors" style={{ borderBottomColor: tab===t.key?"#58a6ff":"transparent", color: tab===t.key?"#58a6ff":"#7d8590", background:"transparent" }}>{t.label}</button>)}
            </div>
          </div>
          <button onClick={() => setExpanded(false)} style={{ color: "#7d8590", background: "#161b22", border: "1px solid #30363d", borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>✕ Close</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace" }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "#161b22", zIndex: 1 }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#7d8590", fontWeight: 500, borderBottom: "2px solid #30363d", minWidth: 180 }}>Metric ($B)</th>
                {rows.map(r => <th key={r.period} style={{ textAlign: "right", padding: "8px 12px", color: "#7d8590", fontWeight: 500, borderBottom: "2px solid #30363d", minWidth: 100 }}>{r.period}</th>)}
              </tr>
            </thead>
            <tbody>
              {cols.map(([key, label]) => (
                <tr key={key} style={{ borderBottom: "1px solid #21262d" }} onMouseEnter={e => e.currentTarget.style.background="#161b22"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <td style={{ padding: "7px 12px", color: "#7d8590", fontWeight: 500 }}>{label}</td>
                  {rows.map((r, i) => (
                    <td key={i} style={{ textAlign: "right", padding: "7px 12px", color: r[key] < 0 ? "#f85149" : "#e6edf3", fontWeight: 500 }}>
                      {r[key] < 0 ? "-$" + Math.abs(r[key]).toFixed(2) : "$" + (r[key] || 0).toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b mb-2" style={{ borderColor: "#21262d" }}>
        <div className="flex">
          {tabs.map(t => <button key={t.key} onClick={()=>setTab(t.key)} className="px-3 py-1.5 text-xs font-mono border-b-2 transition-colors" style={{ borderBottomColor: tab===t.key?"#58a6ff":"transparent", color: tab===t.key?"#58a6ff":"#7d8590", background:"transparent" }}>{t.label}</button>)}
        </div>
        <button onClick={() => setExpanded(true)} style={{ color: "#7d8590", background: "none", border: "none", cursor: "pointer", fontSize: 10, fontFamily: "monospace", padding: "2px 8px" }}>⤢ Expand</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead><tr><th className="text-left text-gray-600 py-1 pr-3 font-normal">Metric ($B)</th>{rows.map(r=><th key={r.period} className="text-right text-gray-500 py-1 px-2 font-normal">{r.period}</th>)}</tr></thead>
          <tbody>{cols.map(([key,label])=><tr key={key} className="border-t border-gray-800"><td className="text-gray-400 py-1.5 pr-3">{label}</td>{rows.map((r,i)=><td key={i} className="text-right py-1.5 px-2 font-semibold" style={{color:r[key]<0?"#f85149":"#e5e7eb"}}>{r[key]<0?"-$"+Math.abs(r[key]).toFixed(2):"$"+(r[key]||0).toFixed(2)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function QuickStats({ quote, metrics }) {
  if (!quote) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading...</div>;
  const m = metrics?.metric || {};
  const rows = [["Open","$"+fmt.price(quote.o)],["Day High","$"+fmt.price(quote.h)],["Day Low","$"+fmt.price(quote.l)],["Prev Close","$"+fmt.price(quote.pc)],["EPS (TTM)",m.epsBasicExclExtraItemsTTM?"$"+m.epsBasicExclExtraItemsTTM.toFixed(2):"N/A"],["P/E",m.peBasicExclExtraTTM?m.peBasicExclExtraTTM.toFixed(1):"N/A"],["Fwd P/E",m.peExclExtraAnnual?m.peExclExtraAnnual.toFixed(1):"N/A"],["Beta",m.beta?m.beta.toFixed(2):"N/A"],["Mkt Cap",m.marketCapitalization?fmt.large(m.marketCapitalization*1e6):"N/A"],["Div Yield",m.dividendYieldIndicatedAnnual?m.dividendYieldIndicatedAnnual.toFixed(2)+"%":"N/A"],["Price/Book",m.pbAnnual?m.pbAnnual.toFixed(1):"N/A"],["ROE",m.roeTTM?m.roeTTM.toFixed(1)+"%":"N/A"]];
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2"><span className="terminal-header"><Activity size={12} /></span><span className="terminal-header">Quick Stats</span></div>
      <div className="mt-2">{rows.map(([k,v])=><div key={k} className="flex justify-between text-xs font-mono border-b border-gray-800 py-1.5"><span className="text-gray-600">{k}</span><span className="text-gray-200 font-semibold">{v}</span></div>)}</div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// RESEARCH BROWSER
// ─────────────────────────────────────────────────────────────

const RESEARCH_CATALOG = [
  { id: "SPY",           label: "S&P 500 ETF",           type: "equity",    ticker: "SPY",          category: "Indices" },
  { id: "QQQ",           label: "Nasdaq 100 ETF",         type: "equity",    ticker: "QQQ",          category: "Indices" },
  { id: "IWM",           label: "Russell 2000 ETF",       type: "equity",    ticker: "IWM",          category: "Indices" },
  { id: "DIA",           label: "Dow Jones ETF",          type: "equity",    ticker: "DIA",          category: "Indices" },
  { id: "AAPL",          label: "Apple Inc.",             type: "equity",    ticker: "AAPL",         category: "Equities" },
  { id: "MSFT",          label: "Microsoft Corp.",        type: "equity",    ticker: "MSFT",         category: "Equities" },
  { id: "NVDA",          label: "NVIDIA Corp.",           type: "equity",    ticker: "NVDA",         category: "Equities" },
  { id: "GOOGL",         label: "Alphabet Inc.",          type: "equity",    ticker: "GOOGL",        category: "Equities" },
  { id: "AMZN",          label: "Amazon.com",             type: "equity",    ticker: "AMZN",         category: "Equities" },
  { id: "META",          label: "Meta Platforms",         type: "equity",    ticker: "META",         category: "Equities" },
  { id: "TSLA",          label: "Tesla Inc.",             type: "equity",    ticker: "TSLA",         category: "Equities" },
  { id: "JPM",           label: "JPMorgan Chase",         type: "equity",    ticker: "JPM",          category: "Banks" },
  { id: "GS",            label: "Goldman Sachs",          type: "equity",    ticker: "GS",           category: "Banks" },
  { id: "BAC",           label: "Bank of America",        type: "equity",    ticker: "BAC",          category: "Banks" },
  { id: "MS",            label: "Morgan Stanley",         type: "equity",    ticker: "MS",           category: "Banks" },
  { id: "C",             label: "Citigroup",              type: "equity",    ticker: "C",            category: "Banks" },
  { id: "GC=F",          label: "Gold",                   type: "commodity", ticker: "GC=F",         category: "Commodities" },
  { id: "CL=F",          label: "Crude Oil (WTI)",        type: "commodity", ticker: "CL=F",         category: "Commodities" },
  { id: "SI=F",          label: "Silver",                 type: "commodity", ticker: "SI=F",         category: "Commodities" },
  { id: "NG=F",          label: "Natural Gas",            type: "commodity", ticker: "NG=F",         category: "Commodities" },
  { id: "HG=F",          label: "Copper",                 type: "commodity", ticker: "HG=F",         category: "Commodities" },
  { id: "ZW=F",          label: "Wheat",                  type: "commodity", ticker: "ZW=F",         category: "Commodities" },
  { id: "EURUSD=X",      label: "EUR/USD",                type: "fx",        ticker: "EURUSD=X",     category: "FX" },
  { id: "GBPUSD=X",      label: "GBP/USD",                type: "fx",        ticker: "GBPUSD=X",     category: "FX" },
  { id: "USDJPY=X",      label: "USD/JPY",                type: "fx",        ticker: "USDJPY=X",     category: "FX" },
  { id: "USDCNY=X",      label: "USD/CNY",                type: "fx",        ticker: "USDCNY=X",     category: "FX" },
  { id: "DX=F",          label: "US Dollar Index",        type: "fx",        ticker: "DX=F",         category: "FX" },
  { id: "FEDFUNDS",      label: "Fed Funds Rate",         type: "macro",     series: "FEDFUNDS",     category: "Macro" },
  { id: "DGS10",         label: "10-Year Treasury",       type: "macro",     series: "DGS10",        category: "Macro" },
  { id: "DGS2",          label: "2-Year Treasury",        type: "macro",     series: "DGS2",         category: "Macro" },
  { id: "CPIAUCSL",      label: "CPI (Inflation)",        type: "macro",     series: "CPIAUCSL",     category: "Macro" },
  { id: "PCEPI",         label: "PCE Price Index",        type: "macro",     series: "PCEPI",        category: "Macro" },
  { id: "UNRATE",        label: "Unemployment Rate",      type: "macro",     series: "UNRATE",       category: "Macro" },
  { id: "GDP",           label: "US GDP",                 type: "macro",     series: "GDP",          category: "Macro" },
  { id: "T10Y2Y",        label: "Yield Curve (10Y-2Y)",   type: "macro",     series: "T10Y2Y",       category: "Macro" },
  { id: "topic-inflation", label: "Inflation",            type: "topic",                             category: "Topics" },
  { id: "topic-rates",     label: "Interest Rates",       type: "topic",                             category: "Topics" },
  { id: "topic-energy",    label: "Energy Markets",       type: "topic",                             category: "Topics" },
  { id: "topic-credit",    label: "Credit Markets",       type: "topic",                             category: "Topics" },
];

const RELATED_MAP = {
  "SPY":      [{ id:"QQQ", label:"Nasdaq 100 ETF", type:"equity", ticker:"QQQ", category:"Indices" }, { id:"IWM", label:"Russell 2000", type:"equity", ticker:"IWM", category:"Indices" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"topic-rates", label:"Interest Rates", type:"topic", category:"Topics" }],
  "QQQ":      [{ id:"AAPL", label:"Apple", type:"equity", ticker:"AAPL", category:"Equities" }, { id:"MSFT", label:"Microsoft", type:"equity", ticker:"MSFT", category:"Equities" }, { id:"NVDA", label:"NVIDIA", type:"equity", ticker:"NVDA", category:"Equities" }, { id:"topic-rates", label:"Interest Rates", type:"topic", category:"Topics" }],
  "AAPL":     [{ id:"MSFT", label:"Microsoft", type:"equity", ticker:"MSFT", category:"Equities" }, { id:"GOOGL", label:"Alphabet", type:"equity", ticker:"GOOGL", category:"Equities" }, { id:"QQQ", label:"Nasdaq 100", type:"equity", ticker:"QQQ", category:"Indices" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }],
  "MSFT":     [{ id:"AAPL", label:"Apple", type:"equity", ticker:"AAPL", category:"Equities" }, { id:"NVDA", label:"NVIDIA", type:"equity", ticker:"NVDA", category:"Equities" }, { id:"QQQ", label:"Nasdaq 100", type:"equity", ticker:"QQQ", category:"Indices" }],
  "NVDA":     [{ id:"AAPL", label:"Apple", type:"equity", ticker:"AAPL", category:"Equities" }, { id:"QQQ", label:"Nasdaq 100", type:"equity", ticker:"QQQ", category:"Indices" }, { id:"TSLA", label:"Tesla", type:"equity", ticker:"TSLA", category:"Equities" }],
  "TSLA":     [{ id:"NVDA", label:"NVIDIA", type:"equity", ticker:"NVDA", category:"Equities" }, { id:"QQQ", label:"Nasdaq 100", type:"equity", ticker:"QQQ", category:"Indices" }, { id:"CL=F", label:"Crude Oil", type:"commodity", ticker:"CL=F", category:"Commodities" }],
  "JPM":      [{ id:"GS", label:"Goldman Sachs", type:"equity", ticker:"GS", category:"Banks" }, { id:"BAC", label:"Bank of America", type:"equity", ticker:"BAC", category:"Banks" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }],
  "GS":       [{ id:"JPM", label:"JPMorgan", type:"equity", ticker:"JPM", category:"Banks" }, { id:"MS", label:"Morgan Stanley", type:"equity", ticker:"MS", category:"Banks" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }],
  "BAC":      [{ id:"JPM", label:"JPMorgan", type:"equity", ticker:"JPM", category:"Banks" }, { id:"C", label:"Citigroup", type:"equity", ticker:"C", category:"Banks" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }],
  "GC=F":     [{ id:"SI=F", label:"Silver", type:"commodity", ticker:"SI=F", category:"Commodities" }, { id:"EURUSD=X", label:"EUR/USD", type:"fx", ticker:"EURUSD=X", category:"FX" }, { id:"CPIAUCSL", label:"CPI Inflation", type:"macro", series:"CPIAUCSL", category:"Macro" }, { id:"DX=F", label:"USD Index", type:"fx", ticker:"DX=F", category:"FX" }],
  "CL=F":     [{ id:"NG=F", label:"Natural Gas", type:"commodity", ticker:"NG=F", category:"Commodities" }, { id:"HG=F", label:"Copper", type:"commodity", ticker:"HG=F", category:"Commodities" }, { id:"topic-energy", label:"Energy Markets", type:"topic", category:"Topics" }, { id:"EURUSD=X", label:"EUR/USD", type:"fx", ticker:"EURUSD=X", category:"FX" }],
  "NG=F":     [{ id:"CL=F", label:"Crude Oil", type:"commodity", ticker:"CL=F", category:"Commodities" }, { id:"topic-energy", label:"Energy Markets", type:"topic", category:"Topics" }],
  "HG=F":     [{ id:"CL=F", label:"Crude Oil", type:"commodity", ticker:"CL=F", category:"Commodities" }, { id:"GC=F", label:"Gold", type:"commodity", ticker:"GC=F", category:"Commodities" }, { id:"CPIAUCSL", label:"CPI Inflation", type:"macro", series:"CPIAUCSL", category:"Macro" }],
  "EURUSD=X": [{ id:"GBPUSD=X", label:"GBP/USD", type:"fx", ticker:"GBPUSD=X", category:"FX" }, { id:"DX=F", label:"USD Index", type:"fx", ticker:"DX=F", category:"FX" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }],
  "DX=F":     [{ id:"EURUSD=X", label:"EUR/USD", type:"fx", ticker:"EURUSD=X", category:"FX" }, { id:"GC=F", label:"Gold", type:"commodity", ticker:"GC=F", category:"Commodities" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }],
  "GBPUSD=X": [{ id:"EURUSD=X", label:"EUR/USD", type:"fx", ticker:"EURUSD=X", category:"FX" }, { id:"DX=F", label:"USD Index", type:"fx", ticker:"DX=F", category:"FX" }],
  "USDJPY=X": [{ id:"DX=F", label:"USD Index", type:"fx", ticker:"DX=F", category:"FX" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }],
  "FEDFUNDS": [{ id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }, { id:"DGS2", label:"2Y Treasury", type:"macro", series:"DGS2", category:"Macro" }, { id:"T10Y2Y", label:"Yield Curve", type:"macro", series:"T10Y2Y", category:"Macro" }, { id:"topic-rates", label:"Interest Rates", type:"topic", category:"Topics" }],
  "DGS10":    [{ id:"DGS2", label:"2Y Treasury", type:"macro", series:"DGS2", category:"Macro" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"T10Y2Y", label:"Yield Curve", type:"macro", series:"T10Y2Y", category:"Macro" }, { id:"topic-rates", label:"Interest Rates", type:"topic", category:"Topics" }],
  "DGS2":     [{ id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"T10Y2Y", label:"Yield Curve", type:"macro", series:"T10Y2Y", category:"Macro" }],
  "CPIAUCSL": [{ id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }, { id:"GC=F", label:"Gold", type:"commodity", ticker:"GC=F", category:"Commodities" }, { id:"topic-inflation", label:"Inflation", type:"topic", category:"Topics" }],
  "T10Y2Y":   [{ id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }, { id:"DGS2", label:"2Y Treasury", type:"macro", series:"DGS2", category:"Macro" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"topic-credit", label:"Credit Markets", type:"topic", category:"Topics" }],
  "UNRATE":   [{ id:"CPIAUCSL", label:"CPI Inflation", type:"macro", series:"CPIAUCSL", category:"Macro" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"topic-inflation", label:"Inflation", type:"topic", category:"Topics" }],
  "topic-inflation": [{ id:"CPIAUCSL", label:"CPI", type:"macro", series:"CPIAUCSL", category:"Macro" }, { id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"GC=F", label:"Gold", type:"commodity", ticker:"GC=F", category:"Commodities" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }],
  "topic-rates":     [{ id:"FEDFUNDS", label:"Fed Funds Rate", type:"macro", series:"FEDFUNDS", category:"Macro" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }, { id:"T10Y2Y", label:"Yield Curve", type:"macro", series:"T10Y2Y", category:"Macro" }, { id:"JPM", label:"JPMorgan", type:"equity", ticker:"JPM", category:"Banks" }],
  "topic-energy":    [{ id:"CL=F", label:"Crude Oil", type:"commodity", ticker:"CL=F", category:"Commodities" }, { id:"NG=F", label:"Natural Gas", type:"commodity", ticker:"NG=F", category:"Commodities" }, { id:"HG=F", label:"Copper", type:"commodity", ticker:"HG=F", category:"Commodities" }, { id:"EURUSD=X", label:"EUR/USD", type:"fx", ticker:"EURUSD=X", category:"FX" }],
  "topic-credit":    [{ id:"T10Y2Y", label:"Yield Curve", type:"macro", series:"T10Y2Y", category:"Macro" }, { id:"DGS10", label:"10Y Treasury", type:"macro", series:"DGS10", category:"Macro" }, { id:"JPM", label:"JPMorgan", type:"equity", ticker:"JPM", category:"Banks" }, { id:"GS", label:"Goldman Sachs", type:"equity", ticker:"GS", category:"Banks" }],
};

const TOPIC_CONFIG = {
  "topic-inflation": {
    title: "Inflation", icon: "📈",
    desc: "Consumer prices, purchasing power, and monetary policy response.",
    macro: [
      { id:"CPIAUCSL", label:"CPI",          series:"CPIAUCSL" },
      { id:"PCEPI",    label:"PCE",          series:"PCEPI" },
      { id:"FEDFUNDS", label:"Fed Funds",    series:"FEDFUNDS" },
      { id:"DGS10",    label:"10Y Treasury", series:"DGS10" },
    ],
    assets: [
      { id:"GC=F",      label:"Gold",          type:"commodity", ticker:"GC=F",      category:"Commodities" },
      { id:"EURUSD=X",  label:"EUR/USD",        type:"fx",        ticker:"EURUSD=X",  category:"FX" },
      { id:"TIP",       label:"TIP (TIPS ETF)", type:"equity",    ticker:"TIP",       category:"Equities" },
    ],
  },
  "topic-rates": {
    title: "Interest Rates", icon: "📊",
    desc: "Federal Reserve policy, Treasury yields, and the yield curve.",
    macro: [
      { id:"FEDFUNDS", label:"Fed Funds",          series:"FEDFUNDS" },
      { id:"DGS2",     label:"2Y Treasury",        series:"DGS2" },
      { id:"DGS10",    label:"10Y Treasury",       series:"DGS10" },
      { id:"T10Y2Y",   label:"Yield Curve (10-2)", series:"T10Y2Y" },
    ],
    assets: [
      { id:"TLT", label:"TLT (20Y Treasury)", type:"equity", ticker:"TLT", category:"Equities" },
      { id:"SHY", label:"SHY (1-3Y Treasury)", type:"equity", ticker:"SHY", category:"Equities" },
      { id:"JPM", label:"JPMorgan",            type:"equity", ticker:"JPM", category:"Banks" },
    ],
  },
  "topic-energy": {
    title: "Energy Markets", icon: "⚡",
    desc: "Crude oil, natural gas, and energy sector dynamics.",
    macro: [
      { id:"CPIAUCSL", label:"CPI", series:"CPIAUCSL" },
    ],
    assets: [
      { id:"CL=F", label:"Crude Oil (WTI)",  type:"commodity", ticker:"CL=F", category:"Commodities" },
      { id:"NG=F", label:"Natural Gas",       type:"commodity", ticker:"NG=F", category:"Commodities" },
      { id:"HG=F", label:"Copper",            type:"commodity", ticker:"HG=F", category:"Commodities" },
    ],
  },
  "topic-credit": {
    title: "Credit Markets", icon: "🏦",
    desc: "Corporate bonds, credit spreads, and bank lending conditions.",
    macro: [
      { id:"T10Y2Y",   label:"Yield Curve", series:"T10Y2Y" },
      { id:"DGS10",    label:"10Y Treasury", series:"DGS10" },
      { id:"FEDFUNDS", label:"Fed Funds",    series:"FEDFUNDS" },
    ],
    assets: [
      { id:"LQD", label:"LQD (IG Bonds)",        type:"equity", ticker:"LQD", category:"Equities" },
      { id:"HYG", label:"HYG (High Yield Bonds)", type:"equity", ticker:"HYG", category:"Equities" },
      { id:"JPM", label:"JPMorgan",               type:"equity", ticker:"JPM", category:"Banks" },
    ],
  },
};

// Market cap from Finnhub is in millions USD
const fmtMktCap = v => { if (v == null || isNaN(v)) return "—"; if (v >= 1e6) return "$" + (v/1e6).toFixed(2) + "T"; if (v >= 1e3) return "$" + (v/1e3).toFixed(2) + "B"; return "$" + Math.round(v) + "M"; };
const fmtX   = v => v == null || isNaN(v) ? "—" : v.toFixed(1) + "x";
const fmtN   = (v, d=2) => v == null || isNaN(v) ? "—" : (+v).toFixed(d);
const fmtMgn = v => v == null || isNaN(v) ? "—" : (+v).toFixed(1) + "%";
const fmtGr  = v => v == null || isNaN(v) ? "—" : (v >= 0 ? "+" : "") + (+v).toFixed(1) + "%";
const clrM   = v => v == null ? "#7d8590" : v > 0 ? "#3fb950" : "#f85149";

const RB_TYPE_COLOR = { equity:"#58a6ff", commodity:"#e3b341", fx:"#3fb950", macro:"#bc8cff", topic:"#f0883e" };

function ResearchMiniChart({ data, color = "#58a6ff", height = 60 }) {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const gradId = "rg" + color.replace(/[^a-z0-9]/gi, "");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={"url(#" + gradId + ")"} dot={false} isAnimationActive={false} />
        <YAxis domain={["auto","auto"]} hide />
        <Tooltip
          contentStyle={{ background:"#161b22", border:"1px solid #30363d", borderRadius:4, fontSize:10, fontFamily:"'IBM Plex Mono', monospace" }}
          labelFormatter={() => ""}
          formatter={v => [v?.toFixed(4), ""]} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ResearchPanelShell({ title, subtitle, badge, onClose, children }) {
  return (
    <div className="terminal-panel terminal-glow flex flex-col" style={{ minHeight: 340 }}>
      <div className="flex items-center justify-between px-3 pt-3 pb-2" style={{ borderBottom:"1px solid #21262d", flexShrink:0 }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <div className="font-mono font-bold truncate" style={{ color:"#e6edf3", fontSize:13 }}>{title}</div>
            {subtitle && <div className="font-mono truncate" style={{ color:"#7d8590", fontSize:10 }}>{subtitle}</div>}
          </div>
          {badge && (
            <span className="font-mono" style={{ background:"#21262d", border:"1px solid #30363d", borderRadius:3, padding:"1px 6px", fontSize:9, color:"#7d8590", textTransform:"uppercase", letterSpacing:"0.05em", flexShrink:0 }}>
              {badge}
            </span>
          )}
        </div>
        <button onClick={onClose} style={{ color:"#7d8590", background:"none", border:"none", cursor:"pointer", fontSize:14, marginLeft:8, flexShrink:0 }}>✕</button>
      </div>
      <div className="flex flex-col flex-1 p-3">{children}</div>
    </div>
  );
}

function RelatedLinks({ itemId, onOpen }) {
  const links = RELATED_MAP[itemId] || [];
  if (!links.length) return null;
  return (
    <div className="mt-auto pt-2" style={{ borderTop:"1px solid #21262d" }}>
      <div className="font-mono mb-1.5" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Related</div>
      <div className="flex flex-wrap gap-1">
        {links.map(link => (
          <button key={link.id} onClick={() => onOpen(link)} className="font-mono"
            style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:3, padding:"2px 7px", fontSize:10, color:RB_TYPE_COLOR[link.type]||"#7d8590", cursor:"pointer" }}
            onMouseEnter={e => e.currentTarget.style.borderColor="#30363d"}
            onMouseLeave={e => e.currentTarget.style.borderColor="#21262d"}>
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EquityResearchPanel({ item, onClose, onOpen }) {
  const TABS = ["Overview","Financials","Valuation","News","Peers"];
  const [activeTab, setActiveTab] = useState("Overview");
  const [quote, setQuote]         = useState(null);
  const [profile, setProfile]     = useState(null);
  const [metrics, setMetrics]     = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [earnings, setEarnings]   = useState(null);
  const [recs, setRecs]           = useState(null);
  const [pt, setPt]               = useState(undefined); // undefined = not loaded yet
  const [news, setNews]           = useState(null);
  const [peers, setPeers]         = useState(null);
  const [peerQ, setPeerQ]         = useState({});
  const [peerM, setPeerM]         = useState({});
  const loadedTabs = useRef(new Set(["Overview"]));

  // ── Base load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingBase(true);
    setActiveTab("Overview");
    loadedTabs.current = new Set(["Overview"]);
    setEarnings(null); setRecs(null); setPt(undefined);
    setNews(null); setPeers(null); setPeerQ({}); setPeerM({});

    Promise.all([
      api("/quote?symbol=" + item.ticker),
      delay(150).then(() => api("/stock/profile2?symbol=" + item.ticker)),
      delay(300).then(() => api("/stock/metric?symbol=" + item.ticker + "&metric=all")),
      fetch("/api/chart?ticker=" + encodeURIComponent(item.ticker) + "&range=1y&interval=1d")
        .then(r => r.json()).catch(() => null),
    ]).then(([q, p, metaRaw, c]) => {
      setQuote(q);
      setProfile(p || {});
      setMetrics(metaRaw?.metric || null);
      const result = c?.chart?.result?.[0];
      if (result) {
        const ts      = result.timestamp || [];
        const closes  = result.indicators?.quote?.[0]?.close || [];
        const raw = ts.map((t,i) => ({ t, v: closes[i] != null ? +closes[i].toFixed(2) : null })).filter(d => d.v != null);
        const withMA  = raw.map((d,i) => {
          if (i < 49) return d;
          const avg = raw.slice(i-49, i+1).reduce((s,x) => s+x.v, 0) / 50;
          return { ...d, ma50: +avg.toFixed(2) };
        });
        setChartData(withMA);
      }
      setLoadingBase(false);
    }).catch(() => setLoadingBase(false));
  }, [item.ticker]); // eslint-disable-line

  // ── Lazy tab loads ────────────────────────────────────────────────────────
  useEffect(() => {
    if (loadedTabs.current.has(activeTab)) return;
    loadedTabs.current.add(activeTab);

    if (activeTab === "Financials") {
      api("/calendar/earnings?symbol=" + item.ticker)
        .then(d => setEarnings(
          (d?.earningsCalendar || [])
            .filter(e => e.epsActual != null)
            .sort((a,b) => b.date < a.date ? -1 : 1)
            .slice(0, 8)
        ))
        .catch(() => setEarnings([]));
    }
    if (activeTab === "Valuation") {
      Promise.all([
        api("/stock/recommendation?symbol=" + item.ticker),
        delay(150).then(() => api("/stock/price-target?symbol=" + item.ticker)),
      ]).then(([r, p]) => {
        setRecs(Array.isArray(r) ? r : []);
        setPt(p?.targetMean ? p : null);
      }).catch(() => { setRecs([]); setPt(null); });
    }
    if (activeTab === "News") {
      const today = new Date().toISOString().split("T")[0];
      const ago90 = new Date(Date.now() - 90*86400*1000).toISOString().split("T")[0];
      api("/company-news?symbol=" + item.ticker + "&from=" + ago90 + "&to=" + today)
        .then(n => setNews(Array.isArray(n) ? n.slice(0, 12) : []))
        .catch(() => setNews([]));
    }
    if (activeTab === "Peers") {
      api("/stock/peers?symbol=" + item.ticker).then(async list => {
        const p5 = (list || []).filter(x => x !== item.ticker).slice(0, 5);
        setPeers(p5);
        const qMap = {}, mMap = {};
        for (let i = 0; i < p5.length; i++) {
          if (i > 0) await delay(200);
          try {
            const [pq, pm] = await Promise.all([
              api("/quote?symbol=" + p5[i]),
              api("/stock/metric?symbol=" + p5[i] + "&metric=all"),
            ]);
            qMap[p5[i]] = pq; mMap[p5[i]] = pm?.metric || {};
          } catch(e) {}
        }
        setPeerQ({...qMap}); setPeerM({...mMap});
      }).catch(() => setPeers([]));
    }
  }, [activeTab]); // eslint-disable-line

  const m   = metrics || {};
  const up  = quote?.dp >= 0;
  const priceColor = up ? "#3fb950" : "#f85149";

  const pct52 = m["52WeekHigh"] && m["52WeekLow"] && quote?.c
    ? Math.min(100, Math.max(0, ((quote.c - m["52WeekLow"]) / (m["52WeekHigh"] - m["52WeekLow"])) * 100))
    : null;

  // ── Tab renderers ─────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div>
      {/* Company info strip */}
      {profile && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {profile.logo && <img src={profile.logo} alt="" style={{ height:20, width:20, objectFit:"contain", borderRadius:3, background:"#161b22", padding:2 }} />}
          {profile.finnhubIndustry && <span className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>{profile.finnhubIndustry}</span>}
          {profile.exchange         && <span className="font-mono" style={{ color:"#484f58", fontSize:10 }}>· {profile.exchange}</span>}
          {profile.country          && <span className="font-mono" style={{ color:"#484f58", fontSize:10 }}>· {profile.country}</span>}
          {profile.weburl && <a href={profile.weburl} target="_blank" rel="noopener noreferrer" className="font-mono ml-auto" style={{ color:"#1f6feb", fontSize:10 }}>{profile.weburl.replace(/^https?:\/\//,"").replace(/\/$/,"")}</a>}
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns:"1fr 300px" }}>
        {/* Left: price + chart + 52w */}
        <div>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:30 }}>${fmt.price(quote?.c)}</span>
            <span className="font-mono" style={{ color:priceColor, fontSize:14 }}>
              {quote?.d != null ? fmt.change(quote.d) : ""} ({fmt.pct(quote?.dp || 0)})
            </span>
          </div>

          {/* 1Y chart with 50MA */}
          {chartData.length > 0 && (
            <div style={{ height:220, marginBottom:10 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top:4, right:2, bottom:0, left:0 }}>
                  <defs>
                    <linearGradient id={"eqg_" + item.ticker.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={priceColor} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={priceColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t"
                    tickFormatter={t => { const d = new Date(t*1000); return (d.getMonth()+1)+"/"+(d.getDate()); }}
                    tick={{ fill:"#484f58", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }} tickLine={false} axisLine={false} interval={35} />
                  <YAxis domain={["auto","auto"]} hide />
                  <Tooltip
                    contentStyle={{ background:"#161b22", border:"1px solid #30363d", borderRadius:4, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" }}
                    labelFormatter={t => new Date(t*1000).toLocaleDateString()}
                    formatter={(v,n) => [v != null ? "$"+v.toFixed(2) : "—", n==="v" ? "Price" : "MA 50"]} />
                  <Area type="monotone" dataKey="v" stroke={priceColor} strokeWidth={1.5} fill={"url(#eqg_"+item.ticker.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="ma50" stroke="#e3b341" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 52-week range bar */}
          {pct52 != null && (
            <div className="mb-3">
              <div className="flex justify-between font-mono mb-1.5" style={{ color:"#484f58", fontSize:9 }}>
                <span>52W LOW ${fmtN(m["52WeekLow"])}</span>
                <span style={{ color:"#7d8590" }}>52-WEEK RANGE</span>
                <span>${fmtN(m["52WeekHigh"])} 52W HIGH</span>
              </div>
              <div style={{ position:"relative", height:4, background:"#21262d", borderRadius:2 }}>
                <div style={{ position:"absolute", left:0, width:pct52+"%", height:"100%", background: pct52>70?"#3fb950":pct52<30?"#f85149":"#e3b341", borderRadius:2 }} />
                <div style={{ position:"absolute", left:pct52+"%", top:-3, width:2, height:10, background:"#e6edf3", borderRadius:1, transform:"translateX(-50%)" }} />
              </div>
            </div>
          )}

          {/* Company description */}
          {profile?.description && (
            <div className="mt-2">
              <div className="font-mono mb-1" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>About</div>
              <p className="font-mono" style={{ color:"#7d8590", fontSize:10, lineHeight:1.7, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                {profile.description}
              </p>
            </div>
          )}
        </div>

        {/* Right: key stats */}
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Key Statistics</div>
          <div style={{ borderTop:"1px solid #21262d" }}>
            {[
              ["Market Cap",      fmtMktCap(m.marketCapitalization)],
              ["P/E (TTM)",       fmtX(m.peBasicExclExtraTTM)],
              ["P/E (Norm.)",     fmtX(m.peNormalizedAnnual)],
              ["EV/EBITDA",       fmtX(m.evEbitdaTTM)],
              ["Price/Book",      fmtX(m.pbAnnual)],
              ["Price/Sales",     fmtX(m.psAnnual)],
              ["EPS (TTM)",       m.epsBasicExclExtraItemsTTM != null ? "$"+fmtN(m.epsBasicExclExtraItemsTTM) : "—"],
              ["Div Yield",       m.dividendYieldIndicatedAnnual != null ? fmtMgn(m.dividendYieldIndicatedAnnual) : "—"],
              ["Beta",            fmtN(m.beta)],
              ["Gross Margin",    fmtMgn(m.grossMarginTTM)],
              ["Net Margin",      fmtMgn(m.netMarginTTM)],
              ["ROE",             fmtMgn(m.roeTTM)],
              ["Volume",          quote?.v != null ? fmt.volume(quote.v) : "—"],
              ["Avg Vol (10D)",   m["10DayAverageTradingVolume"] != null ? (m["10DayAverageTradingVolume"]).toFixed(2)+"M" : "—"],
              ["Shares Out.",     m.shareOutstanding != null ? fmtMktCap(m.shareOutstanding) : "—"],
            ].map(([k,v]) => (
              <div key={k} className="flex justify-between py-1.5 font-mono" style={{ borderBottom:"1px solid #161b22" }}>
                <span style={{ color:"#7d8590", fontSize:10 }}>{k}</span>
                <span style={{ color:"#e6edf3", fontSize:10 }}>{v || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3"><RelatedLinks itemId={item.id} onOpen={onOpen} /></div>
    </div>
  );

  const renderFinancials = () => (
    <div>
      {/* Profitability + Returns */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns:"1fr 1fr" }}>
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Profitability</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["","Annual","TTM"].map((h,i) => (
                <th key={h} className="font-mono pb-1" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {[
                ["Gross Margin",    m.grossMarginAnnual,    m.grossMarginTTM],
                ["Operating Margin",m.operatingMarginAnnual,m.operatingMarginTTM],
                ["Net Margin",      m.netMarginAnnual,      m.netMarginTTM],
                ["Pretax Margin",   m.pretaxMarginAnnual,   m.pretaxMarginTTM],
              ].map(([k,ann,ttm]) => (
                <tr key={k} style={{ borderTop:"1px solid #161b22" }}>
                  <td className="font-mono py-1.5" style={{ color:"#7d8590", fontSize:10 }}>{k}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:clrM(ann), fontSize:10 }}>{fmtMgn(ann)}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:clrM(ttm), fontSize:10 }}>{fmtMgn(ttm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Returns &amp; Efficiency</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["","Annual","TTM"].map((h,i) => (
                <th key={h} className="font-mono pb-1" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {[
                ["ROE",            m.roeRfy,   m.roeTTM],
                ["ROA",            m.roaRfy,   m.roaTTM],
                ["ROIC",           m.roiAnnual,m.roiTTM],
                ["Asset Turnover", m.assetTurnoverAnnual, m.assetTurnoverTTM],
                ["Inv. Turnover",  m.inventoryTurnoverAnnual, m.inventoryTurnoverTTM],
              ].map(([k,ann,ttm]) => (
                <tr key={k} style={{ borderTop:"1px solid #161b22" }}>
                  <td className="font-mono py-1.5" style={{ color:"#7d8590", fontSize:10 }}>{k}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:clrM(ann), fontSize:10 }}>{fmtMgn(ann)}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:clrM(ttm), fontSize:10 }}>{fmtMgn(ttm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Growth + Balance Sheet */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns:"1fr 1fr" }}>
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Growth</div>
          {[
            ["Rev Growth (QoQ YoY)", m.revenueGrowthQuarterlyYoy],
            ["Rev Growth (TTM YoY)", m.revenueGrowthTTMYoy],
            ["Rev Growth (3Y CAGR)", m.revenueGrowth3Y],
            ["Rev Growth (5Y CAGR)", m.revenueGrowth5Y],
            ["EPS Growth (QoQ YoY)", m.epsGrowthQuarterlyYoy],
            ["EPS Growth (TTM YoY)", m.epsGrowthTTMYoy],
            ["EPS Growth (3Y CAGR)", m.epsGrowth3Y],
            ["EPS Growth (5Y CAGR)", m.epsGrowth5Y],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between py-1.5 font-mono" style={{ borderBottom:"1px solid #161b22" }}>
              <span style={{ color:"#7d8590", fontSize:10 }}>{k}</span>
              <span style={{ color:clrM(v), fontSize:10 }}>{fmtGr(v)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Balance Sheet</div>
          {[
            ["Current Ratio",     fmtN(m.currentRatioAnnual)],
            ["Quick Ratio",       fmtN(m.quickRatioAnnual)],
            ["Debt/Equity",       fmtN(m["totalDebt/totalEquityAnnual"])],
            ["LT Debt/Equity",    fmtN(m["longTermDebt/equityAnnual"])],
            ["Book Value/Share",  m.bookValuePerShareAnnual != null ? "$"+fmtN(m.bookValuePerShareAnnual) : "—"],
            ["Cash/Share",        m.cashPerSharePerShareAnnual != null ? "$"+fmtN(m.cashPerSharePerShareAnnual) : "—"],
            ["FCF/Share (TTM)",   m.freeCashFlowPerShareTTM != null ? "$"+fmtN(m.freeCashFlowPerShareTTM) : "—"],
            ["Net Int. Coverage", fmtN(m.netInterestCoverageAnnual)],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between py-1.5 font-mono" style={{ borderBottom:"1px solid #161b22" }}>
              <span style={{ color:"#7d8590", fontSize:10 }}>{k}</span>
              <span style={{ color:"#e6edf3", fontSize:10 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Earnings history */}
      {earnings === null ? (
        <div className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>Loading earnings history…</div>
      ) : earnings.length > 0 ? (
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Earnings History (Reported)</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:560 }}>
              <thead>
                <tr>{["Quarter","Date","EPS Actual","EPS Est.","Surprise","Rev Actual","Rev Est."].map((h,i) => (
                  <th key={h} className="font-mono pb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right", paddingRight:i===6?0:8 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {earnings.map((e,i) => {
                  const surp = e.epsActual != null && e.epsEstimate ? ((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate)) * 100 : null;
                  return (
                    <tr key={i} style={{ borderTop:"1px solid #161b22" }}>
                      <td className="font-mono py-1.5" style={{ color:"#7d8590", fontSize:10 }}>Q{e.quarter} {e.year}</td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"#484f58", fontSize:10, paddingRight:8 }}>{e.date}</td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:8 }}>${fmtN(e.epsActual)}</td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"#7d8590", fontSize:10, paddingRight:8 }}>${fmtN(e.epsEstimate)}</td>
                      <td className="font-mono py-1.5 text-right" style={{ color: surp != null ? clr(surp) : "#484f58", fontSize:10, paddingRight:8 }}>
                        {surp != null ? (surp>=0?"+":"")+surp.toFixed(1)+"%" : "—"}
                      </td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:8 }}>
                        {e.revenueActual != null ? "$"+(e.revenueActual/1e9).toFixed(2)+"B" : "—"}
                      </td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"#7d8590", fontSize:10 }}>
                        {e.revenueEstimate != null ? "$"+(e.revenueEstimate/1e9).toFixed(2)+"B" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderValuation = () => {
    const latestRec = recs?.[0];
    const total = latestRec ? latestRec.strongBuy + latestRec.buy + latestRec.hold + latestRec.sell + latestRec.strongSell : 0;
    const segments = latestRec ? [
      { label:"Strong Buy", v:latestRec.strongBuy,   color:"#3fb950" },
      { label:"Buy",        v:latestRec.buy,          color:"#7ee787" },
      { label:"Hold",       v:latestRec.hold,         color:"#e3b341" },
      { label:"Sell",       v:latestRec.sell,         color:"#ffa198" },
      { label:"Strong Sell",v:latestRec.strongSell,   color:"#f85149" },
    ] : [];
    const ptLow = pt?.targetLow, ptMean = pt?.targetMean, ptHigh = pt?.targetHigh, ptMed = pt?.targetMedian;
    const cur = quote?.c;
    const ptBarPct = ptLow && ptHigh && cur ? Math.min(100, Math.max(0, ((cur-ptLow)/(ptHigh-ptLow))*100)) : null;
    const meanBarPct = ptLow && ptHigh && ptMean ? ((ptMean-ptLow)/(ptHigh-ptLow))*100 : null;
    const upside = ptMean && cur ? ((ptMean-cur)/cur)*100 : null;
    return (
      <div className="grid gap-4" style={{ gridTemplateColumns:"1fr 1fr" }}>
        {/* Multiples */}
        <div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Valuation Multiples</div>
          {[
            ["P/E (TTM)",          fmtX(m.peBasicExclExtraTTM)],
            ["P/E (Normalized)",   fmtX(m.peNormalizedAnnual)],
            ["EV/EBITDA (Annual)", fmtX(m.evEbitdaAnnual)],
            ["EV/EBITDA (TTM)",    fmtX(m.evEbitdaTTM)],
            ["Price/Sales (Ann.)", fmtX(m.psAnnual)],
            ["Price/Sales (TTM)",  fmtX(m.psTTM)],
            ["Price/Book (Ann.)",  fmtX(m.pbAnnual)],
            ["Price/FCF (Ann.)",   fmtX(m.pfcfShareAnnual)],
            ["Price/FCF (TTM)",    fmtX(m.pfcfShareTTM)],
            ["Price/Cash Flow",    fmtX(m.pcfShareTTM)],
            ["EV/FCF (Ann.)",      fmtX(m["currentEv/freeCashFlowAnnual"])],
            ["EV/FCF (TTM)",       fmtX(m["currentEv/freeCashFlowTTM"])],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between py-1.5 font-mono" style={{ borderBottom:"1px solid #161b22" }}>
              <span style={{ color:"#7d8590", fontSize:10 }}>{k}</span>
              <span style={{ color:"#e6edf3", fontSize:10 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Analyst ratings + PT */}
        <div>
          {recs === null ? (
            <div className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>Loading analyst data…</div>
          ) : latestRec ? (
            <div className="mb-4">
              <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                Analyst Consensus · {latestRec.period?.slice(0,7)} · {total} analysts
              </div>
              {/* Stacked bar */}
              <div style={{ display:"flex", height:14, borderRadius:2, overflow:"hidden", marginBottom:8 }}>
                {segments.filter(s=>s.v>0).map(s => (
                  <div key={s.label} style={{ flex:s.v, background:s.color }} title={s.label+": "+s.v} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {segments.map(s => (
                  <div key={s.label} className="flex items-center gap-1 font-mono" style={{ fontSize:10 }}>
                    <div style={{ width:7, height:7, borderRadius:1, background:s.color, flexShrink:0 }} />
                    <span style={{ color:"#7d8590" }}>{s.label}</span>
                    <span style={{ color:"#e6edf3", fontWeight:"bold" }}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="font-mono mb-4" style={{ color:"#484f58", fontSize:10 }}>No analyst ratings available</div>
          )}

          {/* Price Target */}
          {pt && cur ? (
            <div>
              <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Analyst Price Target</div>
              {upside != null && (
                <div className="font-mono mb-2" style={{ color:clrM(upside), fontSize:13 }}>
                  {upside>=0?"▲":"▼"} {Math.abs(upside).toFixed(1)}% to mean target
                </div>
              )}
              {/* PT range bar */}
              <div className="flex justify-between font-mono mb-1" style={{ fontSize:9, color:"#484f58" }}>
                <span>Low ${fmtN(ptLow)}</span>
                <span>High ${fmtN(ptHigh)}</span>
              </div>
              <div style={{ position:"relative", height:6, background:"#21262d", borderRadius:3, marginBottom:10 }}>
                {ptBarPct != null && (
                  <div style={{ position:"absolute", left:ptBarPct+"%", top:-4, width:12, height:14, borderRadius:2, background:"#58a6ff", transform:"translateX(-50%)", border:"2px solid #010409", zIndex:2 }} title={"Current: $"+fmt.price(cur)} />
                )}
                {meanBarPct != null && (
                  <div style={{ position:"absolute", left:meanBarPct+"%", top:-5, width:2, height:16, background:"#e3b341", transform:"translateX(-50%)", zIndex:1 }} title={"Mean: $"+fmtN(ptMean)} />
                )}
              </div>
              <div className="grid" style={{ gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"4px 0" }}>
                {[["Low","$"+fmtN(ptLow)],["Mean","$"+fmtN(ptMean)],["Median","$"+fmtN(ptMed)],["High","$"+fmtN(ptHigh)]].map(([l,v]) => (
                  <div key={l} className="font-mono">
                    <div style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>{l}</div>
                    <div style={{ color:"#e6edf3", fontSize:12 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : pt === null && recs !== null ? (
            <div className="font-mono" style={{ color:"#484f58", fontSize:10 }}>No price target available</div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderNews = () => {
    if (news === null) return <div className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>Loading news…</div>;
    if (!news.length) return <div className="font-mono" style={{ color:"#484f58", fontSize:10 }}>No recent news found</div>;
    return (
      <div className="flex flex-col gap-2">
        {news.map((n,i) => {
          const ts = n.datetime ? new Date(n.datetime*1000) : null;
          const dAgo = ts ? Math.floor((Date.now()-ts)/86400000) : null;
          const timeStr = dAgo===0?"Today":dAgo===1?"Yesterday":dAgo!=null?dAgo+"d ago":"";
          return (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
              <div className="p-3" style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:4 }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#30363d"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#21262d"}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <span className="font-mono" style={{ color:"#e6edf3", fontSize:11, lineHeight:1.5 }}>{n.headline}</span>
                  <span className="font-mono flex-shrink-0" style={{ color:"#484f58", fontSize:9 }}>{timeStr}</span>
                </div>
                <div className="flex items-center gap-2">
                  {n.source   && <span className="font-mono" style={{ color:"#58a6ff", fontSize:9 }}>{n.source}</span>}
                  {n.category && <span className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>{n.category}</span>}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    );
  };

  const renderPeers = () => {
    const allRows = [
      { ticker:item.ticker, q:quote,  pm:metrics || {}, isSelf:true },
      ...(peers||[]).map(p => ({ ticker:p, q:peerQ[p]||null, pm:peerM[p]||{}, isSelf:false })),
    ];
    if (peers === null) return <div className="font-mono" style={{ color:"#7d8590", fontSize:10 }}>Loading peers…</div>;
    if (!peers.length && allRows.length === 1) return <div className="font-mono" style={{ color:"#484f58", fontSize:10 }}>No peer data available</div>;
    const cols = ["Ticker","Price","Day %","Mkt Cap","P/E","EV/EBITDA","P/S","Gross Mgn","Net Mgn","ROE","Rev Grw"];
    return (
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:800 }}>
          <thead>
            <tr>{cols.map((h,i) => (
              <th key={h} className="font-mono pb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right", paddingRight:i===cols.length-1?0:10, whiteSpace:"nowrap" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {allRows.map(({ ticker, q, pm, isSelf }) => (
              <tr key={ticker} style={{ borderTop:"1px solid #21262d", background:isSelf?"#0d1117":"transparent" }}>
                <td className="font-mono py-2" style={{ color:isSelf?"#58a6ff":"#e6edf3", fontSize:11, fontWeight:isSelf?"bold":"normal" }}>
                  {ticker}
                  {!isSelf && <button onClick={()=>onOpen({id:ticker,label:ticker,type:"equity",ticker,category:"Equities"})}
                    className="font-mono ml-2" style={{ color:"#1f6feb", background:"none", border:"none", cursor:"pointer", fontSize:9 }}>→</button>}
                </td>
                <td className="font-mono py-2 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:10 }}>{q?.c!=null?"$"+fmt.price(q.c):"—"}</td>
                <td className="font-mono py-2 text-right" style={{ color:clr(q?.dp||0), fontSize:10, paddingRight:10 }}>{q?.dp!=null?fmt.pct(q.dp):"—"}</td>
                <td className="font-mono py-2 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:10 }}>{fmtMktCap(pm.marketCapitalization)}</td>
                <td className="font-mono py-2 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:10 }}>{fmtX(pm.peBasicExclExtraTTM)}</td>
                <td className="font-mono py-2 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:10 }}>{fmtX(pm.evEbitdaTTM)}</td>
                <td className="font-mono py-2 text-right" style={{ color:"#e6edf3", fontSize:10, paddingRight:10 }}>{fmtX(pm.psAnnual)}</td>
                <td className="font-mono py-2 text-right" style={{ color:clrM(pm.grossMarginAnnual), fontSize:10, paddingRight:10 }}>{fmtMgn(pm.grossMarginAnnual)}</td>
                <td className="font-mono py-2 text-right" style={{ color:clrM(pm.netMarginAnnual), fontSize:10, paddingRight:10 }}>{fmtMgn(pm.netMarginAnnual)}</td>
                <td className="font-mono py-2 text-right" style={{ color:clrM(pm.roeRfy), fontSize:10, paddingRight:10 }}>{fmtMgn(pm.roeRfy)}</td>
                <td className="font-mono py-2 text-right" style={{ color:clr(pm.revenueGrowthQuarterlyYoy||0), fontSize:10 }}>{fmtGr(pm.revenueGrowthQuarterlyYoy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="terminal-panel terminal-glow flex flex-col" style={{ minHeight:520 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-0" style={{ borderBottom:"1px solid #21262d", flexShrink:0 }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:15 }}>{item.ticker}</span>
          <span className="font-mono" style={{ color:"#7d8590", fontSize:12 }}>{profile?.name || item.label}</span>
          <span className="font-mono" style={{ background:"#21262d", border:"1px solid #30363d", borderRadius:3, padding:"1px 6px", fontSize:9, color:"#58a6ff", textTransform:"uppercase" }}>Equity</span>
          {loadingBase && <span className="font-mono" style={{ color:"#484f58", fontSize:9 }}>Loading…</span>}
        </div>
        <button onClick={onClose} style={{ color:"#7d8590", background:"none", border:"none", cursor:"pointer", fontSize:14, marginLeft:8 }}>✕</button>
      </div>
      {/* Tab nav */}
      <div className="flex px-4" style={{ borderBottom:"1px solid #21262d", flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className="font-mono"
            style={{ background:"none", border:"none", borderBottom:activeTab===t?"2px solid #58a6ff":"2px solid transparent",
              color:activeTab===t?"#e6edf3":"#7d8590", fontSize:11, padding:"8px 14px", cursor:"pointer", transition:"color 0.15s" }}>
            {t}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="flex-1 p-4" style={{ overflowY:"auto" }}>
        {loadingBase
          ? <div className="flex items-center justify-center font-mono" style={{ height:200, color:"#7d8590", fontSize:11 }}>Loading…</div>
          : activeTab==="Overview"   ? renderOverview()
          : activeTab==="Financials" ? renderFinancials()
          : activeTab==="Valuation"  ? renderValuation()
          : activeTab==="News"       ? renderNews()
          : activeTab==="Peers"      ? renderPeers()
          : null}
      </div>
    </div>
  );
}

function MarketResearchPanel({ item, onClose, onOpen }) {
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const isFX = item.type === "fx";
  const decimals = isFX ? 4 : 2;

  useEffect(() => {
    setLoading(true);
    fetch("/api/chart?ticker=" + encodeURIComponent(item.ticker) + "&range=3mo&interval=1d")
      .then(r => r.json())
      .then(c => {
        const result = c?.chart?.result?.[0];
        if (result) {
          const ts = result.timestamp || [];
          const closes = result.indicators?.quote?.[0]?.close || [];
          const data = ts.map((t, i) => ({ t, v: closes[i] })).filter(d => d.v != null);
          setChartData(data);
          if (data.length >= 2) {
            const cur = data[data.length - 1].v;
            const prev = data[data.length - 2].v;
            const m1 = data[Math.max(0, data.length - 22)].v;
            setSummary({ cur, prev, dayPct:((cur-prev)/prev)*100, m1Pct:((cur-m1)/m1)*100 });
          }
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [item.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  const priceStr = summary ? summary.cur.toLocaleString("en-US", { minimumFractionDigits:decimals, maximumFractionDigits:decimals }) : "—";

  return (
    <ResearchPanelShell title={item.label} subtitle={item.ticker} badge={isFX ? "FX" : "Commodity"} onClose={onClose}>
      {loading ? (
        <div className="flex items-center justify-center flex-1 font-mono" style={{ color:"#7d8590", fontSize:11 }}>Loading…</div>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-mono font-bold" style={{ color:"#e6edf3", fontSize:22 }}>{isFX ? "" : "$"}{priceStr}</span>
            <div className="flex flex-col items-end">
              {summary && <span className="font-mono" style={{ color:clr(summary.dayPct), fontSize:12 }}>Day {fmt.pct(summary.dayPct)}</span>}
              {summary && <span className="font-mono" style={{ color:clr(summary.m1Pct), fontSize:10 }}>1M {fmt.pct(summary.m1Pct)}</span>}
            </div>
          </div>
          <div style={{ marginBottom:8 }}>
            <ResearchMiniChart data={chartData} color={summary?.dayPct >= 0 ? "#3fb950" : "#f85149"} height={110} />
          </div>
          {summary && (
            <div className="grid mb-2" style={{ gridTemplateColumns:"1fr 1fr", gap:"4px 8px" }}>
              {[
                ["Prev Close", (isFX?"":"$") + summary.prev.toFixed(decimals)],
                ["1M Return",  fmt.pct(summary.m1Pct)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>{k}</div>
                  <div className="font-mono" style={{ color:"#e6edf3", fontSize:11 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
          <RelatedLinks itemId={item.id} onOpen={onOpen} />
        </>
      )}
    </ResearchPanelShell>
  );
}

function MacroResearchPanel({ item, onClose, onOpen }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/fred?series=" + item.series)
      .then(r => r.json())
      .then(d => {
        const obs = (d.observations || [])
          .filter(o => o.value !== "." && !isNaN(parseFloat(o.value)))
          .slice(-60)
          .map(o => ({ t: o.date, v: parseFloat(o.value) }));
        setData(obs);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [item.series]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest = data[data.length - 1];
  const prev   = data[data.length - 2];
  const yearAgo = data[Math.max(0, data.length - 13)];
  const yoyPct = latest && yearAgo && yearAgo.v !== 0 ? ((latest.v - yearAgo.v) / Math.abs(yearAgo.v)) * 100 : null;
  const mom = latest && prev ? latest.v - prev.v : null;

  return (
    <ResearchPanelShell title={item.label} subtitle={item.series} badge="Macro" onClose={onClose}>
      {loading ? (
        <div className="flex items-center justify-center flex-1 font-mono" style={{ color:"#7d8590", fontSize:11 }}>Loading…</div>
      ) : !data.length ? (
        <div className="flex items-center justify-center flex-1 font-mono" style={{ color:"#f85149", fontSize:11 }}>No data available</div>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-0.5">
            <span className="font-mono font-bold" style={{ color:"#bc8cff", fontSize:24 }}>{latest?.v?.toFixed(2)}</span>
            <div className="flex flex-col items-end">
              {yoyPct != null && <span className="font-mono" style={{ color:clr(yoyPct), fontSize:11 }}>YoY {fmt.pct(yoyPct)}</span>}
              {mom != null && <span className="font-mono" style={{ color:clr(mom), fontSize:10 }}>MoM {mom >= 0 ? "+" : ""}{mom.toFixed(2)}</span>}
            </div>
          </div>
          <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:10 }}>As of {latest?.t}</div>
          <div style={{ flex:1, marginBottom:6 }}>
            <ResearchMiniChart data={data} color="#bc8cff" height={120} />
          </div>
          <div className="grid mb-2" style={{ gridTemplateColumns:"1fr 1fr", gap:"4px 8px" }}>
            {[
              ["Previous",   prev?.v?.toFixed(2) || "—"],
              ["1Y Ago",     yearAgo?.v?.toFixed(2) || "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>{k}</div>
                <div className="font-mono" style={{ color:"#e6edf3", fontSize:11 }}>{v}</div>
              </div>
            ))}
          </div>
          <RelatedLinks itemId={item.id} onOpen={onOpen} />
        </>
      )}
    </ResearchPanelShell>
  );
}

function TopicResearchPanel({ item, onClose, onOpen }) {
  const cfg = TOPIC_CONFIG[item.id];
  const [macroData, setMacroData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cfg) return;
    setLoading(true);
    Promise.all(
      cfg.macro.map((m, i) =>
        delay(i * 200)
          .then(() => fetch("/api/fred?series=" + m.series).then(r => r.json()))
          .then(d => {
            const obs = (d.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
            const latest = obs[obs.length - 1];
            const prev   = obs[obs.length - 2];
            return { id:m.id, label:m.label, latest:latest ? parseFloat(latest.value) : null, date:latest?.date, prev:prev ? parseFloat(prev.value) : null };
          })
          .catch(() => ({ id:m.id, label:m.label, latest:null }))
      )
    ).then(results => {
      setMacroData(Object.fromEntries(results.map(r => [r.id, r])));
      setLoading(false);
    });
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return null;

  return (
    <ResearchPanelShell title={cfg.icon + " " + cfg.title} subtitle={cfg.desc} badge="Topic" onClose={onClose}>
      {loading ? (
        <div className="flex items-center justify-center flex-1 font-mono" style={{ color:"#7d8590", fontSize:11 }}>Loading…</div>
      ) : (
        <>
          <div className="grid mb-3" style={{ gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {cfg.macro.map(m => {
              const d = macroData[m.id];
              const mom = d?.latest != null && d?.prev != null ? d.latest - d.prev : null;
              return (
                <button key={m.id} onClick={() => onOpen({ id:m.id, label:m.label, type:"macro", series:m.series, category:"Macro" })}
                  className="text-left p-2"
                  style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:4, cursor:"pointer", transition:"border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="#30363d"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#21262d"}>
                  <div className="font-mono" style={{ color:"#7d8590", fontSize:9, textTransform:"uppercase" }}>{m.label}</div>
                  <div className="font-mono font-bold" style={{ color:"#bc8cff", fontSize:16 }}>
                    {d?.latest != null ? d.latest.toFixed(2) : "—"}
                  </div>
                  {mom != null && (
                    <div className="font-mono" style={{ color:clr(mom), fontSize:10 }}>
                      {mom >= 0 ? "▲" : "▼"} {Math.abs(mom).toFixed(2)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ borderTop:"1px solid #21262d", paddingTop:8, marginBottom:4 }}>
            <div className="font-mono mb-2" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Related Assets</div>
            <div className="flex flex-wrap gap-1.5">
              {cfg.assets.map(a => (
                <button key={a.id} onClick={() => onOpen(a)} className="font-mono"
                  style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:3, padding:"3px 8px", fontSize:11, color:RB_TYPE_COLOR[a.type]||"#7d8590", cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="#30363d"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#21262d"}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <RelatedLinks itemId={item.id} onOpen={onOpen} />
        </>
      )}
    </ResearchPanelShell>
  );
}

function ResearchPanel({ item, onClose, onOpen }) {
  if (item.type === "equity") {
    return (
      <div style={{ gridColumn:"1 / -1" }}>
        <EquityResearchPanel item={item} onClose={onClose} onOpen={onOpen} />
      </div>
    );
  }
  switch (item.type) {
    case "commodity": return <MarketResearchPanel  item={item} onClose={onClose} onOpen={onOpen} />;
    case "fx":        return <MarketResearchPanel  item={item} onClose={onClose} onOpen={onOpen} />;
    case "macro":     return <MacroResearchPanel   item={item} onClose={onClose} onOpen={onOpen} />;
    case "topic":     return <TopicResearchPanel   item={item} onClose={onClose} onOpen={onOpen} />;
    default:          return null;
  }
}

const HOME_TILES = [
  { heading:"Macro",       color:"#bc8cff", ids:["FEDFUNDS","DGS10","T10Y2Y","CPIAUCSL","UNRATE"] },
  { heading:"Equities",    color:"#58a6ff", ids:["SPY","QQQ","AAPL","NVDA","TSLA"] },
  { heading:"Commodities", color:"#e3b341", ids:["GC=F","CL=F","SI=F","HG=F","NG=F"] },
  { heading:"FX",          color:"#3fb950", ids:["EURUSD=X","DX=F","GBPUSD=X","USDJPY=X","USDCNY=X"] },
  { heading:"Banks",       color:"#58a6ff", ids:["JPM","GS","BAC","MS","C"] },
  { heading:"Topics",      color:"#f0883e", ids:["topic-inflation","topic-rates","topic-energy","topic-credit"] },
];

function ResearchHomeDashboard({ onOpen }) {
  const byId = Object.fromEntries(RESEARCH_CATALOG.map(c => [c.id, c]));
  return (
    <div>
      <div className="font-mono mb-4" style={{ color:"#484f58", fontSize:11 }}>
        Search above to open research panels — or start from a quick-access tile below. Press <span style={{ color:"#7d8590" }}>/</span> to focus the search bar.
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))" }}>
        {HOME_TILES.map(({ heading, color, ids }) => (
          <div key={heading} className="terminal-panel p-3">
            <div className="font-mono mb-2" style={{ color, fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>{heading}</div>
            <div className="flex flex-col gap-1">
              {ids.map(id => {
                const item = byId[id];
                if (!item) return null;
                return (
                  <button key={id} onClick={() => onOpen(item)} className="text-left font-mono px-2 py-1.5"
                    style={{ background:"transparent", border:"1px solid #21262d", borderRadius:4, color:"#e6edf3", fontSize:12, cursor:"pointer", transition:"all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="#30363d"; e.currentTarget.style.background="#0d1117"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="#21262d"; e.currentTarget.style.background="transparent"; }}>
                    <span style={{ color }}>{item.label}</span>
                    <span style={{ color:"#484f58", marginLeft:8, fontSize:10 }}>{item.id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResearchBrowser({ pendingItem, onPendingConsumed }) {
  const [query, setQuery]               = useState("");
  const [suggestions, setSuggestions]   = useState([]);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);
  const [panels, setPanels]             = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ov_research_recent") || "[]"); }
    catch { return []; }
  });
  const debounceRef = useRef(null);
  const searchRef   = useRef(null);

  // Press "/" anywhere to focus search
  useEffect(() => {
    const handler = e => {
      if (e.key === "/" && document.activeElement !== searchRef.current && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSuggestions([]); setSuggestionIdx(-1); return; }
    debounceRef.current = setTimeout(async () => {
      const q = query.toLowerCase();
      const local = RESEARCH_CATALOG.filter(item =>
        item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
      ).slice(0, 6);
      try {
        const res = await api("/search?q=" + encodeURIComponent(query));
        const remote = (res.result || []).slice(0, 8).map(r => ({
          id:r.symbol, label:r.description || r.symbol, type:"equity", ticker:r.symbol, category:"Equities"
        }));
        const merged = [...local];
        remote.forEach(e => { if (!merged.find(m => m.id === e.id)) merged.push(e); });
        setSuggestions(merged.slice(0, 10));
      } catch { setSuggestions(local); }
    }, 300);
  }, [query]);

  const openPanel = item => {
    const newRecent = [item, ...recentSearches.filter(r => r.id !== item.id)].slice(0, 8);
    setRecentSearches(newRecent);
    localStorage.setItem("ov_research_recent", JSON.stringify(newRecent));
    setPanels(prev => prev.find(p => p.id === item.id) ? prev : [{ ...item }, ...prev]);
    setQuery(""); setSuggestions([]); setSuggestionIdx(-1);
  };

  const closePanel = id => setPanels(prev => prev.filter(p => p.id !== id));

  // Consume external trigger (e.g. from Geopolitical Events module)
  useEffect(() => {
    if (pendingItem) { openPanel(pendingItem); onPendingConsumed && onPendingConsumed(); }
  }, [pendingItem]); // eslint-disable-line

  const handleKeyDown = e => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown")  { e.preventDefault(); setSuggestionIdx(i => Math.min(i+1, suggestions.length-1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSuggestionIdx(i => Math.max(i-1, -1)); }
    else if (e.key === "Enter" && suggestionIdx >= 0) { openPanel(suggestions[suggestionIdx]); }
    else if (e.key === "Escape") { setSuggestions([]); setSuggestionIdx(-1); setQuery(""); }
  };

  const grouped = suggestions.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col flex-1" style={{ height:"calc(100vh - 90px)", overflow:"hidden" }}>
      {/* ── Search bar ── */}
      <div className="px-4 py-3" style={{ borderBottom:"1px solid #21262d", background:"#010409", flexShrink:0 }}>
        <div style={{ position:"relative", maxWidth:680 }}>
          <div className="flex items-center gap-2 px-3 py-2"
            style={{ background:"#161b22", border:"1px solid " + (searchFocused ? "#1f6feb" : "#30363d"), borderRadius:6 }}
            onFocusCapture={() => setSearchFocused(true)}
            onBlurCapture={() => setSearchFocused(false)}>
            <Search size={13} style={{ color:"#7d8590", flexShrink:0 }} />
            <input ref={searchRef} value={query}
              onChange={e => { setQuery(e.target.value); setSuggestionIdx(-1); }}
              onKeyDown={handleKeyDown}
              placeholder="Search equities, commodities, FX, macro indicators, topics… (press / to focus)"
              style={{ background:"transparent", border:"none", color:"#e6edf3", fontSize:12, flex:1, outline:"none", minWidth:0 }} />
            {query && (
              <button onClick={() => { setQuery(""); setSuggestions([]); setSuggestionIdx(-1); searchRef.current?.focus(); }}
                style={{ color:"#7d8590", background:"none", border:"none", cursor:"pointer", flexShrink:0, fontSize:12 }}>✕</button>
            )}
            <span className="font-mono" style={{ color:"#484f58", fontSize:9, flexShrink:0 }}>/</span>
          </div>

          {/* Dropdown */}
          {suggestions.length > 0 && (
            <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:"#161b22", border:"1px solid #30363d", borderRadius:6, zIndex:200, boxShadow:"0 12px 32px rgba(0,0,0,0.6)", overflow:"hidden" }}>
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div style={{ padding:"5px 12px 2px", color:"#484f58", fontSize:9, textTransform:"uppercase", letterSpacing:"0.1em", background:"#0d1117" }}>{cat}</div>
                  {items.map(item => {
                    const idx = suggestions.indexOf(item);
                    const active = idx === suggestionIdx;
                    return (
                      <div key={item.id}
                        onClick={() => openPanel(item)}
                        onMouseEnter={() => setSuggestionIdx(idx)}
                        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 12px", cursor:"pointer", background:active?"#1f2937":"transparent", borderLeft:active?"2px solid #1f6feb":"2px solid transparent" }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold" style={{ color:RB_TYPE_COLOR[item.type]||"#7d8590", fontSize:11, width:80, flexShrink:0 }}>{item.id}</span>
                          <span className="font-mono truncate" style={{ color:"#e6edf3", fontSize:12 }}>{item.label}</span>
                        </div>
                        <span className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase", marginLeft:8, flexShrink:0 }}>{item.type}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent searches row */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {recentSearches.length > 0 && !query && (
            <>
              <span className="font-mono" style={{ color:"#484f58", fontSize:9, textTransform:"uppercase" }}>Recent:</span>
              {recentSearches.map(r => (
                <button key={r.id} onClick={() => openPanel(r)} className="font-mono"
                  style={{ background:"#161b22", border:"1px solid #21262d", borderRadius:3, padding:"2px 8px", color:RB_TYPE_COLOR[r.type]||"#7d8590", fontSize:10, cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="#30363d"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#21262d"}>
                  {r.label}
                </button>
              ))}
            </>
          )}
          {panels.length > 0 && (
            <button onClick={() => setPanels([])} className="font-mono ml-auto"
              style={{ color:"#f85149", background:"none", border:"none", cursor:"pointer", fontSize:10 }}>
              Close all ({panels.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Panel workspace ── */}
      <div className="flex-1" style={{ overflowY:"auto", padding:12 }}>
        {panels.length === 0
          ? <ResearchHomeDashboard onOpen={openPanel} />
          : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(380px, 1fr))", gap:12, alignItems:"start" }}>
              {panels.map(p => (
                <ResearchPanel key={p.id} item={p} onClose={() => closePanel(p.id)} onOpen={openPanel} />
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}

function PortfolioTracker() {
  const [holdings, setHoldings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ov_portfolio") || "[]"); }
    catch { return []; }
  });
  const [quotes, setQuotes] = useState({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [form, setForm] = useState({ ticker: "", shares: "", avgCost: "" });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    localStorage.setItem("ov_portfolio", JSON.stringify(holdings));
  }, [holdings]);

  const tickerKey = holdings.map(h => h.ticker).join(",");
  useEffect(() => {
    if (!holdings.length) { setQuotes({}); return; }
    setLoadingQuotes(true);
    const fetch_ = async () => {
      const newQuotes = {};
      for (let i = 0; i < holdings.length; i++) {
        if (i > 0) await delay(i * 200);
        try {
          const q = await api("/quote?symbol=" + holdings[i].ticker);
          newQuotes[holdings[i].ticker] = { price: q.c, change: q.d, changePct: q.dp };
        } catch(e) {}
      }
      setQuotes(newQuotes);
      setLoadingQuotes(false);
    };
    fetch_();
  }, [tickerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const addHolding = () => {
    const t = form.ticker.trim().toUpperCase();
    const s = parseFloat(form.shares);
    const c = parseFloat(form.avgCost);
    if (!t) { setFormError("Enter a ticker symbol"); return; }
    if (!s || s <= 0) { setFormError("Enter a valid share count"); return; }
    if (!c || c <= 0) { setFormError("Enter a valid average cost"); return; }
    const idx = holdings.findIndex(h => h.ticker === t);
    if (idx >= 0) {
      const old = holdings[idx];
      const totalShares = old.shares + s;
      const newAvg = (old.shares * old.avgCost + s * c) / totalShares;
      const updated = [...holdings];
      updated[idx] = { ticker: t, shares: totalShares, avgCost: newAvg };
      setHoldings(updated);
    } else {
      setHoldings([...holdings, { ticker: t, shares: s, avgCost: c }]);
    }
    setForm({ ticker: "", shares: "", avgCost: "" });
    setFormError("");
  };

  const removeHolding = (ticker) => setHoldings(holdings.filter(h => h.ticker !== ticker));

  const refreshQuotes = () => {
    if (!holdings.length || loadingQuotes) return;
    setLoadingQuotes(true);
    const fetch_ = async () => {
      const newQuotes = { ...quotes };
      for (let i = 0; i < holdings.length; i++) {
        if (i > 0) await delay(i * 200);
        try {
          const q = await api("/quote?symbol=" + holdings[i].ticker);
          newQuotes[holdings[i].ticker] = { price: q.c, change: q.d, changePct: q.dp };
        } catch(e) {}
      }
      setQuotes(newQuotes);
      setLoadingQuotes(false);
    };
    fetch_();
  };

  let totalValue = 0, totalCost = 0, dayPnlTotal = 0;
  holdings.forEach(h => {
    const q = quotes[h.ticker];
    const price = q?.price || h.avgCost;
    totalValue += price * h.shares;
    totalCost += h.avgCost * h.shares;
    if (q?.change) dayPnlTotal += q.change * h.shares;
  });
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const summaryCards = [
    { label: "Portfolio Value", value: "$" + totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: "#e6edf3" },
    { label: "Today's P&L", value: (dayPnlTotal >= 0 ? "+" : "") + "$" + Math.abs(dayPnlTotal).toFixed(2), color: clr(dayPnlTotal) },
    { label: "Total P&L", value: (totalPnl >= 0 ? "+" : "") + "$" + Math.abs(totalPnl).toFixed(2), color: clr(totalPnl) },
    { label: "Total Return", value: totalCost > 0 ? fmt.pct(totalPnlPct) : "—", color: totalCost > 0 ? clr(totalPnlPct) : "#7d8590" },
  ];

  const inputStyle = { background: "#0d1117", border: "1px solid #30363d", borderRadius: 4, color: "#e6edf3", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: "6px 8px", width: "100%" };

  return (
    <div className="flex flex-col flex-1" style={{ height: "calc(100vh - 90px)", overflow: "hidden" }}>
      {/* Summary row */}
      <div className="grid gap-2 p-2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {summaryCards.map(({ label, value, color }) => (
          <div key={label} className="terminal-panel p-3">
            <div className="text-xs font-mono" style={{ color: "#7d8590", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 }}>{label}</div>
            <div className="font-mono font-bold mt-1" style={{ color, fontSize: 18 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="flex gap-2 px-2 pb-2 flex-1" style={{ overflow: "hidden", minHeight: 0 }}>
        {/* Holdings table */}
        <div className="terminal-panel terminal-glow flex-1 flex flex-col p-3" style={{ overflowY: "auto" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="terminal-header">💼 Holdings ({holdings.length})</span>
            <button onClick={refreshQuotes} disabled={loadingQuotes}
              className="text-xs font-mono px-2 py-1"
              style={{ border: "1px solid #30363d", borderRadius: 4, background: "transparent", color: loadingQuotes ? "#7d8590" : "#58a6ff", cursor: loadingQuotes ? "wait" : "pointer" }}>
              {loadingQuotes ? "⟳ Updating..." : "⟳ Refresh"}
            </button>
          </div>

          {holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1" style={{ color: "#7d8590" }}>
              <div className="text-xs font-mono text-center">No positions yet.</div>
              <div className="text-xs font-mono text-center mt-1">Add holdings using the form on the right.</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #30363d" }}>
                  {["Ticker", "Shares", "Avg Cost", "Price", "Mkt Value", "P&L ($)", "Return", "Day Chg", ""].map(h => (
                    <th key={h} className="text-left px-2 py-2"
                      style={{ color: "#7d8590", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => {
                  const q = quotes[h.ticker];
                  const price = q?.price ?? null;
                  const mktValue = price !== null ? price * h.shares : null;
                  const costBasis = h.avgCost * h.shares;
                  const pnl = mktValue !== null ? mktValue - costBasis : null;
                  const pnlPct = pnl !== null ? (pnl / costBasis) * 100 : null;
                  const alloc = totalValue > 0 && mktValue !== null ? (mktValue / totalValue) * 100 : 0;
                  return (
                    <tr key={h.ticker} className="holding-row" style={{ borderBottom: "1px solid #161b22" }}>
                      <td className="px-2 py-2">
                        <div className="font-mono font-bold" style={{ color: "#58a6ff", fontSize: 12 }}>{h.ticker}</div>
                        <div className="font-mono" style={{ color: "#7d8590", fontSize: 10 }}>{alloc.toFixed(1)}%</div>
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: "#e6edf3", fontSize: 12 }}>{h.shares.toLocaleString()}</td>
                      <td className="px-2 py-2 font-mono" style={{ color: "#e6edf3", fontSize: 12 }}>${fmt.price(h.avgCost)}</td>
                      <td className="px-2 py-2 font-mono" style={{ color: price !== null ? "#e6edf3" : "#7d8590", fontSize: 12 }}>
                        {price !== null ? "$" + fmt.price(price) : loadingQuotes ? "…" : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: "#e6edf3", fontSize: 12 }}>
                        {mktValue !== null ? "$" + mktValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: pnl !== null ? clr(pnl) : "#7d8590", fontSize: 12 }}>
                        {pnl !== null ? (pnl >= 0 ? "+" : "") + "$" + Math.abs(pnl).toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: pnlPct !== null ? clr(pnlPct) : "#7d8590", fontSize: 12 }}>
                        {pnlPct !== null ? fmt.pct(pnlPct) : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono" style={{ color: q?.changePct != null ? clr(q.changePct) : "#7d8590", fontSize: 12 }}>
                        {q?.changePct != null ? fmt.pct(q.changePct) : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeHolding(h.ticker)}
                          style={{ color: "#f85149", background: "none", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {holdings.length > 1 && (
                <tfoot>
                  <tr style={{ borderTop: "1px solid #30363d" }}>
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: "#7d8590", fontSize: 11 }} colSpan={4}>TOTAL</td>
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: "#e6edf3", fontSize: 12 }}>
                      ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: clr(totalPnl), fontSize: 12 }}>
                      {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 font-mono font-bold" style={{ color: clr(totalPnlPct), fontSize: 12 }}>
                      {fmt.pct(totalPnlPct)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-2" style={{ width: 280, flexShrink: 0 }}>
          {/* Add position form */}
          <div className="terminal-panel terminal-glow p-3">
            <div className="terminal-header mb-3">+ Add / Update Position</div>
            <div className="flex flex-col gap-2">
              <div>
                <div className="font-mono mb-1" style={{ color: "#7d8590", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ticker</div>
                <input className="pf-input" value={form.ticker}
                  onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                  onKeyDown={e => e.key === "Enter" && document.getElementById("pf-shares")?.focus()}
                  placeholder="AAPL" style={inputStyle} />
              </div>
              <div>
                <div className="font-mono mb-1" style={{ color: "#7d8590", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Shares</div>
                <input id="pf-shares" className="pf-input" type="number" min="0" step="any"
                  value={form.shares}
                  onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && document.getElementById("pf-cost")?.focus()}
                  placeholder="100" style={inputStyle} />
              </div>
              <div>
                <div className="font-mono mb-1" style={{ color: "#7d8590", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Avg Cost / Share ($)</div>
                <input id="pf-cost" className="pf-input" type="number" min="0" step="any"
                  value={form.avgCost}
                  onChange={e => setForm(f => ({ ...f, avgCost: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && addHolding()}
                  placeholder="150.00" style={inputStyle} />
              </div>
              {formError && <div className="font-mono" style={{ color: "#f85149", fontSize: 11 }}>{formError}</div>}
              <button onClick={addHolding}
                className="font-mono font-semibold py-2 mt-1"
                style={{ background: "#1f6feb", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: 12, letterSpacing: "0.05em" }}>
                ADD POSITION
              </button>
              <div className="font-mono" style={{ color: "#484f58", fontSize: 10 }}>
                Adding an existing ticker averages your cost basis.
              </div>
            </div>
          </div>

          {/* Allocation breakdown */}
          {holdings.length > 0 && (
            <div className="terminal-panel terminal-glow p-3 flex-1" style={{ overflowY: "auto" }}>
              <div className="terminal-header mb-3">📊 Allocation</div>
              {[...holdings]
                .map(h => {
                  const q = quotes[h.ticker];
                  const price = q?.price || h.avgCost;
                  return { ...h, mktValue: price * h.shares };
                })
                .sort((a, b) => b.mktValue - a.mktValue)
                .map(h => {
                  const pct = totalValue > 0 ? (h.mktValue / totalValue) * 100 : 0;
                  const q = quotes[h.ticker];
                  return (
                    <div key={h.ticker} className="mb-3">
                      <div className="flex justify-between font-mono mb-1" style={{ fontSize: 11 }}>
                        <span style={{ color: "#e6edf3" }}>{h.ticker}</span>
                        <span style={{ color: q?.changePct != null ? clr(q.changePct) : "#7d8590" }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ background: "#21262d", borderRadius: 2, height: 4 }}>
                        <div style={{ width: pct + "%", height: "100%", background: "#1f6feb", borderRadius: 2, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Panel = ({ children, className = "", style = {} }) => <div className={"terminal-panel terminal-glow p-3 flex flex-col " + className} style={style}>{children}</div>;

function MarketSessionBadges() {
  const SESSIONS = [
    { name: "NYSE",   open: { h:14, m:30 }, close: { h:21, m:0  }, tz: "America/New_York",  flag: "🇺🇸" },
    { name: "LSE",    open: { h:8,  m:0  }, close: { h:16, m:30 }, tz: "Europe/London",     flag: "🇬🇧" },
    { name: "TSE",    open: { h:0,  m:0  }, close: { h:6,  m:0  }, tz: "Asia/Tokyo",        flag: "🇯🇵" },
    { name: "HKEx",   open: { h:1,  m:30 }, close: { h:8,  m:0  }, tz: "Asia/Hong_Kong",    flag: "🇭🇰" },
  ];
  const [, setTick] = useState(0); // tick unused intentionally — triggers re-render
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t+1), 30000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="flex items-center gap-3">
      {SESSIONS.map(s => {
        const now = new Date();
        const utcH = now.getUTCHours();
        const utcM = now.getUTCMinutes();
        const utcMins = utcH * 60 + utcM;
        // Simple UTC-based approximation (ignores DST exactly but good enough for indicator)
        const offsets = { "America/New_York":-240, "Europe/London":60, "Asia/Tokyo":540, "Asia/Hong_Kong":480 };
        const off = offsets[s.tz] || 0;
        const localMins = ((utcMins + off) % 1440 + 1440) % 1440;
        const openMins  = s.open.h  * 60 + s.open.m;
        const closeMins = s.close.h * 60 + s.close.m;
        const isOpen = localMins >= openMins && localMins < closeMins;
        return (
          <span key={s.name} className="font-mono" style={{ color: isOpen ? "#3fb950" : "#484f58", fontSize:9 }}>
            {s.flag} {s.name} {isOpen ? "●" : "○"}
          </span>
        );
      })}
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("financial");
  const [subPage, setSubPage] = useState("overview");
  const [settings, setSettings] = useState(() => ({ showTickerTape: true, ...loadSettings() }));
  const [showSettings, setShowSettings] = useState(false);
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
      delay(300).then(() => api("/stock/metric?symbol="+ticker+"&metric=all")),
      delay(600).then(() => api("/stock/profile2?symbol="+ticker)),
      delay(900).then(() => api("/company-news?symbol="+ticker+"&from="+monthAgo+"&to="+today)),
      delay(1200).then(() => api("/calendar/earnings?symbol="+ticker+"&from="+today+"&to="+yearAhead)),
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

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col" style={{ fontFamily: "'IBM Plex Mono', monospace", background: "#0d1117" }}>
      <GlobalStyles />
      {settings.showTickerTape && <TickerTape tapeData={tapeData} />}
      {showSettings && (
        <div style={{ position: "fixed", top: 48, right: 16, zIndex: 1000, background: "#161b22", border: "1px solid #30363d", borderRadius: 6, padding: 16, minWidth: 260, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="terminal-header">⚙ Settings</span>
            <button onClick={() => setShowSettings(false)} style={{ color: "#7d8590", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <div style={{ borderTop: "1px solid #21262d", paddingTop: 12 }}>
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-xs font-mono" style={{ color: "#e6edf3" }}>Ticker Tape</div>
                <div className="text-xs font-mono" style={{ color: "#7d8590" }}>Scrolling price bar at top</div>
              </div>
              <button
                onClick={() => setSettings(s => { const n = { ...s, showTickerTape: !s.showTickerTape }; saveSettings(n); return n; })}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                  background: settings.showTickerTape ? "#1f6feb" : "#30363d",
                  position: "relative", transition: "background 0.2s"
                }}>
                <div style={{
                  position: "absolute", top: 3, left: settings.showTickerTape ? 21 : 3,
                  width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s"
                }} />
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="terminal-nav flex items-center gap-0 px-4">
        {[
          { key: "financial", label: "📈 Financial" },
          { key: "commodities", label: "🛢 Commodities" },
          { key: "crypto", label: "₿ Crypto" },
          { key: "supplychain", label: "📉 Macro" },
          { key: "technical", label: "📊 Technical" },
          { key: "eye", label: "👁 Eye of Sauron" },
          { key: "fx", label: "💱 FX" },
          { key: "portfolio", label: "💼 Portfolio" },
          { key: "research", label: "🔬 Research" },
        ].map(p => (
          <button key={p.key} onClick={() => setActivePage(p.key)}
            className="px-5 py-2.5 text-xs font-mono font-semibold tracking-wider uppercase transition-colors border-b-2"
            style={{ borderBottomColor: activePage === p.key ? "#60a5fa" : "transparent", color: activePage === p.key ? "#60a5fa" : "#6b7280", background: "transparent" }}>
            {p.label}
          </button>
        ))}
      </div>
      <TopNav ticker={ticker} setTicker={setTicker} quote={quote} loading={loading} onSettingsClick={() => setShowSettings(!showSettings)} />
      {activePage === "commodities" && <CommoditiesDashboard />}
      {activePage === "crypto" && <CryptoDashboard />}
      {activePage === "supplychain" && <SupplyChainDashboard onOpenResearch={item => { setPendingResearchItem(item); setActivePage("research"); }} />}
      {activePage === "fx" && <FXDashboard onOpenResearch={item => { setPendingResearchItem(item); setActivePage("research"); }} />}
      {activePage === "technical" && <TechnicalAnalysis ticker={ticker} />}

      {activePage === "eye" && <EyeOfSauron onOpenResearch={item => { setPendingResearchItem(item); setActivePage("research"); }} />}
      {activePage === "portfolio" && <PortfolioTracker />}
      {activePage === "research" && <ResearchBrowser pendingItem={pendingResearchItem} onPendingConsumed={() => setPendingResearchItem(null)} />}

      {activePage === "financial" && <div className="flex flex-col flex-1" style={{ overflow: "hidden" }}>
        <div className="flex items-center gap-0 px-3 pt-2" style={{ borderBottom: "1px solid #21262d" }}>
          {[["overview", "📊 Overview"], ["peers", "🔍 Peer Comparison"]].map(([k, l]) => (
            <button key={k} onClick={() => setSubPage(k)}
              className="px-4 py-2 text-xs font-mono transition-colors border-b-2"
              style={{ borderBottomColor: subPage === k ? "#58a6ff" : "transparent", color: subPage === k ? "#58a6ff" : "#7d8590", background: "transparent" }}>
              {l}
            </button>
          ))}
        </div>
        {subPage === "peers" && (
          <div className="flex-1 p-2" style={{ overflow: "hidden" }}>
            <PeerComparison ticker={ticker} metrics={metrics} quote={quote} />
          </div>
        )}
        {subPage === "overview" && <div className="flex-1 p-2 grid gap-2" style={{ gridTemplateColumns: "1fr 210px 210px 190px", gridTemplateRows: "300px 220px 200px", height: "calc(100vh - 90px)", overflow: "hidden" }}>

        <Panel style={{ gridColumn: "1/2", gridRow: "1/2", overflow: "hidden" }}>
          <div className="flex items-center gap-1.5 mb-1"><span className="terminal-header"><Activity size={11} /></span><span className="terminal-header">{ticker} · Price Chart</span></div>
          <div style={{ height: 255, minHeight: 255 }}><PriceChart ticker={ticker} /></div>
        </Panel>

        <Panel style={{ gridColumn: "2/3", gridRow: "1/2", overflowY: "auto" }}>
          <KeyMetrics quote={quote} metrics={metrics} />
        </Panel>

        <Panel style={{ gridColumn: "3/4", gridRow: "1/2", overflowY: "auto" }}>
          <QuickStats quote={quote} metrics={metrics} />
        </Panel>

        <Panel style={{ gridColumn: "4/5", gridRow: "1/3", overflowY: "auto" }}>
          <div className="flex items-center gap-1.5 mb-2"><span className="terminal-header"><Star size={11} /></span><span className="terminal-header">Watchlist</span></div>
          {tapeData.map(t => (
            <div key={t.symbol} className="watchlist-row flex justify-between items-center py-1 border-b cursor-pointer px-1 rounded" style={{ borderColor: "#21262d" }} onClick={()=>setTicker(t.symbol)}>
              <span className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{t.symbol}</span>
              <div className="flex flex-col items-end">
                <span className="text-xs font-mono" style={{ color: "#e6edf3" }}>${fmt.price(t.price)}</span>
                <span className="text-xs font-mono" style={{color:clr(t.changePct)}}>{t.changePct>=0?"▲":"▼"}{Math.abs(t.changePct||0).toFixed(2)}%</span>
              </div>
            </div>
          ))}
          <div className="mt-3 mb-1"><span className="terminal-header">Events</span></div>
          <EventsCalendar earnings={earnings} />
        </Panel>

        <Panel style={{ gridColumn: "1/2", gridRow: "2/3", overflow: "hidden" }}>
          <div className="flex items-center gap-1.5 mb-1"><span className="terminal-header"><DollarSign size={11} /></span><span className="terminal-header">Financial Statements</span></div>
          <div style={{ overflowY: "auto", height: 185 }}><FinancialStatements ticker={ticker} /></div>
        </Panel>

        <Panel style={{ gridColumn: "2/4", gridRow: "2/3", overflowY: "auto" }}>
          <AnalystData ticker={ticker} />
        </Panel>

        <Panel style={{ gridColumn: "1/3", gridRow: "3/4", overflowY: "auto" }}>
          <div className="flex items-center gap-1.5 mb-1"><span className="terminal-header"><Newspaper size={11} /></span><span className="terminal-header">News & Sentiment</span></div>
          <NewsFeed news={news} />
        </Panel>

        <Panel style={{ gridColumn: "3/5", gridRow: "3/4", overflowY: "auto" }}>
          <CompanyProfile profile={profile} />
        </Panel>

      </div>
      }
      </div>
      }
      <div className="status-bar flex items-center gap-4 px-4 py-1.5 text-xs font-mono">
        <span>OMNES VIDENTES · LIVE DATA</span>
        <span style={{ color:"#21262d" }}>|</span>
        <MarketSessionBadges />
        <span className="ml-auto">Last Updated: {statusTime}</span>
      </div>
    </div>
  );
}// build Thu Apr  9 12:56:09 EDT 2026
