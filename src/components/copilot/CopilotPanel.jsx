import { useState, useEffect, useRef, useMemo } from 'react';
import { MdText } from '../ui/MdText';

export function buildCopilotContext(activePage, ticker, quote, metrics, profile, news, pageContext) {
  const m   = metrics?.metric || {};
  const fmt = v => v != null ? (+v).toFixed(2) : null;
  const lines = [`Active Terminal Page: ${activePage}`];

  // ── Financial ──────────────────────────────────────────────────────────────
  if (activePage === "financial" && ticker) {
    lines.push(`Ticker: ${ticker}${profile?.name ? ` — ${profile.name}` : ""}`);
    if (profile?.finnhubIndustry) lines.push(`Sector / Industry: ${profile.finnhubIndustry}`);
    if (profile?.country)         lines.push(`Country: ${profile.country}`);
    if (quote?.c)  lines.push(`Current Price: $${fmt(quote.c)} (${quote.dp >= 0 ? "+" : ""}${fmt(quote.dp)}% today)`);
    if (quote?.h)  lines.push(`Day Range: $${fmt(quote.l)} – $${fmt(quote.h)}`);
    if (m["52WeekLow"] && m["52WeekHigh"]) lines.push(`52-Week Range: $${fmt(m["52WeekLow"])} – $${fmt(m["52WeekHigh"])}`);
    if (m.marketCapitalization)      lines.push(`Market Cap: $${(m.marketCapitalization/1000).toFixed(1)}B`);
    if (m.peBasicExclExtraTTM)       lines.push(`P/E (TTM): ${fmt(m.peBasicExclExtraTTM)}x`);
    if (m.pbAnnual)                  lines.push(`P/B: ${fmt(m.pbAnnual)}x`);
    if (m.grossMarginAnnual)         lines.push(`Gross Margin: ${(m.grossMarginAnnual*100).toFixed(1)}%`);
    if (m.netMarginAnnual)           lines.push(`Net Margin: ${(m.netMarginAnnual*100).toFixed(1)}%`);
    if (m.roeTTM)                    lines.push(`ROE (TTM): ${(m.roeTTM*100).toFixed(1)}%`);
    if (m["totalDebt/totalEquityAnnual"]) lines.push(`Debt/Equity: ${fmt(m["totalDebt/totalEquityAnnual"])}`);
    if (m.revenueGrowthTTMYoy)       lines.push(`Revenue Growth (YoY TTM): ${(m.revenueGrowthTTMYoy*100).toFixed(1)}%`);
    if (m.epsGrowthTTMYoy)           lines.push(`EPS Growth (YoY TTM): ${(m.epsGrowthTTMYoy*100).toFixed(1)}%`);
    if (m.beta)                      lines.push(`Beta: ${fmt(m.beta)}`);
    if (news?.length) {
      lines.push("\nRecent News (most recent 6):");
      news.slice(0,6).forEach(n => lines.push(`  • [${n.source}] ${n.headline}`));
    }
  }

  // ── Portfolio ──────────────────────────────────────────────────────────────
  if (activePage === "portfolio") {
    if (pageContext?.type === "portfolio" && pageContext.holdings?.length) {
      const { holdings, livePrices } = pageContext;
      let totalValue = 0, totalCost = 0;
      lines.push(`Portfolio: ${holdings.length} position${holdings.length !== 1 ? "s" : ""}`);
      holdings.forEach(h => {
        const lp = livePrices?.[h.ticker];
        const currentPrice = lp?.price ?? null;
        const currentValue = currentPrice != null ? currentPrice * h.shares : null;
        const cost = h.avgCost * h.shares;
        const gainLoss = currentValue != null ? currentValue - cost : null;
        const gainLossPct = gainLoss != null && cost > 0 ? (gainLoss / cost) * 100 : null;
        if (currentValue != null) totalValue += currentValue;
        totalCost += cost;
        let pos = `${h.ticker}: ${h.shares} sh @ $${h.avgCost} avg`;
        if (currentPrice != null) pos += ` | now $${currentPrice.toFixed(2)}`;
        if (gainLoss != null) pos += ` | P&L ${gainLoss >= 0 ? "+" : ""}$${gainLoss.toFixed(0)} (${gainLossPct >= 0 ? "+" : ""}${gainLossPct?.toFixed(1)}%)`;
        lines.push(`  • ${pos}`);
      });
      if (totalValue > 0) {
        const totalGL = totalValue - totalCost;
        lines.push(`Total Value: $${totalValue.toFixed(0)} | Total P&L: ${totalGL >= 0 ? "+" : ""}$${totalGL.toFixed(0)} (${(totalGL/totalCost*100).toFixed(1)}%)`);
      }
    } else {
      try {
        const holdings = JSON.parse(localStorage.getItem("ov_portfolio") || "[]");
        if (holdings.length) {
          lines.push(`Portfolio: ${holdings.length} positions`);
          holdings.forEach(h => lines.push(`  • ${h.ticker}: ${h.shares} shares @ $${h.avgCost} avg cost`));
        } else {
          lines.push("Portfolio: no positions entered yet.");
        }
      } catch(e) {}
    }
  }

  // ── Screener ───────────────────────────────────────────────────────────────
  if (activePage === "screener") {
    if (pageContext?.type === "screener") {
      const { presetName, filterCount, topResults } = pageContext;
      lines.push(`Stock Screener — ${filterCount} stocks match current filters${presetName ? ` (preset: "${presetName}")` : ""}`);
      if (topResults?.length) {
        lines.push("Top results by market cap:");
        topResults.slice(0, 12).forEach(s => {
          let row = `  • ${s.ticker} (${s.name}) | ${s.sector} | $${s.price?.toFixed(2) ?? "—"}`;
          if (s.mktCap != null) row += ` | MCap $${s.mktCap.toFixed(1)}B`;
          if (s.pe != null)     row += ` | P/E ${s.pe.toFixed(1)}x`;
          if (s.roe != null)    row += ` | ROE ${(s.roe * 100).toFixed(1)}%`;
          lines.push(row);
        });
      }
    } else {
      lines.push("Stock Screener — filter thousands of equities by P/E, ROE, margins, market cap, sector, and more.");
    }
  }

  // ── Earnings ───────────────────────────────────────────────────────────────
  if (activePage === "earnings") {
    if (pageContext?.type === "earnings") {
      const { month, eventCount, selectedDate, eventsOnDate } = pageContext;
      lines.push(`Earnings Calendar — ${month} — ${eventCount ?? 0} notable earnings`);
      if (selectedDate && eventsOnDate?.length) {
        lines.push(`Selected date: ${selectedDate}`);
        eventsOnDate.forEach(e => {
          let row = `  • ${e.symbol}`;
          if (e.epsEstimate != null)     row += ` | EPS est $${e.epsEstimate}`;
          if (e.revenueEstimate != null) row += ` | Rev est $${(e.revenueEstimate/1e9).toFixed(1)}B`;
          if (e.hour)                    row += ` | ${e.hour === "bmo" ? "Before Open" : e.hour === "amc" ? "After Close" : e.hour}`;
          lines.push(row);
        });
      } else if (selectedDate) {
        lines.push(`Selected date: ${selectedDate} — no notable earnings`);
      }
    } else {
      lines.push("Earnings Calendar — upcoming earnings announcements with beat/miss history and whisper numbers.");
    }
  }

  // ── Technical Analysis ─────────────────────────────────────────────────────
  if (activePage === "technical") {
    lines.push(`Technical Analysis — ${ticker}${pageContext?.range ? ` (${pageContext.range} range)` : ""}`);
    if (quote?.c) lines.push(`Current Price: $${fmt(quote.c)}`);
    if (pageContext?.type === "technical") {
      const { lastRSI, lastMACD, lastSignal, rsiLabel, macdSignal, bbSignal } = pageContext;
      if (lastRSI  != null) lines.push(`RSI(14): ${lastRSI.toFixed(1)} — ${rsiLabel}`);
      if (lastMACD != null) lines.push(`MACD(12,26,9): ${lastMACD.toFixed(4)} | Signal: ${lastSignal?.toFixed(4) ?? "—"} — ${macdSignal}`);
      if (bbSignal)         lines.push(`Bollinger Bands(20,2): price is ${bbSignal}`);
    }
  }

  // ── Commodities ────────────────────────────────────────────────────────────
  if (activePage === "commodities") {
    if (pageContext?.type === "commodities") {
      const { active: activeTicker, snapshot } = pageContext;
      const activeCom = snapshot?.find(c => c.ticker === activeTicker);
      lines.push(`Commodities Futures Dashboard — active chart: ${activeCom?.label ?? activeTicker}`);
      const available = (snapshot ?? []).filter(c => c.price != null);
      if (available.length) {
        lines.push("Current futures prices:");
        ["Metals","Energy","Agriculture"].forEach(cat => {
          const group = available.filter(c => c.category === cat);
          if (!group.length) return;
          lines.push(`  ${cat}:`);
          group.forEach(c => {
            const chg = c.changePct != null ? ` (${c.changePct >= 0 ? "+" : ""}${c.changePct.toFixed(2)}%)` : "";
            lines.push(`    • ${c.label} (${c.symbol}): ${c.price.toFixed(2)} ${c.unit}${chg}`);
          });
        });
      }
    } else {
      lines.push("Commodities Futures Dashboard — metals, energy, agriculture futures.");
    }
  }

  // ── Crypto ─────────────────────────────────────────────────────────────────
  if (activePage === "crypto") {
    if (pageContext?.type === "crypto") {
      const { active: activeTicker, snapshot } = pageContext;
      const activeCoin = snapshot?.find(c => c.ticker === activeTicker);
      lines.push(`Crypto Markets Dashboard — active chart: ${activeCoin?.label ?? activeTicker}`);
      const available = (snapshot ?? []).filter(c => c.price != null);
      if (available.length) {
        lines.push("Current prices:");
        available.forEach(c => {
          const chg = c.changePct != null ? ` (${c.changePct >= 0 ? "+" : ""}${c.changePct.toFixed(2)}%)` : "";
          const p = c.price < 0.01 ? c.price.toFixed(6) : c.price < 1 ? c.price.toFixed(4) : c.price < 1000 ? c.price.toFixed(2) : c.price.toFixed(0);
          lines.push(`  • ${c.label} (${c.symbol}): $${p}${chg}`);
        });
      }
    } else {
      lines.push("Crypto Markets Dashboard — top cryptocurrencies by market cap.");
    }
  }

  // ── FX ─────────────────────────────────────────────────────────────────────
  if (activePage === "fx") {
    if (pageContext?.type === "fx") {
      const { active: activeTicker, snapshot, cbRates } = pageContext;
      const activePair = snapshot?.find(p => p.ticker === activeTicker);
      lines.push(`FX Dashboard — active pair: ${activePair?.label ?? activeTicker}`);
      const available = (snapshot ?? []).filter(p => p.price != null);
      if (available.length) {
        lines.push("FX Rates:");
        available.forEach(p => {
          const dec = p.dec ?? 4;
          const chg = p.changePct != null ? ` (${p.changePct >= 0 ? "+" : ""}${p.changePct.toFixed(3)}%)` : "";
          lines.push(`  • ${p.label}: ${p.price.toFixed(dec)}${chg}`);
        });
      }
      const cbArr = cbRates ? Object.values(cbRates).filter(r => r?.value != null) : [];
      if (cbArr.length) {
        lines.push("Central Bank Policy Rates:");
        cbArr.forEach(r => lines.push(`  • ${r.flag} ${r.label} (${r.bank}): ${r.value.toFixed(2)}%`));
      }
    } else {
      lines.push("FX Dashboard — major currency pairs and central bank rates.");
    }
  }

  // ── Supply Chain / Macro ───────────────────────────────────────────────────
  if (activePage === "supplychain") {
    if (pageContext?.type === "supplychain") {
      const { macroSnapshot, commoditySnapshot } = pageContext;
      lines.push("Macro Intelligence Dashboard — FRED macro series + commodity proxies");
      if (macroSnapshot?.length) {
        lines.push("FRED Series (latest readings):");
        macroSnapshot.filter(s => s.value != null).forEach(s => {
          const chg = s.change != null ? ` Δ${s.change >= 0 ? "+" : ""}${s.change.toFixed(2)}` : "";
          lines.push(`  • ${s.label}: ${s.value.toFixed(2)}${s.suffix}${chg} — ${s.note}`);
        });
      }
      const comAvail = (commoditySnapshot ?? []).filter(c => c.price != null);
      if (comAvail.length) {
        lines.push("Commodity Proxies:");
        comAvail.forEach(c => {
          const chg = c.changePct != null ? ` (${c.changePct >= 0 ? "+" : ""}${c.changePct.toFixed(2)}%)` : "";
          lines.push(`  • ${c.label}: $${c.price.toFixed(2)}${chg} — ${c.desc}`);
        });
      }
    } else {
      lines.push("Macro Intelligence Dashboard — Fed Funds, yield curve, CPI, PCE, GDP, M2 and supply chain indicators.");
    }
  }

  // ── Eye of Sauron ──────────────────────────────────────────────────────────
  if (activePage === "eye") {
    if (pageContext?.type === "eye" && pageContext.activeModule === "geo" && pageContext.events?.length) {
      const { events: geoEvents, selectedEvent } = pageContext;
      lines.push(`Geopolitical Intelligence Feed — ${geoEvents.length} market-moving events`);
      ["High","Medium","Low"].forEach(impact => {
        const group = geoEvents.filter(e => e.impact === impact).slice(0, 5);
        if (!group.length) return;
        lines.push(`  ${impact} Impact:`);
        group.forEach(e => {
          let row = `    • [${e.category}] ${e.headline}`;
          if (e.signal) row += ` | Signal: ${e.signal}`;
          if (e.assets?.length) row += ` | Assets: ${e.assets.join(", ")}`;
          lines.push(row);
        });
      });
      if (selectedEvent) {
        lines.push(`\nFocused event: ${selectedEvent.headline}`);
        if (selectedEvent.summary) lines.push(`Summary: ${selectedEvent.summary}`);
        if (selectedEvent.assets?.length) lines.push(`Affected assets: ${selectedEvent.assets.join(", ")}`);
      }
    } else if (pageContext?.type === "eye" && pageContext.activeModule) {
      lines.push(`Eye of Sauron — active module: ${pageContext.activeModule}`);
    } else {
      lines.push("Eye of Sauron — global intelligence feeds: globe, weather, vessel tracker, flights, energy grid, geopolitical events.");
    }
  }

  // ── Global Markets ─────────────────────────────────────────────────────────
  if (activePage === "markets") {
    if (pageContext?.type === "markets" && pageContext.country) {
      const { country } = pageContext;
      lines.push(`Global Markets — ${country.flag ?? ""} ${country.name} (currency: ${country.currency ?? "—"})`);
    } else {
      lines.push("Global Markets — country-level equity market dashboards.");
    }
  }

  // ── Research Browser ───────────────────────────────────────────────────────
  if (activePage === "research") {
    if (pageContext?.type === "research" && pageContext.panels?.length) {
      lines.push(`Research Browser — ${pageContext.panels.length} open panel${pageContext.panels.length !== 1 ? "s" : ""}:`);
      pageContext.panels.forEach(p => {
        lines.push(`  • [${(p.type ?? "?").toUpperCase()}] ${p.label} (${p.ticker ?? p.id})`);
      });
    } else {
      lines.push("Research Browser — no panels open. User can search equities, commodities, FX, macro, and topics.");
    }
  }

  return lines.join("\n");
}

