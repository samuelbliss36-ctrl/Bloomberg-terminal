import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Search, Bell, Settings, RefreshCw, Zap, ArrowUpRight, ArrowDownRight, Calendar, Newspaper, Building2, DollarSign, BarChart2, Activity, Star } from "lucide-react";

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
const clr = (v) => (v >= 0 ? "#00d084" : "#ff4757");
const bg = (v) => (v >= 0 ? "rgba(0,208,132,0.1)" : "rgba(255,71,87,0.1)");
const WATCHLIST = ["SPY", "QQQ", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN", "META"];

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
    <div className="overflow-hidden border-b border-gray-800 bg-gray-950" style={{ height: 28 }}>
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

function TopNav({ ticker, setTicker, quote, loading }) {
  const [input, setInput] = useState(ticker);
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-800 bg-gray-950">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-yellow-400" />
        <span className="text-yellow-400 font-bold text-sm tracking-widest font-mono">TERMINAL</span>
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
          <span className="text-gray-500 text-xs font-mono">Vol: {fmt.volume(quote.v)}</span>
        </div>
      )}
      {loading && <span className="text-yellow-500 text-xs font-mono animate-pulse">Loading...</span>}
      <div className="ml-auto flex items-center gap-3 text-gray-500">
        <Bell size={14} />
        <RefreshCw size={14} className="cursor-pointer hover:text-gray-300" onClick={() => setTicker(ticker)} />
        <Settings size={14} />
        <div className="h-4 w-px bg-gray-700" />
        <span className="text-xs font-mono text-gray-600">LIVE</span>
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      </div>
    </div>
  );
}

const TIMEFRAMES = ["1W", "1M", "3M", "1Y"];
const TF_DAYS = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 };
const TF_RES = { "1W": "D", "1M": "D", "3M": "D", "1Y": "W" };

