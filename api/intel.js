// AI Intelligence Card generator — returns structured JSON for any financial asset
// Uses the same key resolution as api/copilot.js: env vars first, then user-supplied key.
// Response shape: { whatThisIs, currentNarrative, keyRisks[], bullCase, bearCase }

const OPENAI_KEY_RE    = /^sk-[A-Za-z0-9\-_]{20,}$/;
const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;
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
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).end();

  const { id, context, apiKey } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required" });

  const rawKey = process.env.OPENAI_KEY || process.env.ANTHROPIC_KEY || apiKey;
  if (!rawKey) {
    return res.status(401).json({
      error: "no_key",
      message: "No API key configured. Enter your OpenAI or Anthropic key in the AI Copilot settings panel.",
    });
  }

  const isAnthropic = rawKey.startsWith("sk-ant");
  if (!(isAnthropic ? ANTHROPIC_KEY_RE : OPENAI_KEY_RE).test(rawKey)) {
    return res.status(401).json({ error: "Invalid API key format." });
  }

  const safeContext = typeof context === "string" ? context.slice(0, MAX_CONTEXT_LEN) : null;

  const userPrompt = `Generate intelligence cards for the following financial asset.

Asset ID: ${String(id).slice(0, 20)}
${safeContext ? `\nLive market data:\n${safeContext}` : "\nNo live data available — use your knowledge of this asset."}

Return a JSON object with keys: whatThisIs, currentNarrative, keyRisks (array of 4 strings), bullCase, bearCase.`;

  try {
    let text;

    if (isAnthropic) {
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
    } else {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + rawKey,
          "Content-Type":  "application/json",
        },
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

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(parsed);
  } catch (err) {
    console.error("intel error:", err.message);
    res.status(500).json({ error: safeError(err) });
  }
}
