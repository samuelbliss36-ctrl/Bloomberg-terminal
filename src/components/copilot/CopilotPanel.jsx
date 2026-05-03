import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MdText } from '../ui/MdText';
import { db } from '../../lib/db';
import { useAuth } from '../../context/AuthContext';
import { isOwner, getSubscription } from '../../lib/subscription';
import { supabase } from '../../lib/supabase';
import UpgradePage from '../../pages/Subscription/UpgradePage';

function genUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    // eslint-disable-next-line no-mixed-operators
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function buildCopilotContext(activePage, ticker, quote, metrics, profile, news) {
  const m   = metrics?.metric || {};
  const fmt = v => v != null ? (+v).toFixed(2) : null;
  const lines = [`Active Terminal Page: ${activePage}`];

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

  if (activePage === "portfolio") {
    try {
      const holdings = JSON.parse(localStorage.getItem("ov_portfolio") || "[]");
      if (holdings.length) {
        lines.push(`Portfolio: ${holdings.length} positions`);
        holdings.forEach(h => {
          const pos = `${h.ticker}: ${h.shares} shares @ $${h.avgCost} avg cost`;
          lines.push(`  • ${pos}`);
        });
      } else {
        lines.push("Portfolio: no positions entered yet.");
      }
    } catch(e) {}
  }

  if (activePage === "screener") {
    lines.push("The user is on the Stock Screener page, browsing a universe of thousands of equities.");
    lines.push("They can filter by P/E, P/B, ROE, margins, market cap, sector, div yield, beta, and more.");
  }

  if (activePage === "earnings") {
    lines.push("The user is viewing the Earnings Calendar — upcoming earnings announcements with beat/miss history and whisper numbers.");
  }

  if (activePage === "technical") {
    lines.push(`The user is viewing the Technical Analysis page for: ${ticker}`);
    if (quote?.c) lines.push(`Current Price: $${fmt(quote.c)}`);
  }

  return lines.join("\n");
}

