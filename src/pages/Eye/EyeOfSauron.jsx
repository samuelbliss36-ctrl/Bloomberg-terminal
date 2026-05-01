import { useState } from "react";
import GlobalIntelligenceGlobe from "./GlobalIntelligenceGlobe";
import WeatherDashboard from "./WeatherDashboard";
import TankerMap from "./TankerMap";
import FlightTracker from "./FlightTracker";
import EnergyGrid from "./EnergyGrid";
import GeopoliticalEvents from "./GeopoliticalEvents";

export default function EyeOfSauron({ onOpenResearch }) {
  const [active, setActive] = useState(null);

  const MODULES = [
    { id: "globe",   icon: "🌐", title: "Infrastructure Globe", desc: "Interactive 3D globe — oil routes, subsea cables, strategic chokepoints" },
    { id: "weather", icon: "🌦", title: "Global Weather",       desc: "Live weather across major financial centers worldwide" },
    { id: "vessels", icon: "🛢", title: "Vessel Tracker",       desc: "Live oil tankers and cargo ships via MarineTraffic" },
    { id: "flights", icon: "✈️", title: "Flight Tracker",       desc: "Real-time global flight tracking via ADS-B Exchange" },
    { id: "energy",  icon: "⚡", title: "Energy Grid",          desc: "Live US electricity grid demand and generation mix" },
    { id: "tankers", icon: "🚢", title: "Shipping Routes",      desc: "Major shipping lane congestion and freight rates", tag: "Coming Soon" },
    { id: "geo",     icon: "🌍", title: "Geopolitical Events",  desc: "Live intelligence feed — market-moving events classified by impact and region" },
  ];

  const renderModule = (id) => {
    if (id === "globe")   return <GlobalIntelligenceGlobe onOpenResearch={onOpenResearch} />;
    if (id === "weather") return <WeatherDashboard />;
    if (id === "vessels") return <TankerMap />;
    if (id === "flights") return <FlightTracker />;
    if (id === "energy")  return <EnergyGrid />;
    if (id === "geo")     return <GeopoliticalEvents onOpenResearch={onOpenResearch} />;
    return null;
  };

  if (active) {
    const mod = MODULES.find(m => m.id === active);
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => setActive(null)}
            className="text-xs font-mono px-3 py-1 rounded transition-colors"
            style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #58a6ff33" }}>
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
        <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>Global intelligence feeds — click any module to expand</div>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        {MODULES.map(mod => (
          <div key={mod.id}
            onClick={() => !mod.tag && setActive(mod.id)}
            className="eye-card p-4 transition-all"
            style={{ cursor: mod.tag ? "default" : "pointer", minHeight: 140 }}>
            <div style={{ fontSize: 36 }} className="mb-3">{mod.icon}</div>
            <div className="font-mono font-bold text-sm mb-1" style={{ color: mod.tag ? "#64748b" : "#0f172a" }}>{mod.title}</div>
            <div className="font-mono text-xs leading-relaxed mb-3" style={{ color: "var(--text-3)" }}>{mod.desc}</div>
            {mod.tag ? (
              <span className="text-xs font-mono px-2 py-1 rounded" style={{ border: "1px solid #7d8590", color: "#2563eb33" }}>Coming Soon</span>
            ) : (
              <span className="text-xs font-mono px-2 py-1 rounded" style={{ border: "1px solid #58a6ff33", color: "#2563eb" }}>● Click to Open</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
