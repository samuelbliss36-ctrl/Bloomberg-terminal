// SEC EDGAR API proxy — no API key required
// Modes:
//   GET  /api/sec?mode=filings&ticker=AAPL
//     → { cik, entityName, filings: [...] }
//   GET  /api/sec?mode=extract&cik=320193&accession=...&doc=...
//     → { riskFactors, mda, fullText, truncated }
//   POST /api/sec?mode=summarize   body: { ticker, entityName, formType, period, filingDate, sections, apiKey }
//     → { headline, financialHighlights, riskFactors, mdaInsights, outlook, watchPoints }

// ── SEC Summary (AI) constants ────────────────────────────────────────────────
const OPENAI_KEY_RE    = /^sk-[A-Za-z0-9\-_]{20,}$/;
const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;
const MAX_SECTION_LEN  = 6_000;

function safeAiError(err) {
  const msg = err?.message || "";
  if (msg.includes("rate limit") || msg.includes("Rate limit")) return "AI provider rate limit reached — try again shortly.";
  if (msg.includes("invalid_api_key") || msg.includes("Incorrect API key")) return "Invalid API key.";
  if (msg.includes("insufficient_quota")) return "API quota exceeded on the configured key.";
  return "AI request failed. Check your API key and try again.";
}

const SEC_SUMMARY_SYSTEM = `You are a senior equity research analyst specializing in SEC filing analysis. You have just read the relevant sections of a public company's SEC filing (10-K or 10-Q).

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

async function handleSummarize(req, res) {
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

  const cap = s => (typeof s === "string" ? s.slice(0, MAX_SECTION_LEN) : "");
  const textParts = [];
  if (sections.riskFactors) textParts.push(`=== ITEM 1A — RISK FACTORS ===\n${cap(sections.riskFactors)}`);
  if (sections.mda)         textParts.push(`=== ITEM 7 / ITEM 2 — MD&A ===\n${cap(sections.mda)}`);
  if (sections.results)     textParts.push(`=== RESULTS OF OPERATIONS ===\n${cap(sections.results)}`);
  if (sections.fullText && !textParts.length) textParts.push(`=== FILING EXCERPT ===\n${cap(sections.fullText)}`);

  if (!textParts.length) return res.status(400).json({ error: "No extractable text in this filing" });

  const userPrompt = `Analyze the following SEC ${formType || "10-K/10-Q"} filing for ${entityName || ticker} (${ticker}).
Filing date: ${filingDate || "unknown"} | Period: ${period || "unknown"}

${textParts.join("\n\n")}

