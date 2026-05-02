import { RESEARCH_CATALOG, HOME_TILES } from "../../../data/researchData";

export default function ResearchHomeDashboard({ onOpen }) {
  const byId = Object.fromEntries(RESEARCH_CATALOG.map(c => [c.id, c]));
  return (
    <div>
      <div className="font-mono mb-4" style={{ color:"var(--text-3)", fontSize:11 }}>
        Search above to open research panels — or start from a quick-access tile below. Press <span style={{ color:"var(--text-3)" }}>/</span> to focus the search bar.
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))" }}>
        {HOME_TILES.map(({ heading, color, ids }) => (
          <div key={heading} className="terminal-panel p-3">
            <div className="font-mono mb-2" style={{ color, fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>{heading}</div>
            <div className="flex flex-col gap-1">
              {ids.map(id => {
                const item = byId[id];
                if (!item) return null;
                return (
                  <button key={id} onClick={() => onOpen(item)} className="text-left font-mono px-2 py-1.5"
                    style={{ background:"transparent", border:"1px solid rgba(15,23,42,0.12)", borderRadius:10, color:"var(--text-1)", fontSize:12, cursor:"pointer", transition:"all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"; e.currentTarget.style.background="#f8fafc"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="transparent"; }}>
                    <span style={{ color }}>{item.label}</span>
                    <span style={{ color:"var(--text-3)", marginLeft:8, fontSize:10 }}>{item.id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