function PriceChart({ ticker }) {
  const [tf, setTf] = useState("3M");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const to = Math.floor(Date.now() / 1000);
    const from = to - TF_DAYS[tf] * 24 * 3600;
    const range = TF_DAYS[tf] <= 7 ? "5d" : TF_DAYS[tf] <= 30 ? "1mo" : TF_DAYS[tf] <= 90 ? "3mo" : "1y";
    const interval = TF_DAYS[tf] <= 7 ? "1h" : "1d";
    fetch("https://corsproxy.io/?url=" + encodeURIComponent("https://query1.finance.yahoo.com/v8/finance/chart/" + ticker + "?range=" + range + "&interval=" + interval))
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
  const lc = chg >= 0 ? "#00d084" : "#ff4757";
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
      <div className="flex items-center gap-1.5 mb-2"><span className="text-blue-400"><BarChart2 size={12} /></span><span className="text-xs font-mono font-semibold tracking-wider uppercase text-blue-400">Key Metrics</span></div>
      <div className="grid grid-cols-2 gap-x-6 mt-2">
        <div>{rows1.map(([l, v]) => <div key={l} className="flex justify-between items-center py-1.5 border-b border-gray-800"><span className="text-gray-500 text-xs font-mono">{l}</span><span className="text-gray-200 text-xs font-mono font-semibold">{v}</span></div>)}</div>
        <div>{rows2.map(([l, v]) => <div key={l} className="flex justify-between items-center py-1.5 border-b border-gray-800"><span className="text-gray-500 text-xs font-mono">{l}</span><span className="text-gray-200 text-xs font-mono font-semibold">{v}</span></div>)}</div>
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
      <div className="flex items-center gap-1.5 mb-2"><span className="text-blue-400"><Building2 size={12} /></span><span className="text-xs font-mono font-semibold tracking-wider uppercase text-blue-400">Company Profile</span></div>
      <div className="grid grid-cols-3 gap-2 mt-2 mb-3">
        {[["Sector", profile.finnhubIndustry], ["Country", profile.country], ["Employees", profile.employeeTotal?.toLocaleString()], ["Founded", profile.ipo?.split("-")[0]], ["Exchange", profile.exchange], ["Currency", profile.currency]].map(([k, v]) => (
          <div key={k} className="bg-gray-900 rounded p-1.5"><div className="text-gray-600 text-xs font-mono">{k}</div><div className="text-gray-200 text-xs font-mono font-semibold truncate">{v || "N/A"}</div></div>
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
  bullish: { color: "#00d084", bg: "rgba(0,208,132,0.1)", label: "BULLISH" },
  bearish: { color: "#ff4757", bg: "rgba(255,71,87,0.1)", label: "BEARISH" },
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
          <a key={i} href={n.url} target="_blank" rel="noreferrer" className="block border border-gray-800 rounded p-2.5 hover:border-gray-700 transition-colors">
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
  const [tab, setTab] = useState("income");
  const [data, setData] = useState(null);
  useEffect(() => {
    api("/stock/financials-reported?symbol=" + ticker + "&freq=quarterly").then(d => setData(d.data?.slice(0,4) || []));
  }, [ticker]);
  const tabs = [{ key: "income", label: "Income Stmt" }, { key: "balance", label: "Balance Sheet" }, { key: "cashflow", label: "Cash Flow" }];
  const find = (arr, key) => arr?.find(x=>x.concept.includes(key))?.value/1e9||0;
  const extractIC = r => ({ revenue: find(r?.ic,"RevenueFromContractWithCustomer"), netIncome: find(r?.ic,"NetIncomeLoss"), grossProfit: find(r?.ic,"GrossProfit") });
  const extractBS = r => ({ totalAssets: find(r?.bs,"Assets"), totalLiabilities: find(r?.bs,"Liabilities"), cash: find(r?.bs,"CashAndCashEquivalentsAtCarryingValue") });
  const extractCF = r => ({ operatingCF: find(r?.cf,"NetCashProvidedByUsedInOperatingActivities"), capEx: find(r?.cf,"PaymentsToAcquirePropertyPlantAndEquipment") });
  if (!data) return <div className="text-gray-600 text-xs font-mono animate-pulse">Loading financials...</div>;
  const rows = data.map(d => ({ period: d.form + " " + d.filed?.slice(0,4), ...(tab==="income"?extractIC(d.report):tab==="balance"?extractBS(d.report):extractCF(d.report)) }));
  const colMap = { income: [["revenue","Revenue"],["grossProfit","Gross Profit"],["netIncome","Net Income"]], balance: [["totalAssets","Total Assets"],["totalLiabilities","Total Liab."],["cash","Cash"]], cashflow: [["operatingCF","Operating CF"],["capEx","CapEx"]] };
  const cols = colMap[tab];
  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-800 mb-3">
        {tabs.map(t => <button key={t.key} onClick={()=>setTab(t.key)} className="px-3 py-1.5 text-xs font-mono border-b-2 transition-colors" style={{ borderBottomColor: tab===t.key?"#60a5fa":"transparent", color: tab===t.key?"#60a5fa":"#6b7280", background:"transparent" }}>{t.label}</button>)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead><tr><th className="text-left text-gray-600 py-1 pr-3 font-normal">Metric ($B)</th>{rows.map(r=><th key={r.period} className="text-right text-gray-500 py-1 px-2 font-normal">{r.period}</th>)}</tr></thead>
          <tbody>{cols.map(([key,label])=><tr key={key} className="border-t border-gray-800"><td className="text-gray-400 py-1.5 pr-3">{label}</td>{rows.map((r,i)=><td key={i} className="text-right py-1.5 px-2 font-semibold" style={{color:r[key]<0?"#ff4757":"#e5e7eb"}}>{r[key]<0?"-$"+Math.abs(r[key]).toFixed(2):"$"+(r[key]||0).toFixed(2)}</td>)}</tr>)}</tbody>
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
      <div className="flex items-center gap-1.5 mb-2"><span className="text-blue-400"><Activity size={12} /></span><span className="text-xs font-mono font-semibold tracking-wider uppercase text-blue-400">Quick Stats</span></div>
      <div className="mt-2">{rows.map(([k,v])=><div key={k} className="flex justify-between text-xs font-mono border-b border-gray-800 py-1.5"><span className="text-gray-600">{k}</span><span className="text-gray-200 font-semibold">{v}</span></div>)}</div>
    </div>
  );
}

const Panel = ({ children, className = "" }) => <div className={"bg-gray-950 border border-gray-800 rounded p-3 flex flex-col " + className}>{children}</div>;

export default function App() {
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
    Promise.all(WATCHLIST.map(s=>api("/quote?symbol="+s).then(q=>({symbol:s,price:q.c,changePct:q.dp})))).then(setTapeData);
  }, []);

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col" style={{ fontFamily: "'Courier New', monospace" }}>
      <TickerTape tapeData={tapeData} />
      <TopNav ticker={ticker} setTicker={setTicker} quote={quote} loading={loading} />
      <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "1fr 310px 260px", gridTemplateRows: "380px auto auto" }}>
        <Panel style={{ gridColumn: "1/2", gridRow: "1/2" }}>
          <div className="flex items-center gap-1.5 mb-2"><span className="text-blue-400"><Activity size={12} /></span><span className="text-xs font-mono font-semibold tracking-wider uppercase text-blue-400">{ticker} Price Chart</span></div>
          <div style={{ height: 280, minHeight: 280 }}><PriceChart ticker={ticker} /></div>
        </Panel>
        <Panel style={{ gridColumn: "2/3", gridRow: "1/2" }}><KeyMetrics quote={quote} metrics={metrics} /></Panel>
        <Panel style={{ gridColumn: "3/4", gridRow: "1/3" }}>
          <div className="flex items-center gap-1.5 mb-2"><span className="text-blue-400"><Calendar size={12} /></span><span className="text-xs font-mono font-semibold tracking-wider uppercase text-blue-400">Upcoming Events</span></div>
          <div className="mt-2 overflow-y-auto flex-1"><EventsCalendar earnings={earnings} /></div>
        </Panel>
        <Panel style={{ gridColumn: "1/2", gridRow: "2/3", minHeight: 240 }}>
          <div className="flex items-center gap-1.5 mb-2"><span className="text-blue-400"><DollarSign size={12} /></span><span className="text-xs font-mono font-semibold tracking-wider uppercase text-blue-400">Financial Statements</span></div>
          <div style={{ height: 200, minHeight: 200, overflowY: "auto" }}><FinancialStatements ticker={ticker} /></div>
        </Panel>
        <Panel style={{ gridColumn: "2/3", gridRow: "2/3" }}><QuickStats quote={quote} metrics={metrics} /></Panel>
        <Panel style={{ gridColumn: "1/2", gridRow: "3/4" }}><CompanyProfile profile={profile} /></Panel>
        <Panel style={{ gridColumn: "2/3", gridRow: "3/4" }}>
          <div className="flex items-center gap-1.5 mb-2"><span className="text-blue-400"><Newspaper size={12} /></span><span className="text-xs font-mono font-semibold tracking-wider uppercase text-blue-400">News & Sentiment</span></div>
          <div className="mt-2 overflow-y-auto flex-1"><NewsFeed news={news} /></div>
        </Panel>
        <Panel style={{ gridColumn: "3/4", gridRow: "3/4" }}>
          <div className="flex items-center gap-1.5 mb-2"><span className="text-blue-400"><Star size={12} /></span><span className="text-xs font-mono font-semibold tracking-wider uppercase text-blue-400">Watchlist</span></div>
          <div className="mt-2">
            {tapeData.map(t => (
              <div key={t.symbol} className="flex justify-between items-center py-1.5 border-b border-gray-800 cursor-pointer hover:bg-gray-900 px-1 rounded transition-colors" onClick={()=>setTicker(t.symbol)}>
                <span className="text-gray-300 text-xs font-mono font-bold">{t.symbol}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-200 text-xs font-mono">${fmt.price(t.price)}</span>
                  <span className="text-xs font-mono font-bold" style={{color:clr(t.changePct)}}>{t.changePct>=0?"▲":"▼"}{Math.abs(t.changePct||0).toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="flex items-center gap-4 px-4 py-1.5 border-t border-gray-800 bg-gray-950 text-xs font-mono text-gray-600">
        <span>LIVE DATA · FINNHUB.IO</span>
        <span className="text-gray-800">|</span>
        <span>Type a ticker and press Enter to search</span>
        <span className="ml-auto">Last Updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}