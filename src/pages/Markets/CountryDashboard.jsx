import { useState, useEffect, useRef } from "react";
import { delay, fmt, clr } from "../../lib/fmt";

export const COUNTRY_CONFIG = {
  CA: {
    id:"CA", name:"Canada", flag:"🇨🇦", region:"North America", accentColor:"#e11d48",
    fxTicker:"CADUSD=X",
    indices:[{ label:"TSX Composite", ticker:"^GSPTSE" },{ label:"TSX 60 ETF", ticker:"XIU.TO" }],
    macro:[
      { label:"Policy Rate",  series:"IRSTCI01CAM156N" },
      { label:"CPI",          series:"CPALTT01CAM657N" },
      { label:"Unemployment", series:"LRUNTTTTCAM156S" },
      { label:"10Y Bond",     series:"IRLTLT01CAM156N" },
    ],
    topStocks:[
      { ticker:"RY.TO",   label:"Royal Bank",      sector:"Financials" },
      { ticker:"TD.TO",   label:"TD Bank",         sector:"Financials" },
      { ticker:"SHOP.TO", label:"Shopify",         sector:"Technology" },
      { ticker:"ENB.TO",  label:"Enbridge",        sector:"Energy" },
      { ticker:"CNQ.TO",  label:"Can. Natural Res.",sector:"Energy" },
    ],
    keyComms:[
      { id:"CL=F", label:"Crude Oil",   note:"~18% of export revenue" },
      { id:"NG=F", label:"Natural Gas", note:"Alberta LNG exports" },
      { id:"GC=F", label:"Gold",        note:"Major mining sector" },
      { id:"HG=F", label:"Copper",      note:"BC & Ontario mines" },
    ],
    insight:{
      summary:"Canada is a commodity-driven, export-dependent economy with ~75% of goods flowing to the US. The TSX is heavily weighted toward financials (~35%) and energy (~20%), making it uniquely sensitive to oil prices and US economic cycles.",
      drivers:["WTI/WCS oil price — core driver of Alberta GDP and TSX energy","Bank of Canada vs Fed rate divergence (CAD/USD flows)","US housing and auto demand (lumber, steel exports)","Chinese commodity demand (metals, potash)"],
      risks:["Household debt-to-income ratio near record highs","US tariff risk on auto, lumber, softwood","Energy transition reducing long-run oil demand"],
    },
  },
  UK: {
    id:"UK", name:"United Kingdom", flag:"🇬🇧", region:"Europe", accentColor:"#2563eb",
    fxTicker:"GBPUSD=X",
    indices:[{ label:"FTSE 100", ticker:"^FTSE" },{ label:"FTSE 250", ticker:"^FTMC" }],
    macro:[
      { label:"Policy Rate",  series:"BOEBR" },
      { label:"CPI",          series:"GBRCPIALLMINMEI" },
      { label:"Unemployment", series:"LRUNTTTTGBM156S" },
      { label:"10Y Bond",     series:"IRLTLT01GBM156N" },
    ],
    topStocks:[
      { ticker:"AZN.L",  label:"AstraZeneca", sector:"Healthcare" },
      { ticker:"HSBA.L", label:"HSBC",        sector:"Financials" },
      { ticker:"BP.L",   label:"BP",          sector:"Energy" },
      { ticker:"SHEL.L", label:"Shell",       sector:"Energy" },
      { ticker:"GSK.L",  label:"GSK",         sector:"Healthcare" },
    ],
    keyComms:[
      { id:"CL=F", label:"Crude Oil",   note:"Shell & BP direct exposure" },
      { id:"GC=F", label:"Gold",        note:"London LBMA gold market hub" },
      { id:"NG=F", label:"Natural Gas", note:"North Sea production" },
    ],
    insight:{
      summary:"The FTSE 100 is skewed toward multinationals (80% revenues overseas) — a weaker GBP actually boosts index performance. The UK runs a persistent current account deficit and faces structurally higher inflation post-Brexit.",
      drivers:["GBP/USD rate — FTSE 100 earnings are largely overseas","BOE rate path vs Fed (GBP carry dynamics)","UK fiscal credibility (Gilt market as key signal)","Oil price (Shell + BP ≈ 15% of FTSE 100 weight)"],
      risks:["Persistent current account deficit (~4% of GDP)","Post-Brexit trade friction reducing EU goods flows","BOE credibility — UK inflation stickier than peers"],
    },
  },
  JP: {
    id:"JP", name:"Japan", flag:"🇯🇵", region:"Asia-Pacific", accentColor:"#ea580c",
    fxTicker:"USDJPY=X",
    indices:[{ label:"Nikkei 225", ticker:"^N225" },{ label:"TOPIX", ticker:"^TOPX" }],
    macro:[
      { label:"Policy Rate",  series:"IRSTCI01JPM156N" },
      { label:"CPI",          series:"JPNCPIALLMINMEI" },
      { label:"Unemployment", series:"LRUNTTTTJPM156S" },
      { label:"10Y Bond",     series:"IRLTLT01JPM156N" },
    ],
    topStocks:[
      { ticker:"7203.T", label:"Toyota",   sector:"Automotive" },
      { ticker:"6758.T", label:"Sony",     sector:"Technology" },
      { ticker:"9984.T", label:"SoftBank", sector:"Technology" },
      { ticker:"6501.T", label:"Hitachi",  sector:"Industrials" },
      { ticker:"6902.T", label:"Denso",    sector:"Automotive" },
    ],
    keyComms:[
      { id:"CL=F", label:"Crude Oil",   note:"Japan imports ~99% of energy needs" },
      { id:"NG=F", label:"Natural Gas", note:"World's largest LNG importer" },
      { id:"HG=F", label:"Copper",      note:"Key industrial input" },
    ],
    insight:{
      summary:"Japan's Nikkei 225 is heavily export-oriented — a weak Yen (USD/JPY > 150) directly boosts corporate earnings of Toyota, Sony, and other exporters. The BOJ's ultra-loose policy is the world's largest carry trade funding source.",
      drivers:["USD/JPY rate — weak JPY = earnings boost for all major exporters","BOJ yield curve control — the dominant policy variable","China demand (Japan's #1 trading partner)","Corporate governance reforms driving ROE improvement"],
      risks:["Yen carry trade unwind — sudden JPY spike = global deleveraging","BOJ normalization (rate hike = JPY surge, export headwind)","Demographics — shrinking workforce, debt >230% of GDP"],
    },
  },
  IN: {
    id:"IN", name:"India", flag:"🇮🇳", region:"Asia-Pacific", accentColor:"#059669",
    fxTicker:"INRUSD=X",
    indices:[{ label:"Nifty 50", ticker:"^NSEI" },{ label:"BSE Sensex", ticker:"^BSESN" }],
    macro:[
      { label:"CPI",          series:"INDCPIALLMINMEI" },
    ],
    topStocks:[
      { ticker:"RELIANCE.NS",  label:"Reliance Ind.",  sector:"Conglomerate" },
      { ticker:"TCS.NS",       label:"TCS",            sector:"IT Services" },
      { ticker:"HDFCBANK.NS",  label:"HDFC Bank",      sector:"Financials" },
      { ticker:"INFY.NS",      label:"Infosys",        sector:"IT Services" },
      { ticker:"ICICIBANK.NS", label:"ICICI Bank",     sector:"Financials" },
    ],
    keyComms:[
      { id:"CL=F", label:"Crude Oil", note:"India imports ~88% of oil needs" },
      { id:"GC=F", label:"Gold",      note:"World's 2nd largest gold consumer" },
      { id:"ZW=F", label:"Wheat",     note:"Key food security commodity" },
    ],
    insight:{
      summary:"India is the fastest-growing large economy (GDP ~7% p.a.), driven by domestic consumption and IT services exports. The Nifty 50 is one of the world's best-performing indices over the past decade.",
      drivers:["Domestic consumption — 60%+ of GDP, rising middle class","IT exports (TCS, Infosys, Wipro = major FX earners)","RBI rate policy vs Fed (INR carry dynamics)","Infrastructure investment cycle (roads, railways, data centers)"],
      risks:["Current account deficit sensitive to oil price spikes","High Nifty valuations (P/E ~22x vs EM peers)","Monsoon failure risk — agriculture = 15% of GDP","INR depreciation pressure during USD tightening cycles"],
    },
  },
  CN: {
    id:"CN", name:"China", flag:"🇨🇳", region:"Asia-Pacific", accentColor:"#e11d48",
    fxTicker:"CNYUSD=X",
    indices:[{ label:"Hang Seng", ticker:"^HSI" },{ label:"SSE Composite", ticker:"000001.SS" }],
    macro:[
      { label:"CPI",          series:"CHNCPIALLMINMEI" },
    ],
    topStocks:[
      { ticker:"BABA",   label:"Alibaba (ADR)",  sector:"Technology" },
      { ticker:"JD",     label:"JD.com (ADR)",   sector:"E-Commerce" },
      { ticker:"PDD",    label:"PDD Holdings",   sector:"E-Commerce" },
      { ticker:"BIDU",   label:"Baidu (ADR)",    sector:"Technology" },
      { ticker:"700.HK", label:"Tencent (HK)",   sector:"Technology" },
    ],
    keyComms:[
      { id:"HG=F", label:"Copper",      note:"China = 55% of global demand" },
      { id:"CL=F", label:"Crude Oil",   note:"World's largest importer" },
      { id:"ZW=F", label:"Wheat",       note:"Largest consumer globally" },
    ],
    insight:{
      summary:"China markets are driven by PBOC policy, property sector deleveraging, and US-China geopolitical relations. The Hang Seng is the primary traded proxy for China risk given mainland capital controls.",
      drivers:["PBOC monetary policy and credit impulse","Property sector deleveraging (Evergrande, Country Garden legacy)","US-China tech sanctions and tariff escalation","Stimulus measures targeting infrastructure and consumption"],
      risks:["Property deflation — largest asset market globally by value","US chip export restrictions constraining tech sector growth","Taiwan geopolitical risk premium","Deflationary spiral risk — CPI near zero for extended period"],
    },
  },
  EU: {
    id:"EU", name:"Eurozone", flag:"🇪🇺", region:"Europe", accentColor:"#7c3aed",
    fxTicker:"EURUSD=X",
    indices:[{ label:"EURO STOXX 50", ticker:"^STOXX50E" },{ label:"DAX 40", ticker:"^GDAXI" },{ label:"CAC 40", ticker:"^FCHI" }],
    macro:[
      { label:"ECB Rate",     series:"ECBDFR" },
      { label:"CPI (HICP)",   series:"CP0000EZ19M086NEST" },
      { label:"Unemployment", series:"LRUNTTTTEZM156S" },
      { label:"10Y Bond",     series:"IRLTLT01EZM156N" },
    ],
    topStocks:[
      { ticker:"ASML.AS", label:"ASML",           sector:"Semiconductors" },
      { ticker:"SAP.DE",  label:"SAP",            sector:"Enterprise Tech" },
      { ticker:"MC.PA",   label:"LVMH",           sector:"Luxury" },
      { ticker:"SIE.DE",  label:"Siemens",        sector:"Industrials" },
      { ticker:"NESN.SW", label:"Nestlé",         sector:"Consumer Staples" },
    ],
    keyComms:[
      { id:"NG=F", label:"Natural Gas", note:"Europe = major LNG importer" },
      { id:"CL=F", label:"Crude Oil",   note:"Net energy importer" },
      { id:"HG=F", label:"Copper",      note:"Industrial + EV demand" },
    ],
    insight:{
      summary:"The Eurozone is export-driven where EUR/USD is critical to corporate competitiveness. Germany's industrial base and ECB pivot from 15 years of near-zero rates are the defining macro themes of the current cycle.",
      drivers:["ECB rate path — fastest hiking cycle in history now unwinding","EUR/USD — weak EUR boosts exporters (ASML, SAP, BMW, Airbus)","Energy cost restructuring post-Ukraine war (LNG vs pipeline gas)","China luxury and capital goods demand (LVMH, Siemens)"],
      risks:["German industrial competitiveness vs China competition","Sovereign debt fragmentation (Italy vs Germany spread)","Russia-Ukraine conflict duration and energy supply","China luxury slowdown (LVMH, Hermès have 30%+ China revenue)"],
    },
  },
};

