// Stock screener — FMP data proxy + AI natural-language filter generation
// GET  /api/screener          → FMP live universe (cached 12h)
// POST /api/screener?mode=ai  → AI query → filter object  body: { query, apiKey }

// ── AI Screener constants ─────────────────────────────────────────────────────
const OPENAI_KEY_RE    = /^sk-[A-Za-z0-9\-_]{20,}$/;
const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;

function safeAiError(err) {
  const msg = err?.message || "";
  if (msg.includes("rate limit") || msg.includes("Rate limit")) return "AI provider rate limit reached — try again shortly.";
  if (msg.includes("invalid_api_key") || msg.includes("Incorrect API key")) return "Invalid API key.";
  if (msg.includes("insufficient_quota")) return "API quota exceeded on the configured key.";
  return "AI request failed. Check your API key and try again.";
}

const AI_SCREENER_SYSTEM = `You are a quantitative equity research assistant for a stock screener tool.

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
- "defense", "aerospace", "military" → "Industrials"
- "pharma", "biotech", "drug", "medical" → "Healthcare"
- "banks", "insurance", "fintech", "payments" → "Financials"
- "software", "semiconductors", "AI", "SaaS", "cloud", "cybersecurity" → "Technology"
- "retail", "e-commerce", "autos", "hotels", "restaurants", "gaming" → "Consumer Disc."
- "food", "beverages", "household products", "grocery" → "Consumer Staples"
- "media", "telecom", "streaming", "social media" → "Communication"
- "oil", "gas", "renewables", "solar", "wind" → "Energy"
- "chemicals", "mining", "metals", "steel" → "Materials"
- "utilities", "electric", "water" → "Utilities"
- "REIT", "real estate" → "Real Estate"
- "manufacturing", "freight", "airlines", "railroads" → "Industrials"

=== NUMERIC INTERPRETATION ===
- "low P/E" → peMax: "15"
- "cheap", "value" → peMax: "15", pbMax: "2"
- "growth" → revGrowthMin: "15"
- "high growth" → revGrowthMin: "25"
- "low debt" → debtToEqMax: "0.5"
- "debt-free" → debtToEqMax: "0.1"
- "profitable" → profitable: true, netMarginMin: "5"
- "high margin" → grossMarginMin: "50", netMarginMin: "15"
- "dividend", "income" → paysDividend: true, divYieldMin: "2"
- "high dividend" → paysDividend: true, divYieldMin: "4"
- "low volatility", "defensive" → betaMax: "0.8"
- "high quality" → roeMin: "15", profitable: true

=== OUTPUT FORMAT ===
Respond with a single valid JSON object (no markdown, no fences):
{
  "filters": { ...only keys with non-default values... },
  "description": "1-sentence plain-English summary",
  "reasoning": ["chip 1", "chip 2", "chip 3"]
}
reasoning: 2–4 short phrases (≤5 words each) explaining criteria applied.`;

async function handleAiScreener(req, res) {
  const { query, apiKey } = req.body || {};
  if (!query?.trim()) return res.status(400).json({ error: "query required" });

  const key = process.env.OPENAI_KEY || process.env.ANTHROPIC_KEY || apiKey;
  if (!key) {
    return res.status(401).json({ error: "no_key", message: "No API key configured." });
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
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 600, system: AI_SCREENER_SYSTEM, messages: [{ role: "user", content: userPrompt }] }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
      text = d.content?.[0]?.text || "";
    } else {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 600, response_format: { type: "json_object" }, messages: [{ role: "system", content: AI_SCREENER_SYSTEM }, { role: "user", content: userPrompt }] }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
      text = d.choices?.[0]?.message?.content || "";
    }

    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { const m = clean.match(/\{[\s\S]*\}/); if (!m) throw new Error("AI returned non-JSON"); parsed = JSON.parse(m[0]); }

    if (!parsed.filters || !parsed.description) throw new Error("AI response missing required fields");

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ filters: parsed.filters || {}, description: parsed.description || "", reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [] });
  } catch (err) {
    console.error("ai-screener error:", err.message);
    res.status(500).json({ error: safeAiError(err) });
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  // AI mode: POST /api/screener?mode=ai
  if (req.method === "POST" && req.query?.mode === "ai") {
    return handleAiScreener(req, res);
  }

  // FMP live universe: GET /api/screener
  if (req.method !== "GET") return res.status(405).end();

  const FMP_KEY = process.env.FMP_KEY;
  if (!FMP_KEY) {
    return res.status(503).json({ error: "FMP_KEY env var not set." });
  }

  try {
    const url =
      `https://financialmodelingprep.com/stable/company-screener` +
      `?isEtf=false&isFund=false&isActivelyTrading=true&limit=500&apikey=${FMP_KEY}`;

    const response = await fetch(url);
    const text = await response.text();

    if (!response.ok || text.startsWith("Premium")) {
      return res.status(402).json({ error: "FMP plan limit reached or endpoint requires upgrade." });
    }

    const data = JSON.parse(text);
    if (!Array.isArray(data)) return res.status(200).json([]);

    const normalised = data.map(s => ({
      symbol:             s.symbol,
      companyName:        s.companyName  || s.symbol,
      sector:             s.sector       || null,
      price:              s.price        ?? null,
      changePercentage:   s.changePercentage ?? null,
      marketCap:          s.marketCap    ?? null,
      beta:               s.beta         ?? null,
      volume:             s.volume       ?? null,
      lastAnnualDividend: s.lastAnnualDividend ?? 0,
    }));

    res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate=86400");
    res.json(normalised);
  } catch (err) {
    console.error("screener error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
