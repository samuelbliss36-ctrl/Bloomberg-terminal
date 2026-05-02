import { useState, useEffect } from "react";
import { fetchChart } from "../../lib/api";
import { fmt, clr, delay } from "../../lib/fmt";
import { UniversalChart } from "../../components/charts/UniversalChart";

export default function CryptoDashboard({ onContextUpdate }) {
  const COINS = [
    { ticker: "BTC-USD", label: "Bitcoin", symbol: "BTC" },
    { ticker: "ETH-USD", label: "Ethereum", symbol: "ETH" },
    { ticker: "SOL-USD", label: "Solana", symbol: "SOL" },
    { ticker: "BNB-USD", label: "BNB", symbol: "BNB" },
    { ticker: "XRP-USD", label: "XRP", symbol: "XRP" },
    { ticker: "DOGE-USD", label: "Dogecoin", symbol: "DOGE" },
    { ticker: "ADA-USD", label: "Cardano", symbol: "ADA" },
    { ticker: "AVAX-USD", label: "Avalanche", symbol: "AVAX" },
    { ticker: "LINK-USD", label: "Chainlink", symbol: "LINK" },
    { ticker: "DOT-USD", label: "Polkadot", symbol: "DOT" },
    { ticker: "MATIC-USD", label: "Polygon", symbol: "MATIC" },
    { ticker: "UNI7083-USD", label: "Uniswap", symbol: "UNI" },
  ];

  const [prices, setPrices] = useState({});
  const [active, setActive] = useState("BTC-USD");
  const activeCoin = COINS.find(c => c.ticker === active);

  // Serialize live state into copilot context
  useEffect(() => {
    if (!onContextUpdate) return;
    const snapshot = COINS.map(c => ({
      ...c,
      price:     prices[c.ticker]?.price     ?? null,
      changePct: prices[c.ticker]?.changePct ?? null,
    }));
    onContextUpdate({ type: "crypto", active, snapshot });
  }, [prices, active]); // eslint-disable-line

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      for (const c of COINS) {
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

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "280px 1fr", gridTemplateRows: "1fr auto" }}>
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "1/3", overflowY: "auto" }}>
        <div className="terminal-header mb-3">₿ Crypto Markets</div>
        <div className="flex flex-col gap-1">
          {COINS.map(c => {
            const d = prices[c.ticker];
            const isActive = active === c.ticker;
            return (
              <div key={c.ticker} onClick={() => setActive(c.ticker)}
                className="flex items-center justify-between p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#eff6ff" : "transparent", border: "1px solid", borderColor: isActive ? "#2563eb33" : "#e2e8f0" }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold"
                    style={{ background: "#e2e8f0", color: isActive ? "#2563eb" : "#64748b" }}>{c.symbol.slice(0,1)}</div>
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: isActive ? "#2563eb" : "#0f172a" }}>{c.label}</div>
                    <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{c.symbol}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold" style={{ color: "var(--text-1)" }}>
                    {d === undefined ? "…" : d?.price != null ? "$" + fmt.price(d.price) : "—"}
                  </div>
                  {d?.changePct != null && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#2563eb" : "#e11d48" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3 flex flex-col" style={{ gridColumn: "2/3", gridRow: "1/2" }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="terminal-header">{activeCoin?.label} ({activeCoin?.symbol})</span>
          {prices[active]?.price && <span className="font-mono font-bold" style={{ color:"var(--text-1)", fontSize:18 }}>${fmt.price(prices[active].price)}</span>}
          {prices[active]?.changePct != null && <span className="font-mono" style={{ color:clr(prices[active].changePct), fontSize:12 }}>{prices[active].changePct>=0?"▲":"▼"}{Math.abs(prices[active].changePct).toFixed(2)}%</span>}
        </div>
        <div style={{ flex:1, minHeight:280 }}>
          <UniversalChart ticker={active} height={280} showVolume defaultTf="1M" />
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "2/3" }}>
        <div className="terminal-header mb-3">24h Market Overview</div>
        <div className="grid grid-cols-4 gap-2">
          {COINS.slice(0, 8).map(c => {
            const d = prices[c.ticker];
            return (
              <div key={c.ticker} onClick={() => setActive(c.ticker)}
                className="p-2 rounded cursor-pointer"
                style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
                <div className="text-xs font-mono font-bold" style={{ color: "var(--text-3)" }}>{c.symbol}</div>
                <div className="text-xs font-mono font-bold" style={{ color: "var(--text-1)" }}>{d?.price ? "$" + fmt.price(d.price) : "..."}</div>
                {d?.changePct != null && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#2563eb" : "#e11d48" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