function CountryDashboard({ country, onOpenResearch }) {
  const [indexData,   setIndexData]   = useState({});
  const [fxData,      setFxData]      = useState(null);
  const [macroData,   setMacroData]   = useState({});
  const [stockData,   setStockData]   = useState({});
  const [loadingIdx,  setLoadingIdx]  = useState(true);
  const macroFetched  = useRef(false);
  const stocksFetched = useRef(false);

  // ── Fetch indices + FX on mount ──────────────────────────────────────────
  useEffect(() => {
    setLoadingIdx(true); setIndexData({}); setFxData(null);
    macroFetched.current = false; stocksFetched.current = false;
    setMacroData({}); setStockData({});

    const tickers = [...country.indices.map(i => i.ticker), country.fxTicker];
    Promise.all(tickers.map((t, i) =>
      delay(i * 80).then(() =>
        fetch("/api/chart?ticker=" + encodeURIComponent(t) + "&range=5d&interval=1d").then(r => r.json()).catch(() => null)
      )
    )).then(results => {
      const idxOut = {};
      tickers.forEach((t, i) => {
        const res = results[i]?.chart?.result?.[0];
        if (res) {
          const closes = res.indicators?.quote?.[0]?.close || [];
          const valid  = closes.filter(v => v != null);
          const cur = valid[valid.length-1], prev = valid[valid.length-2];
          idxOut[t] = { price: cur, changePct: cur && prev ? ((cur-prev)/prev)*100 : null };
        }
      });
      setFxData(idxOut[country.fxTicker] || null);
      const idxOnly = {};
      country.indices.forEach(idx => { if (idxOut[idx.ticker]) idxOnly[idx.ticker] = idxOut[idx.ticker]; });
      setIndexData(idxOnly);
      setLoadingIdx(false);
    }).catch(() => setLoadingIdx(false));
  }, [country.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lazy-load macro ──────────────────────────────────────────────────────
  useEffect(() => {
    if (macroFetched.current || !country.macro?.length) return;
    macroFetched.current = true;
    Promise.all(country.macro.map((m, i) =>
      delay(i * 250).then(() =>
        fetch("/api/fred?series=" + m.series).then(r => r.json()).catch(() => null)
      )
    )).then(results => {
      const out = {};
      country.macro.forEach((m, i) => {
        const obs = (results[i]?.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
        const lat = obs[obs.length-1], prv = obs[obs.length-2];
        out[m.series] = { latest: lat ? parseFloat(lat.value) : null, date: lat?.date, prev: prv ? parseFloat(prv.value) : null };
      });
      setMacroData(out);
    });
  }, [country.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lazy-load stocks ─────────────────────────────────────────────────────
  useEffect(() => {
    if (stocksFetched.current || !country.topStocks?.length) return;
    stocksFetched.current = true;
    (async () => {
      const out = {};
      for (let i = 0; i < country.topStocks.length; i++) {
        if (i > 0) await delay(180);
        try {
          const c = await fetch("/api/chart?ticker=" + encodeURIComponent(country.topStocks[i].ticker) + "&range=5d&interval=1d").then(r => r.json());
          const res = c?.chart?.result?.[0];
          if (res) {
            const closes = res.indicators?.quote?.[0]?.close || [];
            const valid  = closes.filter(v => v != null);
            const cur = valid[valid.length-1], prev = valid[valid.length-2];
            out[country.topStocks[i].ticker] = { price: cur, changePct: cur && prev ? ((cur-prev)/prev)*100 : null };
          }
        } catch(e) {}
      }
      setStockData({...out});
    })();
  }, [country.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mainIdx = country.indices[0];
  const mainD   = indexData[mainIdx?.ticker];
  const isInvFX = country.fxTicker === "USDJPY=X"; // JPY quotes as units per USD (higher = weaker JPY)
  const fmtPx   = (v, dp=2) => v != null ? v.toLocaleString("en-US",{minimumFractionDigits:dp,maximumFractionDigits:dp}) : "—";
  const fxDp    = isInvFX ? 2 : 4;

  return (
    <div className="flex-1 overflow-auto px-4 py-4">
      {/* ── Country header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span style={{ fontSize:32 }}>{country.flag}</span>
          <div>
            <div className="font-mono font-bold" style={{ color:"var(--text-1)", fontSize:20 }}>{country.name}</div>
            <div className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>{country.region}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {mainD && (
            <div className="text-right">
              <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>{mainIdx.label}</div>
              <div className="font-mono font-bold" style={{ color:"var(--text-1)", fontSize:18 }}>{fmtPx(mainD.price)}</div>
              {mainD.changePct != null && <div className="font-mono" style={{ color:clr(mainD.changePct), fontSize:11 }}>1D {fmt.pct(mainD.changePct)}</div>}
            </div>
          )}
          {fxData && (
            <div className="text-right" style={{ borderLeft:"1px solid var(--border)", paddingLeft:16 }}>
              <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>{country.fxTicker.replace("=X","")}</div>
              <div className="font-mono font-bold" style={{ color:"#059669", fontSize:18 }}>{fmtPx(fxData.price, fxDp)}</div>
              {fxData.changePct != null && <div className="font-mono" style={{ color:clr(fxData.changePct), fontSize:11 }}>1D {fmt.pct(fxData.changePct)}</div>}
            </div>
          )}
          {loadingIdx && !mainD && <div className="font-mono" style={{ color:"var(--text-3)", fontSize:11 }}>Loading…</div>}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns:"1fr 1fr", alignItems:"start" }}>

        {/* ── Left column ── */}
        <div className="flex flex-col gap-4">

          {/* All Indices */}
          <div className="terminal-panel p-3">
            <div className="font-mono mb-3" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Market Indices</div>
            <div style={{ borderTop:"1px solid rgba(15,23,42,0.09)" }}>
              {country.indices.map(idx => {
                const d = indexData[idx.ticker];
                return (
                  <div key={idx.ticker} className="flex items-center justify-between py-2" style={{ borderBottom:"1px solid rgba(15,23,42,0.06)" }}>
                    <div>
                      <div className="font-mono" style={{ color:"var(--text-1)", fontSize:11 }}>{idx.label}</div>
                      <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>{idx.ticker}</div>
                    </div>
                    <div className="text-right">
                      {d ? (
                        <>
                          <div className="font-mono font-bold" style={{ color:"var(--text-1)", fontSize:13 }}>{fmtPx(d.price)}</div>
                          {d.changePct != null && <div className="font-mono" style={{ color:clr(d.changePct), fontSize:10 }}>{fmt.pct(d.changePct)}</div>}
                        </>
                      ) : <div className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>—</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Economy */}
          {country.macro?.length > 0 && (
            <div className="terminal-panel p-3">
              <div className="font-mono mb-3" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Economy</div>
              <div className="grid gap-2" style={{ gridTemplateColumns:"1fr 1fr" }}>
                {country.macro.map(m => {
                  const d = macroData[m.series];
                  const mom = d?.latest != null && d?.prev != null ? d.latest - d.prev : null;
                  return (
                    <button key={m.series}
                      onClick={() => onOpenResearch({ id:m.series, label:m.label, type:"macro", series:m.series, category:"Macro" })}
                      className="text-left p-2"
                      style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:10, cursor:"pointer" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor="#e2e8f0"}>
                      <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>{m.label}</div>
                      <div className="font-mono font-bold" style={{ color:"#7c3aed", fontSize:18 }}>
                        {d?.latest != null ? d.latest.toFixed(2) : "—"}
                      </div>
                      {mom != null && <div className="font-mono" style={{ color:clr(mom), fontSize:9 }}>{mom>=0?"+":""}{mom.toFixed(2)} chg</div>}
                      {d?.date && <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>{d.date}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Commodity Exposure */}
          <div className="terminal-panel p-3">
            <div className="font-mono mb-3" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Commodity Exposure</div>
            <div className="flex flex-col gap-1.5">
              {country.keyComms.map(c => (
                <button key={c.id}
                  onClick={() => onOpenResearch({ id:c.id, label:c.label, type:"commodity", ticker:c.id, category:"Commodities" })}
                  className="flex items-center justify-between py-2 px-2 text-left"
                  style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:10, cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="#e2e8f0"}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono" style={{ color:"#b45309", fontSize:11 }}>{c.label}</span>
                    <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>{c.id}</span>
                  </div>
                  <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>{c.note}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-4">

          {/* Key Companies */}
          <div className="terminal-panel p-3">
            <div className="font-mono mb-3" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Key Companies</div>
            <div style={{ borderTop:"1px solid rgba(15,23,42,0.09)" }}>
              {country.topStocks.map(s => {
                const d = stockData[s.ticker];
                return (
                  <button key={s.ticker}
                    onClick={() => onOpenResearch({ id:s.ticker, label:s.label, type:"equity", ticker:s.ticker, category:"Equities" })}
                    className="w-full flex items-center justify-between py-2 px-1 text-left"
                    style={{ borderBottom:"1px solid rgba(15,23,42,0.06)", cursor:"pointer", background:"transparent" }}
                    onMouseEnter={e => e.currentTarget.style.background="#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <div>
                      <div className="font-mono" style={{ color:"var(--text-1)", fontSize:11 }}>{s.label}</div>
                      <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>{s.ticker} · {s.sector}</div>
                    </div>
                    <div className="text-right">
                      {d ? (
                        <>
                          <div className="font-mono" style={{ color:"var(--text-1)", fontSize:11 }}>{fmtPx(d.price)}</div>
                          {d.changePct != null && <div className="font-mono" style={{ color:clr(d.changePct), fontSize:10 }}>{fmt.pct(d.changePct)}</div>}
                        </>
                      ) : <div className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>—</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Market Intelligence */}
          <div className="terminal-panel p-3">
            <div className="font-mono mb-3" style={{ color:country.accentColor, fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              Market Intelligence
            </div>
            <p className="font-mono mb-4" style={{ color:"#1e293b", fontSize:10, lineHeight:1.75 }}>{country.insight.summary}</p>
            <div className="mb-4">
              <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>Key Drivers</div>
              {country.insight.drivers.map((d, i) => (
                <div key={i} className="flex items-start gap-2 mb-1.5">
                  <span className="font-mono flex-shrink-0" style={{ color:country.accentColor, fontSize:10 }}>▸</span>
                  <span className="font-mono" style={{ color:"#475569", fontSize:10, lineHeight:1.6 }}>{d}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>Key Risks</div>
              {country.insight.risks.map((r, i) => (
                <div key={i} className="flex items-start gap-2 mb-1.5">
                  <span className="font-mono flex-shrink-0" style={{ color:"#e11d48", fontSize:10 }}>⚠</span>
                  <span className="font-mono" style={{ color:"#475569", fontSize:10, lineHeight:1.6 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GlobalMarketsModule({ onOpenResearch }) {
  const [selected, setSelected] = useState("CA");
  const countries = Object.values(COUNTRY_CONFIG);
  const country   = COUNTRY_CONFIG[selected];
  return (
    <div className="flex flex-col flex-1" style={{ overflow:"hidden" }}>
      {/* ── Country selector bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 flex-wrap" style={{ borderBottom:"1px solid rgba(15,23,42,0.09)", flexShrink:0 }}>
        <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", marginRight:4 }}>Markets:</span>
        {countries.map(c => (
          <button key={c.id} onClick={() => setSelected(c.id)} className="font-mono"
            style={{
              borderRadius:10, border:"1px solid", padding:"3px 10px", fontSize:10, cursor:"pointer",
              borderColor: selected===c.id ? c.accentColor : "#e2e8f0",
              color:        selected===c.id ? c.accentColor : "#64748b",
              background:   selected===c.id ? c.accentColor+"18" : "transparent",
            }}>
            {c.flag} {c.name}
          </button>
        ))}
      </div>
      <CountryDashboard key={selected} country={country} onOpenResearch={onOpenResearch} />
    </div>
  );
}
