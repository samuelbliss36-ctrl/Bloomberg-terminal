// Persistent settings helpers
export const loadSettings = () => {
  try { return JSON.parse(localStorage.getItem("ov_settings") || "{}"); } catch { return {}; }
};
export const saveSettings = (s) => {
  try { localStorage.setItem("ov_settings", JSON.stringify(s)); } catch {}
};

export const fmt = {
  price: (v) => v?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pct: (v) => (v >= 0 ? "+" : "") + v?.toFixed(2) + "%",
  change: (v) => (v >= 0 ? "+" : "") + v?.toFixed(2),
  large: (v) => { if (!v) return "N/A"; if (v >= 1e12) return "$" + (v/1e12).toFixed(2) + "T"; if (v >= 1e9) return "$" + (v/1e9).toFixed(2) + "B"; if (v >= 1e6) return "$" + (v/1e6).toFixed(2) + "M"; return "$" + v?.toLocaleString(); },
  volume: (v) => { if (!v) return "N/A"; if (v >= 1e6) return (v/1e6).toFixed(2) + "M"; if (v >= 1e3) return (v/1e3).toFixed(1) + "K"; return v?.toString(); },
};
export const clr = (v) => (v >= 0 ? "#059669" : "#e11d48");
export const bg = (v) => (v >= 0 ? "rgba(5,150,105,0.10)" : "rgba(225,29,72,0.10)");
export const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Market cap from Finnhub is in millions USD
export const fmtMktCap = v => { if (v == null || isNaN(v)) return "—"; if (v >= 1e6) return "$" + (v/1e6).toFixed(2) + "T"; if (v >= 1e3) return "$" + (v/1e3).toFixed(2) + "B"; return "$" + Math.round(v) + "M"; };
export const fmtX   = v => v == null || isNaN(v) ? "—" : v.toFixed(1) + "x";
export const fmtN   = (v, d=2) => v == null || isNaN(v) ? "—" : (+v).toFixed(d);
export const fmtMgn = v => v == null || isNaN(v) ? "—" : (+v).toFixed(1) + "%";
export const fmtGr  = v => v == null || isNaN(v) ? "—" : (v >= 0 ? "+" : "") + (+v).toFixed(1) + "%";
export const clrM   = v => v == null ? "#64748b" : v > 0 ? "#059669" : "#e11d48";
export function clrM2(v) {
  if (typeof v !== "string") return "#0f172a";
  const n = parseFloat(v);
  if (isNaN(n)) return "#0f172a";
  if (v.includes("%")) return n > 0 ? "#059669" : "#e11d48";
  return "#0f172a";
}

export const RB_TYPE_COLOR = { equity:"#2563eb", commodity:"#b45309", fx:"#059669", macro:"#7c3aed", topic:"#ea580c" };

export const sentimentStyle = {
  bullish: { color: "#059669", bg: "rgba(5,150,105,0.10)", label: "BULLISH" },
  bearish: { color: "#e11d48", bg: "rgba(225,29,72,0.10)", label: "BEARISH" },
  neutral: { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", label: "NEUTRAL" },
};
export function getSentiment(headline) {
  const h = headline.toLowerCase();
  if (["beat", "record", "surge", "growth", "profit", "gain", "rise", "strong", "buy", "upgrade"].some(w => h.includes(w))) return "bullish";
  if (["miss", "fall", "drop", "loss", "weak", "cut", "probe", "lawsuit", "fine", "sell", "downgrade"].some(w => h.includes(w))) return "bearish";
  return "neutral";
}
