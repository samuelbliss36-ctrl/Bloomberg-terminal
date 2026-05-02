// Server-side Finnhub proxy with Vercel edge caching
// All client Finnhub calls route through here in production so:
//   1. The API key never appears in the browser JS bundle
//   2. Vercel's edge cache is shared across ALL users — 100 users hitting
//      the same ticker share one Finnhub call per cache window instead of 100
//
// Usage: GET /api/finnhub?_q=/quote%3Fsymbol%3DAAPL
// The _q param is the full Finnhub path + query string, URL-encoded.

// Explicit allowlist of permitted Finnhub path prefixes — keeps the proxy narrow
const ALLOWED = [
  "/quote",
  "/stock/profile2",
  "/stock/metric",
  "/stock/peers",
  "/stock/recommendation",
  "/stock/earnings",
  "/stock/candle",
  "/stock/insider-transactions",
  "/stock/insider-sentiment",
  "/stock/ownership",
  "/company-news",
  "/calendar/earnings",
  "/news",
  "/search",
  "/forex/candle",
  "/forex/rates",
];

// Cache TTLs (seconds) per endpoint — prices short, stable data long
function cacheTTL(path) {
  if (path === "/quote")               return 60;    // 1 min  — live price
  if (path.startsWith("/stock/profile")) return 3600; // 1 hr   — company info
  if (path.startsWith("/search"))       return 3600; // 1 hr   — search results
  if (path.startsWith("/calendar/"))    return 1800; // 30 min — earnings dates
  if (path.startsWith("/news"))         return 180;  // 3 min  — news feed
  if (path.startsWith("/company-news")) return 300;  // 5 min  — company news
  return 300;                                        // 5 min  — everything else
}

export default async function handler(req, res) {
  // Accept either name — REACT_APP_FINNHUB_KEY is already in Vercel from initial setup
  const FINNHUB_KEY = process.env.FINNHUB_KEY || process.env.REACT_APP_FINNHUB_KEY;
  if (!FINNHUB_KEY) {
    return res.status(503).json({ error: "FINNHUB_KEY env var not set." });
  }

  const { _q } = req.query;
  if (!_q) return res.status(400).json({ error: "_q param required" });

  // Validate the path prefix before forwarding
  const pathOnly = _q.split("?")[0];
  if (!ALLOWED.some(prefix => pathOnly.startsWith(prefix))) {
    return res.status(403).json({ error: "Endpoint not permitted" });
  }

  try {
    const sep = _q.includes("?") ? "&" : "?";
    const url = `https://finnhub.io/api/v1${_q}${sep}token=${FINNHUB_KEY}`;

    const r = await fetch(url);
    if (!r.ok) {
      // 403 = endpoint not available on current plan — return null so callers
      // degrade gracefully instead of causing Promise.all to reject and wipe
      // out other successful responses in the same batch.
      if (r.status === 403) return res.status(200).json(null);
      return res.status(r.status).json({ error: `Finnhub returned ${r.status}` });
    }

    const data = await r.json();
    const ttl  = cacheTTL(pathOnly);

    res.setHeader("Access-Control-Allow-Origin", "*");
    // s-maxage = edge cache shared across all users
    // stale-while-revalidate = serve stale instantly while refreshing in background
    res.setHeader("Cache-Control", `s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
