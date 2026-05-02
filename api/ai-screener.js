// AI Screener — natural-language query → filter parameter object
// POST { query, apiKey }
// Returns { filters, description, reasoning }

const OPENAI_KEY_RE    = /^sk-[A-Za-z0-9\-_]{20,}$/;
const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;

function safeError(err) {
  const msg = err?.message || "";
  if (msg.includes("rate limit") || msg.includes("Rate limit")) return "AI provider rate limit reached — try again shortly.";
  if (msg.includes("invalid_api_key") || msg.includes("Incorrect API key")) return "Invalid API key.";
  if (msg.includes("insufficient_quota")) return "API quota exceeded on the configured key.";
  return "AI request failed. Check your API key and try again.";
}

const SYSTEM_PROMPT = `You are a quantitative equity research assistant for a stock screener tool.

Your job: translate a plain-English stock screening query into a structured filter object.

=== FILTER SCHEMA ===
Return a JSON object with ONLY the keys listed below. Omit keys you don't want to filter on (or use the defaults shown).

{
  "sector":        string — one of: "All" | "Technology" | "Healthcare" | "Financials" | "Consumer Disc." | "Consumer Staples" | "Communication" | "Energy" | "Industrials" | "Materials" | "Utilities" | "Real Estate"
  "mktCapTier":    string — one of: "All" | "Mega" (>$200B) | "Large" ($10–200B) | "Mid" ($2–10B) | "Small" (<$2B)
  "rating":        string — one of: "All" | "Strong Buy" | "Buy" | "Hold" | "Sell"
  "peMin":         string (number) — minimum trailing P/E
  "peMax":         string (number) — maximum trailing P/E
  "fwdPeMax":      string (number) — maximum forward P/E
  "revGrowthMin":  string (number) — minimum revenue growth % (e.g. "10" = 10%)
  "revGrowthMax":  string (number) — maximum revenue growth %
  "grossMarginMin":string (number) — minimum gross margin %
  "netMarginMin":  string (number) — minimum net margin %
  "divYieldMin":   string (number) — minimum dividend yield %
  "betaMax":       string (number) — maximum beta (volatility)
  "roeMin":        string (number) — minimum return on equity %
  "pbMax":         string (number) — maximum price-to-book ratio
  "debtToEqMax":   string (number) — maximum debt-to-equity ratio
  "profitable":    boolean — true = only include stocks with positive net margin
  "paysDividend":  boolean — true = only include dividend-paying stocks
}

=== SECTOR MAPPING RULES ===
When the user mentions an industry/theme, map it to the closest sector:
- "defense", "aerospace", "military", "government contractors" → "Industrials"
- "pharma", "biotech", "drug", "medical devices", "hospitals" → "Healthcare"
- "banks", "insurance", "fintech", "asset management", "payments" → "Financials"
- "software", "semiconductors", "chips", "cloud", "AI", "SaaS", "cybersecurity", "hardware" → "Technology"
- "retail", "e-commerce", "autos", "luxury", "hotels", "restaurants", "gaming" → "Consumer Disc."
- "food", "beverages", "household products", "tobacco", "grocery" → "Consumer Staples"
- "media", "telecom", "streaming", "social media", "advertising" → "Communication"
- "oil", "gas", "renewables", "solar", "wind", "power" → "Energy"
- "chemicals", "mining", "metals", "steel", "paper" → "Materials"
- "electric utilities", "water utilities", "gas utilities" → "Utilities"
- "REIT", "real estate", "housing" → "Real Estate"
- "manufacturing", "industrial machinery", "freight", "airlines", "railroads" → "Industrials"

=== SIZE MAPPING RULES ===
- "small-cap", "small cap", "smaller companies" → "Small"
- "mid-cap", "mid cap" → "Mid"
- "large-cap", "large cap", "blue chip" → "Large"
- "mega-cap", "trillion dollar" → "Mega"
- If multiple sizes mentioned or unclear → "All"

=== NUMERIC INTERPRETATION GUIDELINES ===
- "low P/E" → peMax: "15"
- "cheap", "value" → peMax: "15", pbMax: "2"
- "growth" → revGrowthMin: "15"
- "high growth", "hypergrowth" → revGrowthMin: "25"
- "revenue acceleration" → revGrowthMin: "15"
- "low debt" → debtToEqMax: "0.5"
- "debt-free", "no debt" → debtToEqMax: "0.1"
- "profitable" → profitable: true, netMarginMin: "5"
- "high margin" → grossMarginMin: "50", netMarginMin: "15"
- "dividend", "income" → paysDividend: true, divYieldMin: "2"
- "high dividend" → paysDividend: true, divYieldMin: "4"
- "low volatility", "low risk", "defensive" → betaMax: "0.8"
- "high quality" → roeMin: "15", profitable: true
- "high ROE" → roeMin: "20"

=== OUTPUT FORMAT ===
Respond with a single valid JSON object (no markdown, no fences) with exactly these three keys:
{
  "filters": { ...the filter object using only keys with non-default values... },
  "description": "A 1-sentence plain-English summary of what this screen finds (e.g. 'Profitable small-cap defense companies with low debt and accelerating revenue')",
  "reasoning": ["short chip 1", "short chip 2", "short chip 3"]
}

The "reasoning" array contains 2–4 short phrases (≤5 words each) explaining the key criteria applied (e.g. ["Small-cap only", "Industrials sector", "D/E < 0.5", "Rev growth > 15%"]).

Default values (do NOT include these in the filters object unless you want to change them):
  sector: "All", mktCapTier: "All", rating: "All"
  peMin:"", peMax:"", fwdPeMax:"", revGrowthMin:"", revGrowthMax:""
  grossMarginMin:"", netMarginMin:"", divYieldMin:"", betaMax:""
  roeMin:"", pbMax:"", debtToEqMax:""
  profitable: false, paysDividend: false

Only include filters that change from their default. For example if the user wants all sectors, do NOT include "sector" key.`;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).end();

  const { query, apiKey } = req.body || {};
  if (!query?.trim()) return res.status(400).json({ error: "query required" });

  const key = process.env.OPENAI_KEY || process.env.ANTHROPIC_KEY || apiKey;
  if (!key) {
    return res.status(401).json({
      error: "no_key",
      message: "No API key configured. Enter your OpenAI or Anthropic key in the AI Copilot settings.",
    });
  }

  const isAnthropic = key.startsWith("sk-ant");
  if (!(isAnthropic ? ANTHROPIC_KEY_RE : OPENAI_KEY_RE).test(key)) {
    return res.status(401).json({ error: "Invalid API key format." });
  }
  const userPrompt = `Translate this stock screening query into filter parameters:\n\n"${query.trim()}"`;

  try {
    let text;

    if (isAnthropic) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key":         key,
          "anthropic-version": "2023-06-01",
          "content-type":      "application/json",
        },
        body: JSON.stringify({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 600,
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
          "Authorization": "Bearer " + key,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          model:           "gpt-4o-mini",
          max_tokens:      600,
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

    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI returned non-JSON response");
      parsed = JSON.parse(match[0]);
    }

    if (!parsed.filters || !parsed.description) {
      throw new Error("AI response missing required fields");
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      filters:     parsed.filters     || {},
      description: parsed.description || "",
      reasoning:   Array.isArray(parsed.reasoning) ? parsed.reasoning : [],
    });
  } catch (err) {
    console.error("ai-screener error:", err.message);
    res.status(500).json({ error: safeError(err) });
  }
}