export function CopilotPanel({ activePage, ticker, quote, metrics, profile, news, pageContext, onClose }) {
  const [msgs,       setMsgs]      = useState([]);
  const [input,      setInput]     = useState("");
  const [loading,    setLoading]   = useState(false);
  const [apiKey,     setApiKey]    = useState(() => localStorage.getItem("ov_copilot_key") || "");
  const [showConfig, setShowConfig]= useState(false);
  const [keyDraft,   setKeyDraft]  = useState("");
  const [provider,   setProvider]  = useState(null); // "openai" | "anthropic"
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const context = buildCopilotContext(activePage, ticker, quote, metrics, profile, news, pageContext);

  // Suggested prompts change based on active page
  const SUGGESTIONS = useMemo(() => {
    if (activePage === "financial") return [
      `Summarize the investment case for ${ticker}`,
      `What are the key risks for ${ticker}?`,
      `Is ${ticker} cheap or expensive vs its history?`,
      `Generate a bull and bear thesis for ${ticker}`,
    ];
    if (activePage === "portfolio")  return [
      "How concentrated is my portfolio?",
      "Which positions carry the most risk?",
      "Suggest ways to diversify my holdings",
      "What would you trim or add to?",
    ];
    if (activePage === "screener")   return [
      "What criteria would you use to find quality growth stocks?",
      "How would you screen for deep value plays?",
      "Explain a capital-efficient investing strategy",
      "What does this filtered list of stocks suggest?",
    ];
    if (activePage === "technical")  return [
      `Describe a trading plan for ${ticker} based on these technicals`,
      `Is ${ticker} currently overbought or oversold?`,
      "What signals should I watch for a trend reversal?",
      "Explain what RSI and MACD are telling me",
    ];
    if (activePage === "earnings")   return [
      "What should I look for in earnings releases this week?",
      "Which upcoming earnings could be market-moving?",
      "How do I trade an earnings announcement safely?",
      "Explain EPS estimates and what a beat or miss means",
    ];
    if (activePage === "commodities") return [
      "Which commodity is showing the strongest momentum?",
      "What's driving crude oil prices right now?",
      "Explain the relationship between gold and the US dollar",
      "Which commodities are the best inflation hedges?",
    ];
    if (activePage === "crypto") return [
      "Analyze current crypto market conditions",
      "Compare BTC vs ETH risk/reward today",
      "What macro factors move crypto markets?",
      "Which coins show relative strength today?",
    ];
    if (activePage === "fx") return [
      "Which currency pairs offer the best carry trade opportunity?",
      "What do current CB rate differentials signal for the USD?",
      "Explain the macro implications of EUR/USD movement",
      "Which pairs are most sensitive to US rate policy?",
    ];
    if (activePage === "supplychain") return [
      "Interpret the current yield curve signal",
      "Is inflation trending up or down based on this data?",
      "Summarize current macro conditions in 3 bullets",
      "What does the macro environment mean for equities?",
    ];
    if (activePage === "eye") return [
      "Which geopolitical events pose the highest market risk?",
      "Summarize the top intelligence events and their impact",
      "Which sectors benefit from current geopolitical tensions?",
      "What assets are most at risk from current events?",
    ];
    if (activePage === "markets") return [
      "Give me an investment overview of this market",
      "What are the key risks in this country's economy?",
      "How does this market compare to US equities?",
      "What ETFs give me exposure to this market?",
    ];
    if (activePage === "research") return [
      "Summarize what I'm currently researching",
      "Compare the open research panels",
      "What investment themes do my open panels share?",
      "What should I add to my research list?",
    ];
    return ["What can you help me with?", "Explain the current market environment"];
  }, [activePage, ticker]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading]);

  const saveKey = () => {
    const k = keyDraft.trim();
    setApiKey(k);
    localStorage.setItem("ov_copilot_key", k);
    setShowConfig(false);
    setKeyDraft("");
  };

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    const userMsg  = { role:"user", content: q };
    const newMsgs  = [...msgs, userMsg];
    setMsgs(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const res  = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ messages: newMsgs, context, apiKey: apiKey || undefined }),
      });
      const data = await res.json();
      if (data.error === "no_key") {
        setMsgs(m => [...m, { role:"assistant", content:"⚙️ No API key configured. Click the **settings icon** (⚙) above to enter your OpenAI or Anthropic API key." }]);
      } else if (data.error) {
        setMsgs(m => [...m, { role:"assistant", content:`Error: ${data.error}` }]);
      } else {
        if (data.provider) setProvider(data.provider);
        setMsgs(m => [...m, { role:"assistant", content: data.message }]);
      }
    } catch(e) {
      setMsgs(m => [...m, { role:"assistant", content:"Connection error — check your API key or network." }]);
    }
    setLoading(false);
  };

  const providerBadge = provider === "anthropic"
    ? { label:"Claude · Haiku", color:"#7c3aed" }
    : provider === "openai"
    ? { label:"GPT-4o mini",    color:"#059669" }
    : null;

  // Human-readable label for the context badge
  const contextLabel =
    activePage === "financial"   ? `${ticker} · Financial View`     :
    activePage === "portfolio"   ? "Portfolio Tracker"               :
    activePage === "screener"    ? "Stock Screener"                  :
    activePage === "technical"   ? `${ticker} · Technical Analysis`  :
    activePage === "earnings"    ? "Earnings Calendar"               :
    activePage === "commodities" ? "Commodities Dashboard"           :
    activePage === "crypto"      ? "Crypto Markets"                  :
    activePage === "fx"          ? "FX Dashboard"                    :
    activePage === "supplychain" ? "Macro Intelligence"              :
    activePage === "eye"         ? "Eye of Sauron"                   :
    activePage === "markets"     ? "Global Markets"                  :
    activePage === "research"    ? "Research Browser"                :
    activePage.charAt(0).toUpperCase() + activePage.slice(1);

  const panelStyle = {
    position:"fixed", bottom:40, right:16, width:400, height:580,
    zIndex:9998, display:"flex", flexDirection:"column",
    background:"var(--surface-0)", border:"1px solid var(--border-solid)",
    borderRadius:12, boxShadow:"0 8px 40px rgba(0,0,0,0.18)",
    fontFamily:"'Inter','IBM Plex Sans',sans-serif",
    overflow:"hidden",
  };

  return (
    <div style={panelStyle}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", borderBottom:"1px solid var(--border-solid)", flexShrink:0, background:"var(--surface-1)" }}>
        <span style={{ fontSize:15 }}>🤖</span>
        <span style={{ fontSize:12, fontWeight:700, color:"var(--text-1)", letterSpacing:"0.04em" }}>AI Copilot</span>
        {providerBadge && (
          <span style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", padding:"1px 7px", borderRadius:99, background: providerBadge.color+"22", color: providerBadge.color, fontWeight:600, marginLeft:2 }}>
            ● {providerBadge.label}
          </span>
        )}
        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          <button onClick={() => { setShowConfig(c => !c); setKeyDraft(apiKey); }}
            title="Configure API key"
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:"var(--text-3)", padding:"2px 4px", lineHeight:1 }}>⚙</button>
          <button onClick={onClose}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:"var(--text-3)", padding:"2px 4px", lineHeight:1 }}>✕</button>
        </div>
      </div>

      {/* ── API Key Config ──────────────────────────────────────── */}
      {showConfig && (
        <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--border-solid)", background:"var(--surface-2)", flexShrink:0 }}>
          <div style={{ fontSize:10, fontWeight:600, color:"var(--text-1)", marginBottom:6 }}>API Key (OpenAI or Anthropic)</div>
          <div style={{ fontSize:9, color:"var(--text-3)", marginBottom:6 }}>
            OpenAI keys start with <code style={{ fontFamily:"monospace" }}>sk-</code> · Anthropic keys start with <code style={{ fontFamily:"monospace" }}>sk-ant-</code><br />
            Stored locally in your browser only. Never sent anywhere except the model API.
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <input
              type="password"
              value={keyDraft}
              onChange={e => setKeyDraft(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveKey()}
              placeholder="sk-… or sk-ant-…"
              style={{ flex:1, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, padding:"4px 8px",
                background:"var(--surface-0)", border:"1px solid var(--border-solid)", borderRadius:5, color:"var(--text-1)" }} />
            <button onClick={saveKey}
              style={{ padding:"4px 12px", fontSize:10, fontWeight:600, background:"#2563eb", color:"#fff", border:"none", borderRadius:5, cursor:"pointer" }}>
              Save
            </button>
          </div>
          {apiKey && <div style={{ fontSize:9, color:"#059669", marginTop:4 }}>✓ Key saved ({apiKey.slice(0,8)}…)</div>}
        </div>
      )}

      {/* ── Context badge ──────────────────────────────────────── */}
      <div style={{ padding:"6px 14px", borderBottom:"1px solid var(--border-solid)", flexShrink:0, display:"flex", gap:8, alignItems:"center", background:"var(--surface-1)" }}>
        <span style={{ fontSize:9, color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace" }}>Context:</span>
        <span style={{ fontSize:9, fontWeight:600, color:"#2563eb", fontFamily:"'IBM Plex Mono',monospace" }}>
          {contextLabel}
        </span>
        {quote?.c && activePage === "financial" &&
          <span style={{ fontSize:9, color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace" }}>
            ${quote.c.toFixed(2)}
            <span style={{ color: quote.dp >= 0 ? "#059669" : "#e11d48" }}> ({quote.dp >= 0 ? "+" : ""}{quote.dp?.toFixed(2)}%)</span>
          </span>}
        {pageContext && activePage !== "financial" &&
          <span style={{ fontSize:8, color:"#059669", fontFamily:"'IBM Plex Mono',monospace", marginLeft:"auto" }}>● live data</span>}
      </div>

      {/* ── Message thread ─────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign:"center", marginTop:20 }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🤖</div>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--text-1)", marginBottom:4 }}>AI Copilot</div>
            <div style={{ fontSize:10, color:"var(--text-3)", lineHeight:1.5 }}>
              Ask me anything about the data you're looking at — summaries, trade ideas, risk analysis, comparisons.
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} style={{ display:"flex", flexDirection:"column", alignItems: m.role==="user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth:"88%", padding:"8px 12px", borderRadius: m.role==="user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
              background: m.role==="user" ? "#2563eb" : "var(--surface-1)",
              border: m.role==="user" ? "none" : "1px solid var(--border-solid)",
              color: m.role==="user" ? "#fff" : "var(--text-1)",
              fontSize:11, lineHeight:1.55,
            }}>
              {m.role === "assistant" ? <MdText text={m.content} /> : m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:"flex", alignItems:"flex-start" }}>
            <div style={{ padding:"8px 14px", borderRadius:"12px 12px 12px 3px", background:"var(--surface-1)",
              border:"1px solid var(--border-solid)", fontSize:11, color:"var(--text-3)" }}>
              <span style={{ animation:"pulse 1.2s ease-in-out infinite" }}>Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Suggested prompts ──────────────────────────────────── */}
      {msgs.length === 0 && (
        <div style={{ padding:"0 14px 8px", display:"flex", flexWrap:"wrap", gap:5, flexShrink:0 }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => send(s)}
              style={{ fontSize:9, padding:"3px 9px", borderRadius:99, cursor:"pointer", fontFamily:"'Inter',sans-serif",
                background:"var(--surface-2)", border:"1px solid var(--border-solid)", color:"var(--text-1)",
                transition:"border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor="#2563eb"}
              onMouseLeave={e => e.currentTarget.style.borderColor=""}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ──────────────────────────────────────────── */}
      <div style={{ padding:"10px 14px", borderTop:"1px solid var(--border-solid)", display:"flex", gap:8, flexShrink:0, background:"var(--surface-1)" }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask about this data…"
          style={{ flex:1, fontFamily:"'Inter',sans-serif", fontSize:11, padding:"7px 10px",
            background:"var(--surface-0)", border:"1px solid var(--border-solid)", borderRadius:7,
            color:"var(--text-1)", outline:"none" }} />
        <button onClick={() => send()} disabled={!input.trim() || loading}
          style={{ padding:"7px 14px", fontSize:11, fontWeight:600, borderRadius:7, border:"none", cursor:"pointer",
            background: input.trim() && !loading ? "#2563eb" : "var(--surface-2)",
            color: input.trim() && !loading ? "#fff" : "var(--text-3)", transition:"background 0.15s" }}>
          ↑
        </button>
      </div>
    </div>
  );
}
