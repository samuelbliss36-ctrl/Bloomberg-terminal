import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { api } from "../../lib/api";
import { RB_TYPE_COLOR } from "../../lib/fmt";
import { RESEARCH_CATALOG } from "../../data/researchData";
import ResearchPanel         from "./panels/ResearchPanel";
import ResearchHomeDashboard from "./panels/ResearchHomeDashboard";

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
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

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
