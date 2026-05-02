import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api, fetchChart } from "../../lib/api";
import { fmt, delay, fmtMktCap, fmtX, fmtN, fmtMgn, fmtGr, clrM2 } from "../../lib/fmt";

function AnalystData({ ticker }) {
  const [data, setData] = useState(null);
  const [targets, setTargets] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [insider, setInsider] = useState(null);

  useEffect(() => {
    // Use allSettled so one failing/paid endpoint doesn't wipe the others
    Promise.allSettled([
      api("/stock/recommendation?symbol=" + ticker),
      api("/stock/price-target?symbol=" + ticker),
      api("/stock/earnings?symbol=" + ticker + "&limit=4"),
      api("/stock/insider-transactions?symbol=" + ticker),
    ]).then(([rec, tgt, earn, ins]) => {
      const r = rec.status === "fulfilled"  ? rec.value  : null;
      const t = tgt.status === "fulfilled"  ? tgt.value  : null;
      const e = earn.status === "fulfilled" ? earn.value : null;
      const i = ins.status === "fulfilled"  ? ins.value  : null;
      setData(Array.isArray(r) ? (r[0] || null) : null);
      setTargets(t?.targetMean ? t : null);
      setEarnings(e?.data?.slice(0, 4) || []);
      setInsider(i?.data?.slice(0, 6) || []);
    });
  }, [ticker]);

  const total = data ? (data.buy + data.hold + data.sell + data.strongBuy + data.strongSell) : 0;
  const bullPct = total ? Math.round(((data.buy + data.strongBuy) / total) * 100) : 0;
  const bearPct = total ? Math.round(((data.sell + data.strongSell) / total) * 100) : 0;
  const holdPct = total ? Math.round((data.hold / total) * 100) : 0;

  return (
    <div className="h-full grid gap-2" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>

      <div>
        <div className="terminal-header mb-2">📊 Analyst Ratings</div>
        {!data ? <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>Loading...</div> : (
          <div>
            <div className="flex gap-1 mb-2" style={{ height: 8, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ width: bullPct + "%", background: "#059669" }} />
              <div style={{ width: holdPct + "%", background: "#b45309" }} />
              <div style={{ width: bearPct + "%", background: "#e11d48" }} />
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[["Strong Buy", data.strongBuy, "#059669"], ["Buy", data.buy, "#059669"], ["Hold", data.hold, "#b45309"], ["Sell", data.sell, "#e11d48"], ["Strong Sell", data.strongSell, "#e11d48"]].map(([l, v, c]) => (
                <div key={l} className="p-1 rounded" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
                  <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{l}</div>
                  <div className="text-sm font-mono font-bold" style={{ color: c }}>{v}</div>
                </div>
              ))}
              <div className="p-1 rounded" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
                <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>Period</div>
                <div className="text-xs font-mono" style={{ color: "var(--text-1)" }}>{data.period}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="terminal-header mb-2">🎯 Price Targets</div>
        {!targets ? <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>Loading...</div> :
         !targets.targetMean ? <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>Not available on free tier</div> : (
          <div className="flex flex-col gap-1">
            {[["High", targets.targetHigh, "#059669"], ["Average", targets.targetMean, "#2563eb"], ["Low", targets.targetLow, "#e11d48"], ["Updated", targets.lastUpdated, "#64748b"]].map(([l, v, c]) => (
              <div key={l} className="flex justify-between py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{l}</span>
                <span className="text-xs font-mono font-bold" style={{ color: c }}>{l === "Updated" ? v?.slice(0,10) : v ? "$" + v.toFixed(2) : "N/A"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ overflowY: "auto" }}>
        <div className="terminal-header mb-2">📈 Earnings Surprises</div>
        {!earnings ? <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>Loading...</div> : (
          <div className="flex flex-col gap-1">
            {earnings.map((e, i) => {
              const surprise = e.actual - e.estimate;
              const pct = e.estimate ? (surprise / Math.abs(e.estimate) * 100).toFixed(1) : 0;
              return (
                <div key={i} className="flex justify-between items-center py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{e.period}</span>
                  <span className="text-xs font-mono" style={{ color: "var(--text-3)" }}>Est: ${e.estimate?.toFixed(2)}</span>
                  <span className="text-xs font-mono" style={{ color: "var(--text-1)" }}>Act: ${e.actual?.toFixed(2)}</span>
                  <span className="text-xs font-mono font-bold" style={{ color: surprise >= 0 ? "#059669" : "#e11d48" }}>{surprise >= 0 ? "+" : ""}{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ overflowY: "auto" }}>
        <div className="terminal-header mb-2">🏦 Insider Transactions</div>
        {!insider ? <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>Loading...</div> : (
          <div className="flex flex-col gap-1">
            {insider.map((t, i) => (
              <div key={i} className="flex justify-between items-center py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="text-xs font-mono" style={{ color: "var(--text-1)" }}>{t.name?.split(" ").slice(-1)[0]}</div>
                  <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{t.transactionDate}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold" style={{ color: t.change > 0 ? "#059669" : "#e11d48" }}>
                    {t.change > 0 ? "BUY" : "SELL"} {Math.abs(t.change).toLocaleString()}
                  </div>
                  <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>${t.transactionPrice?.toFixed(2)}</div>
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
    <div className="flex items-center justify-center h-full text-xs font-mono animate-pulse" style={{ color: "var(--text-3)" }}>
      Loading peer data...
    </div>
  );

  return (
    <div style={{ overflowX: "auto", overflowY: "auto", height: "100%" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace", minWidth: 600 }}>
        <thead>
          <tr style={{ position: "sticky", top: 0, background: "var(--surface-1)", zIndex: 1 }}>
            <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--text-3)", fontWeight: 500, borderBottom: "2px solid var(--border-solid)", minWidth: 120 }}>Metric</th>
            {allTickers.map(t => (
              <th key={t} style={{ textAlign: "right", padding: "6px 10px", borderBottom: "2px solid var(--border-solid)", minWidth: 90, color: t === ticker ? "#2563eb" : "#64748b", fontWeight: t === ticker ? 700 : 500 }}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map(m => {
            const best = getBest(m, allTickers, allData);
            return (
              <tr key={m.label} style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => e.currentTarget.style.background = "#ffffff"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "5px 10px", color: "var(--text-3)", fontWeight: 500 }}>{m.label}</td>
                {allTickers.map(t => {
                  const d = allData[t];
                  const val = d ? m.fn(d.quote, d.metrics) : "...";
                  const isBest = best === t;
                  const isMain = t === ticker;
                  return (
                    <td key={t} style={{ textAlign: "right", padding: "5px 10px", color: isBest ? "#059669" : isMain ? "#0f172a" : "#64748b", fontWeight: isMain ? 600 : 400, background: isBest ? "rgba(5,150,105,0.05)" : "transparent" }}>
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

function FinancialStatements({ ticker }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState("income");
  const [data, setData] = useState(null);
  useEffect(() => {
    api("/stock/financials-reported?symbol=" + ticker + "&freq=quarterly")
      .then(d => setData(d.data?.slice(0,40) || []))
      .catch(() => setData([]));
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
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: "var(--surface-0)", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <span className="terminal-header">📊 Financial Statements — {ticker}</span>
            <div className="flex">
              {tabs.map(t => <button key={t.key} onClick={()=>setTab(t.key)} className="px-3 py-1 text-xs font-mono border-b-2 transition-colors" style={{ borderBottomColor: tab===t.key?"#2563eb":"transparent", color: tab===t.key?"#2563eb":"#64748b", background:"transparent" }}>{t.label}</button>)}
            </div>
          </div>
          <button onClick={() => setExpanded(false)} style={{ color: "var(--text-3)", background: "var(--surface-1)", border: "1px solid var(--border-solid)", borderRadius: 10, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>✕ Close</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace" }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "var(--surface-1)", zIndex: 1 }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-3)", fontWeight: 500, borderBottom: "2px solid var(--border-solid)", minWidth: 180 }}>Metric ($B)</th>
                {rows.map(r => <th key={r.period} style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-3)", fontWeight: 500, borderBottom: "2px solid var(--border-solid)", minWidth: 100 }}>{r.period}</th>)}
              </tr>
            </thead>
            <tbody>
              {cols.map(([key, label]) => (
                <tr key={key} style={{ borderBottom: "1px solid var(--border)" }} onMouseEnter={e => e.currentTarget.style.background="#ffffff"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <td style={{ padding: "7px 12px", color: "var(--text-3)", fontWeight: 500 }}>{label}</td>
                  {rows.map((r, i) => (
                    <td key={i} style={{ textAlign: "right", padding: "7px 12px", color: r[key] < 0 ? "#e11d48" : "#0f172a", fontWeight: 500 }}>
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
      <div className="flex items-center justify-between border-b mb-2" style={{ borderColor: "#e2e8f0" }}>
        <div className="flex">
          {tabs.map(t => <button key={t.key} onClick={()=>setTab(t.key)} className="px-3 py-1.5 text-xs font-mono border-b-2 transition-colors" style={{ borderBottomColor: tab===t.key?"#2563eb":"transparent", color: tab===t.key?"#2563eb":"#64748b", background:"transparent" }}>{t.label}</button>)}
        </div>
        <button onClick={() => setExpanded(true)} style={{ color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", fontSize: 10, fontFamily: "monospace", padding: "2px 8px" }}>⤢ Expand</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead><tr><th className="text-left text-gray-600 py-1 pr-3 font-normal">Metric ($B)</th>{rows.map(r=><th key={r.period} className="text-right text-gray-500 py-1 px-2 font-normal">{r.period}</th>)}</tr></thead>
          <tbody>{cols.map(([key,label])=><tr key={key} className="border-t border-gray-800"><td className="text-gray-400 py-1.5 pr-3">{label}</td>{rows.map((r,i)=><td key={i} className="text-right py-1.5 px-2 font-semibold" style={{color:r[key]<0?"#e11d48":"#e5e7eb"}}>{r[key]<0?"-$"+Math.abs(r[key]).toFixed(2):"$"+(r[key]||0).toFixed(2)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function AssetView({ ticker, quote, metrics, profile, news }) {
  const [activeTab, setActiveTab] = useState("News");
  const [chartRange, setChartRange] = useState("1Y");
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [histData, setHistData] = useState(null);

  // ── Options chain state ───────────────────────────────────────────
  const [optChain, setOptChain]       = useState(null);
  const [optLoading, setOptLoading]   = useState(false);
  const [optExpiries, setOptExpiries] = useState([]);
  const [optExpiryIdx, setOptExpiryIdx] = useState(0);

  const TABS = ["News","Options","Financials","Analyst","Peers","Profile","Historical"];
  const RANGES = ["1D","5D","1M","3M","6M","1Y","5Y","MAX"];
  const rangeMap = { "1D":"1d", "5D":"5d", "1M":"1mo", "3M":"3mo", "6M":"6mo", "1Y":"1y", "5Y":"5y", "MAX":"max" };
  const intMap =  { "1D":"5m","5D":"15m","1M":"1d","3M":"1d","6M":"1d","1Y":"1wk","5Y":"1mo","MAX":"1mo" };

  const up = quote?.dp >= 0;
  const priceColor = up ? "#059669" : "#e11d48";
  const m = metrics?.metric || {};

  // Fetch hero chart — reset loading state on every ticker/range change
  useEffect(() => {
    setChartData([]);
    setChartLoading(true);
    const range = rangeMap[chartRange] || "1y";
    const interval = intMap[chartRange] || "1wk";
    fetchChart(ticker, range, interval)
      .then(d => {
        const result = d?.chart?.result?.[0];
        if (!result) { setChartLoading(false); return; }
        const ts = result.timestamp || [];
        const closes = result.indicators?.quote?.[0]?.close || [];
        const pts = ts.map((t,i) => ({ t, v: closes[i] != null ? +closes[i].toFixed(2) : null })).filter(p => p.v != null);
        setChartData(pts);
        setChartLoading(false);
      })
      .catch(() => setChartLoading(false));
  }, [ticker, chartRange]); // eslint-disable-line

  // Reset options chain when ticker changes
  useEffect(() => {
    setOptChain(null);
    setOptExpiries([]);
    setOptExpiryIdx(0);
  }, [ticker]);

  // Fetch options chain via Yahoo Finance proxy
  const fetchOptChain = useCallback(async (idx, expiryList) => {
    setOptLoading(true);
    try {
      const useList = expiryList.length ? expiryList : optExpiries;
      const dateParam = (idx > 0 && useList[idx]) ? `&date=${useList[idx]}` : "";
      const r = await fetch(`/api/options?ticker=${encodeURIComponent(ticker)}${dateParam}`);
      const d = await r.json();
      const res = d?.optionChain?.result?.[0];
      if (!res) { setOptLoading(false); return; }
      const expList  = res.expirationDates || useList;
      const opts     = res.options?.[0] || {};
      const spot     = res.quote?.regularMarketPrice || quote?.c || 0;
      setOptExpiries(expList);
      setOptExpiryIdx(idx);
      setOptChain({ calls: opts.calls || [], puts: opts.puts || [], spot, expiries: expList, expiryIdx: idx });
    } catch (e) {
      console.error("options fetch:", e);
    }
    setOptLoading(false);
  }, [ticker, quote, optExpiries]);

  // Auto-fetch when user clicks Options tab
  useEffect(() => {
    if (activeTab === "Options" && !optChain && !optLoading) {
      fetchOptChain(0, []);
    }
  }, [activeTab, optChain, optLoading, fetchOptChain]);

  // Historical tab — re-fetch whenever ticker changes (fetchChart has 5-min cache)
  useEffect(() => {
    if (activeTab !== "Historical") return;
    setHistData(null);
    fetchChart(ticker, "3mo", "1d")
      .then(d => {
        const result = d?.chart?.result?.[0];
        if (!result) { setHistData([]); return; }
        const ts = result.timestamp || [];
        const q0 = result.indicators?.quote?.[0] || {};
        const rows = ts.map((t, i) => ({
          date: new Date(t*1000).toLocaleDateString("en-US",{month:"short",day:"2-digit",year:"numeric"}),
          open:  q0.open?.[i]?.toFixed(2),
          high:  q0.high?.[i]?.toFixed(2),
          low:   q0.low?.[i]?.toFixed(2),
          close: q0.close?.[i]?.toFixed(2),
          vol:   q0.volume?.[i],
        })).filter(r => r.close).reverse();
        setHistData(rows);
      })
      .catch(() => setHistData([]));
  }, [activeTab, ticker]); // eslint-disable-line

  // Quick helpers
  const fmtRange = (lo, hi) => lo && hi ? `$${fmtN(lo)} – $${fmtN(hi)}` : "—";

  const metricsGrid = [
    { label:"Open",        value: quote?.o != null ? "$"+fmt.price(quote.o) : "—" },
    { label:"Day Range",   value: fmtRange(quote?.l, quote?.h) },
    { label:"Volume",      value: quote?.v != null ? fmt.volume(quote.v) : "—" },
    { label:"Market Cap",  value: fmtMktCap(m.marketCapitalization) },
    { label:"52W Range",   value: fmtRange(m["52WeekLow"], m["52WeekHigh"]) },
    { label:"Avg Vol 10D", value: m["10DayAverageTradingVolume"] != null ? (m["10DayAverageTradingVolume"]).toFixed(1)+"M" : "—" },
    { label:"P/E (TTM)",   value: fmtX(m.peBasicExclExtraTTM) },
    { label:"EPS (TTM)",   value: m.epsBasicExclExtraItemsTTM != null ? "$"+fmtN(m.epsBasicExclExtraItemsTTM) : "—" },
  ];

  // ── Tab content renderers ─────────────────────────────────────────────────
  const renderNews = () => {
    if (!news) return <div style={{ color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>Loading news…</div>;
    if (!news.length) return <div style={{ color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>No recent news</div>;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"var(--text-3)", marginBottom:2 }}>
          {news.length} article{news.length !== 1 ? "s" : ""} · last 30 days
        </div>
        {news.map((n,i) => {
          const ts = n.datetime ? new Date(n.datetime*1000) : null;
          const ago = ts ? Math.floor((Date.now()-ts)/86400000) : null;
          return (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
              <div className="news-card" style={{ padding:"8px 10px", background:"var(--surface-0)" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=""}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:10, marginBottom:3 }}>
                  <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:500, color:"var(--text-1)", lineHeight:1.4 }}>{n.headline}</span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"var(--text-3)", flexShrink:0 }}>
                    {ago===0?"Today":ago===1?"1d ago":ago!=null?ago+"d ago":""}
                  </span>
                </div>
                <span style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:"#2563eb" }}>{n.source}</span>
              </div>
            </a>
          );
        })}
      </div>
    );
  };

  const renderOptions = () => {
    // Loading state
    if (optLoading) return (
      <div style={{ padding:"40px 0", textAlign:"center", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"var(--text-3)" }}>
        Loading options chain for <strong style={{ color:"var(--text-1)" }}>{ticker}</strong>…
      </div>
    );

    // Not yet fetched
    if (!optChain) return (
      <div style={{ padding:"40px 0", textAlign:"center", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"var(--text-3)" }}>
        Click <strong>Options</strong> tab to load live chain
      </div>
    );

    const { calls, puts, spot, expiries } = optChain;
    const callMap = new Map(calls.map(c => [c.strike, c]));
    const putMap  = new Map(puts.map(p  => [p.strike, p]));
    const allStrikes = [...new Set([...calls.map(c => c.strike), ...puts.map(p => p.strike)])].sort((a,b)=>a-b);

    const fmtIV  = v  => v  != null ? (v  * 100).toFixed(1) + "%" : "—";
    const fmtPx  = v  => v  != null ? "$" + v.toFixed(2)          : "—";
    const fmtInt = v  => v  != null ? v.toLocaleString()           : "—";

    const selectStyle = {
      fontFamily:"'IBM Plex Mono',monospace", fontSize:10, padding:"2px 6px",
      background:"var(--surface-1)", color:"var(--text-1)",
      border:"1px solid var(--border-solid)", borderRadius:4, cursor:"pointer",
    };

    return (
      <div>
        {/* Header row — expiry selector + spot */}
        <div style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:"var(--text-3)", marginBottom:8, display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontWeight:600, color:"var(--text-1)" }}>Expiry:</span>
          <select style={selectStyle} value={optExpiryIdx}
            onChange={e => fetchOptChain(+e.target.value, expiries)}>
            {expiries.map((ts, i) => (
              <option key={i} value={i}>
                {new Date(ts * 1000).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}
              </option>
            ))}
          </select>
          <span>Spot: <strong style={{ color:"var(--text-1)" }}>${fmt.price(spot)}</strong></span>
          <span style={{ color:"#059669", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }}>● Live · Yahoo Finance</span>
        </div>

        {/* Calls | Strike | Puts grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:0 }}>
          {/* CALLS */}
          <table className="dense-table">
            <thead><tr>
              <th style={{ textAlign:"left" }}>IV</th>
              <th>Bid</th><th>Ask</th><th>OI</th><th>Vol</th>
            </tr></thead>
            <tbody>
              {allStrikes.map(k => {
                const c   = callMap.get(k);
                const itm = k < spot;
                return (
                  <tr key={k} style={{ background: itm ? "rgba(5,150,105,0.05)" : "transparent" }}>
                    <td style={{ color:"var(--text-3)", textAlign:"left" }}>{fmtIV(c?.impliedVolatility)}</td>
                    <td style={{ color:"#059669" }}>{fmtPx(c?.bid)}</td>
                    <td style={{ color:"#e11d48" }}>{fmtPx(c?.ask)}</td>
                    <td style={{ color:"var(--text-3)" }}>{fmtInt(c?.openInterest)}</td>
                    <td style={{ color:"var(--text-3)" }}>{fmtInt(c?.volume)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* STRIKE column */}
          <div style={{ display:"flex", flexDirection:"column" }}>
            <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:600, textTransform:"uppercase",
              letterSpacing:"0.08em", color:"var(--text-3)", padding:"5px 14px 6px",
              borderBottom:"1px solid rgba(15,23,42,0.07)", textAlign:"center" }}>STRIKE</div>
            {allStrikes.map(k => {
              const atm = Math.abs(k - spot) / spot < 0.006;
              return (
                <div key={k} style={{ padding:"4px 14px", borderBottom:"1px solid rgba(15,23,42,0.05)",
                  fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700,
                  color: atm ? "#2563eb" : "#475569", textAlign:"center",
                  background: atm ? "rgba(37,99,235,0.08)" : "transparent" }}>
                  {k % 1 === 0 ? k : k.toFixed(2)}
                </div>
              );
            })}
          </div>

          {/* PUTS */}
          <table className="dense-table">
            <thead><tr>
              <th>Bid</th><th>Ask</th><th>OI</th><th>Vol</th>
              <th style={{ textAlign:"right" }}>IV</th>
            </tr></thead>
            <tbody>
              {allStrikes.map(k => {
                const p   = putMap.get(k);
                const itm = k > spot;
                return (
                  <tr key={k} style={{ background: itm ? "rgba(225,29,72,0.05)" : "transparent" }}>
                    <td style={{ color:"#059669" }}>{fmtPx(p?.bid)}</td>
                    <td style={{ color:"#e11d48" }}>{fmtPx(p?.ask)}</td>
                    <td style={{ color:"var(--text-3)" }}>{fmtInt(p?.openInterest)}</td>
                    <td style={{ color:"var(--text-3)" }}>{fmtInt(p?.volume)}</td>
                    <td style={{ color:"var(--text-3)", textAlign:"right" }}>{fmtIV(p?.impliedVolatility)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:"var(--text-3)", marginTop:10, textAlign:"center" }}>
          Calls (ITM green) · ATM blue · Puts (ITM red) · Data via Yahoo Finance
        </div>
      </div>
    );
  };

  const renderFinancials = () => {
    const rows = [
      ["Gross Margin (Ann.)", fmtMgn(m.grossMarginAnnual), fmtMgn(m.grossMarginTTM)],
      ["Operating Margin",   fmtMgn(m.operatingMarginAnnual), fmtMgn(m.operatingMarginTTM)],
      ["Net Margin",         fmtMgn(m.netMarginAnnual), fmtMgn(m.netMarginTTM)],
      ["ROE",                fmtMgn(m.roeRfy), fmtMgn(m.roeTTM)],
      ["ROA",                fmtMgn(m.roaRfy), fmtMgn(m.roaTTM)],
      ["ROIC",               fmtMgn(m.roiAnnual), fmtMgn(m.roiTTM)],
      ["Rev Growth QoQ YoY", fmtGr(m.revenueGrowthQuarterlyYoy), fmtGr(m.revenueGrowthTTMYoy)],
      ["EPS Growth QoQ YoY", fmtGr(m.epsGrowthQuarterlyYoy), fmtGr(m.epsGrowthTTMYoy)],
      ["Current Ratio",      fmtN(m.currentRatioAnnual), "—"],
      ["Quick Ratio",        fmtN(m.quickRatioAnnual), "—"],
      ["Debt / Equity",      fmtN(m["totalDebt/totalEquityAnnual"]), "—"],
      ["EV/EBITDA (Ann.)",   fmtX(m.evEbitdaAnnual), fmtX(m.evEbitdaTTM)],
      ["P/E",                fmtX(m.peBasicExclExtraTTM), fmtX(m.peNormalizedAnnual)],
    ];
    return (
      <table className="dense-table">
        <thead><tr>
          <th style={{ textAlign:"left" }}>Metric</th>
          <th>Annual</th>
          <th>TTM</th>
        </tr></thead>
        <tbody>
          {rows.map(([k,a,t]) => (
            <tr key={k}>
              <td style={{ color:"var(--text-3)", textAlign:"left" }}>{k}</td>
              <td style={{ color: a!=="—"?clrM2(a):"#64748b" }}>{a||"—"}</td>
              <td style={{ color: t!=="—"?clrM2(t):"#64748b" }}>{t||"—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderProfile = () => {
    if (!profile || !profile.name) return <div style={{ color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>Loading profile…</div>;
    const fields = [
      ["Full Name",    profile.name],
      ["Industry",     profile.finnhubIndustry],
      ["Exchange",     profile.exchange],
      ["Country",      profile.country],
      ["Currency",     profile.currency],
      ["IPO Date",     profile.ipo],
      ["Website",      profile.weburl],
      ["Shares Out.",  profile.shareOutstanding != null ? profile.shareOutstanding.toFixed(2)+"M" : null],
    ];
    return (
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 24px" }}>
        <div>
          {profile.logo && <img src={profile.logo} alt="" style={{ height:36, width:36, objectFit:"contain", borderRadius:8, background:"var(--surface-1)", padding:4, marginBottom:12 }} />}
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:"#475569", lineHeight:1.7, marginBottom:12 }}>{profile.description}</p>
        </div>
        <table className="dense-table" style={{ alignSelf:"start" }}>
          <tbody>
            {fields.filter(([,v])=>v).map(([k,v]) => (
              <tr key={k}>
                <td style={{ color:"var(--text-3)", textAlign:"left" }}>{k}</td>
                <td style={{ color:"var(--text-1)" }}>
                  {k==="Website"
                    ? <a href={v} target="_blank" rel="noopener noreferrer" style={{ color:"#2563eb", textDecoration:"none" }}>{v.replace(/^https?:\/\//,"").replace(/\/$/,"")}</a>
                    : v}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderHistorical = () => {
    if (!histData) return <div style={{ color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>Loading…</div>;
    if (!histData.length) return <div style={{ color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>No data</div>;
    return (
      <table className="dense-table">
        <thead>
          <tr>
            <th style={{ textAlign:"left" }}>Date</th>
            <th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th>
          </tr>
        </thead>
        <tbody>
          {histData.map((r,i) => {
            const dayUp = +r.close >= +r.open;
            return (
              <tr key={i}>
                <td style={{ color:"var(--text-3)", textAlign:"left" }}>{r.date}</td>
                <td>${r.open}</td>
                <td style={{ color:"#059669" }}>${r.high}</td>
                <td style={{ color:"#e11d48" }}>${r.low}</td>
                <td style={{ color: dayUp?"#059669":"#e11d48", fontWeight:600 }}>${r.close}</td>
                <td style={{ color:"var(--text-3)" }}>{r.vol ? fmt.volume(r.vol) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* TIER 1: Price Hero */}
      <div className="asset-hero">
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              {profile?.logo && <img src={profile.logo} alt="" style={{ height:18, width:18, objectFit:"contain", borderRadius:4, background:"var(--surface-1)", padding:1 }} />}
              <span className="asset-ticker-name">{ticker}</span>
              <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:"var(--text-3)" }}>{profile?.name}</span>
              {profile?.exchange && <span style={{ fontFamily:"'Inter',sans-serif", fontSize:9, background:"var(--surface-3)", color:"var(--text-3)", borderRadius:4, padding:"1px 5px" }}>{profile.exchange}</span>}
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
              <span className="asset-price">{quote?.c != null ? "$"+fmt.price(quote.c) : "—"}</span>
              {quote?.d != null && (
                <span className="asset-change" style={{ color:priceColor }}>
                  {up?"+":""}{fmt.price(quote.d)} ({fmt.pct(quote.dp||0)})
                </span>
              )}
            </div>
          </div>
          {/* TF range buttons */}
          <div className="tf-btn-group">
            {RANGES.map(r => (
              <button key={r} className={"tf-btn"+(chartRange===r?" active":"")} onClick={() => setChartRange(r)}>{r}</button>
            ))}
          </div>
        </div>
        {/* Chart — always reserve space; skeleton while loading */}
        <div style={{ height:180, marginTop:8, position:"relative" }}>
          {chartLoading && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
              background:"var(--surface-0)", borderRadius:6 }}>
              <div style={{ width:"100%", height:"100%", background:`linear-gradient(90deg, var(--surface-0) 25%, var(--surface-2) 50%, var(--surface-0) 75%)`,
                backgroundSize:"200% 100%", borderRadius:6, animation:"shimmer 1.4s infinite",
                opacity:0.7 }} />
            </div>
          )}
          {!chartLoading && chartData.length === 0 && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"var(--text-3)" }}>
                Chart data unavailable
              </span>
            </div>
          )}
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top:4, right:0, bottom:0, left:0 }}>
                <defs>
                  <linearGradient id={"avg_"+ticker.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={priceColor} stopOpacity={0.18}/>
                    <stop offset="95%" stopColor={priceColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" hide />
                <YAxis domain={["auto","auto"]} hide />
                <Tooltip contentStyle={{ background:"var(--surface-2)", border:"1px solid var(--border-solid)", borderRadius:8, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" }}
                  labelFormatter={t => new Date(t*1000).toLocaleDateString()}
                  formatter={v=>["$"+v?.toFixed(2),"Price"]} />
                <Area type="monotone" dataKey="v" stroke={priceColor} strokeWidth={1.5}
                  fill={"url(#avg_"+ticker.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* TIER 2: At-a-Glance Metrics */}
      <div className="asset-metrics-grid">
        {metricsGrid.map(({ label, value }) => (
          <div key={label} className="metric-cell">
            <div className="metric-cell-label">{label}</div>
            <div className="metric-cell-value">{value}</div>
          </div>
        ))}
      </div>

      {/* TIER 3: Tabbed Workspace */}
      <div className="asset-tabs-bar">
        {TABS.map(t => (
          <button key={t} className={"asset-tab-btn"+(activeTab===t?" active":"")} onClick={() => setActiveTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="asset-tab-content">
        {activeTab==="News"       && renderNews()}
        {activeTab==="Options"    && renderOptions()}
        {activeTab==="Financials" && (
          <div className="flex flex-col gap-4">
            {renderFinancials()}
            <FinancialStatements ticker={ticker} />
          </div>
        )}
        {activeTab==="Analyst"    && <AnalystData ticker={ticker} />}
        {activeTab==="Peers"      && <PeerComparison ticker={ticker} metrics={metrics} quote={quote} />}
        {activeTab==="Profile"    && renderProfile()}
        {activeTab==="Historical" && renderHistorical()}
      </div>
    </div>
  );
}
