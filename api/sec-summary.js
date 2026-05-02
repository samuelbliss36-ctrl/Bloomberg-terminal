// SEC filing AI summarizer — uses same key resolution as api/copilot.js
// POST { ticker, entityName, formType, period, filingDate, sections, apiKey }
// Returns { headline, financialHighlights, riskFactors, mdaInsights, outlook, watchPoints }

const OPENAI_KEY_RE    = /^sk-[A-Za-z0-9\-_]{20,}$/;
const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;
const MAX_SECTION_LEN  = 6_000; // chars per filing section

function safeError(err) {
  const msg = err?.message || "";
  if (msg.includes("rate limit") || msg.includes("Rate limit")) return "AI provider rate limit reached — try again shortly.";
  if (msg.includes("invalid_api_key") || msg.includes("Incorrect API key")) return "Invalid API key.";
  if (msg.includes("insufficient_quota")) return "API quota exceeded on the configured key.";
  return "AI request failed. Check your API key and try again.";
}

const SYSTEM_PROMPT = `You are a senior equity research analyst specializing in SEC filing analysis. You have just read the relevant sections of a public company's SEC filing (10-K or 10-Q).

Generate a structured, professional analysis. Respond ONLY with valid JSON — no markdown, no code fences.

Return exactly this structure:
{
  "headline": "One sentence capturing the single most important takeaway from this filing (≤20 words)",
  "financialHighlights": ["highlight 1", "highlight 2", "highlight 3"],
  "riskFactors": ["key risk 1", "key risk 2", "key risk 3"],
  "mdaInsights": "2-3 sentences on management's characterization of business performance, key drivers, and operating trends",
  "outlook": "2-3 sentences on forward-looking statements, guidance, or management's view of upcoming quarters",
  "watchPoints": ["what to monitor heading into next quarter 1", "watch point 2", "watch point 3"]
}

Rules:
- financialHighlights: extract specific numbers, percentages, or dollar figures mentioned in the text
- riskFactors: focus on risks that are NEW, ELEVATED, or given prominent placement in Item 1A
- mdaInsights: paraphrase management's own framing — don't editorialize
- outlook: identify any explicit guidance ranges, targets, or commentary on future quarters
- watchPoints: forward-looking, actionable items an analyst should track
- If the text is truncated or a section is missing, note uncertainty with "data incomplete"
- Keep all strings concise and professional`;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).end();

  const { ticker, entityName, formType, period, filingDate, sections, apiKey } = req.body || {};
  if (!ticker || !sections) return res.status(400).json({ error: "ticker and sections required" });

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

  // Build the user prompt from whatever sections we have (capped to prevent oversized payloads)
  const cap = s => (typeof s === "string" ? s.slice(0, MAX_SECTION_LEN) : "");
  const textParts = [];
  if (sections.riskFactors) textParts.push(`=== ITEM 1A — RISK FACTORS ===\n${cap(sections.riskFactors)}`);
  if (sections.mda)         textParts.push(`=== ITEM 7 / ITEM 2 — MD&A ===\n${cap(sections.mda)}`);
  if (sections.results)     textParts.push(`=== RESULTS OF OPERATIONS ===\n${cap(sections.results)}`);
  if (sections.fullText && !textParts.length) textParts.push(`=== FILING EXCERPT ===\n${cap(sections.fullText)}`);

  if (!textParts.length) {
    return res.status(400).json({ error: "No extractable text in this filing" });
  }

  const userPrompt = `Analyze the following SEC ${formType || "10-K/10-Q"} filing for ${entityName || ticker} (${ticker}).
Filing date: ${filingDate || "unknown"} | Period: ${period || "unknown"}

${textParts.join("\n\n")}

Generate a structured JSON analysis. Return the JSON object directly — no markdown, no preamble.`;

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
          max_tokens: 1000,
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
          max_tokens:      1000,
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

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(parsed);
  } catch (err) {
    console.error("sec-summary error:", err.message);
    res.status(500).json({ error: safeError(err) });
  }
}
