// Financial Modeling Prep stock screener proxy
// Env var: FMP_KEY  (free at https://financialmodelingprep.com/developer/docs)
// Uses /stable/company-screener (v3 endpoint is legacy/deprecated)
// 12-hour Vercel edge cache → ~2 FMP API calls/day, well within free-plan 250/day limit
//
// Returns: ~78 large-cap US equities with live price, marketCap, sector, beta,
// volume, changePct, divYield. Fundamentals (P/E, margins, ROE, etc.) are merged
// client-side from SCREENER_UNIVERSE which already has hand-tuned values for the
// top 70 stocks (most of which overlap with this universe).

export default async function handler(req, res) {
  const FMP_KEY = process.env.FMP_KEY;
  if (!FMP_KEY) {
    return res.status(503).json({ error: "FMP_KEY env var not set. Add it in Vercel → Settings → Environment Variables." });
  }

  try {
    const url =
      `https://financialmodelingprep.com/stable/company-screener` +
      `?isEtf=false&isFund=false&isActivelyTrading=true&limit=500&apikey=${FMP_KEY}`;

    const response = await fetch(url);
    const text = await response.text();

    // Catch "Premium" paywall responses (FMP returns plain text, not JSON, for plan errors)
    if (!response.ok || text.startsWith("Premium")) {
      return res.status(402).json({ error: "FMP plan limit reached or endpoint requires upgrade." });
    }

    const data = JSON.parse(text);
    if (!Array.isArray(data)) return res.status(200).json([]);

    // Normalise to the schema expected by the client-side merge in App.js
    const normalised = data.map(s => ({
      symbol:             s.symbol,
      companyName:        s.companyName  || s.symbol,
      sector:             s.sector       || null,
      price:              s.price        ?? null,
      changePercentage:   s.changePercentage ?? null,
      marketCap:          s.marketCap    ?? null,   // raw dollars — client divides by 1e9
      beta:               s.beta         ?? null,
      volume:             s.volume       ?? null,   // raw shares — client divides by 1e6
      lastAnnualDividend: s.lastAnnualDividend ?? 0,
    }));

    res.setHeader("Access-Control-Allow-Origin", "*");
    // 12-hour edge cache — fundamental screener data doesn't change intraday
    res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate=86400");
    res.json(normalised);
  } catch (err) {
    console.error("screener error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
