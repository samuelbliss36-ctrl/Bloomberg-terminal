export default function EnergyGrid() {
  return (
    <div className="flex flex-col" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="terminal-header">⚡ Live Energy Grid — Electricity Maps</span>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #58a6ff33" }}>● LIVE</span>
        <span className="text-xs font-mono" style={{ color: "var(--text-3)" }}>Carbon intensity & energy mix by country</span>
      </div>
      <iframe
        src="https://www.eia.gov/electricity/gridmonitor/dashboard/electric_overview/US48/US48"
        style={{ width: "100%", height: 450, border: "none" }}
        title="Live Energy Grid"
      />
    </div>
  );
}
