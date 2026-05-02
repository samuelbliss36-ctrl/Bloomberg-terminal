const VALID_RANGES    = new Set(["1d","5d","1mo","3mo","6mo","1y","2y","5y","10y","ytd","max"]);
const VALID_INTERVALS = new Set(["1m","2m","5m","15m","30m","60m","90m","1h","1d","5d","1wk","1mo","3mo"]);

export default async function handler(req, res) {
  const { ticker, range, interval } = req.query;

  if (!ticker || typeof ticker !== "string") {
    return res.status(400).json({ error: "ticker required" });
  }
  if (!VALID_RANGES.has(range)) {
    return res.status(400).json({ error: `Invalid range. Allowed: ${[...VALID_RANGES].join(", ")}` });
  }
  if (!VALID_INTERVALS.has(interval)) {
    return res.status(400).json({ error: `Invalid interval. Allowed: ${[...VALID_INTERVALS].join(", ")}` });
  }

  try {
    const safeTicker = encodeURIComponent(ticker);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${safeTicker}?range=${range}&interval=${interval}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Upstream chart data unavailable" });
    }

    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.json(data);
  } catch (err) {
    console.error("chart error:", err.message);
    res.status(500).json({ error: "Chart data request failed" });
  }
}
