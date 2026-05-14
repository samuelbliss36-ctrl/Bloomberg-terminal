// AI Copilot proxy — Perplexity (live search) / OpenAI / Anthropic / xAI (Grok)
// Auth hierarchy:
//   1. Owner email → unlimited, uses server key
//   2. Active subscriber → uses server key
//   3. Unsubscribed + no user apiKey → 402 subscription_required
//   4. Unsubscribed + user-supplied apiKey → use their key (bypass subscription)
//
// Server key priority: PERPLEXITY_KEY → OPENAI_KEY → ANTHROPIC_KEY

import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, incrementUsage, rateLimitedResponse } from './_rateLimit.js';
import { setCors } from './_cors.js';
import { withCircuitBreaker } from './_circuitBreaker.js';
import { kvGet, kvSet } from './_kv.js';
import { getAuth } from './_auth.js';

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = Math.imul(h, 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}


const OPENAI_KEY_RE    = /^sk-[A-Za-z0-9\-_]{20,}$/;
const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;
const PERPLEXITY_KEY_RE = /^pplx-[A-Za-z0-9]{20,}$/;
const XAI_KEY_RE        = /^xai-[A-Za-z0-9]{20,}$/;

// Maximum messages to forward — prevents unbounded token spend
const MAX_MESSAGES = 20;
// Maximum context string length — blocks oversized injection payloads
const MAX_CONTEXT_LEN = 12_000;

function buildSystemPrompt(context) {
  return `You are an AI financial copilot embedded in a professional Bloomberg-style trading terminal called "Omnes Videntes."

Here is the current live state of the terminal the user is looking at:

${context}

Your role:
- Provide concise, insightful financial analysis grounded in the data above
- Generate specific, actionable trade ideas when asked
- Summarise complex market data clearly and professionally
- Clearly separate data-derived facts from your analysis and opinions
- Flag material risks alongside opportunities — never one-sided
- Use markdown: **bold** key figures, bullet lists for multi-point answers
- Keep responses focused — 2–4 paragraphs unless the user asks for depth

Cite specific numbers from the terminal context whenever possible. If the context lacks data needed to answer well, say so directly rather than guessing.

⚠️ Disclaimer: This is for informational and educational purposes only. Nothing here constitutes financial advice. Always do your own research and consult a licensed financial advisor before making investment decisions.`;
}

/** Sanitise a user-supplied error so we don't leak internal details */
function safeError(err) {
  const msg = err?.message || "";
  if (msg.includes("rate limit") || msg.includes("Rate limit")) return "AI provider rate limit reached — try again shortly.";
  if (msg.includes("invalid_api_key") || msg.includes("Incorrect API key")) return "Invalid API key.";
  if (msg.includes("insufficient_quota")) return "API quota exceeded on the configured key.";
  return "AI request failed. Check your API key and try again.";
}

async function callPerplexity(key, systemPrompt, safeMessages) {
  const r = await withCircuitBreaker('perplexity', () =>
    fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        max_tokens: 1024,
        messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
      }),
    })
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  return {
    text: d.choices?.[0]?.message?.content || "(no response)",
    provider: "perplexity",
    tokens: (d.usage?.prompt_tokens || 0) + (d.usage?.completion_tokens || 0),
  };
}

async function callOpenAI(key, systemPrompt, safeMessages) {
  const r = await withCircuitBreaker('openai', () =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
      }),
    })
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  return {
    text: d.choices?.[0]?.message?.content || "(no response)",
    provider: "openai",
    tokens: (d.usage?.prompt_tokens || 0) + (d.usage?.completion_tokens || 0),
  };
}

async function callGrok(key, systemPrompt, safeMessages) {
  const r = await withCircuitBreaker('xai', () =>
    fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-2-latest",
        max_tokens: 1024,
        messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
      }),
    })
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  return {
    text: d.choices?.[0]?.message?.content || "(no response)",
    provider: "xai",
    tokens: (d.usage?.prompt_tokens || 0) + (d.usage?.completion_tokens || 0),
  };
}

async function callAnthropic(key, systemPrompt, safeMessages) {
  const r = await withCircuitBreaker('anthropic', () =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: safeMessages,
      }),
    })
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  return {
    text: d.content?.[0]?.text || "(no response)",
    provider: "anthropic",
    tokens: (d.usage?.input_tokens || 0) + (d.usage?.output_tokens || 0),
  };
}

// Try providers in order until one succeeds — server keys only
async function callWithFallback(systemPrompt, safeMessages) {
  const providers = [];
  if (process.env.PERPLEXITY_KEY) providers.push(() => callPerplexity(process.env.PERPLEXITY_KEY, systemPrompt, safeMessages));
  if (process.env.OPENAI_KEY)     providers.push(() => callOpenAI(process.env.OPENAI_KEY, systemPrompt, safeMessages));
  if (process.env.ANTHROPIC_KEY)  providers.push(() => callAnthropic(process.env.ANTHROPIC_KEY, systemPrompt, safeMessages));

  let lastErr;
  for (const call of providers) {
    try { return await call(); } catch (err) { lastErr = err; }
  }
  throw lastErr || new Error("No AI providers available");
}

