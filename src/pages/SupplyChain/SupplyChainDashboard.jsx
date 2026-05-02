import { useState, useEffect } from "react";
import { fetchChart } from "../../lib/api";
import { clr, delay } from "../../lib/fmt";
import { UniversalChart } from "../../components/charts/UniversalChart";

export default function SupplyChainDashboard({ onOpenResearch, onContextUpdate }) {
  const FRED_SERIES = [
    { id: "FEDFUNDS",    label: "Fed Funds Rate",          note: "FOMC policy rate",                src: "Federal Reserve", suffix: "%",  freq: "Monthly" },
    { id: "DGS10",       label: "US 10Y Treasury",         note: "Risk-free rate benchmark",        src: "US Treasury",     suffix: "%",  freq: "Daily"   },
    { id: "DGS2",        label: "US 2Y Treasury",          note: "Short-term rate expectation",     src: "US Treasury",     suffix: "%",  freq: "Daily"   },
    { id: "T10Y2Y",      label: "Yield Curve (10Y-2Y)",    note: "Inversion = recession signal",    src: "Fed",             suffix: "%",  freq: "Daily"   },
    { id: "T10YIE",      label: "10Y Breakeven Inflation", note: "Market inflation expectation",    src: "Fed",             suffix: "%",  freq: "Daily"   },
    { id: "CPIAUCSL",    label: "CPI (Urban)",             note: "Consumer price inflation",        src: "BLS",             suffix: "",   freq: "Monthly" },
    { id: "PCEPI",       label: "PCE Price Index",         note: "Fed's preferred inflation gauge", src: "BEA",             suffix: "",   freq: "Monthly" },
    { id: "PPIACO",      label: "PPI All Commodities",     note: "Producer price inflation",        src: "BLS",             suffix: "",   freq: "Monthly" },
    { id: "UNRATE",      label: "Unemployment Rate",       note: "US labor market health",          src: "BLS",             suffix: "%",  freq: "Monthly" },
    { id: "GDP",         label: "US Real GDP",             note: "Quarterly economic output",       src: "BEA",             suffix: "",   freq: "Quarterly"},
    { id: "M2SL",        label: "M2 Money Supply",         note: "Broad money supply ($B)",         src: "Federal Reserve", suffix: "B",  freq: "Monthly" },
    { id: "BOPGSTB",     label: "US Trade Balance",        note: "Monthly goods trade deficit",     src: "Census",          suffix: "M",  freq: "Monthly" },
  ];

  const INDICES = [
    { ticker: "HG=F", label: "Copper (Dr. Copper)", symbol: "HG", desc: "Global economic health proxy" },
    { ticker: "NG=F", label: "Natural Gas", symbol: "NG", desc: "Energy & heating cost" },
    { ticker: "CL=F", label: "WTI Crude Oil", symbol: "WTI", desc: "Global transport cost" },
    { ticker: "ZW=F", label: "Wheat", symbol: "ZW", desc: "Food supply stress indicator" },
  ];

  const [prices, setPrices] = useState({});
  const [active, setActive] = useState("CL=F");
  const [fredData, setFredData] = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      for (const s of FRED_SERIES) {
        if (cancelled) return;
        try {
          const r = await fetch("/api/fred?series=" + s.id);
          if (!r.ok) throw new Error("HTTP " + r.status);
          const d = await r.json();
          const valid = (d.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
          const latest = valid[valid.length - 1];
          const prev   = valid[valid.length - 2];
          const val    = latest ? parseFloat(latest.value) : NaN;
          const prevVal = prev  ? parseFloat(prev.value)   : NaN;
          const change = !isNaN(val) && !isNaN(prevVal) ? val - prevVal : null;
          const entry = { value: !isNaN(val) ? val : null, change, date: latest?.date };
          if (!cancelled) setFredData(fd => ({ ...fd, [s.id]: entry }));
        } catch(e) {
          if (!cancelled) setFredData(fd => ({ ...fd, [s.id]: null }));
        }
        await delay(150);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      for (const c of INDICES) {
        if (cancelled) return;
        try {
          const d = await fetchChart(c.ticker, "1d", "1m");
          const meta = d?.chart?.result?.[0]?.meta;
          const price = meta?.regularMarketPrice ?? null;
          const prev  = meta?.previousClose ?? null;
          const change    = price != null && prev != null ? price - prev : null;
          const changePct = price != null && prev != null ? ((price - prev) / prev) * 100 : null;
          if (!cancelled) setPrices(p => ({ ...p, [c.ticker]: { price, change, changePct } }));
        } catch(e) {
          if (!cancelled) setPrices(p => ({ ...p, [c.ticker]: null }));
        }
        await delay(150);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // Serialize live state into copilot context
  useEffect(() => {
    if (!onContextUpdate) return;
    const macroSnapshot = FRED_SERIES.map(s => ({
      ...s,
      value:  fredData[s.id]?.value  ?? null,
      change: fredData[s.id]?.change ?? null,
      date:   fredData[s.id]?.date   ?? null,
    }));
    const commoditySnapshot = INDICES.map(c => ({
      ...c,
      price:     prices[c.ticker]?.price     ?? null,
      changePct: prices[c.ticker]?.changePct ?? null,
    }));
    onContextUpdate({ type: "supplychain", macroSnapshot, commoditySnapshot });
  }, [fredData, prices]); // eslint-disable-line

  const activeIndex = INDICES.find(c => c.ticker === active);

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "280px 1fr" }}>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/2", gridRow: "1/3", overflowY: "auto" }}>
        <div className="terminal-header mb-1">📊 Macro Indicators</div>
        <div className="text-xs font-mono mb-3" style={{ color: "var(--text-3)" }}>Monthly published figures</div>
        <div className="flex flex-col gap-1">
          {FRED_SERIES.map(s => {
            const d = fredData[s.id];
            const val = d?.value;
            const chg = d?.change;
            const display = d === undefined ? "…"
              : val != null
                ? s.id === "BOPGSTB" ? "$" + (val/1000).toFixed(1) + "B"
                : s.id === "M2SL"    ? "$" + (val/1000).toFixed(2) + "T"
                : s.id === "GDP"     ? "$" + (val/1000).toFixed(1) + "T"
                : val.toFixed(2) + s.suffix
              : "—";
            const chgDisplay = chg != null ? (chg >= 0 ? "+" : "") + chg.toFixed(2) + s.suffix : d === undefined ? "" : "—";
            const chgColor = chg == null ? "var(--text-3)" : chg >= 0 ? "#2563eb" : "#e11d48";
            const researchItem = { id: s.id, label: s.label, type: "macro", series: s.id, category: "Macro" };
            return (
              <div key={s.id} className="p-2 rounded" onClick={() => onOpenResearch && onOpenResearch(researchItem)}
                style={{ background: "var(--surface-0)", border: "1px solid var(--border)", cursor: onOpenResearch ? "pointer" : "default" }}
                onMouseEnter={e => { if (onOpenResearch) e.currentTarget.style.borderColor="rgba(15,23,42,0.28)"; }}
                onMouseLeave={e => { if (onOpenResearch) e.currentTarget.style.borderColor="#e2e8f0"; }}>
                <div className="flex items-center justify-between mb-0.5">
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: "var(--text-1)" }}>{s.label}</div>
                    <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{s.src} · {s.freq}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold" style={{ color: val != null ? "#b45309" : "var(--text-3)" }}>{display}</div>
                    <div className="text-xs font-mono" style={{ color: chgColor }}>{chgDisplay}</div>
                  </div>
                </div>
                <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{s.note}</div>
                {d?.date && <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>As of {d.date}</div>}
              </div>
            );
          })}
        </div>

        <div className="terminal-header mt-4 mb-2">⚡ Live Market Proxies</div>
        <div className="flex flex-col gap-1">
          {INDICES.map(c => {
            const d = prices[c.ticker];
            const isActive = active === c.ticker;
            return (
              <div key={c.ticker} onClick={() => setActive(c.ticker)}
                className="p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "var(--blue-dim)" : "var(--surface-0)", border: "1px solid", borderColor: isActive ? "rgba(37,99,235,0.25)" : "var(--border)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: isActive ? "var(--blue)" : "var(--text-1)" }}>{c.label}</div>
                    <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{c.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold" style={{ color: "var(--text-1)" }}>
                      {d === undefined ? "…" : d?.price != null ? (d.price > 100 ? d.price.toFixed(0) : d.price.toFixed(2)) : "—"}
                    </div>
                    {d?.changePct != null && <div className="text-xs font-mono" style={{ color: d.changePct >= 0 ? "#2563eb" : "#e11d48" }}>{d.changePct >= 0 ? "▲" : "▼"}{Math.abs(d.changePct).toFixed(2)}%</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "2/3", gridRow: "1/2" }}>
        <div className="mb-2">
          <div className="terminal-header">{activeIndex?.label}</div>
          <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{activeIndex?.desc}</div>
          {prices[active] && (
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono font-bold" style={{ color: "var(--text-1)", fontSize: 20 }}>
                {prices[active]?.price > 100 ? prices[active]?.price?.toFixed(0) : prices[active]?.price?.toFixed(2)}
              </span>
              <span className="text-xs font-mono" style={{ color: clr(prices[active]?.changePct) }}>
                {prices[active]?.changePct >= 0 ? "▲" : "▼"} {Math.abs(prices[active]?.changePct || 0).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <UniversalChart ticker={active} height={240} showVolume defaultTf="1Y" label={activeIndex?.label} />
      </div>
    </div>
  );
}