Generate a structured JSON analysis. Return the JSON object directly — no markdown, no preamble.`;

  try {
    let text;
    if (isAnthropic) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, system: SEC_SUMMARY_SYSTEM, messages: [{ role: "user", content: userPrompt }] }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
      text = d.content?.[0]?.text || "";
    } else {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1000, response_format: { type: "json_object" }, messages: [{ role: "system", content: SEC_SUMMARY_SYSTEM }, { role: "user", content: userPrompt }] }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
      text = d.choices?.[0]?.message?.content || "";
    }

    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { const m = clean.match(/\{[\s\S]*\}/); if (!m) throw new Error("AI returned non-JSON response"); parsed = JSON.parse(m[0]); }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(parsed);
  } catch (err) {
    console.error("sec summarize error:", err.message);
    res.status(500).json({ error: safeAiError(err) });
  }
}

const UA = "Omnes-Videntes/1.0 (Bloomberg-style terminal; contact: admin@omnesvidentes.app)";

// Module-level ticker→CIK cache (persists across warm Vercel invocations)
let tickerMap = null;
let tickerMapTs = 0;

async function getTickerMap() {
  if (tickerMap && Date.now() - tickerMapTs < 86_400_000) return tickerMap;
  const r = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": UA },
  });
  if (!r.ok) throw new Error("EDGAR ticker map unavailable");
  tickerMap = await r.json();
  tickerMapTs = Date.now();
  return tickerMap;
}

async function getCIK(ticker) {
  const map = await getTickerMap();
  const upper = ticker.toUpperCase();
  const entry = Object.values(map).find(e => e.ticker === upper);
  if (!entry) throw new Error(`Ticker "${ticker}" not found in SEC EDGAR`);
  return { cik: entry.cik_str, entityName: entry.title };
}

/** Strip HTML tags and decode common entities — leaves readable prose. */
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Extract a named section from plain text.
 * Tries to find "Item N.? SECTION TITLE" and capture up to maxLen characters
 * until the next numbered Item heading.
 */
function extractSection(text, itemRegex, maxLen = 5000) {
  const match = text.match(itemRegex);
  if (!match) return null;
  const start = match.index + match[0].length;
  const slice = text.slice(start, start + maxLen * 2);
  // Stop at the next "Item N" heading
  const nextItem = slice.search(/\bitem\s+\d+[a-z]?\b/i);
  const raw = nextItem > 200 ? slice.slice(0, nextItem) : slice.slice(0, maxLen);
  return raw.trim().slice(0, maxLen);
}

async function handleFilings(ticker, res) {
  const { cik, entityName } = await getCIK(ticker);
  const cikPadded = String(cik).padStart(10, "0");

  const subRes = await fetch(`https://data.sec.gov/submissions/CIK${cikPadded}.json`, {
    headers: { "User-Agent": UA },
  });
  if (!subRes.ok) throw new Error("EDGAR submissions endpoint error");
  const sub = await subRes.json();

  const recent = sub.filings?.recent || {};
  const forms      = recent.form            || [];
  const dates      = recent.filingDate      || [];
  const periods    = recent.reportDate      || [];
  const accessions = recent.accessionNumber || [];
  const primaryDocs= recent.primaryDocument || [];

  const filings = [];
  for (let i = 0; i < forms.length && filings.length < 10; i++) {
    if (forms[i] === "10-K" || forms[i] === "10-Q") {
      const acc = accessions[i];
      const accNoDash = acc.replace(/-/g, "");
      filings.push({
        form:       forms[i],
        date:       dates[i],
        period:     periods[i],
        accession:  acc,
        primaryDoc: primaryDocs[i],
        indexUrl:   `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoDash}/${acc}-index.htm`,
        docUrl:     primaryDocs[i]
          ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoDash}/${primaryDocs[i]}`
          : null,
      });
    }
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600");
  res.json({ cik, entityName, filings });
}

// Strict format validators — prevent path traversal / SSRF into unexpected EDGAR paths
const CIK_RE        = /^\d{1,10}$/;
const ACCESSION_RE  = /^\d{10}-\d{2}-\d{6}$/;
const DOC_RE        = /^[a-zA-Z0-9._-]{1,120}$/;

async function handleExtract(cik, accession, doc, res) {
  if (!CIK_RE.test(cik))            return res.status(400).json({ error: "Invalid CIK format." });
  if (!ACCESSION_RE.test(accession)) return res.status(400).json({ error: "Invalid accession format." });
  if (!DOC_RE.test(doc))             return res.status(400).json({ error: "Invalid document filename." });

  const acc = accession.replace(/-/g, "");
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/${doc}`;

  // Fetch first 500 KB — enough for Risk Factors and the start of MD&A in most filings
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Range": "bytes=0-512000",
    },
  });
  if (!r.ok && r.status !== 206) throw new Error(`EDGAR document fetch failed: ${r.status}`);
  const html = await r.text();
  const text = stripHtml(html);

  // ── Risk Factors (Item 1A) ─────────────────────────────────────────────────
  const riskFactors = extractSection(
    text,
    /item\s+1a\.?\s*\.?\s*risk\s+factors/i,
    4500
  );

  // ── MD&A (Item 7 for 10-K, Item 2 for 10-Q) ────────────────────────────────
  const mda = extractSection(
    text,
    /item\s+(?:7|2)\.?\s*\.?\s*management[''s]*\s+discussion/i,
    4500
  );

  // ── Results of Operations (often inside MD&A, useful for 10-Q) ─────────────
  const results = extractSection(
    text,
    /results\s+of\s+operations/i,
    3000
  );

  // Fallback: if no structured sections found, send the first clean chunk
  const fullText = text.slice(0, 5000);
  const truncated = r.status === 206 || html.length >= 510000;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=86400");
  res.json({
    riskFactors,
    mda,
    results,
    fullText: (riskFactors || mda) ? null : fullText,
    truncated,
    charsFetched: html.length,
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  const { mode, ticker, cik, accession, doc } = req.query || {};

  // POST mode=summarize — AI filing analysis
  if (req.method === "POST" && mode === "summarize") {
    return handleSummarize(req, res);
  }

  if (req.method !== "GET") return res.status(405).end();

  try {
    if (mode === "filings") {
      if (!ticker) return res.status(400).json({ error: "ticker required" });
      await handleFilings(ticker, res);
    } else if (mode === "extract") {
      if (!cik || !accession || !doc) return res.status(400).json({ error: "cik, accession, doc required" });
      await handleExtract(cik, accession, doc, res);
    } else {
      res.status(400).json({ error: "mode must be 'filings', 'extract', or 'summarize'" });
    }
  } catch (err) {
    console.error("sec error:", err.message);
    res.status(500).json({ error: "SEC filing request failed" });
  }
}
