// SEC EDGAR API proxy — no API key required
// Two modes:
//   GET /api/sec?mode=filings&ticker=AAPL
//     → { cik, entityName, filings: [{ form, date, period, accession, primaryDoc, url }] }
//   GET /api/sec?mode=extract&cik=320193&accession=0000320193-24-000123&doc=aapl20240928.htm
//     → { riskFactors, mda, fullText, truncated }

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

async function handleExtract(cik, accession, doc, res) {
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
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "GET") return res.status(405).end();

  const { mode, ticker, cik, accession, doc } = req.query || {};

  try {
    if (mode === "filings") {
      if (!ticker) return res.status(400).json({ error: "ticker required" });
      await handleFilings(ticker, res);
    } else if (mode === "extract") {
      if (!cik || !accession || !doc) return res.status(400).json({ error: "cik, accession, doc required" });
      await handleExtract(cik, accession, doc, res);
    } else {
      res.status(400).json({ error: "mode must be 'filings' or 'extract'" });
    }
  } catch (err) {
    console.error("sec error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