export function CopilotPanel({ activePage, ticker, quote, metrics, profile, news, onClose }) {
  const { user } = useAuth();

  // Load most recent conversation on mount
  const [conversationId, setConversationId] = useState(() => genUUID());
  const [msgs,       setMsgs]      = useState(() => {
    const convs = db.conversations.load();
    if (convs.length > 0) return convs[0].messages || [];
    return [];
  });
  const [convTitle,  setConvTitle] = useState(() => {
    const convs = db.conversations.load();
    if (convs.length > 0) { return convs[0].title || ''; }
    return '';
  });
  const [showHistory,setShowHistory] = useState(false);

  const [input,      setInput]     = useState("");
  const [loading,    setLoading]   = useState(false);
  const [apiKey,     setApiKey]    = useState(() => localStorage.getItem("ov_copilot_key") || "");
  const [showConfig, setShowConfig]= useState(false);
  const [keyDraft,   setKeyDraft]  = useState("");
  const [provider,    setProvider]   = useState(null); // "openai" | "anthropic" | "perplexity"
  const [showUpgrade, setShowUpgrade]= useState(false);
  const [subscription, setSubscription] = useState(null);

  // Load subscription on mount
  useEffect(() => {
    if (!user || isOwner(user)) return;
    getSubscription().then(sub => setSubscription(sub));
  }, [user]);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const context = buildCopilotContext(activePage, ticker, quote, metrics, profile, news);

  // Re-read conversations when cloud sync fires
  useEffect(() => {
    const handler = () => {
      const convs = db.conversations.load();
      if (convs.length > 0 && msgs.length === 0) {
        setMsgs(convs[0].messages || []);
        setConvTitle(convs[0].title || '');
        setConversationId(convs[0].id || genUUID());
      }
    };
    window.addEventListener('ov:data-synced', handler);
    return () => window.removeEventListener('ov:data-synced', handler);
  }, [msgs.length]);

  // Persist conversation after every assistant response
  const persistConversation = useCallback((updatedMsgs, title) => {
    const convs = db.conversations.load();
    const now = new Date().toISOString();
    const entry = {
      id: conversationId,
      title: title || convTitle || 'Untitled',
      messages: updatedMsgs,
      page_context: activePage,
      updated_at: now,
    };
    // Replace existing entry with same id, or prepend
    const filtered = convs.filter(c => c.id !== conversationId);
    const updated = [entry, ...filtered].slice(0, 20);
    db.conversations.save(updated, user?.id);
  }, [conversationId, convTitle, activePage, user?.id]);

  const startNewChat = useCallback(() => {
    setMsgs([]);
    setConvTitle('');
    setConversationId(genUUID());
    setShowHistory(false);
    setProvider(null);
  }, []);

  const loadConversation = useCallback((conv) => {
    setMsgs(conv.messages || []);
    setConvTitle(conv.title || '');
    setConversationId(conv.id);
    setShowHistory(false);
  }, []);

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
      "Which positions have the most risk?",
      "Suggest ways to diversify my holdings",
      "What would you trim or add to?",
    ];
    if (activePage === "screener")   return [
      "What criteria would you use to find quality growth stocks?",
      "How would you screen for deep value plays?",
      "Explain a capital-efficient investing strategy",
    ];
    if (activePage === "technical")  return [
      `Describe a trading plan for ${ticker} based on technicals`,
      "What signals should I watch for a trend reversal?",
    ];
    if (activePage === "earnings")   return [
      "What should I look for in earnings releases this week?",
      "How do I trade an earnings announcement safely?",
    ];
    return ["What can you help me with?", "Explain the current market environment"];
  }, [activePage, ticker]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading]);

  // Restore API key from Supabase user metadata if localStorage was wiped (e.g. after sign-out)
  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem("ov_copilot_key");
    if (!stored && user?.user_metadata?.copilot_key) {
      const k = user.user_metadata.copilot_key;
      localStorage.setItem("ov_copilot_key", k);
      setApiKey(k);
    }
  }, [user]);

  const saveKey = () => {
    const k = keyDraft.trim();
    setApiKey(k);
    localStorage.setItem("ov_copilot_key", k);
    // Persist to Supabase so it survives sign-out / sign-in on any device
    if (supabase && user) {
      supabase.auth.updateUser({ data: { copilot_key: k } })
        .catch(e => console.warn("copilot key sync failed:", e.message));
    }
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

    // Set title from first user message
    const title = convTitle || q.slice(0, 40);
    if (!convTitle) setConvTitle(title);

    try {
      // Attach Supabase session token so the server can verify subscription
      let authHeader = {};
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          authHeader = { Authorization: `Bearer ${session.access_token}` };
        }
      }
      const res  = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type":"application/json", ...authHeader },
        body: JSON.stringify({ messages: newMsgs, context, apiKey: apiKey || undefined }),
      });
      if (res.status === 503) {
        // Owner is authenticated but no server key configured — show config hint
        const finalMsgs = [...newMsgs, { role:"assistant", content:"⚙️ **Server AI key not configured.** Add `PERPLEXITY_KEY` (or `OPENAI_KEY`) to **Vercel → Settings → Environment Variables**, then redeploy. You can also enter your own key via the ⚙ settings icon above." }];
        setMsgs(finalMsgs);
        persistConversation(finalMsgs, convTitle || q.slice(0,40));
        setLoading(false);
        return;
      }
      if (res.status === 402) {
        // Not subscribed and no user key — show upgrade wall (never for owner)
        if (!isOwner(user)) {
          setMsgs(newMsgs.slice(0, -1));
          setInput(q);
          setShowUpgrade(true);
          setLoading(false);
          return;
        }
        // Owner hitting 402 shouldn't happen, but just in case show config hint
        const finalMsgs = [...newMsgs, { role:"assistant", content:"⚙️ Add `PERPLEXITY_KEY` to Vercel environment variables to enable the AI copilot." }];
        setMsgs(finalMsgs);
        setLoading(false);
        return;
      }
      const data = await res.json();
      let finalMsgs;
      if (data.error === "no_key") {
        finalMsgs = [...newMsgs, { role:"assistant", content:"⚙️ No API key configured. Click the **settings icon** (⚙) above to enter your OpenAI or Anthropic API key." }];
      } else if (data.error) {
        finalMsgs = [...newMsgs, { role:"assistant", content:`Error: ${data.error}` }];
      } else {
        if (data.provider) setProvider(data.provider);
        finalMsgs = [...newMsgs, { role:"assistant", content: data.message }];
      }
      setMsgs(finalMsgs);
      persistConversation(finalMsgs, title);
    } catch(e) {
      const finalMsgs = [...newMsgs, { role:"assistant", content:"Connection error — check your API key or network." }];
      setMsgs(finalMsgs);
      persistConversation(finalMsgs, title);
    }
    setLoading(false);
  };

  const providerBadge = provider === "anthropic"
    ? { label:"Claude · Haiku",         color:"#7c3aed" }
    : provider === "openai"
    ? { label:"GPT-4o mini",            color:"#059669" }
    : provider === "perplexity"
    ? { label:"Perplexity · Live",      color:"#0ea5e9" }
    : null;

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
        {isOwner(user) && (
          <span style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", padding:"1px 7px", borderRadius:99, background:"#fef9c3", color:"#854d0e", fontWeight:600, marginLeft:2 }}>
            ★ Owner — Unlimited
          </span>
        )}
        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          <button onClick={startNewChat}
            title="New chat"
            style={{ background:"none", border:"1px solid var(--border-solid)", cursor:"pointer", fontSize:10, color:"var(--text-3)", padding:"2px 8px", lineHeight:1.4, borderRadius:5, fontFamily:"'IBM Plex Mono',monospace" }}>+ New</button>
          <button onClick={() => setShowHistory(h => !h)}
            title="Conversation history"
            style={{ background: showHistory ? "rgba(37,99,235,0.10)" : "none", border:"none", cursor:"pointer", fontSize:12, color: showHistory ? "#2563eb" : "var(--text-3)", padding:"2px 4px", lineHeight:1 }}>☰</button>
          <button onClick={() => { setShowConfig(c => !c); setKeyDraft(apiKey); }}
            title="Configure API key"
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:"var(--text-3)", padding:"2px 4px", lineHeight:1 }}>⚙</button>
          <button onClick={onClose}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:"var(--text-3)", padding:"2px 4px", lineHeight:1 }}>✕</button>
        </div>
      </div>

      {/* ── Conversation History ────────────────────────────────── */}
      {showHistory && (() => {
        const convs = db.conversations.load();
        return (
          <div style={{ borderBottom:"1px solid var(--border-solid)", background:"var(--surface-2)", flexShrink:0, maxHeight:160, overflowY:"auto" }}>
            {convs.length === 0 ? (
              <div style={{ padding:"12px 14px", fontSize:10, color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace" }}>No saved conversations yet</div>
            ) : convs.map(c => (
              <button key={c.id} onClick={() => loadConversation(c)}
                style={{ display:"block", width:"100%", textAlign:"left", padding:"8px 14px", background: c.id===conversationId ? "rgba(37,99,235,0.08)" : "none",
                  border:"none", borderBottom:"1px solid var(--border-subtle)", cursor:"pointer", transition:"background 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background="rgba(37,99,235,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background=c.id===conversationId?"rgba(37,99,235,0.08)":"none"}>
                <div style={{ fontSize:11, color:"var(--text-1)", fontFamily:"'IBM Plex Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {c.title || 'Untitled'}
                </div>
                <div style={{ fontSize:9, color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace", marginTop:2 }}>
                  {c.updated_at ? new Date(c.updated_at).toLocaleDateString() : ''} · {c.messages?.length || 0} messages
                </div>
              </button>
            ))}
          </div>
        );
      })()}

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

      {/* ── Upgrade wall ───────────────────────────────────────── */}
      {showUpgrade && !apiKey && (
        <div style={{ flex:1, overflowY:"auto" }}>
          <div style={{ padding:"8px 14px", borderBottom:"1px solid var(--border-solid)", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:10, color:"var(--text-3)" }}>Pro subscription required</span>
            <button onClick={() => setShowUpgrade(false)}
              style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", fontSize:10, color:"var(--text-3)" }}>
              ← Back
            </button>
          </div>
          <UpgradePage subscription={subscription} />
        </div>
      )}

      {/* ── Context badge ──────────────────────────────────────── */}
      {!(showUpgrade && !apiKey) && (
      <div style={{ padding:"6px 14px", borderBottom:"1px solid var(--border-solid)", flexShrink:0, display:"flex", gap:8, alignItems:"center", background:"var(--surface-1)" }}>
        <span style={{ fontSize:9, color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace" }}>Context:</span>
        <span style={{ fontSize:9, fontWeight:600, color:"#2563eb", fontFamily:"'IBM Plex Mono',monospace" }}>
          {activePage === "financial" ? `${ticker} · Financial View` :
           activePage === "portfolio" ? "Portfolio Tracker" :
           activePage === "screener"  ? "Stock Screener" :
           activePage === "technical" ? `${ticker} · Technical Analysis` :
           activePage === "earnings"  ? "Earnings Calendar" :
           activePage.charAt(0).toUpperCase() + activePage.slice(1)}
        </span>
        {quote?.c && activePage === "financial" &&
          <span style={{ fontSize:9, color:"var(--text-3)", fontFamily:"'IBM Plex Mono',monospace" }}>
            ${quote.c.toFixed(2)}
            <span style={{ color: quote.dp >= 0 ? "#059669" : "#e11d48" }}> ({quote.dp >= 0 ? "+" : ""}{quote.dp?.toFixed(2)}%)</span>
          </span>}
      </div>
      )}

      {/* ── Message thread ─────────────────────────────────────── */}
      {!(showUpgrade && !apiKey) && (
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
      )}

      {/* ── Suggested prompts ──────────────────────────────────── */}
      {!(showUpgrade && !apiKey) && (() => {
        // Always show suggestions — collapsed when there are messages, expanded when empty
        const expanded = msgs.length === 0;
        return (
          <div style={{ borderTop: expanded ? "none" : "1px solid var(--border-solid)", flexShrink:0 }}>
            {!expanded && (
              <button
                onClick={() => {
                  const el = document.getElementById("ov-copilot-suggestions");
                  if (el) el.style.display = el.style.display === "none" ? "flex" : "none";
                }}
                style={{ width:"100%", background:"none", border:"none", borderBottom:"1px solid var(--border-solid)",
                  cursor:"pointer", padding:"4px 14px", display:"flex", alignItems:"center", gap:5,
                  color:"var(--text-3)", fontSize:9, fontFamily:"'IBM Plex Mono',monospace", textAlign:"left" }}>
                <span style={{ fontSize:8 }}>✦</span> Suggested questions
                <span style={{ marginLeft:"auto", fontSize:9 }}>▾</span>
              </button>
            )}
            <div id="ov-copilot-suggestions"
              style={{ padding:"6px 14px 8px", display: expanded ? "flex" : "none",
                flexWrap:"wrap", gap:5 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  style={{ fontSize:9, padding:"3px 9px", borderRadius:99, cursor:"pointer",
                    fontFamily:"'Inter',sans-serif", background:"var(--surface-2)",
                    border:"1px solid var(--border-solid)", color:"var(--text-1)", transition:"border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="#2563eb"}
                  onMouseLeave={e => e.currentTarget.style.borderColor=""}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Input bar ──────────────────────────────────────────── */}
      {!(showUpgrade && !apiKey) && (
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
      )}
    </div>
  );
}
