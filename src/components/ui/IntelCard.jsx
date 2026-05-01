export function IntelCard({ intel, accentColor = "#b45309" }) {
  if (!intel) return null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-mono mb-1" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>What It Is</div>
        <p className="font-mono" style={{ color:"#1e293b", fontSize:11, lineHeight:1.7 }}>{intel.whatItIs}</p>
      </div>
      <div>
        <div className="font-mono mb-1" style={{ color:accentColor, fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Why It Matters</div>
        <p className="font-mono" style={{ color:"#1e293b", fontSize:11, lineHeight:1.7 }}>{intel.whyItMatters}</p>
      </div>
      <div>
        <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Key Drivers</div>
        <div className="flex flex-col gap-1">
          {intel.drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-mono flex-shrink-0" style={{ color:accentColor, fontSize:10 }}>▸</span>
              <span className="font-mono" style={{ color:"#475569", fontSize:10, lineHeight:1.6 }}>{d}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Market Relationships</div>
        <div className="flex flex-col gap-1">
          {intel.relationships.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-mono flex-shrink-0" style={{ color:"#2563eb", fontSize:10 }}>↔</span>
              <span className="font-mono" style={{ color:"#475569", fontSize:10, lineHeight:1.6 }}>{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
