import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../../../lib/api";
import { fmt, clr, delay, fmtMktCap, fmtX, fmtN, fmtMgn, fmtGr, clrM } from "../../../lib/fmt";
import RelatedLinks from "./RelatedLinks";

export default function EquityResearchPanel({ item, onClose, onOpen }) {
  const TABS = ["Overview","Financials","Valuation","News","Peers"];
  const [activeTab, setActiveTab] = useState("Overview");
  const [quote, setQuote]         = useState(null);
  const [profile, setProfile]     = useState(null);
  const [metrics, setMetrics]     = useState(null);
  const [chartData, setChartData] = useState([]);
  const [chartRange, setChartRange] = useState("1Y");
  const [loadingBase, setLoadingBase] = useState(true);
  const [baseError, setBaseError]   = useState(false);
  const [earnings, setEarnings]   = useState(null);
  const [recs, setRecs]           = useState(null);
  const [pt, setPt]               = useState(undefined);
  const [news, setNews]           = useState(null);
  const [peers, setPeers]         = useState(null);
  const [peerQ, setPeerQ]         = useState({});
  const [peerM, setPeerM]         = useState({});
  const loadedTabs = useRef(new Set(["Overview"]));

  useEffect(() => {
    setLoadingBase(true);
    setBaseError(false);
    setActiveTab("Overview");
    loadedTabs.current = new Set(["Overview"]);
    setEarnings(null); setRecs(null); setPt(undefined);
    setNews(null); setPeers(null); setPeerQ({}); setPeerM({});

    Promise.all([
      api("/quote?symbol=" + item.ticker),
      delay(150).then(() => api("/stock/profile2?symbol=" + item.ticker)),
      delay(300).then(() => api("/stock/metric?symbol=" + item.ticker + "&metric=all")),
    ]).then(([q, p, metaRaw]) => {
      setQuote(q);
      setProfile(p || {});
      setMetrics(metaRaw?.metric || null);
      setLoadingBase(false);
    }).catch(() => { setLoadingBase(false); setBaseError(true); });
  }, [item.ticker]); // eslint-disable-line

  const EQ_RANGE_MAP = { "1D":"1d","5D":"5d","1M":"1mo","3M":"3mo","6M":"6mo","1Y":"1y","5Y":"5y","MAX":"max" };
  const EQ_INT_MAP   = { "1D":"5m","5D":"15m","1M":"1d","3M":"1d","6M":"1d","1Y":"1d","5Y":"1wk","MAX":"1mo" };
  useEffect(() => {
    const range    = EQ_RANGE_MAP[chartRange] || "1y";
    const interval = EQ_INT_MAP[chartRange]   || "1d";
    fetch("/api/chart?ticker=" + encodeURIComponent(item.ticker) + "&range=" + range + "&interval=" + interval)
      .then(r => r.json()).then(c => {
        const result = c?.chart?.result?.[0];
        if (!result) return;
        const ts     = result.timestamp || [];
        const closes = result.indicators?.quote?.[0]?.close || [];
        const raw = ts.map((t,i) => ({ t, v: closes[i] != null ? +closes[i].toFixed(2) : null })).filter(d => d.v != null);
        const withMA = raw.map((d,i) => {
          if (i < 49) return d;
          const avg = raw.slice(i-49, i+1).reduce((s,x) => s+x.v, 0) / 50;
          return { ...d, ma50: +avg.toFixed(2) };
        });
        setChartData(withMA);
      }).catch(() => setChartData([]));
  }, [item.ticker, chartRange]); // eslint-disable-line

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
      api("/stock/recommendation?symbol=" + item.ticker)
        .then(r => setRecs(Array.isArray(r) ? r : []))
        .catch(() => setRecs([]));
      delay(150)
        .then(() => api("/stock/price-target?symbol=" + item.ticker))
        .then(p => setPt(p?.targetMean ? p : null))
        .catch(() => setPt(null));
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
  const priceColor = up ? "#059669" : "#e11d48";

  const pct52 = m["52WeekHigh"] && m["52WeekLow"] && quote?.c
    ? Math.min(100, Math.max(0, ((quote.c - m["52WeekLow"]) / (m["52WeekHigh"] - m["52WeekLow"])) * 100))
    : null;

  const errBox = msg => (
    <div className="flex items-center gap-2 font-mono" style={{ color:"#e11d48", background:"rgba(225,29,72,0.06)", border:"1px solid rgba(225,29,72,0.18)", borderRadius:6, padding:"10px 14px", fontSize:11, marginBottom:8 }}>⚠ {msg}</div>
  );

  const renderOverview = () => (
    <div>
      {profile && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {profile.logo && <img src={profile.logo} alt="" style={{ height:20, width:20, objectFit:"contain", borderRadius:6, background:"var(--surface-1)", padding:2 }} />}
          {profile.finnhubIndustry && <span className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>{profile.finnhubIndustry}</span>}
          {profile.exchange         && <span className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>· {profile.exchange}</span>}
          {profile.country          && <span className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>· {profile.country}</span>}
          {profile.weburl && <a href={profile.weburl} target="_blank" rel="noopener noreferrer" className="font-mono ml-auto" style={{ color:"#2563eb", fontSize:10 }}>{profile.weburl.replace(/^https?:\/\//,"").replace(/\/$/,"")}</a>}
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns:"1fr 300px" }}>
        <div>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="font-mono font-bold" style={{ color:"var(--text-1)", fontSize:30 }}>${fmt.price(quote?.c)}</span>
            <span className="font-mono" style={{ color:priceColor, fontSize:14 }}>
              {quote?.d != null ? fmt.change(quote.d) : ""} ({fmt.pct(quote?.dp || 0)})
            </span>
          </div>

          <div className="tf-btn-group" style={{ marginBottom:6 }}>
            {["1D","5D","1M","3M","6M","1Y","5Y","MAX"].map(r => (
              <button key={r} className={"tf-btn"+(chartRange===r?" active":"")} onClick={() => setChartRange(r)}>{r}</button>
            ))}
          </div>
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
                    tick={{ fill:"#64748b", fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }} tickLine={false} axisLine={false} interval={35} />
                  <YAxis domain={["auto","auto"]} hide />
                  <Tooltip
                    contentStyle={{ background:"var(--surface-2)", border:"1px solid rgba(15,23,42,0.18)", borderRadius:10, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}
                    labelFormatter={t => new Date(t*1000).toLocaleDateString()}
                    formatter={(v,n) => [v != null ? "$"+v.toFixed(2) : "—", n==="v" ? "Price" : "MA 50"]} />
                  <Area type="monotone" dataKey="v" stroke={priceColor} strokeWidth={1.5} fill={"url(#eqg_"+item.ticker.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="ma50" stroke="#b45309" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {pct52 != null && (
            <div className="mb-3">
              <div className="flex justify-between font-mono mb-1.5" style={{ color:"var(--text-3)", fontSize:9 }}>
                <span>52W LOW ${fmtN(m["52WeekLow"])}</span>
                <span style={{ color:"var(--text-3)" }}>52-WEEK RANGE</span>
                <span>${fmtN(m["52WeekHigh"])} 52W HIGH</span>
              </div>
              <div style={{ position:"relative", height:4, background:"var(--surface-3)", borderRadius:2 }}>
                <div style={{ position:"absolute", left:0, width:pct52+"%", height:"100%", background: pct52>70?"#059669":pct52<30?"#e11d48":"#b45309", borderRadius:2 }} />
                <div style={{ position:"absolute", left:pct52+"%", top:-3, width:2, height:10, background:"#0f172a", borderRadius:1, transform:"translateX(-50%)" }} />
              </div>
            </div>
          )}

          {profile?.description && (
            <div className="mt-2">
              <div className="font-mono mb-1" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>About</div>
              <p className="font-mono" style={{ color:"var(--text-3)", fontSize:10, lineHeight:1.7, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                {profile.description}
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Key Statistics</div>
          <div style={{ borderTop:"1px solid rgba(15,23,42,0.09)" }}>
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
              <div key={k} className="flex justify-between py-1.5 font-mono" style={{ borderBottom:"1px solid rgba(15,23,42,0.06)" }}>
                <span style={{ color:"var(--text-3)", fontSize:10 }}>{k}</span>
                <span style={{ color:"var(--text-1)", fontSize:10 }}>{v || "—"}</span>
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
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns:"1fr 1fr" }}>
        <div>
          <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Profitability</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["","Annual","TTM"].map((h,i) => (
                <th key={h} className="font-mono pb-1" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right" }}>{h}</th>
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
                  <td className="font-mono py-1.5" style={{ color:"var(--text-3)", fontSize:10 }}>{k}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:clrM(ann), fontSize:10 }}>{fmtMgn(ann)}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:clrM(ttm), fontSize:10 }}>{fmtMgn(ttm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Returns &amp; Efficiency</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["","Annual","TTM"].map((h,i) => (
                <th key={h} className="font-mono pb-1" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right" }}>{h}</th>
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
                  <td className="font-mono py-1.5" style={{ color:"var(--text-3)", fontSize:10 }}>{k}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:clrM(ann), fontSize:10 }}>{fmtMgn(ann)}</td>
                  <td className="font-mono py-1.5 text-right" style={{ color:clrM(ttm), fontSize:10 }}>{fmtMgn(ttm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns:"1fr 1fr" }}>
        <div>
          <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Growth</div>
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
            <div key={k} className="flex justify-between py-1.5 font-mono" style={{ borderBottom:"1px solid rgba(15,23,42,0.06)" }}>
              <span style={{ color:"var(--text-3)", fontSize:10 }}>{k}</span>
              <span style={{ color:clrM(v), fontSize:10 }}>{fmtGr(v)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Balance Sheet</div>
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
            <div key={k} className="flex justify-between py-1.5 font-mono" style={{ borderBottom:"1px solid rgba(15,23,42,0.06)" }}>
              <span style={{ color:"var(--text-3)", fontSize:10 }}>{k}</span>
              <span style={{ color:"var(--text-1)", fontSize:10 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {earnings === null ? (
        <div className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>Loading earnings history…</div>
      ) : earnings.length > 0 ? (
        <div>
          <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Earnings History (Reported)</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:560 }}>
              <thead>
                <tr>{["Quarter","Date","EPS Actual","EPS Est.","Surprise","Rev Actual","Rev Est."].map((h,i) => (
                  <th key={h} className="font-mono pb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right", paddingRight:i===6?0:8 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {earnings.map((e,i) => {
                  const surp = e.epsActual != null && e.epsEstimate ? ((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate)) * 100 : null;
                  return (
                    <tr key={i} style={{ borderTop:"1px solid #161b22" }}>
                      <td className="font-mono py-1.5" style={{ color:"var(--text-3)", fontSize:10 }}>Q{e.quarter} {e.year}</td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"var(--text-3)", fontSize:10, paddingRight:8 }}>{e.date}</td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"var(--text-1)", fontSize:10, paddingRight:8 }}>${fmtN(e.epsActual)}</td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"var(--text-3)", fontSize:10, paddingRight:8 }}>${fmtN(e.epsEstimate)}</td>
                      <td className="font-mono py-1.5 text-right" style={{ color: surp != null ? clr(surp) : "#64748b", fontSize:10, paddingRight:8 }}>
                        {surp != null ? (surp>=0?"+":"")+surp.toFixed(1)+"%" : "—"}
                      </td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"var(--text-1)", fontSize:10, paddingRight:8 }}>
                        {e.revenueActual != null ? "$"+(e.revenueActual/1e9).toFixed(2)+"B" : "—"}
                      </td>
                      <td className="font-mono py-1.5 text-right" style={{ color:"var(--text-3)", fontSize:10 }}>
                        {e.revenueEstimate != null ? "$"+(e.revenueEstimate/1e9).toFixed(2)+"B" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>No earnings history available</div>
      )}
    </div>
  );

  const renderValuation = () => {
    const latestRec = recs?.[0];
    const total = latestRec ? latestRec.strongBuy + latestRec.buy + latestRec.hold + latestRec.sell + latestRec.strongSell : 0;
    const segments = latestRec ? [
      { label:"Strong Buy", v:latestRec.strongBuy,   color:"#059669" },
      { label:"Buy",        v:latestRec.buy,          color:"#047857" },
      { label:"Hold",       v:latestRec.hold,         color:"#b45309" },
      { label:"Sell",       v:latestRec.sell,         color:"#be123c" },
      { label:"Strong Sell",v:latestRec.strongSell,   color:"#e11d48" },
    ] : [];
    const ptLow = pt?.targetLow, ptMean = pt?.targetMean, ptHigh = pt?.targetHigh, ptMed = pt?.targetMedian;
    const cur = quote?.c;
    const ptBarPct = ptLow && ptHigh && cur ? Math.min(100, Math.max(0, ((cur-ptLow)/(ptHigh-ptLow))*100)) : null;
    const meanBarPct = ptLow && ptHigh && ptMean ? ((ptMean-ptLow)/(ptHigh-ptLow))*100 : null;
    const upside = ptMean && cur ? ((ptMean-cur)/cur)*100 : null;
    return (
      <div className="grid gap-4" style={{ gridTemplateColumns:"1fr 1fr" }}>
        <div>
          <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Valuation Multiples</div>
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
            <div key={k} className="flex justify-between py-1.5 font-mono" style={{ borderBottom:"1px solid rgba(15,23,42,0.06)" }}>
              <span style={{ color:"var(--text-3)", fontSize:10 }}>{k}</span>
              <span style={{ color:"var(--text-1)", fontSize:10 }}>{v}</span>
            </div>
          ))}
        </div>

        <div>
          {recs === null ? (
            <div className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>Loading analyst data…</div>
          ) : latestRec ? (
            <div className="mb-4">
              <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                Analyst Consensus · {latestRec.period?.slice(0,7)} · {total} analysts
              </div>
              <div style={{ display:"flex", height:14, borderRadius:2, overflow:"hidden", marginBottom:8 }}>
                {segments.filter(s=>s.v>0).map(s => (
                  <div key={s.label} style={{ flex:s.v, background:s.color }} title={s.label+": "+s.v} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {segments.map(s => (
                  <div key={s.label} className="flex items-center gap-1 font-mono" style={{ fontSize:10 }}>
                    <div style={{ width:7, height:7, borderRadius:1, background:s.color, flexShrink:0 }} />
                    <span style={{ color:"var(--text-3)" }}>{s.label}</span>
                    <span style={{ color:"var(--text-1)", fontWeight:"bold" }}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="font-mono mb-4" style={{ color:"var(--text-3)", fontSize:10 }}>No analyst ratings available</div>
          )}

          {pt && cur ? (
            <div>
              <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Analyst Price Target</div>
              {upside != null && (
                <div className="font-mono mb-2" style={{ color:clrM(upside), fontSize:13 }}>
                  {upside>=0?"▲":"▼"} {Math.abs(upside).toFixed(1)}% to mean target
                </div>
              )}
              <div className="flex justify-between font-mono mb-1" style={{ fontSize:9, color:"var(--text-3)" }}>
                <span>Low ${fmtN(ptLow)}</span>
                <span>High ${fmtN(ptHigh)}</span>
              </div>
              <div style={{ position:"relative", height:6, background:"var(--surface-3)", borderRadius:6, marginBottom:10 }}>
                {ptBarPct != null && (
                  <div style={{ position:"absolute", left:ptBarPct+"%", top:-4, width:12, height:14, borderRadius:2, background:"#2563eb", transform:"translateX(-50%)", border:"2px solid #010409", zIndex:2 }} title={"Current: $"+fmt.price(cur)} />
                )}
                {meanBarPct != null && (
                  <div style={{ position:"absolute", left:meanBarPct+"%", top:-5, width:2, height:16, background:"#b45309", transform:"translateX(-50%)", zIndex:1 }} title={"Mean: $"+fmtN(ptMean)} />
                )}
              </div>
              <div className="grid" style={{ gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"4px 0" }}>
                {[["Low","$"+fmtN(ptLow)],["Mean","$"+fmtN(ptMean)],["Median","$"+fmtN(ptMed)],["High","$"+fmtN(ptHigh)]].map(([l,v]) => (
                  <div key={l} className="font-mono">
                    <div style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>{l}</div>
                    <div style={{ color:"var(--text-1)", fontSize:12 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : pt === null && recs !== null ? (
            <div className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>No price target available</div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderNews = () => {
    if (news === null) return <div className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>Loading news…</div>;
    if (!news.length)  return <div className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>No recent news found</div>;
    return (
      <div className="flex flex-col gap-2">
        <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9, marginBottom:2 }}>{news.length} articles</div>
        {news.map((n,i) => {
          const ts = n.datetime ? new Date(n.datetime*1000) : null;
          const dAgo = ts ? Math.floor((Date.now()-ts)/86400000) : null;
          const timeStr = dAgo===0?"Today":dAgo===1?"Yesterday":dAgo!=null?dAgo+"d ago":"";
          return (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
              <div className="p-3" style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:4 }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#e2e8f0"}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <span className="font-mono" style={{ color:"var(--text-1)", fontSize:11, lineHeight:1.5 }}>{n.headline}</span>
                  <span className="font-mono flex-shrink-0" style={{ color:"var(--text-3)", fontSize:9 }}>{timeStr}</span>
                </div>
                <div className="flex items-center gap-2">
                  {n.source   && <span className="font-mono" style={{ color:"#2563eb", fontSize:9 }}>{n.source}</span>}
                  {n.category && <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>{n.category}</span>}
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
    if (peers === null) return <div className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>Loading peers…</div>;
    if (!peers.length && allRows.length === 1) return <div className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>No peer data available</div>;
    const cols = ["Ticker","Price","Day %","Mkt Cap","P/E","EV/EBITDA","P/S","Gross Mgn","Net Mgn","ROE","Rev Grw"];
    return (
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:800 }}>
          <thead>
            <tr>{cols.map((h,i) => (
              <th key={h} className="font-mono pb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", fontWeight:"normal", textAlign:i===0?"left":"right", paddingRight:i===cols.length-1?0:10, whiteSpace:"nowrap" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {allRows.map(({ ticker, q, pm, isSelf }) => (
              <tr key={ticker} style={{ borderTop:"1px solid rgba(15,23,42,0.09)", background:isSelf?"#f8fafc":"transparent" }}>
                <td className="font-mono py-2" style={{ color:isSelf?"#2563eb":"#0f172a", fontSize:11, fontWeight:isSelf?"bold":"normal" }}>
                  {ticker}
                  {!isSelf && <button onClick={()=>onOpen({id:ticker,label:ticker,type:"equity",ticker,category:"Equities"})}
                    className="font-mono ml-2" style={{ color:"#2563eb", background:"none", border:"none", cursor:"pointer", fontSize:9 }}>→</button>}
                </td>
                <td className="font-mono py-2 text-right" style={{ color:"var(--text-1)", fontSize:10, paddingRight:10 }}>{q?.c!=null?"$"+fmt.price(q.c):"—"}</td>
                <td className="font-mono py-2 text-right" style={{ color:clr(q?.dp||0), fontSize:10, paddingRight:10 }}>{q?.dp!=null?fmt.pct(q.dp):"—"}</td>
                <td className="font-mono py-2 text-right" style={{ color:"var(--text-1)", fontSize:10, paddingRight:10 }}>{fmtMktCap(pm.marketCapitalization)}</td>
                <td className="font-mono py-2 text-right" style={{ color:"var(--text-1)", fontSize:10, paddingRight:10 }}>{fmtX(pm.peBasicExclExtraTTM)}</td>
                <td className="font-mono py-2 text-right" style={{ color:"var(--text-1)", fontSize:10, paddingRight:10 }}>{fmtX(pm.evEbitdaTTM)}</td>
                <td className="font-mono py-2 text-right" style={{ color:"var(--text-1)", fontSize:10, paddingRight:10 }}>{fmtX(pm.psAnnual)}</td>
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
      <div className="flex items-center justify-between px-4 pt-3 pb-0" style={{ borderBottom:"1px solid rgba(15,23,42,0.09)", flexShrink:0 }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono font-bold" style={{ color:"var(--text-1)", fontSize:15 }}>{item.ticker}</span>
          <span className="font-mono" style={{ color:"var(--text-3)", fontSize:12 }}>{profile?.name || item.label}</span>
          <span className="font-mono" style={{ background:"var(--surface-3)", border:"1px solid var(--border-solid)", borderRadius:6, padding:"1px 6px", fontSize:9, color:"#2563eb", textTransform:"uppercase" }}>Equity</span>
          {loadingBase && <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>Loading…</span>}
        </div>
        <button onClick={onClose} style={{ color:"var(--text-3)", background:"none", border:"none", cursor:"pointer", fontSize:14, marginLeft:8 }}>✕</button>
      </div>
      <div className="flex px-4" style={{ borderBottom:"1px solid rgba(15,23,42,0.09)", flexShrink:0, overflowX:"auto" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className="font-mono"
            style={{ background:"none", border:"none", borderBottom:activeTab===t?"2px solid #58a6ff":"2px solid transparent",
              color:activeTab===t?"#0f172a":"#64748b", fontSize:11, padding:"8px 12px", cursor:"pointer", transition:"color 0.15s",
              whiteSpace:"nowrap", flexShrink:0 }}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 p-4" style={{ overflowY:"auto" }}>
        {loadingBase
          ? <div className="flex items-center justify-center font-mono" style={{ height:200, color:"var(--text-3)", fontSize:11 }}>Loading…</div>
          : baseError
          ? errBox("Failed to load data — check your connection or try again")
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
