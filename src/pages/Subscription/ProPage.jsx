import { useState, useEffect } from 'react';
import { startCheckout, openPortal, getSubscription, isOwner } from '../../lib/subscription';
import { useAuth } from '../../context/AuthContext';

// ── Mini SVG graphics ──────────────────────────────────────────────────────────

function SparkLine({ color = "#2563eb" }) {
  const pts = [4,18, 12,14, 20,16, 28,10, 36,13, 44,7, 52,9, 60,4];
  const d = pts.reduce((s, v, i) => s + (i % 2 === 0 ? (i === 0 ? `M${v},` : `L${v},`) : `${v} `), "").trim();
  return (
    <svg width="64" height="22" viewBox="0 0 64 22" fill="none">
      <path d={d} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="60" cy="4" r="2.5" fill={color} />
    </svg>
  );
}

function RadarIcon({ color = "#7c3aed" }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.2" strokeDasharray="3 2" opacity="0.4" />
      <circle cx="16" cy="16" r="9"  stroke={color} strokeWidth="1.2" strokeDasharray="3 2" opacity="0.6" />
      <circle cx="16" cy="16" r="4"  stroke={color} strokeWidth="1.5" />
      <line x1="16" y1="2" x2="16" y2="30" stroke={color} strokeWidth="0.8" opacity="0.3" />
      <line x1="2" y1="16" x2="30" y2="16" stroke={color} strokeWidth="0.8" opacity="0.3" />
      <circle cx="22" cy="10" r="2" fill={color} opacity="0.9" />
    </svg>
  );
}

function BrainIcon({ color = "#059669" }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M10 8 C8 8 6 10 6 12 C5 13 5 14 6 15 C5 16 5 18 7 19 C7 21 9 23 11 23 L16 23"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M22 8 C24 8 26 10 26 12 C27 13 27 14 26 15 C27 16 27 18 25 19 C25 21 23 23 21 23 L16 23"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <line x1="16" y1="8" x2="16" y2="23" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2" fill={color} opacity="0.7" />
      <circle cx="10" cy="15" r="1.5" fill={color} opacity="0.5" />
      <circle cx="22" cy="15" r="1.5" fill={color} opacity="0.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6.5" fill="rgba(5,150,105,0.12)" stroke="rgba(5,150,105,0.3)" />
      <path d="M4.5 7L6.5 9L9.5 5" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Feature data ───────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "🤖",
    color: "#2563eb",
    bg: "rgba(37,99,235,0.07)",
    border: "rgba(37,99,235,0.15)",
    title: "AI Copilot on Every Page",
    desc: "Ask anything about the data in front of you. The Copilot reads your current page context — macro data, your portfolio, live prices — and gives you targeted, specific answers. Not generic chat.",
    badge: "Powered by Perplexity",
  },
  {
    icon: "🔍",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.07)",
    border: "rgba(124,58,237,0.15)",
    title: "AI Natural Language Screener",
    desc: 'Type what you want in plain English — "profitable small-cap tech with low debt and high growth" — and the AI translates it into precise filter logic across 3,000+ stocks instantly.',
    badge: "3,000+ stocks",
  },
  {
    icon: "📊",
    color: "#059669",
    bg: "rgba(5,150,105,0.07)",
    border: "rgba(5,150,105,0.15)",
    title: "AI Intelligence Cards",
    desc: "Every asset — stocks, crypto, FX, commodities — gets a structured AI intelligence brief: what it is, the current market narrative, bull case, bear case, and 4 key risks. Auto-cached, always fresh.",
    badge: "Bull / Bear / Risk",
  },
  {
    icon: "📋",
    color: "#b45309",
    bg: "rgba(180,83,9,0.07)",
    border: "rgba(180,83,9,0.15)",
    title: "SEC Filing AI Analysis",
    desc: "Click any 10-K or 10-Q filing and get an instant AI-generated summary: financial highlights, MD&A insights, risk factors, outlook, and a Bullish / Bearish / Neutral sentiment verdict.",
    badge: "10-K · 10-Q · Sentiment",
  },
  {
    icon: "💼",
    color: "#0891b2",
    bg: "rgba(8,145,178,0.07)",
    border: "rgba(8,145,178,0.15)",
    title: "AI Portfolio Analysis",
    desc: "One click and the AI analyzes your live portfolio: sector concentration, correlation risk between holdings, specific rebalancing suggestions, and the top 3 macro risk factors for your exact positions.",
    badge: "Risk · Correlation · Rebalance",
  },
  {
    icon: "🌍",
    color: "#475569",
    bg: "rgba(71,85,105,0.07)",
    border: "rgba(71,85,105,0.15)",
    title: "Full Terminal Access",
    desc: "Every module unlocked — macro, FX, crypto, commodities, supply chain, earnings, technical analysis, and the Eye of Sauron market scanner. Professional-grade data, one subscription.",
    badge: "12 modules",
  },
];

