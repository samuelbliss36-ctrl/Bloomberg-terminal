/** Lightweight markdown → JSX renderer (bold, inline code, bullet lists) */
export function MdText({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div>
      {lines.map((line, i) => {
        const isBullet = /^\s*[•\-*] /.test(line);
        const content  = line.replace(/^\s*[•\-*] /, "");
        const parts    = (isBullet ? content : line).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        const rendered = parts.map((p, j) => {
          if (p.startsWith("**") && p.endsWith("**")) return <strong key={j}>{p.slice(2,-2)}</strong>;
          if (p.startsWith("`")  && p.endsWith("`"))  return <code key={j} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"0.9em", background:"rgba(15,23,42,0.07)", padding:"1px 4px", borderRadius:3 }}>{p.slice(1,-1)}</code>;
          return p;
        });
        if (isBullet) return <div key={i} style={{ display:"flex", gap:6, marginBottom:2 }}><span style={{ flexShrink:0, color:"#2563eb" }}>•</span><span>{rendered}</span></div>;
        if (line.trim() === "") return <div key={i} style={{ height:6 }} />;
        return <div key={i} style={{ marginBottom:2 }}>{rendered}</div>;
      })}
    </div>
  );
}
