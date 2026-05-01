import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, Line, ReferenceLine, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Search } from "lucide-react";
import { api } from "../../lib/api";
import { fmt, clr, delay, fmtMktCap, fmtX, fmtN, fmtMgn, fmtGr, clrM, RB_TYPE_COLOR } from "../../lib/fmt";
import { RELATED_MAP, RESEARCH_CATALOG, ENTITY_INTEL, FX_RATE_PAIRS, TOPIC_CONFIG, HOME_TILES } from "../../data/researchData";
import { ResearchPanelShell, ResearchTabBar } from "../../components/ui/ResearchPanelShell";
import { IntelCard } from "../../components/ui/IntelCard";

// ── RelatedLinks ──────────────────────────────────────────────────────────────
function RelatedLinks({ itemId, onOpen }) {
  const links = RELATED_MAP[itemId] || [];
  if (!links.length) return null;
  return (
    <div className="mt-auto pt-3" style={{ borderTop:"1px solid rgba(15,23,42,0.08)" }}>
      <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Related</div>
      <div className="flex flex-wrap gap-1.5">
        {links.map(link => (
          <button key={link.id} onClick={() => onOpen(link)} className="font-mono"
            style={{ background:"rgba(15,23,42,0.06)", border:"1px solid rgba(15,23,42,0.11)", borderRadius:20, padding:"3px 10px", fontSize:10, color:RB_TYPE_COLOR[link.type]||"#64748b", cursor:"pointer", transition:"all 0.15s cubic-bezier(0.4,0,0.2,1)" }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(15,23,42,0.10)"; e.currentTarget.style.borderColor="rgba(15,23,42,0.24)"; e.currentTarget.style.transform="translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(15,23,42,0.06)"; e.currentTarget.style.borderColor="rgba(15,23,42,0.11)"; e.currentTarget.style.transform="translateY(0)"; }}>
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── EquityResearchPanel ───────────────────────────────────────────────────────
function EquityResearchPanel({ item, onClose, onOpen }) {
  const TABS = ["Overview","Financials","Valuation","News","Peers"];
  const [activeTab, setActiveTab] = useState("Overview");
  const [quote, setQuote]         = useState(null);
  const [profile, setProfile]     = useState(null);
  const [metrics, setMetrics]     = useState(null);
  const [chartData, setChartData] = useState([]);
  const [chartRange, setChartRange] = useState("1Y");
  const [loadingBase, setLoadingBase] = useState(true);
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
    }).catch(() => setLoadingBase(false));
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
      }).catch(() => {});
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
      ) : null}
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
    if (!news.length) return <div className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>No recent news found</div>;
    return (
      <div className="flex flex-col gap-2">
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

// ── CommodityResearchPanel ────────────────────────────────────────────────────
function CommodityResearchPanel({ item, onClose, onOpen }) {
  const TABS = ["Overview","Intelligence","Producers"];
  const [activeTab, setActiveTab] = useState("Overview");
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const intel = ENTITY_INTEL[item.id];

  useEffect(() => {
    setLoading(true); setChartData([]); setSummary(null); setActiveTab("Overview");
    fetch("/api/chart?ticker=" + encodeURIComponent(item.ticker) + "&range=1y&interval=1d")
      .then(r => r.json())
      .then(c => {
        const result = c?.chart?.result?.[0];
        if (result) {
          const ts     = result.timestamp || [];
          const closes = result.indicators?.quote?.[0]?.close || [];
          const data   = ts.map((t, i) => ({ t, v: closes[i] != null ? +closes[i].toFixed(4) : null })).filter(d => d.v != null);
          setChartData(data);
          if (data.length >= 2) {
            const cur = data[data.length - 1].v, prev = data[data.length - 2].v;
            const m1 = data[Math.max(0, data.length - 22)].v;
            const m3 = data[Math.max(0, data.length - 66)].v;
            const hi52 = Math.max(...data.map(d => d.v)), lo52 = Math.min(...data.map(d => d.v));
            setSummary({ cur, prev, dayPct:((cur-prev)/prev)*100, m1Pct:((cur-m1)/m1)*100, m3Pct:((cur-m3)/m3)*100, ytdPct:((cur-data[0].v)/data[0].v)*100, hi52, lo52 });
          }
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [item.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  const dp = 2;
  const priceColor = summary ? (summary.dayPct >= 0 ? "#059669" : "#e11d48") : "#b45309";
  const pct52 = summary ? Math.min(100, Math.max(0, ((summary.cur - summary.lo52) / (summary.hi52 - summary.lo52)) * 100)) : null;

  const renderOverview = () => loading ? (
    <div className="flex items-center justify-center py-8 font-mono" style={{ color:"var(--text-3)" }}>Loading…</div>
  ) : (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <span className="font-mono font-bold" style={{ color:"var(--text-1)", fontSize:26 }}>${summary?.cur.toLocaleString("en-US",{minimumFractionDigits:dp,maximumFractionDigits:dp})||"—"}</span>
          {intel?.unit && <span className="font-mono ml-2" style={{ color:"var(--text-3)", fontSize:10 }}>per {intel.unit.split("/")[1]||intel.unit}</span>}
        </div>
        <div className="text-right">
          {summary && <div className="font-mono" style={{ color:clr(summary.dayPct), fontSize:13 }}>Day {fmt.pct(summary.dayPct)}</div>}
          {summary && <div className="font-mono" style={{ color:clr(summary.m1Pct), fontSize:10 }}>1M {fmt.pct(summary.m1Pct)}</div>}
        </div>
      </div>

      {chartData.length > 0 && (
        <div style={{ height:190, marginBottom:12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top:4, right:2, bottom:0, left:0 }}>
              <defs>
                <linearGradient id={"cmg_"+item.id.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={priceColor} stopOpacity={0.22}/>
                  <stop offset="95%" stopColor={priceColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tickFormatter={t=>{const d=new Date(t*1000);return(d.getMonth()+1)+"/"+d.getDate();}} tick={{fill:"#64748b",fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}} tickLine={false} axisLine={false} interval={35}/>
              <YAxis domain={["auto","auto"]} hide/>
              <Tooltip contentStyle={{background:"var(--surface-2)",border:"1px solid rgba(15,23,42,0.18)",borderRadius:10,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}} labelFormatter={t=>new Date(t*1000).toLocaleDateString()} formatter={v=>["$"+v?.toFixed(dp),"Price"]}/>
              <Area type="monotone" dataKey="v" stroke={priceColor} strokeWidth={1.5} fill={"url(#cmg_"+item.id.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {pct52 != null && (
        <div className="mb-4">
          <div className="flex justify-between font-mono mb-1" style={{ color:"var(--text-3)", fontSize:9 }}>
            <span>52W LOW ${summary.lo52.toFixed(dp)}</span>
            <span style={{ color:"var(--text-3)" }}>52-WEEK RANGE</span>
            <span>${summary.hi52.toFixed(dp)} 52W HIGH</span>
          </div>
          <div style={{ position:"relative", height:4, background:"var(--surface-3)", borderRadius:2 }}>
            <div style={{ position:"absolute", left:0, width:pct52+"%", height:"100%", background:pct52>70?"#059669":pct52<30?"#e11d48":"#b45309", borderRadius:2 }}/>
            <div style={{ position:"absolute", left:pct52+"%", top:-3, width:2, height:10, background:"#0f172a", borderRadius:1, transform:"translateX(-50%)" }}/>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid mb-4" style={{ gridTemplateColumns:"repeat(4,1fr)", gap:"4px 8px" }}>
          {[["1D",summary.dayPct],["1M",summary.m1Pct],["3M",summary.m3Pct],["YTD",summary.ytdPct]].map(([label,val])=>(
            <div key={label} style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:10, padding:"6px 8px" }}>
              <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>{label}</div>
              <div className="font-mono font-bold" style={{ color:clr(val), fontSize:13 }}>{fmt.pct(val)}</div>
            </div>
          ))}
        </div>
      )}
      <RelatedLinks itemId={item.id} onOpen={onOpen}/>
    </div>
  );

  const renderProducers = () => !intel?.producers ? (
    <div className="font-mono py-4" style={{ color:"var(--text-3)" }}>No producer data available.</div>
  ) : (
    <div>
      <div className="font-mono mb-3" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Key Producers / Supply Sources</div>
      <div style={{ borderTop:"1px solid rgba(15,23,42,0.09)" }}>
        {intel.producers.map((p,i) => (
          <div key={i} className="flex items-start justify-between py-2.5" style={{ borderBottom:"1px solid rgba(15,23,42,0.06)" }}>
            <div>
              <div className="font-mono" style={{ color:"var(--text-1)", fontSize:11 }}>{p.name}</div>
              <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>{p.note}</div>
            </div>
            <div className="font-mono" style={{ color:"#b45309", fontSize:11 }}>{p.share}</div>
          </div>
        ))}
      </div>
      <RelatedLinks itemId={item.id} onOpen={onOpen}/>
    </div>
  );

  return (
    <ResearchPanelShell title={item.label} subtitle={item.ticker} badge="Commodity" onClose={onClose}>
      <ResearchTabBar tabs={TABS} active={activeTab} onSelect={setActiveTab}/>
      {activeTab === "Overview"      && renderOverview()}
      {activeTab === "Intelligence"  && <div>{intel ? <IntelCard intel={intel} accentColor="#b45309"/> : <div className="font-mono py-4" style={{color:"var(--text-3)"}}>No data.</div>}<div className="mt-4"><RelatedLinks itemId={item.id} onOpen={onOpen}/></div></div>}
      {activeTab === "Producers"     && renderProducers()}
    </ResearchPanelShell>
  );
}

// ── FXResearchPanel ───────────────────────────────────────────────────────────
function FXResearchPanel({ item, onClose, onOpen }) {
  const TABS = ["Overview","Rate Differential","Intelligence"];
  const [activeTab, setActiveTab] = useState("Overview");
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [rateData, setRateData]   = useState({ base:[], quote:[] });
  const [rateLoading, setRateLoading] = useState(false);
  const loadedTabs = useRef(new Set(["Overview"]));
  const intel = ENTITY_INTEL[item.id];
  const pair  = FX_RATE_PAIRS[item.id];

  useEffect(() => {
    setLoading(true); setChartData([]); setSummary(null);
    setActiveTab("Overview"); loadedTabs.current = new Set(["Overview"]);
    fetch("/api/chart?ticker=" + encodeURIComponent(item.ticker) + "&range=1y&interval=1d")
      .then(r => r.json())
      .then(c => {
        const result = c?.chart?.result?.[0];
        if (result) {
          const ts     = result.timestamp || [];
          const closes = result.indicators?.quote?.[0]?.close || [];
          const data   = ts.map((t,i) => ({ t, v: closes[i] != null ? +closes[i].toFixed(4) : null })).filter(d => d.v != null);
          setChartData(data);
          if (data.length >= 2) {
            const cur = data[data.length-1].v, prev = data[data.length-2].v;
            const m1 = data[Math.max(0,data.length-22)].v, m3 = data[Math.max(0,data.length-66)].v;
            const hi52 = Math.max(...data.map(d=>d.v)), lo52 = Math.min(...data.map(d=>d.v));
            setSummary({ cur, prev, dayPct:((cur-prev)/prev)*100, m1Pct:((cur-m1)/m1)*100, m3Pct:((cur-m3)/m3)*100, hi52, lo52 });
          }
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [item.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loadedTabs.current.has(activeTab)) return;
    loadedTabs.current.add(activeTab);
    if (activeTab === "Rate Differential" && pair) {
      setRateLoading(true);
      Promise.all([
        fetch("/api/fred?series=" + pair.baseSeries).then(r => r.json()),
        pair.quoteSeries ? fetch("/api/fred?series=" + pair.quoteSeries).then(r => r.json()) : Promise.resolve(null),
      ]).then(([baseRaw, quoteRaw]) => {
        const parse = raw => (raw?.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value))).slice(-60).map(o => ({ t:o.date, v:parseFloat(o.value) }));
        setRateData({ base: parse(baseRaw), quote: parse(quoteRaw) });
        setRateLoading(false);
      }).catch(() => setRateLoading(false));
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const dp = 4;
  const priceColor = summary ? (summary.dayPct >= 0 ? "#059669" : "#e11d48") : "#059669";
  const pct52 = summary ? Math.min(100, Math.max(0, ((summary.cur-summary.lo52)/(summary.hi52-summary.lo52))*100)) : null;

  const renderOverview = () => loading ? (
    <div className="flex items-center justify-center py-8 font-mono" style={{ color:"var(--text-3)" }}>Loading…</div>
  ) : (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-mono font-bold" style={{ color:"var(--text-1)", fontSize:26 }}>{summary?.cur.toLocaleString("en-US",{minimumFractionDigits:dp,maximumFractionDigits:dp})||"—"}</span>
        <div className="text-right">
          {summary && <div className="font-mono" style={{ color:clr(summary.dayPct), fontSize:13 }}>Day {fmt.pct(summary.dayPct)}</div>}
          {summary && <div className="font-mono" style={{ color:clr(summary.m1Pct), fontSize:10 }}>1M {fmt.pct(summary.m1Pct)}</div>}
        </div>
      </div>

      {chartData.length > 0 && (
        <div style={{ height:190, marginBottom:12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top:4, right:2, bottom:0, left:0 }}>
              <defs>
                <linearGradient id={"fxg_"+item.id.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={priceColor} stopOpacity={0.22}/>
                  <stop offset="95%" stopColor={priceColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tickFormatter={t=>{const d=new Date(t*1000);return(d.getMonth()+1)+"/"+d.getDate();}} tick={{fill:"#64748b",fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}} tickLine={false} axisLine={false} interval={35}/>
              <YAxis domain={["auto","auto"]} hide/>
              <Tooltip contentStyle={{background:"var(--surface-2)",border:"1px solid rgba(15,23,42,0.18)",borderRadius:10,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}} labelFormatter={t=>new Date(t*1000).toLocaleDateString()} formatter={v=>[v?.toFixed(dp),"Rate"]}/>
              <Area type="monotone" dataKey="v" stroke={priceColor} strokeWidth={1.5} fill={"url(#fxg_"+item.id.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {pct52 != null && (
        <div className="mb-4">
          <div className="flex justify-between font-mono mb-1" style={{ color:"var(--text-3)", fontSize:9 }}>
            <span>52W LOW {summary.lo52.toFixed(dp)}</span>
            <span style={{ color:"var(--text-3)" }}>52-WEEK RANGE</span>
            <span>{summary.hi52.toFixed(dp)} 52W HIGH</span>
          </div>
          <div style={{ position:"relative", height:4, background:"var(--surface-3)", borderRadius:2 }}>
            <div style={{ position:"absolute", left:0, width:pct52+"%", height:"100%", background:pct52>70?"#059669":pct52<30?"#e11d48":"#b45309", borderRadius:2 }}/>
            <div style={{ position:"absolute", left:pct52+"%", top:-3, width:2, height:10, background:"#0f172a", borderRadius:1, transform:"translateX(-50%)" }}/>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid mb-4" style={{ gridTemplateColumns:"repeat(3,1fr)", gap:"4px 8px" }}>
          {[["1D",summary.dayPct],["1M",summary.m1Pct],["3M",summary.m3Pct]].map(([label,val])=>(
            <div key={label} style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:10, padding:"6px 8px" }}>
              <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>{label}</div>
              <div className="font-mono font-bold" style={{ color:clr(val), fontSize:13 }}>{fmt.pct(val)}</div>
            </div>
          ))}
        </div>
      )}
      <RelatedLinks itemId={item.id} onOpen={onOpen}/>
    </div>
  );

  const renderRateDiff = () => {
    if (!pair) return <div className="font-mono py-4" style={{ color:"var(--text-3)" }}>Rate differential data not available for this pair.</div>;
    if (rateLoading) return <div className="flex items-center justify-center py-8 font-mono" style={{ color:"var(--text-3)" }}>Loading rates…</div>;

    const baseLatest  = rateData.base[rateData.base.length-1];
    const quoteLatest = rateData.quote[rateData.quote.length-1];
    const diff = baseLatest && quoteLatest ? +(baseLatest.v - quoteLatest.v).toFixed(2) : null;

    const baseMap  = Object.fromEntries(rateData.base.map(d=>[d.t,d.v]));
    const quoteMap = Object.fromEntries(rateData.quote.map(d=>[d.t,d.v]));
    const allDates = [...new Set([...rateData.base.map(d=>d.t),...rateData.quote.map(d=>d.t)])].sort();
    let lb=null, lq=null;
    const diffData = allDates.map(t => {
      if (baseMap[t]!=null)  lb=baseMap[t];
      if (quoteMap[t]!=null) lq=quoteMap[t];
      return { t, base:lb, quote:lq, diff: lb!=null&&lq!=null ? +(lb-lq).toFixed(2) : null };
    }).filter(d=>d.diff!=null).slice(-48);

    return (
      <div>
        <div className="grid mb-4" style={{ gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[{ label:pair.baseLabel, val:baseLatest?.v, color:"#2563eb", date:baseLatest?.t },
            { label:pair.quoteLabel||"N/A", val:quoteLatest?.v, color:"#b45309", date:quoteLatest?.t }].map(({label,val,color,date})=>(
            <div key={label} style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:6, padding:"10px 12px" }}>
              <div className="font-mono mb-1" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>{label}</div>
              <div className="font-mono font-bold" style={{ color, fontSize:20 }}>{val!=null?val.toFixed(2)+"%":"—"}</div>
              {date && <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>as of {date}</div>}
            </div>
          ))}
        </div>

        {diff != null && (
          <div className="mb-4 p-3" style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:6 }}>
            <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>Differential (USD minus {pair.quoteCCY})</div>
            <div className="font-mono font-bold" style={{ color:diff>=0?"#2563eb":"#b45309", fontSize:20 }}>{diff>=0?"+":""}{diff} pp</div>
            <div className="font-mono mt-0.5" style={{ color:"var(--text-3)", fontSize:10 }}>
              {diff>1?"USD yield premium — supports USD strength":diff<-1?"Foreign yield premium — USD headwind":"Rates near parity"}
            </div>
          </div>
        )}

        {diffData.length > 0 && (
          <div>
            <div className="font-mono mb-1" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>Rate Differential Over Time</div>
            <div style={{ height:150, marginBottom:12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={diffData} margin={{ top:4, right:2, bottom:0, left:0 }}>
                  <defs>
                    <linearGradient id={"rdg_"+item.id.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{fill:"#64748b",fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}} tickLine={false} axisLine={false} interval={11}/>
                  <YAxis domain={["auto","auto"]} hide/>
                  <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3"/>
                  <Tooltip contentStyle={{background:"var(--surface-2)",border:"1px solid rgba(15,23,42,0.18)",borderRadius:10,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}} formatter={v=>[v?.toFixed(2)+"pp","Differential"]}/>
                  <Area type="monotone" dataKey="diff" stroke="#2563eb" strokeWidth={1.5} fill={"url(#rdg_"+item.id.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <RelatedLinks itemId={item.id} onOpen={onOpen}/>
      </div>
    );
  };

  return (
    <ResearchPanelShell title={item.label} subtitle={item.ticker} badge="FX" onClose={onClose}>
      <ResearchTabBar tabs={TABS} active={activeTab} onSelect={setActiveTab}/>
      {activeTab === "Overview"          && renderOverview()}
      {activeTab === "Rate Differential" && renderRateDiff()}
      {activeTab === "Intelligence"      && <div>{intel ? <IntelCard intel={intel} accentColor="#059669"/> : <div className="font-mono py-4" style={{color:"var(--text-3)"}}>No data.</div>}<div className="mt-4"><RelatedLinks itemId={item.id} onOpen={onOpen}/></div></div>}
    </ResearchPanelShell>
  );
}

// ── MacroResearchPanel ────────────────────────────────────────────────────────
function MacroResearchPanel({ item, onClose, onOpen }) {
  const TABS = ["Chart","Context"];
  const [activeTab, setActiveTab] = useState("Chart");
  const [data, setData]   = useState([]);
  const [loading, setLoading] = useState(true);
  const intel = ENTITY_INTEL[item.id];

  useEffect(() => {
    setLoading(true); setActiveTab("Chart");
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

  const latest  = data[data.length - 1];
  const prev    = data[data.length - 2];
  const yearAgo = data[Math.max(0, data.length - 13)];
  const yoyPct  = latest && yearAgo && yearAgo.v !== 0 ? ((latest.v - yearAgo.v) / Math.abs(yearAgo.v)) * 100 : null;
  const mom     = latest && prev ? latest.v - prev.v : null;

  const trend = (() => {
    if (data.length < 4) return null;
    const pts = data.slice(-12), n = pts.length;
    const xm = (n-1)/2, ym = pts.reduce((s,d)=>s+d.v,0)/n;
    const num = pts.reduce((s,d,i)=>s+(i-xm)*(d.v-ym),0);
    const den = pts.reduce((s,d,i)=>s+(i-xm)**2,0);
    return den===0 ? 0 : num/den;
  })();

  const renderChart = () => loading ? (
    <div className="flex items-center justify-center py-8 font-mono" style={{ color:"var(--text-3)" }}>Loading…</div>
  ) : !data.length ? (
    <div className="flex items-center justify-center py-8 font-mono" style={{ color:"#e11d48" }}>No data available</div>
  ) : (
    <div>
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="font-mono font-bold" style={{ color:"#7c3aed", fontSize:26 }}>{latest?.v?.toFixed(2)}</span>
        <div className="text-right">
          {yoyPct != null && <div className="font-mono" style={{ color:clr(yoyPct), fontSize:11 }}>YoY {fmt.pct(yoyPct)}</div>}
          {mom != null && <div className="font-mono" style={{ color:clr(mom), fontSize:10 }}>MoM {mom>=0?"+":""}{mom.toFixed(2)}</div>}
        </div>
      </div>
      <div className="font-mono mb-3" style={{ color:"var(--text-3)", fontSize:10 }}>As of {latest?.t}</div>

      {trend != null && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5" style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:4 }}>
          <span className="font-mono" style={{ color:Math.abs(trend)<0.01?"#64748b":trend>0?"#059669":"#e11d48", fontSize:14 }}>
            {Math.abs(trend)<0.01?"→":trend>0?"↗":"↘"}
          </span>
          <span className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>
            12-period trend: <span style={{ color:"#1e293b" }}>{trend>0.01?"Rising":trend<-0.01?"Declining":"Flat"}</span>
            <span style={{ color:"var(--text-3)" }}> ({trend>=0?"+":""}{trend.toFixed(3)}/period)</span>
          </span>
        </div>
      )}

      <div style={{ height:155, marginBottom:12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top:4, right:2, bottom:0, left:0 }}>
            <defs>
              <linearGradient id={"mcg_"+item.series.replace(/[^a-z0-9]/gi,"")} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={{fill:"#64748b",fontSize:9,fontFamily:"'IBM Plex Mono',monospace"}} tickLine={false} axisLine={false} interval={11}/>
            <YAxis domain={["auto","auto"]} hide/>
            <Tooltip contentStyle={{background:"var(--surface-2)",border:"1px solid rgba(15,23,42,0.18)",borderRadius:10,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}} formatter={v=>[v?.toFixed(2),item.label]}/>
            <Area type="monotone" dataKey="v" stroke="#7c3aed" strokeWidth={1.5} fill={"url(#mcg_"+item.series.replace(/[^a-z0-9]/gi,"")+")"} dot={false} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid mb-3" style={{ gridTemplateColumns:"repeat(3,1fr)", gap:"4px 8px" }}>
        {[
          ["Previous",  prev?.v?.toFixed(2)||"—"],
          ["1Y Ago",    yearAgo?.v?.toFixed(2)||"—"],
          ["5Y Min",    data.length>=12?Math.min(...data.slice(-60).map(d=>d.v)).toFixed(2):"—"],
        ].map(([k,v])=>(
          <div key={k}>
            <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>{k}</div>
            <div className="font-mono" style={{ color:"var(--text-1)", fontSize:11 }}>{v}</div>
          </div>
        ))}
      </div>
      <RelatedLinks itemId={item.id} onOpen={onOpen}/>
    </div>
  );

  return (
    <ResearchPanelShell title={item.label} subtitle={item.series} badge="Macro" onClose={onClose}>
      <ResearchTabBar tabs={TABS} active={activeTab} onSelect={setActiveTab}/>
      {activeTab === "Chart"   && renderChart()}
      {activeTab === "Context" && (
        <div>
          {intel ? <IntelCard intel={intel} accentColor="#7c3aed"/> : <div className="font-mono py-4" style={{color:"var(--text-3)"}}>No context data available.</div>}
          <div className="mt-4"><RelatedLinks itemId={item.id} onOpen={onOpen}/></div>
        </div>
      )}
    </ResearchPanelShell>
  );
}

// ── TopicResearchPanel ────────────────────────────────────────────────────────
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
        <div className="flex items-center justify-center flex-1 font-mono" style={{ color:"var(--text-3)", fontSize:11 }}>Loading…</div>
      ) : (
        <>
          <div className="grid mb-3" style={{ gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {cfg.macro.map(m => {
              const d = macroData[m.id];
              const mom = d?.latest != null && d?.prev != null ? d.latest - d.prev : null;
              return (
                <button key={m.id} onClick={() => onOpen({ id:m.id, label:m.label, type:"macro", series:m.series, category:"Macro" })}
                  className="text-left p-2"
                  style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:10, cursor:"pointer", transition:"border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#e2e8f0"}>
                  <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>{m.label}</div>
                  <div className="font-mono font-bold" style={{ color:"#7c3aed", fontSize:16 }}>
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
          <div style={{ borderTop:"1px solid rgba(15,23,42,0.09)", paddingTop:8, marginBottom:4 }}>
            <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Related Assets</div>
            <div className="flex flex-wrap gap-1.5">
              {cfg.assets.map(a => (
                <button key={a.id} onClick={() => onOpen(a)} className="font-mono"
                  style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:6, padding:"3px 8px", fontSize:11, color:RB_TYPE_COLOR[a.type]||"#64748b", cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#e2e8f0"}>
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

// ── ResearchPanel (router) ────────────────────────────────────────────────────
function ResearchPanel({ item, onClose, onOpen }) {
  if (item.type === "equity") {
    return (
      <div style={{ gridColumn:"1 / -1" }}>
        <EquityResearchPanel item={item} onClose={onClose} onOpen={onOpen} />
      </div>
    );
  }
  switch (item.type) {
    case "commodity": return <CommodityResearchPanel item={item} onClose={onClose} onOpen={onOpen} />;
    case "fx":        return <FXResearchPanel        item={item} onClose={onClose} onOpen={onOpen} />;
    case "macro":     return <MacroResearchPanel     item={item} onClose={onClose} onOpen={onOpen} />;
    case "topic":     return <TopicResearchPanel     item={item} onClose={onClose} onOpen={onOpen} />;
    default:          return null;
  }
}

// ── ResearchHomeDashboard ─────────────────────────────────────────────────────
function ResearchHomeDashboard({ onOpen }) {
  const byId = Object.fromEntries(RESEARCH_CATALOG.map(c => [c.id, c]));
  return (
    <div>
      <div className="font-mono mb-4" style={{ color:"var(--text-3)", fontSize:11 }}>
        Search above to open research panels — or start from a quick-access tile below. Press <span style={{ color:"var(--text-3)" }}>/</span> to focus the search bar.
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
                    style={{ background:"transparent", border:"1px solid rgba(15,23,42,0.12)", borderRadius:10, color:"var(--text-1)", fontSize:12, cursor:"pointer", transition:"all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"; e.currentTarget.style.background="#f8fafc"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="transparent"; }}>
                    <span style={{ color }}>{item.label}</span>
                    <span style={{ color:"var(--text-3)", marginLeft:8, fontSize:10 }}>{item.id}</span>
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

// ── ResearchBrowser (default export) ─────────────────────────────────────────
export default function ResearchBrowser({ pendingItem, onPendingConsumed }) {
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
      <div className="px-4 py-3" style={{ borderBottom:"1px solid rgba(15,23,42,0.09)", background:"var(--surface-0)", flexShrink:0 }}>
        <div style={{ position:"relative", maxWidth:680 }}>
          <div className="flex items-center gap-2 px-3 py-2"
            style={{ background:"var(--surface-1)", border:"1px solid " + (searchFocused ? "#2563eb" : "#cbd5e1"), borderRadius:6 }}
            onFocusCapture={() => setSearchFocused(true)}
            onBlurCapture={() => setSearchFocused(false)}>
            <Search size={13} style={{ color:"var(--text-3)", flexShrink:0 }} />
            <input ref={searchRef} value={query}
              onChange={e => { setQuery(e.target.value); setSuggestionIdx(-1); }}
              onKeyDown={handleKeyDown}
              placeholder="Search equities, commodities, FX, macro indicators, topics… (press / to focus)"
              style={{ background:"transparent", border:"none", color:"var(--text-1)", fontSize:12, flex:1, outline:"none", minWidth:0 }} />
            {query && (
              <button onClick={() => { setQuery(""); setSuggestions([]); setSuggestionIdx(-1); searchRef.current?.focus(); }}
                style={{ color:"var(--text-3)", background:"none", border:"none", cursor:"pointer", flexShrink:0, fontSize:12 }}>✕</button>
            )}
            <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9, flexShrink:0 }}>/</span>
          </div>

          {/* Dropdown */}
          {suggestions.length > 0 && (
            <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:"var(--surface-1)", border:"1px solid var(--border-solid)", borderRadius:6, zIndex:200, boxShadow:"0 12px 32px rgba(0,0,0,0.6)", overflow:"hidden" }}>
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div style={{ padding:"5px 12px 2px", color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.1em", background:"var(--surface-0)" }}>{cat}</div>
                  {items.map(item => {
                    const idx = suggestions.indexOf(item);
                    const active = idx === suggestionIdx;
                    return (
                      <div key={item.id}
                        onClick={() => openPanel(item)}
                        onMouseEnter={() => setSuggestionIdx(idx)}
                        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 12px", cursor:"pointer", background:active?"#f1f5f9":"transparent", borderLeft:active?"2px solid #1f6feb":"2px solid transparent" }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold" style={{ color:RB_TYPE_COLOR[item.type]||"#64748b", fontSize:11, width:80, flexShrink:0 }}>{item.id}</span>
                          <span className="font-mono truncate" style={{ color:"var(--text-1)", fontSize:12 }}>{item.label}</span>
                        </div>
                        <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", marginLeft:8, flexShrink:0 }}>{item.type}</span>
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
              <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>Recent:</span>
              {recentSearches.map(r => (
                <button key={r.id} onClick={() => openPanel(r)} className="font-mono"
                  style={{ background:"var(--surface-1)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:6, padding:"2px 8px", color:RB_TYPE_COLOR[r.type]||"#64748b", fontSize:10, cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#e2e8f0"}>
                  {r.label}
                </button>
              ))}
            </>
          )}
          {panels.length > 0 && (
            <button onClick={() => setPanels([])} className="font-mono ml-auto"
              style={{ color:"#e11d48", background:"none", border:"none", cursor:"pointer", fontSize:10 }}>
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
