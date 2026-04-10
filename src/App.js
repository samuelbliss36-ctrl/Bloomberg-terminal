import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, Line, Cell, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Search, Bell, Settings, RefreshCw, Zap, ArrowUpRight, ArrowDownRight, Newspaper, Building2, DollarSign, BarChart2, Activity, Star } from "lucide-react";

const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_KEY;
const BASE = "https://finnhub.io/api/v1";
const api = (path) => fetch(BASE + path + "&token=" + FINNHUB_KEY).then((r) => r.json());

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

  const [prices, setPrices] = useState({});
  const [active, setActive] = useState("GC=F");
  const [chartData, setChartData] = useState([]);
  const [tf, setTf] = useState("3M");
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("Metals");
  const TF_RANGE = { "1W": "5d", "1M": "1mo", "3M": "3mo", "1Y": "1y" };

  useEffect(() => {
    Promise.all(
      COMMODITIES.map(c =>
        fetch("/api/chart?ticker=" + c.ticker + "&range=1d&interval=1m")
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

  useEffect(() => {
    setLoading(true);
    fetch("/api/chart?ticker=" + active + "&range=" + TF_RANGE[tf] + "&interval=1d")
      .then(r => r.json())
      .then(d => {
        const result = d?.chart?.result?.[0];
        if (result) {
          const mapped = result.timestamp.map((t, i) => ({
            date: new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            price: result.indicators.quote[0].close[i] ? +result.indicators.quote[0].close[i].toFixed(2) : null,
          })).filter(d => d.price !== null);
          setChartData(mapped);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [active, tf]); // eslint-disable-line

  const startP = chartData[0]?.price || 0;
  const endP = chartData[chartData.length - 1]?.price || 0;
  const chg = endP - startP;
  const lc = chg >= 0 ? "#58a6ff" : "#f85149";
  const minP = chartData.length ? Math.min(...chartData.map(d => d.price)) * 0.995 : 0;
  const maxP = chartData.length ? Math.max(...chartData.map(d => d.price)) * 1.005 : 0;
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
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="terminal-header">{activeCommodity?.label} — {activeCommodity?.unit}</div>
            {prices[active] && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-lg font-mono font-bold" style={{ color: "#e6edf3" }}>${fmt.price(prices[active]?.price)}</span>
                <span className="text-xs font-mono" style={{ color: clr(prices[active]?.changePct) }}>
                  {prices[active]?.changePct >= 0 ? "▲" : "▼"} {Math.abs(prices[active]?.change).toFixed(2)} ({Math.abs(prices[active]?.changePct).toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
          <div className="flex border rounded overflow-hidden" style={{ borderColor: "#21262d" }}>
            {["1W","1M","3M","1Y"].map(t => (
              <button key={t} onClick={() => setTf(t)} className="px-3 py-1 text-xs font-mono transition-colors"
                style={{ background: tf === t ? "#0c2044" : "transparent", color: tf === t ? "#58a6ff" : "#7d8590", borderRight: "1px solid #21262d" }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ height: 260 }}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>Loading chart...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lc} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={lc} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2128" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(chartData.length / 6))} />
                <YAxis domain={[minP, maxP]} tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={v => "$" + v.toFixed(0)} width={52} />
                <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 2, fontSize: 10, fontFamily: "monospace" }} labelStyle={{ color: "#7d8590" }} itemStyle={{ color: "#58a6ff" }} formatter={v => ["$" + fmt.price(v), "Price"]} />
                <Area type="monotone" dataKey="price" stroke={lc} strokeWidth={1.5} fill="url(#commGrad)" dot={false} activeDot={{ r: 3, fill: lc }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
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
  const [chartData, setChartData] = useState([]);
  const [tf, setTf] = useState("1M");
  const [loading, setLoading] = useState(true);
  const TF_RANGE = { "1W": "5d", "1M": "1mo", "3M": "3mo", "1Y": "1y" };

  useEffect(() => {
    Promise.all(
      COINS.map(c =>
        fetch("/api/chart?ticker=" + c.ticker + "&range=1d&interval=1m")
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

  useEffect(() => {
    setLoading(true);
    fetch("/api/chart?ticker=" + active + "&range=" + TF_RANGE[tf] + "&interval=1d")
      .then(r => r.json())
      .then(d => {
        const result = d?.chart?.result?.[0];
        if (result) {
          const mapped = result.timestamp.map((t, i) => ({
            date: new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            price: result.indicators.quote[0].close[i] ? +result.indicators.quote[0].close[i].toFixed(2) : null,
          })).filter(d => d.price !== null);
          setChartData(mapped);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [active, tf]); // eslint-disable-line

  const startP = chartData[0]?.price || 0;
  const endP = chartData[chartData.length - 1]?.price || 0;
  const chg = endP - startP;
  const lc = chg >= 0 ? "#58a6ff" : "#f85149";
  const minP = chartData.length ? Math.min(...chartData.map(d => d.price)) * 0.995 : 0;
  const maxP = chartData.length ? Math.max(...chartData.map(d => d.price)) * 1.005 : 0;
  const activeCoin = COINS.find(c => c.ticker === active);

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "300px 1fr", gridTemplateRows: "1fr auto" }}>
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
                  <div className="text-xs font-mono font-bold" style={{ color: "#e6edf3" }}>{d ? "$" + fmt.price(d.price) : "..."}</div>
                  {d && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#58a6ff" : "#f85149" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "1/2" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="terminal-header">{activeCoin?.label} ({activeCoin?.symbol})</div>
            {prices[active] && (
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono font-bold" style={{ color: "#e6edf3", fontSize: 22 }}>${fmt.price(prices[active]?.price)}</span>
                <span className="text-xs font-mono" style={{ color: clr(prices[active]?.changePct) }}>
                  {prices[active]?.changePct >= 0 ? "▲" : "▼"} {Math.abs(prices[active]?.change || 0).toFixed(2)} ({Math.abs(prices[active]?.changePct || 0).toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
          <div className="flex border rounded overflow-hidden" style={{ borderColor: "#21262d" }}>
            {["1W","1M","3M","1Y"].map(t => (
              <button key={t} onClick={() => setTf(t)} className="px-3 py-1 text-xs font-mono transition-colors"
                style={{ background: tf === t ? "#0c2044" : "transparent", color: tf === t ? "#58a6ff" : "#7d8590", borderRight: "1px solid #21262d" }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ height: 280 }}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>Loading chart...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cryptoDashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lc} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={lc} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2128" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(chartData.length / 6))} />
                <YAxis domain={[minP, maxP]} tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={v => "$" + (v >= 1000 ? (v/1000).toFixed(1) + "k" : v.toFixed(2))} width={55} />
                <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 2, fontSize: 10, fontFamily: "monospace" }} labelStyle={{ color: "#7d8590" }} itemStyle={{ color: "#58a6ff" }} formatter={v => ["$" + fmt.price(v), "Price"]} />
                <Area type="monotone" dataKey="price" stroke={lc} strokeWidth={1.5} fill="url(#cryptoDashGrad)" dot={false} activeDot={{ r: 3, fill: lc }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
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





function SupplyChainDashboard() {
  const FRED_SERIES = [
    { id: "FEDFUNDS", label: "Fed Funds Rate", note: "FOMC rate decision", src: "Federal Reserve", suffix: "%", freq: "Monthly" },
    { id: "DGS10", label: "US 10Y Treasury", note: "Risk-free rate benchmark", src: "US Treasury", suffix: "%", freq: "Daily" },
    { id: "DGS2", label: "US 2Y Treasury", note: "Short-term rate expectation", src: "US Treasury", suffix: "%", freq: "Daily" },
    { id: "CPIAUCSL", label: "CPI (Urban)", note: "Consumer price inflation", src: "BLS", suffix: "", freq: "Monthly" },
    { id: "PPIACO", label: "PPI All Commodities", note: "Producer price inflation", src: "BLS", suffix: "", freq: "Monthly" },
    { id: "UNRATE", label: "Unemployment Rate", note: "US labor market health", src: "BLS", suffix: "%", freq: "Monthly" },
    { id: "BOPGSTB", label: "US Trade Balance", note: "Monthly trade deficit ($M)", src: "Census", suffix: "M", freq: "Monthly" },
    { id: "T10YIE", label: "10Y Breakeven Inflation", note: "Market inflation expectation", src: "Fed", suffix: "%", freq: "Daily" },
  ];

  const INDICES = [
    { ticker: "HG=F", label: "Copper (Dr. Copper)", symbol: "HG", desc: "Global economic health proxy" },
    { ticker: "NG=F", label: "Natural Gas", symbol: "NG", desc: "Energy & heating cost" },
    { ticker: "CL=F", label: "WTI Crude Oil", symbol: "WTI", desc: "Global transport cost" },
    { ticker: "ZW=F", label: "Wheat", symbol: "ZW", desc: "Food supply stress indicator" },
  ];





  const [prices, setPrices] = useState({});
  const [active, setActive] = useState("^BDI");
  const [chartData, setChartData] = useState([]);
  const [tf, setTf] = useState("1Y");
  const [loading, setLoading] = useState(true);
  const TF_RANGE = { "1W": "5d", "1M": "1mo", "3M": "3mo", "1Y": "1y", "5Y": "5y" };

  const [fredData, setFredData] = useState({});

  useEffect(() => {
    Promise.all(
      FRED_SERIES.map(s =>
        fetch("/api/fred?series=" + s.id)
          .then(r => r.json())
          .then(d => {
            const obs = d.observations;
            const latest = obs?.find(o => o.value !== ".");
            const prev = obs?.find((o, i) => i > 0 && o.value !== ".");
            const val = parseFloat(latest?.value);
            const prevVal = parseFloat(prev?.value);
            const change = val - prevVal;
            return [s.id, { value: val, change, date: latest?.date }];
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

  useEffect(() => {
    setLoading(true);
    fetch("/api/chart?ticker=" + encodeURIComponent(active) + "&range=" + TF_RANGE[tf] + "&interval=1d")
      .then(r => r.json())
      .then(d => {
        const result = d?.chart?.result?.[0];
        if (result) {
          const mapped = result.timestamp.map((t, i) => ({
            date: new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            price: result.indicators.quote[0].close[i] ? +result.indicators.quote[0].close[i].toFixed(2) : null,
          })).filter(d => d.price !== null);
          setChartData(mapped);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [active, tf]); // eslint-disable-line

  const startP = chartData[0]?.price || 0;
  const endP = chartData[chartData.length - 1]?.price || 0;
  const chg = endP - startP;
  const lc = chg >= 0 ? "#58a6ff" : "#f85149";
  const minP = chartData.length ? Math.min(...chartData.map(d => d.price)) * 0.995 : 0;
  const maxP = chartData.length ? Math.max(...chartData.map(d => d.price)) * 1.005 : 0;
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
            const display = val ? (s.id === "BOPGSTB" ? "$" + (val/1000).toFixed(1) + "B" : val.toFixed(2) + s.suffix) : "Loading...";
            const chgDisplay = chg ? (chg >= 0 ? "+" : "") + chg.toFixed(2) + s.suffix : "—";
            const chgColor = !chg ? "#7d8590" : chg >= 0 ? "#58a6ff" : "#f85149";
            return (
              <div key={s.id} className="p-2 rounded" style={{ background: "#0d1117", border: "1px solid #1c2128" }}>
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
        <div className="flex items-center justify-between mb-3">
          <div>
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
          <div className="flex border rounded overflow-hidden" style={{ borderColor: "#21262d" }}>
            {["1W","1M","3M","1Y","5Y"].map(t => (
              <button key={t} onClick={() => setTf(t)} className="px-2 py-1 text-xs font-mono transition-colors"
                style={{ background: tf === t ? "#0c2044" : "transparent", color: tf === t ? "#58a6ff" : "#7d8590", borderRight: "1px solid #21262d" }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ height: 240 }}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-xs font-mono animate-pulse" style={{ color: "#7d8590" }}>Loading chart...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="scGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lc} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={lc} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2128" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(chartData.length / 6))} />
                <YAxis domain={[minP, maxP]} tick={{ fill: "#7d8590", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={v => v > 1000 ? (v/1000).toFixed(1)+"k" : v.toFixed(0)} width={45} />
                <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 2, fontSize: 10, fontFamily: "monospace" }} labelStyle={{ color: "#7d8590" }} itemStyle={{ color: "#58a6ff" }} formatter={v => [v.toFixed(2), activeIndex?.symbol]} />
                <Area type="monotone" dataKey="price" stroke={lc} strokeWidth={1.5} fill="url(#scGrad)" dot={false} activeDot={{ r: 3, fill: lc }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>



      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/3", gridRow: "3/4" }}>
        <div className="terminal-header mb-1">📋 Supply Chain Intelligence</div>
        <div className="text-xs font-mono mb-2" style={{ color: "#7d8590" }}>Monthly published figures — not real-time</div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Global SC Pressure", value: "-0.42", sub: "NY Fed Index · Below avg stress", color: "#58a6ff" },
            { label: "Semiconductor Lead Time", value: "14.2 wks", sub: "Down from 26 wks peak", color: "#58a6ff" },
            { label: "ISM Manufacturing PMI", value: "48.7", sub: "Contraction territory (<50)", color: "#f85149" },
            { label: "Freight Cost Index", value: "112.4", sub: "Freightos Baltic · Normalized", color: "#e3b341" },
          ].map(item => (
            <div key={item.label} className="p-3 rounded" style={{ background: "#0d1117", border: "1px solid #1c2128" }}>
              <div className="text-xs font-mono" style={{ color: "#7d8590" }}>{item.label}</div>
              <div className="text-lg font-mono font-bold mt-1" style={{ color: item.color }}>{item.value}</div>
              <div className="text-xs font-mono mt-0.5" style={{ color: "#7d8590" }}>{item.sub}</div>
            </div>
          ))}
        </div>
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

function EyeOfSauron() {
  const [active, setActive] = useState(null);

  const MODULES = [
    { id: "weather", icon: "🌦", title: "Global Weather", desc: "Live weather across major financial centers worldwide" },
    { id: "vessels", icon: "🛢", title: "Vessel Tracker", desc: "Live oil tankers and cargo ships via MarineTraffic" },
    { id: "flights", icon: "✈️", title: "Flight Tracker", desc: "Real-time global flight tracking via ADS-B Exchange" },
    { id: "energy", icon: "⚡", title: "Energy Grid", desc: "Live US electricity grid demand and generation mix" },
    { id: "tankers", icon: "🚢", title: "Shipping Routes", desc: "Major shipping lane congestion and freight rates", tag: "Coming Soon" },
    { id: "geo", icon: "🌍", title: "Geopolitical Events", desc: "Live news filtered for events affecting global markets", tag: "Coming Soon" },
  ];

  const renderModule = (id) => {
    if (id === "weather") return <WeatherDashboard />;
    if (id === "vessels") return <TankerMap />;
    if (id === "flights") return <FlightTracker />;
    if (id === "energy") return <EnergyGrid />;
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

function TickerTape({ tapeData }) {
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
  const items = [...tapeData, ...tapeData];
  return (
    <div className="ticker-tape overflow-hidden" style={{ height: 28 }}>
      <div ref={ref} className="flex items-center gap-6 whitespace-nowrap" style={{ paddingTop: 5 }}>
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-gray-400 font-semibold">{t.symbol}</span>
            <span className="text-gray-200">${fmt.price(t.price)}</span>
            <span style={{ color: clr(t.changePct) }}>{t.changePct >= 0 ? "▲" : "▼"} {Math.abs(t.changePct || 0).toFixed(2)}%</span>
            <span className="text-gray-700 ml-2">|</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TopNav({ ticker, setTicker, quote, loading, onSettingsClick }) {
  const [input, setInput] = useState(ticker);
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-800 bg-gray-950">
      <div className="flex items-center gap-2">
        <Zap size={16} style={{ color: "#58a6ff" }} />
        <span className="logo-text" style={{ fontSize: 13 }}>OMNES VIDENTES</span>
      </div>
      <div className="flex items-center bg-gray-900 border border-gray-700 rounded px-2 py-1 gap-2 max-w-xs w-full">
        <Search size={12} className="text-gray-500" />
        <input className="bg-transparent text-gray-100 text-sm font-mono outline-none w-full placeholder-gray-600" placeholder="Search ticker... (e.g. AAPL)" value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") setTicker(input); }} />
      </div>
      {quote && (
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg font-mono">{ticker}</span>
          <span className="text-gray-300 font-mono text-lg">${fmt.price(quote.c)}</span>
          <span className="flex items-center gap-1 text-sm font-mono px-2 py-0.5 rounded" style={{ color: clr(quote.dp), background: bg(quote.dp) }}>
            {quote.dp >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {fmt.change(quote.d)} ({fmt.pct(quote.dp)})
          </span>
          <span className="text-gray-500 text-xs font-mono">Vol: {fmt.volume(quote.v > 0 ? quote.v : (metrics?.metric?.avgVolume10D || quote.volume))}</span>
        </div>
      )}
      {loading && <span className="text-yellow-500 text-xs font-mono animate-pulse">Loading...</span>}
      <div className="ml-auto flex items-center gap-3 text-gray-500">
        <Bell size={14} />
        <RefreshCw size={14} className="cursor-pointer hover:text-gray-300" onClick={() => setTicker(ticker)} />
        <Settings size={14} className="cursor-pointer hover:text-gray-300" onClick={onSettingsClick} />
        <div className="h-4 w-px bg-gray-700" />
        <span className="text-xs font-mono text-gray-600">LIVE</span>
        <span className="live-dot animate-pulse" style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block" }} />
      </div>
    </div>
  );
}

const TIMEFRAMES = ["1W", "1M", "3M", "1Y"];
const TF_DAYS = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 };
// const TF_RES = { "1W": "D", "1M": "D", "3M": "D", "1Y": "W" };

function PriceChart({ ticker }) {
  const [tf, setTf] = useState("3M");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    // const to = Math.floor(Date.now() / 1000);
    // const from = to - TF_DAYS[tf] * 24 * 3600;
    const range = TF_DAYS[tf] <= 7 ? "5d" : TF_DAYS[tf] <= 30 ? "1mo" : TF_DAYS[tf] <= 90 ? "3mo" : "1y";
    const interval = TF_DAYS[tf] <= 7 ? "1h" : "1d";
    fetch("/api/chart?ticker=" + ticker + "&range=" + range + "&interval=" + interval)
      .then(r => r.json())
      .then(d => {
        const result = d?.chart?.result?.[0];
        if (result) {
          const timestamps = result.timestamp;
          const closes = result.indicators.quote[0].close;
          const volumes = result.indicators.quote[0].volume;
          const mapped = timestamps.map((t, i) => ({
            date: new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            price: closes[i] ? +closes[i].toFixed(2) : null,
            volume: volumes[i] || 0,
            sma20: 0,
          })).filter(d => d.price !== null);
          mapped.forEach((item, i) => {
            if (i >= 19) {
              const slice = mapped.slice(i - 19, i + 1);
              item.sma20 = +(slice.reduce((s, x) => s + x.price, 0) / 20).toFixed(2);
            } else {
              item.sma20 = item.price;
            }
          });
          setData(mapped);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticker, tf]);

  const startPrice = data[0]?.price || 0;
  const endPrice = data[data.length - 1]?.price || 0;
  const chg = endPrice - startPrice;
  const pct = startPrice ? (chg / startPrice) * 100 : 0;
  const lc = chg >= 0 ? "#3fb950" : "#f85149";
  const minP = data.length ? Math.min(...data.map((d) => d.price)) * 0.995 : 0;
  const maxP = data.length ? Math.max(...data.map((d) => d.price)) * 1.005 : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-xs font-mono uppercase tracking-wider">Price Chart</span>
          {data.length > 0 && <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ color: clr(chg), background: bg(chg) }}>{fmt.change(chg)} ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%) {tf}</span>}
        </div>
        <div className="flex border border-gray-800 rounded overflow-hidden">
          {TIMEFRAMES.map((t) => (
            <button key={t} onClick={() => setTf(t)} className="px-2.5 py-1 text-xs font-mono transition-colors" style={{ background: tf === t ? "#1a2744" : "transparent", color: tf === t ? "#60a5fa" : "#6b7280", borderRight: "1px solid #1f2937" }}>{t}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0" style={{ minHeight: 200 }}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm font-mono animate-pulse">Loading chart data...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={lc} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={lc} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#4b5563", fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(data.length / 6))} />
              <YAxis domain={[minP, maxP]} tick={{ fill: "#4b5563", fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={(v) => "$" + v.toFixed(0)} width={52} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 4, fontSize: 10, fontFamily: "monospace" }} labelStyle={{ color: "#9ca3af" }} itemStyle={{ color: "#e5e7eb" }} formatter={(v) => ["$" + fmt.price(v)]} />
              <Area type="monotone" dataKey="price" stroke={lc} strokeWidth={1.5} fill="url(#pg)" dot={false} activeDot={{ r: 3, fill: lc }} />
              <Line type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
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


const Panel = ({ children, className = "", style = {} }) => <div className={"terminal-panel terminal-glow p-3 flex flex-col " + className} style={style}>{children}</div>;

export default function App() {
  const [activePage, setActivePage] = useState("financial");
  const [subPage, setSubPage] = useState("overview");
  const [settings, setSettings] = useState({ showTickerTape: true });
  const [showSettings, setShowSettings] = useState(false);
  const [ticker, setTicker] = useState("AAPL");
  const [quote, setQuote] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [profile, setProfile] = useState(null);
  const [news, setNews] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [tapeData, setTapeData] = useState([]);
  const [loading, setLoading] = useState(false);

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
    // Stagger watchlist to avoid rate limiting
    const fetchTape = async () => {
      const results = [];
      for (let i = 0; i < WATCHLIST.length; i++) {
        await delay(i * 150);
        try {
          const q = await api("/quote?symbol=" + WATCHLIST[i]);
          results.push({ symbol: WATCHLIST[i], price: q.c, changePct: q.dp });
          setTapeData([...results]);
        } catch(e) {}
      }
    };
    fetchTape();
  }, []);

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col" style={{ fontFamily: "'Share Tech Mono', monospace", background: "#0d1117" }}>
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
                onClick={() => setSettings(s => ({ ...s, showTickerTape: !s.showTickerTape }))}
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
          { key: "supplychain", label: "🚢 Supply Chain" },
          { key: "technical", label: "📊 Technical" },
          { key: "eye", label: "👁 Eye of Sauron" },
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
      {activePage === "supplychain" && <SupplyChainDashboard />}
      {activePage === "technical" && <TechnicalAnalysis ticker={ticker} />}

      {activePage === "eye" && <EyeOfSauron />}

      {activePage !== "financial" && activePage !== "technical" && activePage !== "eye" && null}
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
        <span className="text-gray-800">|</span>
        <span>Type a ticker and press Enter to search</span>
        <span className="ml-auto">Last Updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}// build Thu Apr  9 12:56:09 EDT 2026
