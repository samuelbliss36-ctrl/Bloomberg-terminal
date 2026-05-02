// AI Copilot proxy — Perplexity (live search) / OpenAI / Anthropic
// Auth hierarchy:
//   1. Owner email → unlimited, uses server key
//   2. Active subscriber → uses server key
//   3. Unsubscribed + no user apiKey → 402 subscription_required
//   4. Unsubscribed + user-supplied apiKey → use their key (bypass subscription)
//
// Server key priority: PERPLEXITY_KEY → OPENAI_KEY → ANTHROPIC_KEY

import { createClient } from '@supabase/supabase-js';

const OWNER_EMAIL = 'samuelbliss36@gmail.com';

const OPENAI_KEY_RE    = /^sk-[A-Za-z0-9\-_]{20,}$/;
const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;
const PERPLEXITY_KEY_RE = /^pplx-[A-Za-z0-9]{20,}$/;

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
  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + key,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      model:      "llama-3.1-sonar-large-128k-online",
      max_tokens: 1024,
      messages:   [{ role: "system", content: systemPrompt }, ...safeMessages],
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  return { text: d.choices?.[0]?.message?.content || "(no response)", provider: "perplexity" };
}

async function callOpenAI(key, systemPrompt, safeMessages) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + key,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      model:      "gpt-4o-mini",
      max_tokens: 1024,
      messages:   [{ role: "system", content: systemPrompt }, ...safeMessages],
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  return { text: d.choices?.[0]?.message?.content || "(no response)", provider: "openai" };
}

async function callAnthropic(key, systemPrompt, safeMessages) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":          key,
      "anthropic-version":  "2023-06-01",
      "content-type":       "application/json",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   safeMessages,
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  return { text: d.content?.[0]?.text || "(no response)", provider: "anthropic" };
}

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { messages, context, apiKey: userApiKey } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  // ── Auth & subscription check ──────────────────────────────────────────────
  const token = req.headers.authorization?.replace("Bearer ", "");
  let serverKeyAllowed = false;
  let isOwnerUser = false;

  if (token) {
    try {
      const supabase = createClient(
        process.env.REACT_APP_SUPABASE_URL,
        process.env.REACT_APP_SUPABASE_ANON_KEY
      );
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        if (user.email === OWNER_EMAIL) {
          serverKeyAllowed = true;
          isOwnerUser = true;
        } else {
          // Check subscription status
          const supabaseAdmin = createClient(
            process.env.REACT_APP_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
          const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('status')
            .eq('user_id', user.id)
            .single();
          if (sub?.status === 'active') {
            serverKeyAllowed = true;
          }
        }
      }
    } catch (e) {
      // Auth check failed — fall through to user key or 402
    }
  }

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
    // Not subscribed and no user key → require subscription
    return res.status(402).json({
      error: "subscription_required",
      message: "A Pro subscription is required to use the AI Copilot. Upgrade to get Perplexity live search AI.",
    });
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

    // Determine provider from key
    const isPerplexity = keySource === "perplexity_server" || PERPLEXITY_KEY_RE.test(rawKey);
    const isAnthropic  = !isPerplexity && ANTHROPIC_KEY_RE.test(rawKey);
    const isOpenAI     = !isPerplexity && !isAnthropic && OPENAI_KEY_RE.test(rawKey);

    if (isPerplexity) {
      result = await callPerplexity(rawKey, systemPrompt, safeMessages);
    } else if (isAnthropic) {
      result = await callAnthropic(rawKey, systemPrompt, safeMessages);
    } else if (isOpenAI) {
      result = await callOpenAI(rawKey, systemPrompt, safeMessages);
    } else {
      return res.status(401).json({ error: "Invalid API key format." });
    }

    res.json({
      message:  result.text,
      provider: result.provider,
      isOwner:  isOwnerUser,
    });
  } catch (err) {
    console.error("copilot error:", err.message);
    res.status(500).json({ error: safeError(err) });
  }
}