const INCLUDES = [
  "AI Copilot with Perplexity live-search",
  "Unlimited AI stock screening",
  "Intelligence cards for every asset",
  "SEC filing AI summaries with sentiment",
  "AI portfolio risk analysis",
  "All 12 terminal modules",
  "Price alerts & research history sync",
  "Cancel any time — no lock-in",
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [subLoading,   setSubLoading]   = useState(true);
  const [loading,      setLoading]      = useState(false);
  const [err,          setErr]          = useState(null);

  const owner = isOwner(user);

  useEffect(() => {
    if (owner) { setSubLoading(false); return; }
    getSubscription().then(s => { setSubscription(s); setSubLoading(false); });
  }, [owner]);

  const isActive   = owner || subscription?.status === 'active';
  const isPastDue  = subscription?.status === 'past_due';

  const handleCheckout = async () => {
    setErr(null); setLoading(true);
    try { await startCheckout(); } catch (e) { setErr(e.message); setLoading(false); }
  };
  const handlePortal = async () => {
    setErr(null); setLoading(true);
    try { await openPortal(); } catch (e) { setErr(e.message); setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "calc(100vh - 90px)", overflowY: "auto",
      padding: "32px 24px 60px",
      fontFamily: "'Inter','IBM Plex Sans',sans-serif",
      color: "var(--text-1)",
      background: "var(--bg)",
      maxWidth: 960,
      margin: "0 auto",
    }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        {/* Animated signal rings */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "linear-gradient(135deg,#1d4ed8,#7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, boxShadow: "0 0 0 8px rgba(37,99,235,0.08), 0 0 0 16px rgba(37,99,235,0.04)",
          }}>
            📡
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2563eb", marginBottom: 10 }}>
          Omnes Videntes Pro
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-1)", margin: "0 0 12px", lineHeight: 1.2 }}>
          Every AI feature.<br />One subscription.
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 480, margin: "0 auto 24px", lineHeight: 1.65 }}>
          A Bloomberg-grade terminal with AI built in at every layer — not bolted on after the fact.
          Ask questions, screen stocks, read filings, and analyze your portfolio with real intelligence.
        </p>

        {/* Live sparkline decoration */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
          <SparkLine color="#2563eb" />
          <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono',monospace", color: "var(--text-3)", letterSpacing: "0.08em" }}>LIVE · AI-POWERED · PROFESSIONAL</span>
          <SparkLine color="#7c3aed" />
        </div>
      </div>

      {/* ── Subscription status / CTA ─────────────────────────────────────── */}
      {subLoading ? (
        <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 11, marginBottom: 32 }}>Loading…</div>
      ) : owner ? (
        <div style={{
          background: "rgba(5,150,105,0.07)", border: "1px solid rgba(5,150,105,0.25)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 32,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>★</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>Owner Account — Unlimited Access</div>
            <div style={{ fontSize: 10, color: "var(--text-3)" }}>All Pro features are permanently enabled for your account.</div>
          </div>
        </div>
      ) : isActive ? (
        <div style={{
          background: "rgba(5,150,105,0.07)", border: "1px solid rgba(5,150,105,0.25)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 32,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669", boxShadow: "0 0 6px rgba(5,150,105,0.7)", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>Pro — Active</div>
              <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                {subscription?.current_period_end
                  ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`
                  : "All AI features are unlocked."}
              </div>
            </div>
          </div>
          <button
            onClick={handlePortal}
            disabled={loading}
            style={{
              background: "none", border: "1px solid rgba(5,150,105,0.4)", borderRadius: 8,
              padding: "7px 16px", fontSize: 11, fontWeight: 600, cursor: "pointer",
              color: "#059669",
            }}
          >
            {loading ? "Loading…" : "Manage Billing →"}
          </button>
        </div>
      ) : isPastDue ? (
        <div style={{
          background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.30)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 32,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706" }}>⚠ Payment Failed</div>
            <div style={{ fontSize: 10, color: "var(--text-3)" }}>Update your payment method to restore Pro access.</div>
          </div>
          <button
            onClick={handlePortal}
            disabled={loading}
            style={{
              background: "#d97706", border: "none", borderRadius: 8,
              padding: "8px 18px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#fff",
            }}
          >
            {loading ? "Loading…" : "Update Payment Method"}
          </button>
        </div>
      ) : (
        /* Pricing card */
        <div style={{
          background: "var(--surface-1)", border: "1.5px solid rgba(37,99,235,0.25)",
          borderRadius: 16, padding: "28px 28px 24px",
          marginBottom: 36, maxWidth: 400, margin: "0 auto 36px",
          boxShadow: "0 4px 32px rgba(37,99,235,0.08)",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          {/* Gradient top bar */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: "linear-gradient(90deg,#2563eb,#7c3aed,#059669)",
          }} />

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#2563eb", marginBottom: 12 }}>
            Pro Plan
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: "var(--text-1)", lineHeight: 1 }}>$9.99</span>
            <span style={{ fontSize: 13, color: "var(--text-3)", paddingBottom: 4 }}>/month</span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 20 }}>No commitment — cancel any time</div>

          {/* Includes list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22, textAlign: "left" }}>
            {INCLUDES.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckIcon />
                <span style={{ fontSize: 11, color: "var(--text-2)" }}>{item}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
              background: loading ? "#94a3b8" : "linear-gradient(135deg,#1d4ed8,#2563eb)",
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer",
              boxShadow: loading ? "none" : "0 3px 12px rgba(37,99,235,0.4)",
              transition: "all 0.15s",
            }}
          >
            {loading ? "Loading…" : "Start Pro — $9.99/month"}
          </button>

          {err && <div style={{ fontSize: 10, color: "#e11d48", marginTop: 8 }}>{err}</div>}

          <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 12, lineHeight: 1.4 }}>
            Secure checkout via Stripe. Billed monthly.
          </div>
        </div>
      )}

      {/* ── Feature grid ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 16, textAlign: "center" }}>
          What's Included
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              background: f.bg,
              border: `1px solid ${f.border}`,
              borderRadius: 12, padding: "18px 18px 16px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>{f.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)" }}>{f.title}</div>
                  <div style={{
                    display: "inline-block", fontSize: 8, fontWeight: 700, letterSpacing: "0.08em",
                    textTransform: "uppercase", color: f.color, marginTop: 2,
                    background: `${f.color}18`, border: `1px solid ${f.color}30`,
                    borderRadius: 99, padding: "1px 7px",
                  }}>{f.badge}</div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Why section ──────────────────────────────────────────────────── */}
      <div style={{
        background: "var(--surface-1)", border: "1px solid var(--border-solid)",
        borderRadius: 14, padding: "28px 28px",
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 28,
        marginBottom: 36,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <RadarIcon color="#7c3aed" />
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Built for edge, not noise</div>
          <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.65, margin: 0 }}>
            Every AI feature is wired directly into live market data. The Copilot knows what's on your screen.
            The screener understands your intent. The filing summaries read the actual document.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <BrainIcon color="#059669" />
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Context-aware analysis</div>
          <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.65, margin: 0 }}>
            Ask about your portfolio and it knows your exact holdings. Ask about a filing and it's read the MD&A.
            Ask on the FX page and it knows the pair and current rate. No copy-pasting data manually.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 28 }}>⚡</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>One price, everything unlocked</div>
          <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.65, margin: 0 }}>
            No feature tiers, no per-query pricing, no usage caps. $9.99/month covers the full terminal
            with all AI features. Cancel any time from your billing portal.
          </p>
        </div>
      </div>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      {!isActive && !subLoading && !owner && (
        <div style={{ textAlign: "center" }}>
          <button
            onClick={handleCheckout}
            disabled={loading}
            style={{
              padding: "13px 36px", borderRadius: 12, border: "none",
              background: loading ? "#94a3b8" : "linear-gradient(135deg,#1d4ed8,#2563eb)",
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer",
              boxShadow: loading ? "none" : "0 4px 20px rgba(37,99,235,0.40)",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.transform="translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; }}
          >
            {loading ? "Loading…" : "Start Pro — $9.99/month"}
          </button>
          {err && <div style={{ fontSize: 10, color: "#e11d48", marginTop: 8 }}>{err}</div>}
          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 10, lineHeight: 1.4 }}>
            Secure checkout via Stripe · Cancel any time · No commitment
          </div>
        </div>
      )}
    </div>
  );
}
