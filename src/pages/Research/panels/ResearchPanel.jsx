import EquityResearchPanel    from "./EquityResearchPanel";
import CommodityResearchPanel  from "./CommodityResearchPanel";
import FXResearchPanel         from "./FXResearchPanel";
import MacroResearchPanel      from "./MacroResearchPanel";
import TopicResearchPanel      from "./TopicResearchPanel";

export default function ResearchPanel({ item, onClose, onOpen }) {
  if (item.type === "equity") {
    return (
      <div style={{ gridColumn:"1 / -1" }}>
        <EquityResearchPanel item={item} onClose={onClose} onOpen={onOpen} />
      </div>
    );
  }
  switch (item.type) {
    case "commodity": return <CommodityResearchPanel item={item} onClose={onClose} onOpen={onOpen} />;
    case "fx":        return <FXResearchPanel        item={item} onClose={onClose} onOpen={onOpen} />;
    case "macro":     return <MacroResearchPanel     item={item} onClose={onClose} onOpen={onOpen} />;
    case "topic":     return <TopicResearchPanel     item={item} onClose={onClose} onOpen={onOpen} />;
    default:          return null;
  }
}
