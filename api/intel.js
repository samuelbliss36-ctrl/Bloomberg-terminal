// AI Intelligence Card generator — returns structured JSON for any financial asset
// Owner + active subscribers use server keys; others need user-supplied key.
// Response shape: { whatThisIs, currentNarrative, keyRisks[], bullCase, bearCase }

import { checkRateLimit, incrementUsage, rateLimitedResponse } from './_rateLimit.js';
import { setCors } from './_cors.js';
import { getAuth } from './_auth.js';
const OPENAI_KEY_RE    = /^sk-[A-Za-z0-9\-_]{20,}$/;
const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;
const PERPLEXITY_KEY_RE = /^pplx-[A-Za-z0-9]{20,}$/;
const MAX_CONTEXT_LEN  = 8_000;

const SYSTEM_PROMPT = `You are a financial intelligence engine embedded in a professional Bloomberg-style terminal called "Omnes Videntes."

Given data about a financial asset, generate structured intelligence cards for a professional trader or analyst.

CRITICAL: Respond ONLY with valid JSON — no markdown, no code fences, no prose, no explanation before or after the JSON object. Your entire response must be parseable by JSON.parse().

Return exactly this structure:
{
  "whatThisIs": "2-3 sentence plain-English explanation of what this asset is, how it is priced, and its role in financial markets",
  "currentNarrative": "2-3 sentence description of the current market narrative, recent price action drivers, and dominant themes as of the data provided",
  "keyRisks": [
    "Concise risk factor 1 (10-20 words)",
    "Concise risk factor 2 (10-20 words)",
    "Concise risk factor 3 (10-20 words)",
    "Concise risk factor 4 (10-20 words)"
  ],
  "bullCase": "2-3 sentence bull case: what conditions or catalysts would drive meaningful upside",
  "bearCase": "2-3 sentence bear case: what conditions or catalysts would drive meaningful downside"
}

Rules:
- Be specific to the asset — no generic boilerplate
- Ground currentNarrative in the actual data provided (price, trend, metrics)
- keyRisks must be asset-specific, not generic "market risk" platitudes
- Keep all text concise and professional — this is for experienced market participants
- If limited data is provided, use your knowledge of the asset to fill gaps, but note uncertainty`;

function safeError(err) {
  const msg = err?.message || "";
  if (msg.includes("rate limit") || msg.includes("Rate limit")) return "AI provider rate limit reached — try again shortly.";
  if (msg.includes("invalid_api_key") || msg.includes("Incorrect API key")) return "Invalid API key.";
  if (msg.includes("insufficient_quota")) return "API quota exceeded on the configured key.";
  return "AI request failed. Check your API key and try again.";
}

export default async function handler(req, res) {
  if (!setCors(req, res, { allowedMethods: 'POST, OPTIONS' })) return;
  if (req.method !== "POST") return res.status(405).end();

  const { id, context, apiKey: userApiKey } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required" });

  // ── Auth check ────────────────────────────────────────────────────────────
  const { user: authedUser, isOwner: isOwnerUser, serverKeyAllowed } = await getAuth(req);

  // ── Key resolution ────────────────────────────────────────────────────────
  let rawKey = null;
  if (serverKeyAllowed) {
    rawKey = process.env.PERPLEXITY_KEY || process.env.OPENAI_KEY || process.env.ANTHROPIC_KEY || null;
  }
  if (!rawKey && userApiKey) rawKey = userApiKey;

  if (!rawKey) {
    if (isOwnerUser) {
      return res.status(503).json({ error: "no_server_key", message: "No server AI key configured. Add PERPLEXITY_KEY to Vercel environment variables." });
    }
    return res.status(402).json({
      error: "subscription_required",
      message: "A Pro subscription is required to use AI features. Upgrade at any time from the AI Copilot panel.",
    });
  }

  const isPerplexity = PERPLEXITY_KEY_RE.test(rawKey);
  const isAnthropic  = rawKey.startsWith("sk-ant");
  if (!isPerplexity && !(isAnthropic ? ANTHROPIC_KEY_RE : OPENAI_KEY_RE).test(rawKey)) {
    return res.status(401).json({ error: "Invalid API key format." });
  }

  // ── Rate limit check ──────────────────────────────────────────────────────
  const useServerKey = serverKeyAllowed && rawKey !== userApiKey;
  if (useServerKey && authedUser && !isOwnerUser) {
    const rl = await checkRateLimit(authedUser.id, authedUser.email);
    if (!rl.allowed) return res.status(429).json(rateLimitedResponse(rl.remaining, rl.limit));
  }

  const safeContext = typeof context === "string" ? context.slice(0, MAX_CONTEXT_LEN) : null;

  const userPrompt = `Generate intelligence cards for the following financial asset.

Asset ID: ${String(id).slice(0, 20)}
${safeContext ? `\nLive market data:\n${safeContext}` : "\nNo live data available — use your knowledge of this asset."}

Return a JSON object with keys: whatThisIs, currentNarrative, keyRisks (array of 4 strings), bullCase, bearCase.`;

  try {
    let text;
    let tokensUsed = 0;

    if (isPerplexity) {
      const r = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + rawKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar-pro",
          max_tokens: 900,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user",   content: userPrompt },
          ],
        }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
      text = d.choices?.[0]?.message?.content || "";
      tokensUsed = (d.usage?.prompt_tokens || 0) + (d.usage?.completion_tokens || 0);
    } else if (isAnthropic) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key":         rawKey,
          "anthropic-version": "2023-06-01",
          "content-type":      "application/json",
        },
        body: JSON.stringify({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 900,
          system:     SYSTEM_PROMPT,
          messages:   [{ role: "user", content: userPrompt }],
        }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
      text = d.content?.[0]?.text || "";
      tokensUsed = (d.usage?.input_tokens || 0) + (d.usage?.output_tokens || 0);
    } else {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + rawKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model:           "gpt-4o-mini",
          max_tokens:      900,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user",   content: userPrompt },
          ],
        }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
      text = d.choices?.[0]?.message?.content || "";
      tokensUsed = (d.usage?.prompt_tokens || 0) + (d.usage?.completion_tokens || 0);
    }

    if (useServerKey && authedUser && !isOwnerUser && tokensUsed > 0) {
      incrementUsage(authedUser.id, authedUser.email, tokensUsed).catch(() => {});
    }

    // Strip markdown fences if the model added them despite instructions
    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI returned non-JSON response");
      parsed = JSON.parse(match[0]);
    }

    // Validate required keys
    const required = ["whatThisIs", "currentNarrative", "keyRisks", "bullCase", "bearCase"];
    for (const k of required) {
      if (!(k in parsed)) throw new Error(`AI response missing field: ${k}`);
    }
    if (!Array.isArray(parsed.keyRisks)) parsed.keyRisks = [parsed.keyRisks].filter(Boolean);

    res.json(parsed);
  } catch (err) {
    console.error("intel error:", err.message);
    res.status(500).json({ error: safeError(err) });
  }
}
