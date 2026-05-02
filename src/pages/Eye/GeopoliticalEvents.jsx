import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { delay } from "../../lib/fmt";
import { classifyGeoArticle, geoTimeAgo, GEO_CATEGORIES, GEO_IMPACT_COLOR, GEO_SIGNAL_COLOR, GEO_SIGNAL_ICON, GEO_ASSET_COLOR } from "../../data/geoData";

export default function GeopoliticalEvents({ onOpenResearch, onContextUpdate }) {
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
      if (onContextUpdate) {
        const topEvents = classified.slice(0, 20).map(e => ({
          headline: e.headline,
          impact:   e.impact,
          category: e.category,
          signal:   e.signal,
          assets:   e.assets,
          datetime: e.datetime,
        }));
        const sel = classified[0];
        onContextUpdate({
          type: "eye",
          activeModule: "geo",
          events: topEvents,
          selectedEvent: sel ? { headline: sel.headline, summary: sel.summary?.slice(0, 300), impact: sel.impact, category: sel.category, assets: sel.assets } : null,
        });
      }
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
      <div className="px-4 py-2 flex items-center gap-3 flex-wrap" style={{ borderBottom:"1px solid rgba(15,23,42,0.09)", background:"var(--surface-0)", flexShrink:0 }}>
        <span className="font-mono" style={{ background:"#eff6ff", color:"#2563eb", border:"1px solid #58a6ff33", borderRadius:6, padding:"2px 8px", fontSize:10 }}>● LIVE</span>

        <div className="flex items-center gap-1">
          <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>IMPACT:</span>
          {["All","High","Medium","Low"].map(v => (
            <button key={v} onClick={() => setFilterImpact(v)} className="font-mono"
              style={{ padding:"2px 8px", fontSize:10, borderRadius:6, border:"1px solid", cursor:"pointer",
                background: filterImpact===v ? (GEO_IMPACT_COLOR[v]||"#e2e8f0")+"22" : "transparent",
                borderColor: filterImpact===v ? (GEO_IMPACT_COLOR[v]||"#2563eb") : "#e2e8f0",
                color: filterImpact===v ? (GEO_IMPACT_COLOR[v]||"#2563eb") : "#64748b" }}>
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>CATEGORY:</span>
          {["All",...Object.keys(GEO_CATEGORIES)].map(v => {
            const cfg = GEO_CATEGORIES[v];
            return (
              <button key={v} onClick={() => setFilterCat(v)} className="font-mono"
                style={{ padding:"2px 8px", fontSize:10, borderRadius:6, border:"1px solid", cursor:"pointer",
                  background: filterCat===v ? (cfg?.bg||"#e2e8f0") : "transparent",
                  borderColor: filterCat===v ? (cfg?.color||"#2563eb") : "#e2e8f0",
                  color: filterCat===v ? (cfg?.color||"#2563eb") : "#64748b" }}>
                {v}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>TIME:</span>
          {["1H","6H","24H"].map(v => (
            <button key={v} onClick={() => setFilterTime(v)} className="font-mono"
              style={{ padding:"2px 8px", fontSize:10, borderRadius:6, border:"1px solid", cursor:"pointer",
                background: filterTime===v ? "#eff6ff" : "transparent",
                borderColor: filterTime===v ? "#2563eb" : "#e2e8f0",
                color: filterTime===v ? "#2563eb" : "#64748b" }}>
              {v}
            </button>
          ))}
        </div>

        <button onClick={fetchEvents} disabled={loading} className="font-mono"
          style={{ padding:"2px 10px", fontSize:10, borderRadius:6, border:"1px solid var(--border-solid)", background:"transparent", color:loading?"#64748b":"#2563eb", cursor:loading?"wait":"pointer", marginLeft:"auto" }}>
          {loading ? "⟳ Updating…" : "⟳ Refresh"}
        </button>
        {lastRefresh && (
          <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>
            {filtered.length} events · {new Date(lastRefresh).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* ── Two-column workspace ── */}
      <div className="flex flex-1" style={{ overflow:"hidden" }}>

        {/* Left: scrollable event feed */}
        <div style={{ width:460, flexShrink:0, borderRight:"1px solid var(--border)", overflowY:"auto" }}>
          {loading && events.length === 0 ? (
            <div className="flex items-center justify-center p-10 font-mono" style={{ color:"var(--text-3)", fontSize:12 }}>Fetching intelligence feed…</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center p-10 font-mono" style={{ color:"var(--text-3)", fontSize:12 }}>No events match current filters.</div>
          ) : filtered.map(event => {
            const cfg = GEO_CATEGORIES[event.category];
            const isSelected = selected?.id === event.id;
            const ageSec = nowSec - event.datetime;
            const isBreaking = event.impact === "High" && ageSec < 3600;
            const isNew      = ageSec < 1800 && !isBreaking;
            return (
              <div key={event.id} onClick={() => setSelected(event)}
                style={{ borderBottom:"1px solid rgba(15,23,42,0.06)", borderLeft:"3px solid " + (isSelected ? cfg.color : GEO_IMPACT_COLOR[event.impact]),
                  background: isSelected ? cfg.bg : "transparent", padding:"10px 14px", cursor:"pointer", transition:"background 0.15s" }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background="#f8fafc"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background="transparent"; }}>

                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  {isBreaking && <span className="font-mono" style={{ background:"#e11d4822", border:"1px solid #f85149", borderRadius:2, padding:"0 5px", fontSize:8, color:"#e11d48", textTransform:"uppercase" }}>⚡ Breaking</span>}
                  {isNew      && <span className="font-mono" style={{ background:"#05966918", border:"1px solid #3fb950", borderRadius:2, padding:"0 5px", fontSize:8, color:"#059669", textTransform:"uppercase" }}>● New</span>}
                  <span className="font-mono" style={{ background:cfg.bg, border:"1px solid "+cfg.color+"55", borderRadius:2, padding:"0 6px", fontSize:9, color:cfg.color, textTransform:"uppercase" }}>{event.category}</span>
                  <span className="font-mono" style={{ border:"1px solid "+GEO_IMPACT_COLOR[event.impact]+"44", borderRadius:2, padding:"0 5px", fontSize:9, color:GEO_IMPACT_COLOR[event.impact] }}>{event.impact}</span>
                  <span className="font-mono ml-auto" style={{ color:"var(--text-3)", fontSize:9 }}>{geoTimeAgo(event.datetime)}</span>
                </div>

                <div className="font-mono leading-snug mb-1.5" style={{ color:"var(--text-1)", fontSize:12, fontWeight:isBreaking?600:400 }}>
                  {event.headline}
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>{event.source}</span>
                  {event.regions.slice(0,3).map(r => <span key={r} className="font-mono" style={{ color:"var(--text-3)", fontSize:10 }}>{r}</span>)}
                </div>

                <div className="flex flex-wrap gap-1 items-center">
                  {event.assets.slice(0,3).map(a => (
                    <span key={a.id} className="font-mono" style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:2, padding:"1px 6px", fontSize:9, color:"var(--text-3)" }}>
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
            <div className="flex items-center justify-center h-full font-mono" style={{ color:"var(--text-3)", fontSize:12 }}>
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
                  {isBreaking && <span className="font-mono" style={{ background:"#e11d4822", border:"1px solid #f85149", borderRadius:6, padding:"3px 10px", fontSize:10, color:"#e11d48" }}>⚡ BREAKING</span>}
                  <span className="font-mono" style={{ background:cfg.bg, border:"1px solid "+cfg.color, borderRadius:6, padding:"3px 10px", fontSize:10, color:cfg.color }}>{selected.category.toUpperCase()}</span>
                  <span className="font-mono" style={{ border:"1px solid "+GEO_IMPACT_COLOR[selected.impact], borderRadius:6, padding:"3px 10px", fontSize:10, color:GEO_IMPACT_COLOR[selected.impact] }}>{selected.impact.toUpperCase()} IMPACT</span>
                  <span className="font-mono ml-auto" style={{ color:"var(--text-3)", fontSize:10 }}>{selected.source} · {geoTimeAgo(selected.datetime)}</span>
                </div>

                {/* Headline */}
                <h2 className="font-mono font-bold leading-snug mb-3" style={{ color:"var(--text-1)", fontSize:16 }}>{selected.headline}</h2>

                {/* Regions */}
                {selected.regions.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>Region:</span>
                    {selected.regions.map(r => (
                      <span key={r} className="font-mono" style={{ background:"var(--surface-3)", borderRadius:6, padding:"2px 8px", fontSize:11, color:"var(--text-3)" }}>{r}</span>
                    ))}
                  </div>
                )}

                {/* Summary */}
                {selected.summary && (
                  <div className="mb-4 p-3" style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:4 }}>
                    <div className="font-mono mb-1.5" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Summary</div>
                    <p className="font-mono leading-relaxed" style={{ color:"var(--text-3)", fontSize:12 }}>{selected.summary}</p>
                  </div>
                )}

                {/* Why it matters */}
                <div className="mb-4 p-3" style={{ background:cfg.bg, border:"1px solid "+cfg.color+"44", borderRadius:4 }}>
                  <div className="font-mono mb-1.5" style={{ color:cfg.color, fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Why It Matters</div>
                  <p className="font-mono leading-relaxed" style={{ color:"var(--text-1)", fontSize:12 }}>{cfg.why}</p>
                </div>

                {/* Signal + link row */}
                <div className="flex items-center gap-4 mb-4 p-3" style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:4 }}>
                  <div>
                    <div className="font-mono mb-1" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>Directional Signal</div>
                    <div className="font-mono font-bold" style={{ color:GEO_SIGNAL_COLOR[selected.signal], fontSize:18 }}>
                      {GEO_SIGNAL_ICON[selected.signal]} {selected.signal}
                    </div>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <a href={selected.url} target="_blank" rel="noopener noreferrer"
                      className="font-mono"
                      style={{ background:"#2563eb", borderRadius:10, padding:"7px 14px", color:"#fff", fontSize:11, textDecoration:"none" }}>
                      Full Article ↗
                    </a>
                  </div>
                </div>

                {/* Impacted assets */}
                <div className="mb-4">
                  <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                    Impacted Assets {onOpenResearch ? "— Click to Research" : ""}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.assets.map(a => (
                      <button key={a.id}
                        onClick={() => onOpenResearch && onOpenResearch(a)}
                        className="font-mono"
                        style={{ background:"var(--surface-0)", border:"1px solid var(--border-solid)", borderRadius:10, padding:"7px 14px", fontSize:12, color:GEO_ASSET_COLOR[a.type]||"#64748b", cursor:onOpenResearch?"pointer":"default", transition:"all 0.15s" }}
                        onMouseEnter={e => { if (onOpenResearch) { e.currentTarget.style.borderColor=cfg.color; e.currentTarget.style.background=cfg.bg; } }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"; e.currentTarget.style.background="#f8fafc"; }}>
                        {a.label}{onOpenResearch ? " ↗" : ""}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intelligence metadata grid */}
                <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Intelligence Classification</div>
                <div className="grid" style={{ gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                  {[
                    ["Category",  selected.category],
                    ["Impact",    selected.impact],
                    ["Signal",    selected.signal],
                    ["Source",    selected.source],
                    ["Regions",   selected.regions.length ? selected.regions.map(r => r.split(" ").slice(1).join(" ")).join(", ") : "Global"],
                    ["Published", geoTimeAgo(selected.datetime)],
                  ].map(([k, v]) => (
                    <div key={k} className="p-2" style={{ background:"var(--surface-0)", border:"1px solid rgba(15,23,42,0.12)", borderRadius:4 }}>
                      <div className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase" }}>{k}</div>
                      <div className="font-mono" style={{ color:"var(--text-1)", fontSize:11 }}>{v}</div>
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