export default async function handler(req, res) {
  if (!setCors(req, res, { allowedMethods: 'POST, OPTIONS' })) return;
  if (req.method !== "POST") return res.status(405).end();

  const { mode, messages, context, apiKey: userApiKey, page } = req.body || {};

  // ── Insight chip mode (mode: "insight") ──────────────────────────────────────
  // Requires only a valid Supabase session — not a Pro subscription.
  // Uses OPENAI_KEY directly with gpt-4o-mini.
  if (mode === "insight") {
    if (!context) return res.status(400).json({ error: "context required" });
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "auth_required" });
    try {
      const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "invalid_token" });
    } catch { return res.status(401).json({ error: "auth_failed" }); }

    const safeCtx  = context.slice(0, 400);
    const cacheKey = `insight:${page || ""}:${hashStr(safeCtx)}`;
    const cached   = await kvGet(cacheKey);
    if (cached) return res.json({ insight: cached, cached: true });

    const openaiKey = process.env.OPENAI_KEY;
    if (!openaiKey) return res.status(503).json({ error: "not_configured" });

    try {
      const r = await withCircuitBreaker('openai-insight', () =>
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini', max_tokens: 80,
            messages: [
              { role: 'system', content: 'You are a financial insight chip. Generate exactly ONE sentence of market insight (max 110 characters). Be specific and data-driven. No markdown, no quotes, no ellipsis.' },
              { role: 'user',   content: safeCtx },
            ],
          }),
        })
      );
      const d = await r.json();
      if (d.error) throw new Error(d.error.message);
      const insight = (d.choices?.[0]?.message?.content || '').trim().slice(0, 120);
      if (insight) await kvSet(cacheKey, insight, 900);
      return res.json({ insight });
    } catch (err) {
      if (err.circuitOpen) return res.status(503).json({ error: 'upstream_degraded' });
      return res.status(500).json({ error: 'generation_failed' });
    }
  }

  // ── Standard copilot mode ─────────────────────────────────────────────────────
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  const { user: authedUser, isOwner: isOwnerUser, serverKeyAllowed } = await getAuth(req);

  // ── Key resolution ────────────────────────────────────────────────────────
  // Server keys are used for owner + active subscribers
  // User-supplied key bypasses subscription requirement
  let rawKey = null;
  let keySource = null;

  if (serverKeyAllowed) {
    if (process.env.PERPLEXITY_KEY) {
      rawKey = process.env.PERPLEXITY_KEY;
      keySource = "perplexity_server";
    } else if (process.env.OPENAI_KEY) {
      rawKey = process.env.OPENAI_KEY;
      keySource = "openai_server";
    } else if (process.env.ANTHROPIC_KEY) {
      rawKey = process.env.ANTHROPIC_KEY;
      keySource = "anthropic_server";
    }
  }

  // Fall back to user-supplied key regardless of subscription
  if (!rawKey && userApiKey) {
    rawKey = userApiKey;
    keySource = "user";
  }

  if (!rawKey) {
    // Owner is authenticated but no server key configured → config error, not payment error
    if (isOwnerUser) {
      return res.status(503).json({
        error: "no_server_key",
        message: "No server AI key configured. Add PERPLEXITY_KEY (or OPENAI_KEY) to Vercel → Settings → Environment Variables, then redeploy.",
      });
    }
    // Non-owner, no subscription, no user key → require subscription
    return res.status(402).json({
      error: "subscription_required",
      message: "A Pro subscription is required to use the AI Copilot. Upgrade to get Perplexity live search AI.",
    });
  }

  // ── Rate limit check (server-key subscribers only) ───────────────────────
  const useServerKey = keySource !== "user";
  if (useServerKey && authedUser && !isOwnerUser) {
    const rl = await checkRateLimit(authedUser.id, authedUser.email);
    if (!rl.allowed) {
      return res.status(429).json(rateLimitedResponse(rl.remaining, rl.limit));
    }
  }

  // ── Sanitise messages & context ──────────────────────────────────────────
  const safeMessages = messages.slice(-MAX_MESSAGES).map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: typeof m.content === "string" ? m.content.slice(0, 4000) : "",
  }));
  const safeContext = typeof context === "string" ? context.slice(0, MAX_CONTEXT_LEN) : "No terminal context provided.";
  const systemPrompt = buildSystemPrompt(safeContext);

  try {
    let result;

    if (useServerKey) {
      // Server key: try all configured providers in order (Perplexity → OpenAI → Anthropic)
      result = await callWithFallback(systemPrompt, safeMessages);
    } else {
      // User-supplied key: determine provider from key format, no fallback
      const isPerplexity = PERPLEXITY_KEY_RE.test(rawKey);
      const isAnthropic  = !isPerplexity && ANTHROPIC_KEY_RE.test(rawKey);
      const isGrok       = !isPerplexity && !isAnthropic && XAI_KEY_RE.test(rawKey);
      const isOpenAI     = !isPerplexity && !isAnthropic && !isGrok && OPENAI_KEY_RE.test(rawKey);

      if (isPerplexity)     result = await callPerplexity(rawKey, systemPrompt, safeMessages);
      else if (isAnthropic) result = await callAnthropic(rawKey, systemPrompt, safeMessages);
      else if (isGrok)      result = await callGrok(rawKey, systemPrompt, safeMessages);
      else if (isOpenAI)    result = await callOpenAI(rawKey, systemPrompt, safeMessages);
      else return res.status(401).json({ error: "Invalid API key format." });
    }

    // Increment usage for server-key subscribers (fire-and-forget)
    if (useServerKey && authedUser && !isOwnerUser && result.tokens > 0) {
      incrementUsage(authedUser.id, authedUser.email, result.tokens).catch(() => {});
    }

    res.json({
      message:  result.text,
      provider: result.provider,
      tokens_used: result.tokens || 0,
    });
  } catch (err) {
    console.error("copilot error:", err.message);
    res.status(500).json({ error: safeError(err) });
  }
}
