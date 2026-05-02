import { useState, useEffect } from "react";
import { fetchChart } from "../../lib/api";
import { clr, delay } from "../../lib/fmt";
import { UniversalChart } from "../../components/charts/UniversalChart";

export default function FXDashboard({ onOpenResearch, onContextUpdate }) {
  const FX_PAIRS = [
    { ticker: "EURUSD=X",  label: "EUR/USD",  region: "Eurozone", dec: 4 },
    { ticker: "GBPUSD=X",  label: "GBP/USD",  region: "UK",       dec: 4 },
    { ticker: "USDJPY=X",  label: "USD/JPY",  region: "Japan",    dec: 2 },
    { ticker: "USDCHF=X",  label: "USD/CHF",  region: "Switzerland", dec: 4 },
    { ticker: "AUDUSD=X",  label: "AUD/USD",  region: "Australia",dec: 4 },
    { ticker: "USDCAD=X",  label: "USD/CAD",  region: "Canada",   dec: 4 },
    { ticker: "USDCNY=X",  label: "USD/CNY",  region: "China",    dec: 4 },
    { ticker: "DX=F",      label: "DXY Index",region: "Global",   dec: 3 },
    { ticker: "USDINR=X",  label: "USD/INR",  region: "India",    dec: 2 },
    { ticker: "USDMXN=X",  label: "USD/MXN",  region: "Mexico",   dec: 4 },
    { ticker: "USDBRL=X",  label: "USD/BRL",  region: "Brazil",   dec: 4 },
    { ticker: "USDKRW=X",  label: "USD/KRW",  region: "S. Korea", dec: 0 },
  ];

  const CB_SERIES = [
    { id: "FEDFUNDS",          label: "Fed Funds",    flag: "🇺🇸", bank: "Federal Reserve"  },
    { id: "ECBDFR",            label: "ECB Rate",     flag: "🇪🇺", bank: "ECB"              },
    { id: "INTDSRGBM193N",     label: "BoE Rate",     flag: "🇬🇧", bank: "Bank of England"  },
    { id: "IRSTCI01CHM156N",   label: "SNB Rate",     flag: "🇨🇭", bank: "Swiss Natl Bank"  },
    { id: "IRSTCI01AUM156N",   label: "RBA Rate",     flag: "🇦🇺", bank: "Reserve Bank Au"  },
    { id: "IRSTCI01CAM156N",   label: "BoC Rate",     flag: "🇨🇦", bank: "Bank of Canada"   },
  ];

  const [prices,    setPrices]    = useState({});
  const [active,    setActive]    = useState("EURUSD=X");
  const [cbRates,   setCbRates]   = useState({});

  // Fetch FX prices sequentially — avoids Yahoo Finance rate-limiting
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      for (const p of FX_PAIRS) {
        if (cancelled) return;
        try {
          const d = await fetchChart(p.ticker, "1d", "1m");
          const meta = d?.chart?.result?.[0]?.meta;
          const price = meta?.regularMarketPrice ?? null;
          const prev  = meta?.previousClose ?? null;
          const changePct = price != null && prev != null ? ((price - prev) / prev) * 100 : null;
          if (!cancelled) setPrices(pr => ({ ...pr, [p.ticker]: { price, changePct } }));
        } catch(e) {
          if (!cancelled) setPrices(pr => ({ ...pr, [p.ticker]: null }));
        }
        await delay(120);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // Fetch central bank rates from FRED
  useEffect(() => {
    Promise.all(
      CB_SERIES.map(s =>
        fetch("/api/fred?series=" + s.id)
          .then(r => r.json())
          .then(d => {
            const valid = (d.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
            const latest = valid[valid.length - 1];
            return [s.id, { ...s, value: latest ? parseFloat(latest.value) : null, date: latest?.date }];
          })
          .catch(() => [s.id, { ...s, value: null }])
      )
    ).then(results => setCbRates(Object.fromEntries(results)));
  }, []); // eslint-disable-line

  // Serialize live state into copilot context
  useEffect(() => {
    if (!onContextUpdate) return;
    const snapshot = FX_PAIRS.map(p => ({
      ...p,
      price:     prices[p.ticker]?.price     ?? null,
      changePct: prices[p.ticker]?.changePct ?? null,
    }));
    onContextUpdate({ type: "fx", active, snapshot, cbRates });
  }, [prices, active, cbRates]); // eslint-disable-line

  const activePairCfg = FX_PAIRS.find(p => p.ticker === active);
  const activeDec = activePairCfg?.dec ?? 4;
  const activePrice = prices[active];

  return (
    <div className="flex-1 p-3" style={{ display:"grid", gridTemplateColumns:"240px 1fr 200px", gridTemplateRows:"1fr auto", gap:12, height:"calc(100vh - 90px)", overflow:"hidden" }}>

      {/* Left: FX pairs list */}
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn:"1/2", gridRow:"1/3", overflowY:"auto" }}>
        <div className="terminal-header mb-3">💱 FX Pairs</div>
        <div className="flex flex-col gap-1">
          {FX_PAIRS.map(p => {
            const d = prices[p.ticker];
            const isActive = active === p.ticker;
            return (
              <div key={p.ticker} onClick={() => setActive(p.ticker)}
                className="flex items-center justify-between p-2 rounded cursor-pointer"
                style={{ background:isActive?"var(--green-dim)":"transparent", border:"1px solid", borderColor:isActive?"rgba(5,150,105,0.30)":"var(--border)" }}>
                <div>
                  <div className="text-xs font-mono font-bold" style={{ color:isActive?"var(--green)":"var(--text-1)" }}>{p.label}</div>
                  <div className="text-xs font-mono" style={{ color:"var(--text-3)" }}>{p.region}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold" style={{ color:"var(--text-1)" }}>
                    {d === undefined ? "…" : d?.price != null ? d.price.toFixed(p.dec) : "—"}
                  </div>
                  {d?.changePct != null && (
                    <div className="text-xs font-mono" style={{ color:d.changePct>=0?"#059669":"#e11d48" }}>
                      {d.changePct>=0?"▲":"▼"}{Math.abs(d.changePct).toFixed(3)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center: Chart */}
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn:"2/3", gridRow:"1/2" }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="terminal-header">{activePairCfg?.label} · {activePairCfg?.region}</div>
            {activePrice && (
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono font-bold" style={{ color:"var(--text-1)", fontSize:22 }}>
                  {activePrice.price != null ? activePrice.price.toFixed(activeDec) : "—"}
                </span>
                {activePrice.changePct != null && (
                  <span className="text-xs font-mono" style={{ color:clr(activePrice.changePct) }}>
                    {activePrice.changePct>=0?"▲":"▼"} {Math.abs(activePrice.changePct).toFixed(3)}%
                  </span>
                )}
              </div>
            )}
          </div>
          {onOpenResearch && (
            <button onClick={() => onOpenResearch({ id:active, label:activePairCfg?.label||active, type:"fx", ticker:active, category:"FX" })}
              className="font-mono px-2 py-1 text-xs rounded"
              style={{ background:"#eff6ff", border:"1px solid #3fb95033", color:"#059669", cursor:"pointer" }}>
              → Research
            </button>
          )}
        </div>
        <UniversalChart ticker={active} height={260} defaultTf="3M" prefix="" decimals={activeDec} label={activePairCfg?.label} />
      </div>

      {/* Right: Central bank rates */}
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn:"3/4", gridRow:"1/2", overflowY:"auto" }}>
        <div className="terminal-header mb-3">🏦 Central Bank Rates</div>
        <div className="flex flex-col gap-2">
          {CB_SERIES.map(s => {
            const r = cbRates[s.id];
            return (
              <div key={s.id} className="p-2 rounded" style={{ background:"var(--surface-0)", border:"1px solid var(--border)" }}>
                <div className="text-xs font-mono" style={{ color:"var(--text-3)" }}>{s.flag} {s.bank}</div>
                <div className="font-mono font-bold text-sm mt-0.5" style={{ color:"#b45309" }}>
                  {r?.value != null ? r.value.toFixed(2) + "%" : "—"}
                </div>
                <div className="text-xs font-mono" style={{ color:"var(--text-3)" }}>{s.label}</div>
                {r?.date && <div className="text-xs font-mono" style={{ color:"#e2e8f0" }}>As of {r.date}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom: FX heat map */}
      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn:"2/4", gridRow:"2/3" }}>
        <div className="terminal-header mb-3">📊 Day Change Heat Map</div>
        <div className="grid gap-2" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(110px, 1fr))" }}>
          {FX_PAIRS.map(p => {
            const d = prices[p.ticker];
            const pct = d?.changePct;
            const intensity = pct != null ? Math.min(Math.abs(pct)/0.8, 1) : 0;
            const bgColor = pct == null ? "#f8fafc"
              : pct >= 0 ? "rgba(5,150,105," + (0.08 + intensity*0.15) + ")"
              : "rgba(225,29,72," + (0.08 + intensity*0.15) + ")";
            return (
              <div key={p.ticker} onClick={() => setActive(p.ticker)} className="p-2 rounded cursor-pointer"
                style={{ background:bgColor, border:"1px solid", borderColor:active===p.ticker?"#05966955":"#e2e8f0" }}>
                <div className="text-xs font-mono font-bold" style={{ color:"var(--text-1)" }}>{p.label}</div>
                <div className="text-xs font-mono" style={{ color:pct==null?"#64748b":clr(pct) }}>
                  {pct != null ? (pct>=0?"▲":"▼") + Math.abs(pct).toFixed(3)+"%" : "…"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
