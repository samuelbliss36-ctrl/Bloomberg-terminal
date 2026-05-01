export default function TankerMap() {
  return (
    <div className="flex flex-col" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="terminal-header">🛢 Live Vessel Tracker — MarineTraffic</span>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #58a6ff33" }}>● LIVE</span>
      </div>
      <iframe
        src="https://www.marinetraffic.com/en/ais/embed/maptype:0/mmsi:0/vesseltype:80/zoom:4/shownames:true/bgcolor:000000"
        style={{ width: "100%", height: 450, border: "none" }}
        title="Live Vessel Tracker"
      />
    </div>
  );
}
