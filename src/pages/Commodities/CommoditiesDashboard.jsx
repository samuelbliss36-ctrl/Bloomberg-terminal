import { useState, useEffect } from "react";
import { fetchChart } from "../../lib/api";
import { fmt, clr, delay } from "../../lib/fmt";
import { UniversalChart } from "../../components/charts/UniversalChart";

export default function CommoditiesDashboard() {
  const COMMODITIES = [
    { ticker: "GC=F", label: "Gold", symbol: "XAU", unit: "$/oz", category: "Metals" },
    { ticker: "SI=F", label: "Silver", symbol: "XAG", unit: "$/oz", category: "Metals" },
    { ticker: "HG=F", label: "Copper", symbol: "XCU", unit: "$/lb", category: "Metals" },
    { ticker: "PL=F", label: "Platinum", symbol: "XPT", unit: "$/oz", category: "Metals" },
    { ticker: "CL=F", label: "WTI Crude", symbol: "WTI", unit: "$/bbl", category: "Energy" },
    { ticker: "BZ=F", label: "Brent Crude", symbol: "BRT", unit: "$/bbl", category: "Energy" },
    { ticker: "NG=F", label: "Natural Gas", symbol: "NG", unit: "$/MMBtu", category: "Energy" },
    { ticker: "RB=F", label: "Gasoline", symbol: "RB", unit: "$/gal", category: "Energy" },
    { ticker: "ZW=F", label: "Wheat", symbol: "ZW", unit: "$/bu", category: "Agriculture" },
    { ticker: "ZC=F", label: "Corn", symbol: "ZC", unit: "$/bu", category: "Agriculture" },
    { ticker: "ZS=F", label: "Soybeans", symbol: "ZS", unit: "$/bu", category: "Agriculture" },
    { ticker: "KC=F", label: "Coffee", symbol: "KC", unit: "$/lb", category: "Agriculture" },
  ];

  const [prices,   setPrices]   = useState({});
  const [active,   setActive]   = useState("GC=F");
  const [category, setCategory] = useState("Metals");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      for (const c of COMMODITIES) {
        if (cancelled) return;
        try {
          const d = await fetchChart(c.ticker, "1d", "1m");
          const meta = d?.chart?.result?.[0]?.meta;
          const price = meta?.regularMarketPrice ?? null;
          const prev  = meta?.previousClose ?? null;
          const changePct = price != null && prev != null ? ((price - prev) / prev) * 100 : null;
          if (!cancelled) setPrices(p => ({ ...p, [c.ticker]: { price, changePct } }));
        } catch(e) {
          if (!cancelled) setPrices(p => ({ ...p, [c.ticker]: null }));
        }
        await delay(120);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  const activeCommodity = COMMODITIES.find(c => c.ticker === active);
  const categories = ["Metals", "Energy", "Agriculture"];
  const filtered = COMMODITIES.filter(c => c.category === category);

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "340px 1fr", gridTemplateRows: "auto 1fr" }}>
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "1/3", overflowY: "auto" }}>
        <div className="terminal-header mb-3">🛢 Commodities Futures</div>
        <div className="flex gap-2 mb-3">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className="px-3 py-1 text-xs font-mono border rounded transition-colors"
              style={{ borderColor: category === cat ? "#2563eb" : "#e2e8f0", color: category === cat ? "#2563eb" : "#64748b", background: category === cat ? "#eff6ff" : "transparent" }}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {filtered.map(c => {
            const d = prices[c.ticker];
            const isActive = active === c.ticker;
            return (
              <div key={c.ticker} onClick={() => setActive(c.ticker)}
                className="flex items-center justify-between p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#eff6ff" : "transparent", border: "1px solid", borderColor: isActive ? "#2563eb33" : "#e2e8f0" }}>
                <div>
                  <div className="text-xs font-mono font-bold" style={{ color: isActive ? "#2563eb" : "#0f172a" }}>{c.label}</div>
                  <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{c.symbol} · {c.unit}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold" style={{ color: "var(--text-1)" }}>
                    {d === undefined ? "…" : d?.price != null ? "$" + fmt.price(d.price) : "—"}
                  </div>
                  {d?.changePct != null && (
                    <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#2563eb" : "#e11d48" }}>
                      {d.changePct >= 0 ? "▲" : "▼"} {Math.abs(d.changePct).toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "1/2" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="terminal-header">{activeCommodity?.label}</span>
          <span className="font-mono" style={{ color:"var(--text-3)", fontSize:9 }}>{activeCommodity?.unit}</span>
          {prices[active]?.price && (
            <span className="font-mono font-bold" style={{ color:"var(--text-1)", fontSize:14, marginLeft:4 }}>${fmt.price(prices[active].price)}</span>
          )}
          {prices[active]?.changePct != null && (
            <span className="font-mono" style={{ color:clr(prices[active].changePct), fontSize:11 }}>
              {prices[active].changePct >= 0 ? "▲" : "▼"} {Math.abs(prices[active].changePct).toFixed(2)}%
            </span>
          )}
        </div>
        <div style={{ height: 280 }}>
          <UniversalChart ticker={active} height={280} showVolume defaultTf="3M" />
        </div>
      </div>
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "2/3" }}>
        <div className="terminal-header mb-3">Market Summary</div>
        <div className="grid grid-cols-3 gap-2">
          {COMMODITIES.map(c => {
            const d = prices[c.ticker];
            return (
              <div key={c.ticker} onClick={() => { setActive(c.ticker); setCategory(c.category); }}
                className="p-2 rounded cursor-pointer transition-colors"
                style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
                <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{c.symbol}</div>
                <div className="text-xs font-mono font-bold" style={{ color: "var(--text-1)" }}>
                  {d === undefined ? "…" : d?.price != null ? "$" + fmt.price(d.price) : "—"}
                </div>
                {d?.changePct != null && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#2563eb" : "#e11d48" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
