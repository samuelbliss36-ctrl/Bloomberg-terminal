export default function FlightTracker() {
  return (
    <div className="flex flex-col" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="terminal-header">✈️ Live Flight Tracker — FlightRadar24</span>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #58a6ff33" }}>● LIVE</span>
      </div>
      <iframe
        src="https://globe.adsbexchange.com/?largeMode=1"
        style={{ width: "100%", height: 450, border: "none" }}
        title="Live Flight Tracker"
      />
    </div>
  );
}
