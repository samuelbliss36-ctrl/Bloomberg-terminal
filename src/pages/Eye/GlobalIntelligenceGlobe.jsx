import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ARC_STYLE, PT_STYLE, GLOBE_REGIONS, CHOKEPOINTS, OIL_ROUTES, PIPELINES, SEA_CABLES, CABLE_LANDINGS, CONFLICT_ZONES, SANCTIONED_REGIONS, TRADE_FLOWS, MAJOR_PORTS, GLOBE_LAYER_CONFIG, GLOBE_CATEGORIES, GLOBE_FUTURE_LAYERS, TIP } from "../../data/geoData";

const arcCol = d => ARC_STYLE[d._layer]?.color    || "rgba(255,255,255,0.6)";
const arcStr = d => ARC_STYLE[d._layer]?.stroke   || 0.5;
const arcAlt = d => ARC_STYLE[d._layer]?.altitude || 0.1;
const ptCol  = d => PT_STYLE[d._layer]?.color || "#fff";
const ptRad  = d => PT_STYLE[d._layer]?.r     || 0.3;
const ptAlt  = d => PT_STYLE[d._layer]?.alt   || 0.01;

const inRegion = (lat, lng, key) => {
  const b = GLOBE_REGIONS[key]?.bounds;
  if (!b) return true;
  return lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;
};
const meetsImp = (imp, filter) => {
  if (filter === "all") return true;
  if (filter === "critical") return imp === "critical";
  return imp === "critical" || imp === "major";
};

const resolveResearch = (d) => {
  if (!d) return null;
  if (d._layer === "oilRoutes" || d._layer === "pipelines")
    return { id:"CL=F", label:"WTI Crude Oil", ticker:"CL=F", type:"commodity", category:"Commodities" };
  if (d._layer === "seaCables" || d._layer === "cableLandings")
    return null;
  if (d._layer === "conflictZones")
    return { id:d.id, label:d.name, type:"event", category:"Geopolitics" };
  if (d._layer === "tradeFlows")
    return { id:"macro", label:"Global Trade", type:"macro", category:"Macro" };
  if (d._layer === "sanctioned" && d.id === "russia_s")
    return { id:"NG=F", label:"Natural Gas", ticker:"NG=F", type:"commodity", category:"Commodities" };
  if (d._layer === "sanctioned" && d.id === "iran_s")
    return { id:"CL=F", label:"WTI Crude Oil", ticker:"CL=F", type:"commodity", category:"Commodities" };
  return null;
};

