import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SCREENER_UNIVERSE, FULL_UNIVERSE } from "../../screenerData";
import { SECTOR_CLR, RATING_CLR, SCREENER_PRESETS } from "../../lib/constants";
import { SC_COLS, SC_ROW_H, FMP_SECTOR_MAP } from "../../data/screenerData";
import { useAuth } from "../../context/AuthContext";
import { savedScreens as dbScreens } from "../../lib/db";

const AI_EXAMPLES = [
  "Profitable small-caps in defense with low debt and revenue growth",
  "High-margin tech companies with low P/E and strong ROE",
  "Dividend payers in utilities with beta under 0.8",
  "Growth stocks in healthcare with revenue acceleration and no debt",
  "Cheap financials with high dividend yield and strong analyst ratings",
  "Large-cap energy companies with low valuation and positive margins",
];

export default function StockScreener({ onSelectTicker, onContextUpdate }) {
  const DEF = {
    sector:"All", mktCapTier:"All", rating:"All",
    peMin:"", peMax:"", fwdPeMax:"",
    revGrowthMin:"", revGrowthMax:"",
    grossMarginMin:"", netMarginMin:"",
    divYieldMin:"", betaMax:"",
    roeMin:"", pbMax:"", debtToEqMax:"",
    profitable:false, paysDividend:false,
  };
  const [f, setF]               = useState(DEF);
  const [sortCol, setSortCol]   = useState("mktCap");
  const [sortDir, setSortDir]   = useState("desc");
  const [activePreset, setActivePreset] = useState(null);
  const [liveUniverse, setLiveUniverse] = useState(null);   // null = loading, array = ready
  const [liveStatus, setLiveStatus]     = useState("loading"); // "loading" | "live" | "synthetic"
  const scrollRef = useRef(null);

  // ── Saved screens state ────────────────────────────────────────────────────
  const { user } = useAuth();
  const [userScreens, setUserScreens]         = useState(() => dbScreens.load());
  const [saveNameInput, setSaveNameInput]      = useState("");
  const [showSaveInput, setShowSaveInput]      = useState(false);

  // Refresh when cloud sync completes
  useEffect(() => {
    const handler = () => setUserScreens(dbScreens.load());
    window.addEventListener('ov:data-synced', handler);
    return () => window.removeEventListener('ov:data-synced', handler);
  }, []);

  const isDefaultFilters = useMemo(() => {
    return Object.entries(f).every(([k, v]) => v === DEF[k]);
  }, [f]); // eslint-disable-line

  const saveScreen = useCallback(() => {
    const name = saveNameInput.trim() || (aiInterpretation?.description?.slice(0, 40)) || "My Screen";
    const newScreen = { id: Date.now().toString(), name, filters: { ...f }, createdAt: new Date().toISOString() };
    const updated = [newScreen, ...userScreens];
    setUserScreens(updated);
    dbScreens.save(updated, user?.id);
    setSaveNameInput("");
    setShowSaveInput(false);
  }, [saveNameInput, f, userScreens, user, aiInterpretation]);

  const deleteScreen = useCallback((id) => {
    const updated = userScreens.filter(s => s.id !== id);
    setUserScreens(updated);
    dbScreens.save(updated, user?.id);
  }, [userScreens, user]);

  // ── AI Screener state ──────────────────────────────────────────────────────
  const [aiMode, setAiMode]                   = useState(false);
  const [aiQuery, setAiQuery]                 = useState("");
  const [aiLoading, setAiLoading]             = useState(false);
  const [aiError, setAiError]                 = useState(null);
  const [aiInterpretation, setAiInterpretation] = useState(null); // { description, reasoning }
  const aiInputRef = useRef(null);

  const runAiScreen = useCallback(async (queryOverride) => {
    const q = (queryOverride ?? aiQuery).trim();
    if (!q) return;
    let apiKey;
    try { apiKey = localStorage.getItem("ov_copilot_key") || undefined; } catch {}
    setAiLoading(true);
    setAiError(null);
    setAiInterpretation(null);
    try {
      const r = await fetch("/api/ai-screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, apiKey }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.message || d.error || `HTTP ${r.status}`);
      setF({ ...DEF, ...d.filters });
      setActivePreset(null);
      setSortCol("mktCap");
      setSortDir("desc");
      setAiInterpretation({ description: d.description, reasoning: d.reasoning || [] });
    } catch (e) {
      setAiError(e.message || "AI screening failed");
    } finally {
      setAiLoading(false);
    }
  }, [aiQuery]); // eslint-disable-line

  const switchToAiMode = () => {
    setAiMode(true);
    setTimeout(() => aiInputRef.current?.focus(), 60);
  };
  const switchToFilterMode = () => setAiMode(false);

  const setFilter   = useCallback((k, v) => { setF(prev => ({...prev, [k]:v})); setActivePreset(null); }, []);
  const applyPreset = (p, i) => { setF({...DEF, ...p.f}); setActivePreset(i); setSortCol("mktCap"); setSortDir("desc"); setAiInterpretation(null); };
  const reset       = () => { setF(DEF); setActivePreset(null); setSortCol("mktCap"); setSortDir("desc"); setAiInterpretation(null); setAiQuery(""); };
  const toggleSort  = (col) => { if (sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc"); else { setSortCol(col); setSortDir("desc"); } };

  /* ── Live universe: fetch from FMP on mount, merge with SCREENER_UNIVERSE fundamentals ── */
  useEffect(() => {
    fetch("/api/screener")
      .then(r => r.json())
      .then(raw => {
        if (!Array.isArray(raw) || !raw.length) { setLiveStatus("synthetic"); return; }
        const suMap = new Map(SCREENER_UNIVERSE.map(s => [s.ticker, s]));
        const mapped = raw.map(s => {
          const base     = suMap.get(s.symbol) || {};
          const mktCapB  = (s.marketCap || 0) / 1e9;
          const divYield = (s.price > 0 && s.lastAnnualDividend > 0)
            ? +(s.lastAnnualDividend / s.price * 100).toFixed(2) : (base.divYield ?? null);
          return {
            ticker:      s.symbol,
            name:        s.companyName   || base.name   || s.symbol,
            sector:      FMP_SECTOR_MAP[s.sector] || s.sector || base.sector || "Other",
            price:       s.price         ?? base.price  ?? null,
            changePct:   base.changePct  ?? null,
            mktCap:      mktCapB > 0     ? mktCapB      : (base.mktCap ?? null),
            pe:          base.pe         ?? null,
            fwdPe:       base.fwdPe      ?? null,
            pb:          base.pb         ?? null,
            revGrowth:   base.revGrowth  ?? null,
            grossMargin: base.grossMargin?? null,
            netMargin:   base.netMargin  ?? null,
            roe:         base.roe        ?? null,
            debtToEq:    base.debtToEq   ?? null,
            divYield,
            beta:        s.beta          ?? base.beta   ?? null,
            volume:      s.volume != null ? s.volume / 1e6 : (base.volume ?? null),
            rating:      base.rating     ?? null,
          };
        });
        setLiveUniverse(mapped);
        setLiveStatus("live");
      })
      .catch(() => setLiveStatus("synthetic"));
  }, []);

  const universe = liveUniverse || FULL_UNIVERSE;

  /* ── Filtering engine (O(n), runs synchronously in useMemo) ─── */
  const results = useMemo(() => {
    const filtered = universe.filter(s => {
      if (f.sector !== "All" && s.sector !== f.sector) return false;
      if (f.mktCapTier === "Mega"  && s.mktCap < 200)  return false;
      if (f.mktCapTier === "Large" && (s.mktCap < 10  || s.mktCap >= 200)) return false;
      if (f.mktCapTier === "Mid"   && (s.mktCap < 2   || s.mktCap >= 10))  return false;
      if (f.mktCapTier === "Small" && s.mktCap >= 2)   return false;
      if (f.peMin          && (s.pe          == null || s.pe          < +f.peMin))          return false;
      if (f.peMax          && (s.pe          == null || s.pe          > +f.peMax))          return false;
      if (f.fwdPeMax       && (s.fwdPe       == null || s.fwdPe       > +f.fwdPeMax))       return false;
      if (f.revGrowthMin   && (s.revGrowth   == null || s.revGrowth   < +f.revGrowthMin))   return false;
      if (f.revGrowthMax   && (s.revGrowth   == null || s.revGrowth   > +f.revGrowthMax))   return false;
      if (f.grossMarginMin && (s.grossMargin == null || s.grossMargin < +f.grossMarginMin)) return false;
      if (f.netMarginMin   && (s.netMargin   == null || s.netMargin   < +f.netMarginMin))   return false;
      if (f.divYieldMin    && (s.divYield    == null || s.divYield    < +f.divYieldMin))    return false;
      if (f.betaMax        && (s.beta        == null || s.beta        > +f.betaMax))        return false;
      if (f.roeMin         && (s.roe         == null || s.roe         < +f.roeMin))         return false;
      if (f.pbMax          && (s.pb          == null || s.pb          > +f.pbMax))          return false;
      if (f.debtToEqMax    && (s.debtToEq    == null || s.debtToEq    > +f.debtToEqMax))    return false;
      if (f.profitable     && (s.netMargin   == null || s.netMargin   <= 0))                return false;
      if (f.paysDividend   && (s.divYield    == null || s.divYield    <= 0))                return false;
      if (f.rating !== "All" && s.rating !== f.rating) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const av = a[sortCol] ?? (sortDir==="asc" ? Infinity : -Infinity);
      const bv = b[sortCol] ?? (sortDir==="asc" ? Infinity : -Infinity);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return filtered;
  }, [f, sortCol, sortDir, universe]); // eslint-disable-line

  // Serialize screener results into copilot context whenever filters change
  useEffect(() => {
    if (!onContextUpdate) return;
    const presetName = activePreset != null ? SCREENER_PRESETS[activePreset]?.name ?? null : null;
    const topResults = results.slice(0, 15).map(s => ({
      ticker: s.ticker, name: s.name, sector: s.sector,
      price: s.price, mktCap: s.mktCap, pe: s.pe, roe: s.roe,
    }));
    onContextUpdate({ type: "screener", presetName, filterCount: results.length, topResults });
  }, [results, activePreset, onContextUpdate]);

  /* ── DOM virtualizer ───────────────────────────────────────────── */
  const rowVirtualizer = useVirtualizer({
    count:            results.length,
    getScrollElement: () => scrollRef.current,
    estimateSize:     () => SC_ROW_H,
    overscan:         20,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  const SECTORS = ["All","Technology","Healthcare","Financials","Consumer Disc.","Consumer Staples","Communication","Energy","Industrials","Materials","Utilities","Real Estate"];
  const CAPS    = ["All","Mega","Large","Mid","Small"];
  const RATINGS = ["All","Strong Buy","Buy","Hold","Sell"];

  const chipRow = (field, options) => options.map(o => {
    const active = f[field] === o;
    const accent = field==="sector" ? (SECTOR_CLR[o]||"#2563eb") : field==="rating" ? (RATING_CLR[o]||"#2563eb") : "#2563eb";
    return (
      <button key={o} onClick={() => setFilter(field, o)}
        style={{ padding:"2px 9px", fontSize:10, fontWeight:500, cursor:"pointer", borderRadius:99, whiteSpace:"nowrap",
          border:`1px solid ${active ? accent : "var(--border-solid)"}`,
          background: active ? `${accent}18` : "var(--surface-1)",
          color: active ? accent : "var(--text-3)", transition:"all 0.12s" }}>
        {o}
      </button>
    );
  });

  const boolChip = (field, label) => {
    const active = f[field];
    return (
      <button key={field} onClick={() => setFilter(field, !active)}
        style={{ padding:"2px 9px", fontSize:10, fontWeight:500, cursor:"pointer", borderRadius:99, whiteSpace:"nowrap",
          border:`1px solid ${active ? "#059669" : "var(--border-solid)"}`,
          background: active ? "rgba(5,150,105,0.12)" : "var(--surface-1)",
          color: active ? "#059669" : "var(--text-3)", transition:"all 0.12s" }}>
        {active ? "✓ " : ""}{label}
      </button>
    );
  };

  const numInput = (label, key, w=52) => (
    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
      <span style={{ fontSize:10, color:"var(--text-3)", whiteSpace:"nowrap" }}>{label}</span>
      <input type="number" value={f[key]} placeholder="—" onChange={e => setFilter(key, e.target.value)}
        style={{ width:w, padding:"2px 6px", fontSize:11, fontFamily:"'IBM Plex Mono',monospace",
          border:"1px solid var(--border-solid)", borderRadius:4, background:"var(--surface-1)",
          color:"var(--text-1)", outline:"none", appearance:"none" }} />
    </div>
  );

  const grpLbl = t => <span style={{ fontSize:9, fontWeight:700, color:"var(--text-3)", letterSpacing:"0.07em", whiteSpace:"nowrap" }}>{t}</span>;
  const sortIco = col => sortCol===col ? (sortDir==="asc" ? " ▲" : " ▼") : "";

  /* ── Cell renderer helpers ─────────────────────────────────────── */
  const mono = { fontFamily:"'IBM Plex Mono',monospace" };
  const fmtN   = v => v == null ? "—" : v.toFixed(1);
  const fmtMC  = v => v >= 1000 ? "$"+(v/1000).toFixed(2)+"T" : v >= 1 ? "$"+v.toFixed(1)+"B" : "$"+(v*1000).toFixed(0)+"M";
  const roeClr = v => v==null?"var(--text-3)":v>=20?"#059669":v>=10?"#b45309":v<0?"#e11d48":"var(--text-1)";
  const deClr  = v => v==null?"var(--text-3)":v>=4?"#e11d48":v>=2?"#b45309":v<=0.5?"#059669":"var(--text-1)";

  function renderCell(s, col) {
    const k = col.key;
    switch (k) {
      case "ticker":      return <span style={{ ...mono, fontWeight:700, color:"#2563eb" }}>{s.ticker}</span>;
      case "name":        return <span style={{ color:"var(--text-1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>{s.name}</span>;
      case "sector":      return (
        <span style={{ fontSize:9, fontWeight:600, padding:"1px 6px", borderRadius:99, whiteSpace:"nowrap",
          background:`${SECTOR_CLR[s.sector]||"#64748b"}14`, color:SECTOR_CLR[s.sector]||"#64748b" }}>
          {s.sector}
        </span>);
      case "price":       return <span style={{ ...mono, color:"var(--text-1)" }}>{s.price==null?"—":"$"+s.price.toFixed(2)}</span>;
      case "changePct":   return <span style={{ ...mono, color:s.changePct>0?"#059669":s.changePct<0?"#e11d48":"var(--text-1)" }}>
                            {s.changePct==null?"—":(s.changePct>0?"+":"")+s.changePct.toFixed(2)+"%"}</span>;
      case "mktCap":      return <span style={{ ...mono, color:"var(--text-1)" }}>{fmtMC(s.mktCap)}</span>;
      case "pe":          return <span style={{ ...mono, color:"var(--text-1)" }}>{fmtN(s.pe)}</span>;
      case "fwdPe":       return <span style={{ ...mono, color:"var(--text-3)" }}>{fmtN(s.fwdPe)}</span>;
      case "pb":          return <span style={{ ...mono, color:"var(--text-1)" }}>{s.pb==null?"—":s.pb.toFixed(1)}</span>;
      case "revGrowth":   return <span style={{ ...mono, color:s.revGrowth>0?"#059669":s.revGrowth<0?"#e11d48":"var(--text-1)" }}>
                            {s.revGrowth==null?"—":(s.revGrowth>0?"+":"")+s.revGrowth.toFixed(1)+"%"}</span>;
      case "grossMargin": return <span style={{ ...mono, color:"var(--text-1)" }}>{s.grossMargin==null?"—":s.grossMargin.toFixed(1)+"%"}</span>;
      case "netMargin":   return <span style={{ ...mono, color:s.netMargin!=null&&s.netMargin<0?"#e11d48":"var(--text-1)" }}>{s.netMargin==null?"—":s.netMargin.toFixed(1)+"%"}</span>;
      case "roe":         return <span style={{ ...mono, color:roeClr(s.roe) }}>{s.roe==null?"—":s.roe.toFixed(1)+"%"}</span>;
      case "debtToEq":    return <span style={{ ...mono, color:deClr(s.debtToEq) }}>{s.debtToEq==null?"—":s.debtToEq.toFixed(2)}</span>;
      case "divYield":    return <span style={{ ...mono, color:s.divYield>=3.5?"#059669":"var(--text-1)" }}>{s.divYield==null?"—":s.divYield.toFixed(2)+"%"}</span>;
      case "beta":        return <span style={{ ...mono, color:"var(--text-1)" }}>{fmtN(s.beta)}</span>;
      case "volume":      return <span style={{ ...mono, color:"var(--text-3)" }}>{s.volume==null?"—":s.volume.toFixed(2)}</span>;
      case "rating":      return (
        <span style={{ fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:99,
          background:`${RATING_CLR[s.rating]||"#64748b"}14`, color:RATING_CLR[s.rating]||"#64748b" }}>
          {s.rating}
        </span>);
      default: return null;
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", background:"var(--surface-0)" }}>

      {/* ── Top Bar: title + mode toggle + status + reset ─────────── */}
      <div style={{ padding:"8px 16px 0", borderBottom:"none", background:"var(--surface-1)", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.07em", color:"var(--text-1)" }}>📊 STOCK SCREENER</span>
            <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:"var(--text-3)", background:"var(--surface-2)", padding:"1px 8px", borderRadius:99 }}>
              {results.length.toLocaleString()} / {universe.length.toLocaleString()}
            </span>
            {liveStatus === "live"      && <span style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:"#059669" }}>● Live · FMP</span>}
            {liveStatus === "loading"   && <span style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:"#b45309" }}>⟳ Loading…</span>}
            {liveStatus === "synthetic" && <span style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:"var(--text-3)" }}>◦ Synthetic</span>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {/* Mode toggle */}
            <div style={{ display:"flex", border:"1px solid var(--border-solid)", borderRadius:6, overflow:"hidden" }}>
              <button onClick={switchToFilterMode}
                style={{ padding:"3px 10px", fontSize:10, fontWeight:600, cursor:"pointer", border:"none",
                  background: !aiMode ? "#2563eb" : "var(--surface-0)",
                  color: !aiMode ? "#fff" : "var(--text-3)", transition:"all 0.12s" }}>
                ⊞ Filters
              </button>
              <button onClick={switchToAiMode}
                style={{ padding:"3px 10px", fontSize:10, fontWeight:600, cursor:"pointer", border:"none",
                  borderLeft:"1px solid var(--border-solid)",
                  background: aiMode ? "#7c3aed" : "var(--surface-0)",
                  color: aiMode ? "#fff" : "var(--text-3)", transition:"all 0.12s" }}>
                ✦ AI Screen
              </button>
            </div>
            <button onClick={reset} style={{ fontSize:10, color:"var(--text-3)", background:"none", border:"1px solid var(--border-solid)", borderRadius:4, padding:"3px 10px", cursor:"pointer" }}>
              ↺ Reset
            </button>
          </div>
        </div>

        {/* ── AI Mode Panel ─────────────────────────────────────────── */}
        {aiMode && (
          <div style={{ paddingBottom:10, borderBottom:"1px solid var(--border-solid)" }}>
            {/* Input row */}
            <div style={{ display:"flex", gap:6, marginBottom:8 }}>
              <div style={{ flex:1, position:"relative" }}>
                <input
                  ref={aiInputRef}
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !aiLoading) runAiScreen(); }}
                  placeholder='e.g. "profitable small-caps in defense with low debt and revenue acceleration"'
                  style={{ width:"100%", padding:"8px 12px", fontSize:11,
                    fontFamily:"'IBM Plex Mono',monospace",
                    border:"1px solid #7c3aed", borderRadius:6,
                    background:"var(--surface-0)", color:"var(--text-1)",
                    outline:"none", boxSizing:"border-box",
                    boxShadow:"0 0 0 2px rgba(124,58,237,0.1)" }} />
              </div>
              <button
                onClick={() => runAiScreen()}
                disabled={aiLoading || !aiQuery.trim()}
                style={{ padding:"8px 18px", fontSize:11, fontWeight:700, cursor: aiLoading||!aiQuery.trim() ? "default":"pointer",
                  background: aiLoading||!aiQuery.trim() ? "var(--surface-2)" : "#7c3aed",
                  color: aiLoading||!aiQuery.trim() ? "var(--text-3)" : "#fff",
                  border:"none", borderRadius:6, transition:"all 0.12s", whiteSpace:"nowrap",
                  opacity: aiLoading||!aiQuery.trim() ? 0.6 : 1 }}>
                {aiLoading ? "Screening…" : "✦ Screen"}
              </button>
            </div>

            {/* Example queries */}
            {!aiInterpretation && !aiLoading && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:4 }}>
                <span style={{ fontSize:9, color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace", alignSelf:"center", marginRight:2 }}>EXAMPLES:</span>
                {AI_EXAMPLES.map((ex, i) => (
                  <button key={i}
                    onClick={() => { setAiQuery(ex); runAiScreen(ex); }}
                    style={{ padding:"2px 9px", fontSize:9, cursor:"pointer", borderRadius:99,
                      border:"1px solid var(--border-solid)", background:"var(--surface-0)",
                      color:"var(--text-3)", transition:"all 0.1s", fontFamily:"'IBM Plex Mono',monospace" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="#7c3aed"; e.currentTarget.style.color="#7c3aed"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border-solid)"; e.currentTarget.style.color="var(--text-3)"; }}>
                    {ex}
                  </button>
                ))}
              </div>
            )}

            {/* Error */}
            {aiError && (
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:5,
                background:"rgba(225,29,72,0.07)", border:"1px solid rgba(225,29,72,0.2)", fontSize:10,
                fontFamily:"'IBM Plex Mono',monospace", color:"#e11d48" }}>
                ⚠ {aiError}
                {aiError.includes("key") && <span style={{ color:"var(--text-3)" }}> — Add your API key in AI Copilot settings</span>}
              </div>
            )}

            {/* AI result: description + reasoning chips */}
            {aiInterpretation && !aiLoading && (
              <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:"#7c3aed", fontWeight:600 }}>
                  ✦ {aiInterpretation.description}
                </span>
                <span style={{ fontSize:9, color:"var(--text-3)", margin:"0 2px" }}>·</span>
                {aiInterpretation.reasoning.map((chip, i) => (
                  <span key={i} style={{ fontSize:9, padding:"1px 8px", borderRadius:99,
                    background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.2)",
                    color:"#7c3aed", fontFamily:"'IBM Plex Mono',monospace" }}>
                    {chip}
                  </span>
                ))}
                <button onClick={switchToFilterMode}
                  style={{ marginLeft:4, fontSize:9, padding:"1px 8px", borderRadius:99, cursor:"pointer",
                    border:"1px solid var(--border-solid)", background:"var(--surface-0)",
                    color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace" }}>
                  Edit Filters →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Filter Mode Panel ──────────────────────────────────────── */}
        {!aiMode && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, paddingBottom:10, borderBottom:"1px solid var(--border-solid)" }}>
            {/* Preset chips + Save Screen */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, alignItems:"center" }}>
              {SCREENER_PRESETS.map((p, i) => (
                <button key={i} onClick={() => applyPreset(p, i)}
                  style={{ padding:"2px 10px", fontSize:10, fontWeight:500, cursor:"pointer", borderRadius:99,
                    border:`1px solid ${activePreset===i?"#2563eb":"var(--border-solid)"}`,
                    background: activePreset===i?"var(--blue-dim)":"var(--surface-0)",
                    color: activePreset===i?"#2563eb":"var(--text-3)", transition:"all 0.12s" }}>
                  {p.label}
                </button>
              ))}
              {/* User saved screens */}
              {userScreens.length > 0 && (
                <>
                  <span style={{ fontSize:9, color:"var(--text-3)", margin:"0 2px" }}>──</span>
                  {userScreens.map(s => (
                    <span key={s.id} style={{ display:"inline-flex", alignItems:"center", gap:3,
                      padding:"2px 8px 2px 10px", fontSize:10, fontWeight:500, borderRadius:99,
                      border:"1px solid rgba(124,58,237,0.40)", background:"rgba(124,58,237,0.08)", color:"#a78bfa" }}>
                      <button onClick={() => { setF({...DEF, ...s.filters}); setActivePreset(null); setAiInterpretation(null); }}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"inherit", padding:0, fontSize:10, fontFamily:"inherit" }}>
                        {s.name}
                      </button>
                      <button onClick={() => deleteScreen(s.id)}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(167,139,250,0.6)", padding:0, fontSize:10, lineHeight:1 }}>✕</button>
                    </span>
                  ))}
                </>
              )}
              {/* Save current filters */}
              {!isDefaultFilters && !showSaveInput && (
                <button onClick={() => setShowSaveInput(true)}
                  style={{ padding:"2px 10px", fontSize:10, fontWeight:500, cursor:"pointer", borderRadius:99,
                    border:"1px solid rgba(5,150,105,0.40)", background:"rgba(5,150,105,0.08)", color:"#34d399" }}>
                  💾 Save Screen
                </button>
              )}
              {showSaveInput && (
                <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                  <input
                    autoFocus
                    value={saveNameInput}
                    onChange={e => setSaveNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key==="Enter") saveScreen(); if (e.key==="Escape") setShowSaveInput(false); }}
                    placeholder="Screen name…"
                    style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:"var(--surface-0)",
                      border:"1px solid rgba(5,150,105,0.40)", color:"var(--text-1)", outline:"none",
                      fontFamily:"'IBM Plex Mono',monospace", width:130 }} />
                  <button onClick={saveScreen}
                    style={{ padding:"2px 8px", fontSize:10, borderRadius:6, cursor:"pointer",
                      background:"rgba(5,150,105,0.15)", border:"1px solid rgba(5,150,105,0.40)", color:"#34d399" }}>Save</button>
                  <button onClick={() => setShowSaveInput(false)}
                    style={{ padding:"2px 6px", fontSize:10, borderRadius:6, cursor:"pointer",
                      background:"none", border:"1px solid var(--border-solid)", color:"var(--text-3)" }}>✕</button>
                </span>
              )}
            </div>

            {/* Sector chips */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>{chipRow("sector", SECTORS)}</div>

            {/* Cap + Rating + Boolean toggles */}
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:3 }}>{grpLbl("CAP")}<span style={{marginRight:2}}/>{chipRow("mktCapTier", CAPS)}</div>
              <div style={{ display:"flex", alignItems:"center", gap:3 }}>{grpLbl("RATING")}<span style={{marginRight:2}}/>{chipRow("rating", RATINGS)}</div>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>{grpLbl("ONLY")}<span style={{marginRight:2}}/>{boolChip("profitable","Profitable")}{boolChip("paysDividend","Pays Dividend")}</div>
            </div>

            {/* Numeric filters — grouped */}
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                {grpLbl("VALUATION")}{numInput("P/E ≥","peMin")}{numInput("P/E ≤","peMax")}{numInput("Fwd P/E ≤","fwdPeMax")}{numInput("P/B ≤","pbMax")}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                {grpLbl("QUALITY")}{numInput("ROE ≥","roeMin")}{numInput("D/E ≤","debtToEqMax",44)}{numInput("Gross ≥","grossMarginMin")}{numInput("Net ≥","netMarginMin")}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                {grpLbl("GROWTH / INCOME")}{numInput("Rev ≥","revGrowthMin")}{numInput("Rev ≤","revGrowthMax")}{numInput("Div ≥","divYieldMin")}{numInput("Beta ≤","betaMax",44)}
              </div>
            </div>
          </div>
        )}

        {/* Row count hint — always shown */}
        <div style={{ padding:"4px 0 6px", fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:"var(--text-3)" }}>
          Showing {results.length.toLocaleString()} stocks · Click row to open · Click column header to sort
        </div>
      </div>

      {/* ── Virtualized Table ─────────────────────────────────────── */}
      {/* Sticky column header row */}
      <div style={{ flexShrink:0, display:"flex", alignItems:"center", background:"var(--surface-0)",
                    borderBottom:"2px solid var(--border-solid)", minWidth:1350, zIndex:5 }}>
        {SC_COLS.map(c => (
          <div key={c.key}
            onClick={c.num ? () => toggleSort(c.key) : undefined}
            style={{ width:c.w, flex:c.flex||0, minWidth:c.flex?150:c.w,
              padding:"5px 8px", fontSize:9, fontWeight:700, letterSpacing:"0.06em",
              textAlign:c.num?"right":"left", whiteSpace:"nowrap", userSelect:"none",
              cursor:c.num?"pointer":"default",
              color:sortCol===c.key?"#2563eb":"var(--text-3)" }}>
            {c.label}{c.num && sortIco(c.key)}
          </div>
        ))}
      </div>

      {/* Scroll container — virtualizer lives here */}
      <div ref={scrollRef} style={{ flex:1, overflow:"auto", minWidth:1350 }}>
        {results.length === 0 ? (
          <div style={{ textAlign:"center", padding:"48px 0", color:"var(--text-3)", fontSize:12 }}>
            No stocks match the current filters — try resetting
          </div>
        ) : (
          <div style={{ height:`${rowVirtualizer.getTotalSize()}px`, position:"relative" }}>
            {virtualItems.map(vRow => {
              const s = results[vRow.index];
              const even = vRow.index % 2 === 0;
              return (
                <div key={vRow.key}
                  style={{ position:"absolute", top:0, left:0, width:"100%",
                    transform:`translateY(${vRow.start}px)`, height:SC_ROW_H,
                    display:"flex", alignItems:"center",
                    background: even ? "var(--surface-1)" : "var(--surface-0)",
                    borderBottom:"1px solid var(--border-subtle)",
                    cursor:"pointer", transition:"background 0.1s" }}
                  onClick={() => onSelectTicker(s.ticker)}
                  onMouseEnter={e => e.currentTarget.style.background="var(--blue-dim)"}
                  onMouseLeave={e => e.currentTarget.style.background=even?"var(--surface-1)":"var(--surface-0)"}>
                  {SC_COLS.map(col => (
                    <div key={col.key}
                      style={{ width:col.w, flex:col.flex||0, minWidth:col.flex?150:col.w,
                        padding:"0 8px", fontSize:11, textAlign:col.num?"right":"left",
                        overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                      {renderCell(s, col)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
