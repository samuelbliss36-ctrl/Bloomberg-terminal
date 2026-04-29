// Financial Modeling Prep stock screener proxy
// Env var: FMP_KEY  (get a free key at https://financialmodelingprep.com/developer/docs)
// Free tier: 250 requests/day — Vercel 4-hour edge cache keeps usage minimal

export default async function handler(req, res) {
  const FMP_KEY = process.env.FMP_KEY;
  if (!FMP_KEY) {
    return res.status(503).json({ error: "FMP_KEY env var not set. Add it in Vercel dashboard or .env.local." });
  }

  try {
    // Fetch up to 1500 actively-traded US equities (non-ETF, non-fund)
    const url =
      `https://financialmodelingprep.com/api/v3/stock-screener` +
      `?country=US&isEtf=false&isFund=false&isActivelyTrading=true` +
      `&limit=1500&apikey=${FMP_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: `FMP returned ${response.status}` });
    }

    const data = await response.json();
    if (data?.["Error Message"]) {
      return res.status(401).json({ error: data["Error Message"] });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    // 4-hour edge cache — fundamental data doesn't change intraday
    res.setHeader("Cache-Control", "s-maxage=14400, stale-while-revalidate=28800");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