export default function GlobalIntelligenceGlobe({ onOpenResearch }) {
  const containerRef = useRef();
  const globeEl      = useRef();
  const [GlobeComp,  setGlobeComp]  = useState(null);
  const [layers,     setLayers]     = useState(GLOBE_LAYER_CONFIG);
  const [selected,   setSelected]   = useState(null);
  const [hovered,    setHovered]    = useState(null);
  const [dims,       setDims]       = useState({ w:800, h:600 });
  const [region,     setRegion]     = useState("all");
  const [importance, setImportance] = useState("all");
  const [openCats,   setOpenCats]   = useState({ infrastructure:true, transportation:false, geopolitics:true, markets:false, soon:false });

  // ── Lazy-load react-globe.gl ──
  useEffect(() => {
    import("react-globe.gl")
      .then(mod => setGlobeComp(() => mod.default))
      .catch(err => console.error("Globe load failed:", err));
  }, []);

  // ── Responsive container sizing ──
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDims({ w:Math.floor(width), h:Math.floor(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Globe ready: controls + constant daylight lighting ──
  const onGlobeReady = useCallback(() => {
    if (!globeEl.current) return;
    const ctrl = globeEl.current.controls();
    ctrl.autoRotate    = false;
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.12;
    ctrl.minDistance   = 150;
    ctrl.maxDistance   = 700;
    globeEl.current.pointOfView({ lat:20, lng:10, altitude:2.3 }, 800);
    globeEl.current.scene().traverse(obj => {
      if (obj.isAmbientLight)     obj.intensity = 3.5;
      if (obj.isDirectionalLight) obj.intensity = 0;
    });
  }, []);

  const toggleLayer = useCallback((id) => {
    setLayers(prev => ({ ...prev, [id]: { ...prev[id], enabled:!prev[id].enabled } }));
  }, []);

  const toggleCat = useCallback((id) => {
    setOpenCats(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleRegionChange = useCallback((key) => {
    setRegion(key);
    if (globeEl.current && GLOBE_REGIONS[key]?.pov) {
      globeEl.current.pointOfView(GLOBE_REGIONS[key].pov, 900);
    }
  }, []);

  // ── Arc dataset (oil routes + pipelines + cables + trade flows) ──
  const arcsData = useMemo(() => {
    const out = [];
    const add = (arr, layerKey) => {
      if (!layers[layerKey]?.enabled) return;
      arr.forEach(item => {
        if (!meetsImp(item.importance, importance)) return;
        if (region !== "all" &&
            !inRegion(item.startLat, item.startLng, region) &&
            !inRegion(item.endLat,   item.endLng,   region)) return;
        out.push({ ...item, _layer:layerKey });
      });
    };
    add(OIL_ROUTES,   "oilRoutes");
    add(PIPELINES,    "pipelines");
    add(SEA_CABLES,   "seaCables");
    add(TRADE_FLOWS,  "tradeFlows");
    return out;
  }, [layers, region, importance]);

  // ── Point dataset (chokepoints + landings + ports + conflicts + sanctions) ──
  const pointsData = useMemo(() => {
    const out = [];
    const add = (arr, layerKey) => {
      if (!layers[layerKey]?.enabled) return;
      arr.forEach(item => {
        if (!meetsImp(item.importance, importance)) return;
        if (region !== "all" && !inRegion(item.lat, item.lng, region)) return;
        out.push({ ...item, _layer:layerKey });
      });
    };
    add(CHOKEPOINTS,       "chokepoints");
    add(CABLE_LANDINGS,    "cableLandings");
    add(MAJOR_PORTS,       "majorPorts");
    add(CONFLICT_ZONES,    "conflictZones");
    add(SANCTIONED_REGIONS,"sanctioned");
    return out;
  }, [layers, region, importance]);

  // ── Info panel renderer ──
  const badge = (text, color) => (
    <span className="text-xs font-mono px-1.5 py-0.5 rounded"
      style={{ background:color+"22", border:`1px solid ${color}44`, color }}>{text}</span>
  );

  const renderInfo = (d) => {
    if (!d) return null;
    const research = resolveResearch(d);
    return (
      <div className="p-3 rounded mt-3" style={{ background:"var(--surface-0)", border:"1px solid var(--border-solid)" }}>
        <div className="font-mono font-bold text-xs mb-2" style={{ color:"var(--text-1)" }}>{d.name}</div>

        {d._layer === "chokepoints" && <>
          <div className="flex gap-1 mb-2 flex-wrap">{badge(d.type,"#b45309")}{badge(d.importance||"","#64748b")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"var(--text-3)" }}>Oil flow: <span style={{ color:"#f0a500" }}>{d.oil}</span></div>
          <div className="text-xs font-mono leading-relaxed" style={{ color:"var(--text-3)" }}>{d.note}</div>
        </>}

        {d._layer === "oilRoutes" && <>
          <div className="flex gap-1 mb-2">{badge("Oil Route","#f0a500")}{badge(d.importance||"","#64748b")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"var(--text-3)" }}>Region: <span style={{ color:"var(--text-1)" }}>{d.region}</span></div>
          <div className="text-xs font-mono" style={{ color:"#f0a500" }}>Volume: {d.vol}</div>
        </>}

        {d._layer === "pipelines" && <>
          <div className="flex gap-1 mb-2">{badge(d.type,"#e85d04")}{badge(d.importance||"","#64748b")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"var(--text-3)" }}>Region: <span style={{ color:"var(--text-1)" }}>{d.region}</span></div>
          <div className="text-xs font-mono" style={{ color:"#e85d04" }}>Volume: {d.vol}</div>
        </>}

        {d._layer === "seaCables" && <>
          <div className="flex gap-1 mb-2">{badge("Subsea Cable","#2563eb")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"var(--text-3)" }}>Capacity: <span style={{ color:"#2563eb" }}>{d.capacity}</span></div>
          <div className="text-xs font-mono leading-relaxed" style={{ color:"var(--text-3)" }}>{d.operators}</div>
        </>}

        {d._layer === "cableLandings" && <>
          <div className="flex gap-1 mb-2">{badge("Landing Stn","#059669")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"var(--text-3)" }}>Country: <span style={{ color:"var(--text-1)" }}>{d.country}</span></div>
          <div className="text-xs font-mono leading-relaxed" style={{ color:"#059669" }}>{d.cables?.join(", ")}</div>
        </>}

        {d._layer === "conflictZones" && <>
          <div className="flex gap-1 mb-2 flex-wrap">{badge(d.intensity+" Risk","#ff3333")}{badge(d.type,"#64748b")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"var(--text-3)" }}>Since: <span style={{ color:"var(--text-1)" }}>{d.started}</span></div>
          <div className="text-xs font-mono mb-1" style={{ color:"#e11d48" }}>Market impact: {d.impact}</div>
          <div className="text-xs font-mono leading-relaxed" style={{ color:"var(--text-3)" }}>{d.note}</div>
        </>}

        {d._layer === "sanctioned" && <>
          <div className="flex gap-1 mb-2">{badge("Sanctioned","#b45309")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"var(--text-3)" }}>Regime: <span style={{ color:"#b45309" }}>{d.regime}</span></div>
          <div className="text-xs font-mono mb-1" style={{ color:"var(--text-3)" }}>Impact: <span style={{ color:"var(--text-1)" }}>{d.impact}</span></div>
          <div className="text-xs font-mono leading-relaxed" style={{ color:"var(--text-3)" }}>{d.note}</div>
        </>}

        {d._layer === "majorPorts" && <>
          <div className="flex gap-1 mb-2">{badge(d.type,"#06b6d4")}{badge(`Rank #${d.rank}`,"#64748b")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"var(--text-3)" }}>Country: <span style={{ color:"var(--text-1)" }}>{d.country}</span></div>
          <div className="text-xs font-mono" style={{ color:"#06b6d4" }}>Volume: {d.vol}</div>
        </>}

        {d._layer === "tradeFlows" && <>
          <div className="flex gap-1 mb-2">{badge(d.type,"#a78bfa")}{badge(d.importance||"","#64748b")}</div>
          <div className="text-xs font-mono mb-1" style={{ color:"var(--text-3)" }}>Corridor: <span style={{ color:"var(--text-1)" }}>{d.region}</span></div>
          <div className="text-xs font-mono" style={{ color:"#a78bfa" }}>Trade volume: {d.vol}</div>
        </>}

        <div className="flex gap-2 mt-3">
          {research && onOpenResearch && (
            <button onClick={() => onOpenResearch(research)}
              className="text-xs font-mono px-2 py-1 rounded"
              style={{ background:"#eff6ff", border:"1px solid #58a6ff33", color:"#2563eb", cursor:"pointer" }}>
              → Research
            </button>
          )}
          <button onClick={() => setSelected(null)}
            className="text-xs font-mono px-2 py-1 rounded"
            style={{ background:"transparent", border:"1px solid rgba(15,23,42,0.12)", color:"var(--text-3)", cursor:"pointer" }}>
            ✕ Close
          </button>
        </div>
      </div>
    );
  };

  // ── Active count per category ──
  const catActiveCounts = useMemo(() => {
    const counts = {};
    GLOBE_CATEGORIES.forEach(cat => {
      const layersInCat = Object.entries(layers).filter(([,l]) => l.cat === cat.id);
      counts[cat.id] = { active: layersInCat.filter(([,l]) => l.enabled).length, total: layersInCat.length };
    });
    return counts;
  }, [layers]);

  // ── Visible element counts ──
  const activeCounts = useMemo(() => ({
    arcs: arcsData.length,
    points: pointsData.length,
    layers: Object.values(layers).filter(l => l.enabled).length,
  }), [arcsData.length, pointsData.length, layers]);

  return (
    <div className="flex" style={{ height:"calc(100vh - 90px)", overflow:"hidden" }}>

      {/* ── Left panel: filters + layer controls ── */}
      <div className="terminal-panel flex flex-col"
        style={{ width:240, flexShrink:0, overflowY:"auto", borderRight:"1px solid var(--border)" }}>

        {/* Header */}
        <div className="px-3 pt-3 pb-2" style={{ borderBottom:"1px solid var(--border)" }}>
          <div className="terminal-header text-sm mb-1">🌐 Globe Controls</div>
          <div className="text-xs font-mono" style={{ color:"var(--text-3)" }}>
            {activeCounts.layers} layer{activeCounts.layers !== 1 ? "s" : ""} · {activeCounts.arcs + activeCounts.points} elements
          </div>
        </div>

        {/* Region filter */}
        <div className="px-3 py-2" style={{ borderBottom:"1px solid var(--border)" }}>
          <div className="text-xs font-mono mb-1.5" style={{ color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.07em" }}>Region Focus</div>
          <select value={region} onChange={e => handleRegionChange(e.target.value)}
            className="w-full font-mono text-xs p-1.5 rounded"
            style={{ background:"var(--surface-0)", border:"1px solid var(--border-solid)", color:"var(--text-1)", outline:"none", cursor:"pointer" }}>
            {Object.entries(GLOBE_REGIONS).map(([key, r]) => (
              <option key={key} value={key}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Importance filter */}
        <div className="px-3 py-2" style={{ borderBottom:"1px solid var(--border)" }}>
          <div className="text-xs font-mono mb-1.5" style={{ color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.07em" }}>Importance</div>
          <div className="flex gap-1">
            {[["all","All"],["major","Major"],["critical","Critical"]].map(([val, lbl]) => (
              <button key={val} onClick={() => setImportance(val)}
                className="flex-1 text-xs font-mono py-1 rounded"
                style={{
                  background: importance === val ? "#eff6ff" : "transparent",
                  border:"1px solid",
                  borderColor: importance === val ? "#2563eb33" : "#e2e8f0",
                  color: importance === val ? "#2563eb" : "#64748b",
                  cursor:"pointer",
                }}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Category sections */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {GLOBE_CATEGORIES.map(cat => {
            const layersInCat = Object.entries(layers).filter(([,l]) => l.cat === cat.id);
            const counts = catActiveCounts[cat.id];
            const isOpen = openCats[cat.id];
            return (
              <div key={cat.id} className="mb-2">
                {/* Category header */}
                <button onClick={() => toggleCat(cat.id)}
                  className="w-full flex items-center justify-between py-1.5 px-1"
                  style={{ cursor:"pointer", background:"transparent", border:"none" }}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{cat.icon}</span>
                    <span className="text-xs font-mono font-bold" style={{ color:"var(--text-1)" }}>{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {counts.active > 0 && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background:"#eff6ff", color:"#2563eb", fontSize:9 }}>
                        {counts.active}/{counts.total}
                      </span>
                    )}
                    <span className="text-xs font-mono" style={{ color:"var(--text-3)" }}>{isOpen ? "▾" : "▸"}</span>
                  </div>
                </button>

                {/* Layer buttons */}
                {isOpen && (
                  <div className="flex flex-col gap-1 ml-1 mb-1">
                    {layersInCat.map(([id, layer]) => (
                      <button key={id} onClick={() => toggleLayer(id)}
                        className="w-full flex items-start gap-2 p-2 rounded text-left"
                        style={{
                          background: layer.enabled ? "#eff6ff" : "transparent",
                          border:"1px solid",
                          borderColor: layer.enabled ? layer.color+"44" : "#e2e8f0",
                          cursor:"pointer",
                        }}>
                        <div style={{ width:7, height:7, borderRadius:"50%", background:layer.enabled ? layer.color : "#64748b", flexShrink:0, marginTop:3 }} />
                        <div>
                          <div className="font-mono font-bold" style={{ fontSize:11, color:layer.enabled?"#0f172a":"#64748b" }}>
                            {layer.icon} {layer.label}
                          </div>
                          <div className="font-mono" style={{ fontSize:9, color:"var(--text-3)", lineHeight:1.4 }}>{layer.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Coming soon section */}
          <div className="mb-2">
            <button onClick={() => toggleCat("soon")}
              className="w-full flex items-center justify-between py-1.5 px-1"
              style={{ cursor:"pointer", background:"transparent", border:"none" }}>
              <span className="text-xs font-mono font-bold" style={{ color:"var(--text-3)" }}>Coming Soon</span>
              <span className="text-xs font-mono" style={{ color:"#e2e8f0" }}>{openCats.soon ? "▾" : "▸"}</span>
            </button>
            {openCats.soon && (
              <div className="flex flex-col gap-1 ml-1">
                {GLOBE_FUTURE_LAYERS.map(f => (
                  <div key={f.label} className="flex items-center gap-2 p-2 rounded"
                    style={{ border:"1px solid var(--border)", opacity:0.4 }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:"var(--surface-3)" }} />
                    <div className="font-mono" style={{ fontSize:10, color:"var(--text-3)" }}>{f.icon} {f.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected element info */}
        {selected && (
          <div className="px-3 pb-3" style={{ borderTop:"1px solid var(--border)" }}>
            {renderInfo(selected)}
          </div>
        )}
      </div>

      {/* ── Globe canvas ── */}
      <div ref={containerRef} className="flex-1 relative" style={{ background:"var(--surface-0)" }}>
        {!GlobeComp ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="text-xs font-mono animate-pulse" style={{ color:"var(--text-3)" }}>Initializing WebGL renderer…</div>
            <div className="text-xs font-mono" style={{ color:"var(--text-3)" }}>Loading globe assets</div>
          </div>
        ) : (
          <GlobeComp
            ref={globeEl}
            width={dims.w}
            height={dims.h}
            onGlobeReady={onGlobeReady}

            /* Globe: constant daylight, blue-marble texture */
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            showAtmosphere={true}
            atmosphereColor="#4a8fd4"
            atmosphereAltitude={0.12}

            /* Arcs — all layers */
            arcsData={arcsData}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor={arcCol}
            arcStroke={arcStr}
            arcDashLength={1}
            arcDashGap={0}
            arcDashAnimateTime={0}
            arcAltitude={arcAlt}
            arcLabel={d => `<div style="${TIP}"><b>${d.name}</b>${d.vol ? `<br/>Vol: ${d.vol}` : ""}${d.capacity ? `<br/>Cap: ${d.capacity}` : ""}${d.type ? `<br/>${d.type}` : ""}</div>`}
            onArcClick={d => setSelected(d)}
            onArcHover={d => setHovered(d)}

            /* Points — all layers */
            pointsData={pointsData}
            pointLat="lat"
            pointLng="lng"
            pointColor={ptCol}
            pointRadius={ptRad}
            pointAltitude={ptAlt}
            pointResolution={12}
            pointLabel={d => `<div style="${TIP}"><b>${d.name}</b>${d.oil ? `<br/>Oil: ${d.oil}` : ""}${d.vol ? `<br/>Vol: ${d.vol}` : ""}${d.country ? `<br/>${d.country}` : ""}${d.intensity ? `<br/>Risk: ${d.intensity}` : ""}</div>`}
            onPointClick={d => setSelected(d)}
            onPointHover={d => setHovered(d)}
          />
        )}

        {/* Status bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-1.5"
          style={{ background:"var(--surface-0)", borderTop:"1px solid var(--border)", pointerEvents:"none" }}>
          <div className="text-xs font-mono" style={{ color: hovered ? "#0f172a" : "#64748b" }}>
            {hovered ? hovered.name : "Drag to rotate · Scroll to zoom · Click for detail"}
          </div>
          <div className="flex items-center gap-3">
            {region !== "all" && (
              <span className="text-xs font-mono" style={{ color:"#2563eb" }}>
                ◉ {GLOBE_REGIONS[region]?.label}
              </span>
            )}
            {importance !== "all" && (
              <span className="text-xs font-mono" style={{ color:"#b45309" }}>
                ▲ {importance[0].toUpperCase() + importance.slice(1)} only
              </span>
            )}
            <span className="text-xs font-mono" style={{ color:"var(--text-3)" }}>
              {activeCounts.arcs + activeCounts.points} elements
            </span>
          </div>
        </div>

        {/* Layer legend overlay */}
        <div className="absolute top-3 right-3 flex flex-col gap-1" style={{ pointerEvents:"none" }}>
          {Object.entries(layers).filter(([,l]) => l.enabled).map(([id, layer]) => (
            <div key={id} className="text-xs font-mono px-2 py-1 rounded flex items-center gap-1.5"
              style={{ background:"var(--surface-0)", border:`1px solid ${layer.color}33`, color:layer.color }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:layer.color }} />
              {layer.icon} {layer.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
