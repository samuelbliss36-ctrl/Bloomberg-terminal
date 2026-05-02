import { RB_TYPE_COLOR } from "../../../lib/fmt";
import { RELATED_MAP } from "../../../data/researchData";

export default function RelatedLinks({ itemId, onOpen }) {
  const links = RELATED_MAP[itemId] || [];
  if (!links.length) return null;
  return (
    <div className="mt-auto pt-3" style={{ borderTop:"1px solid rgba(15,23,42,0.08)" }}>
      <div className="font-mono mb-2" style={{ color:"var(--text-3)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Related</div>
      <div className="flex flex-wrap gap-1.5">
        {links.map(link => (
          <button key={link.id} onClick={() => onOpen(link)} className="font-mono"
            style={{ background:"rgba(15,23,42,0.06)", border:"1px solid rgba(15,23,42,0.11)", borderRadius:20, padding:"3px 10px", fontSize:10, color:RB_TYPE_COLOR[link.type]||"#64748b", cursor:"pointer", transition:"all 0.15s cubic-bezier(0.4,0,0.2,1)" }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(15,23,42,0.10)"; e.currentTarget.style.borderColor="rgba(15,23,42,0.24)"; e.currentTarget.style.transform="translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(15,23,42,0.06)"; e.currentTarget.style.borderColor="rgba(15,23,42,0.11)"; e.currentTarget.style.transform="translateY(0)"; }}>
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
