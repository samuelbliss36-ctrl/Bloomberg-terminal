import { useState, useEffect } from "react";
import { COUNTRY_CONFIG } from "../../data/countryData";
import CountryDashboard from "./CountryDashboard";
import { InsightChip } from "../../components/InsightChip";

export default function GlobalMarketsModule({ onOpenResearch, onContextUpdate }) {
  const [selected, setSelected] = useState("CA");
  const countries = Object.values(COUNTRY_CONFIG);
  const country   = COUNTRY_CONFIG[selected];

  useEffect(() => {
    if (!onContextUpdate || !country) return;
    onContextUpdate({
      type: "markets",
      country: { id: selected, name: country.name, flag: country.flag, currency: country.currency },
    });
  }, [selected, onContextUpdate]); // eslint-disable-line

  return (
    <div className="flex flex-col flex-1" style={{ overflow:"hidden" }}>
      {/* ── Country selector bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 flex-wrap" style={{ borderBottom:"1px solid var(--border)", flexShrink:0 }}>
        <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", marginRight:4 }}>Markets:</span>
        {countries.map(c => (
          <button key={c.id} onClick={() => setSelected(c.id)} className="font-mono"
            style={{
              borderRadius:10, border:"1px solid", padding:"3px 10px", fontSize:10, cursor:"pointer",
              borderColor: selected===c.id ? c.accentColor : "var(--border-solid)",
              color:        selected===c.id ? c.accentColor : "var(--text-3)",
              background:   selected===c.id ? c.accentColor+"18" : "transparent",
            }}>
            {c.flag} {c.name}
          </button>
        ))}
      </div>
      <InsightChip page="global-markets" context="Global equity markets: international indices, country ETFs, and macro data." style={{ margin: "8px 16px" }} />
      <CountryDashboard key={selected} country={country} onOpenResearch={onOpenResearch} />
    </div>
  );
}
