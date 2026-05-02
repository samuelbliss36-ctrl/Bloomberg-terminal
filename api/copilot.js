// AI Copilot proxy — supports OpenAI (gpt-4o-mini) and Anthropic (claude-haiku-4-5)
// Priority: OPENAI_KEY env var → ANTHROPIC_KEY env var → user-supplied key in request body
// User-supplied keys let each visitor bring their own credentials without server config.

const OPENAI_KEY_RE   = /^sk-[A-Za-z0-9\-_]{20,}$/;
const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;

// Maximum messages to forward — prevents unbounded token spend on long sessions
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

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") return res.status(405).end();

  const { messages, context, apiKey } = req.body || {};
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "messages array required" });

  // Key resolution: env vars first, then user-supplied
  const rawKey = process.env.OPENAI_KEY || process.env.ANTHROPIC_KEY || apiKey;
  if (!rawKey) {
    return res.status(401).json({
      error: "no_key",
      message: "No API key configured. Enter your OpenAI or Anthropic key in the copilot settings panel.",
    });
  }

  // Validate key format to prevent using arbitrary strings as credentials
  const isAnthropic = rawKey.startsWith("sk-ant");
  if (!(isAnthropic ? ANTHROPIC_KEY_RE : OPENAI_KEY_RE).test(rawKey)) {
    return res.status(401).json({ error: "Invalid API key format." });
  }

  // Truncate to last MAX_MESSAGES turns and limit context length
  const safeMessages = messages.slice(-MAX_MESSAGES).map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: typeof m.content === "string" ? m.content.slice(0, 4000) : "",
  }));
  const safeContext = typeof context === "string" ? context.slice(0, MAX_CONTEXT_LEN) : "No terminal context provided.";

  const systemPrompt = buildSystemPrompt(safeContext);

  try {
    let assistantText;

    if (isAnthropic) {
      // ── Anthropic Messages API ─────────────────────────────────────────────
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key":          rawKey,
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
      assistantText = d.content?.[0]?.text || "(no response)";
    } else {
      // ── OpenAI Chat Completions API ────────────────────────────────────────
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + rawKey,
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
      assistantText = d.choices?.[0]?.message?.content || "(no response)";
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ message: assistantText, provider: isAnthropic ? "anthropic" : "openai" });
  } catch (err) {
    console.error("copilot error:", err.message);
    res.status(500).json({ error: safeError(err) });
  }
}
