// FRED series IDs are all-caps alphanumeric (e.g. FEDFUNDS, CPIAUCSL, T10YIE)
const SERIES_RE = /^[A-Z0-9]{1,30}$/;

export default async function handler(req, res) {
  const FRED_KEY = process.env.FRED_KEY;
  if (!FRED_KEY) {
    return res.status(503).json({ error: "FRED_KEY env var not set." });
  }

  const { series } = req.query;
  if (!series || !SERIES_RE.test(series)) {
    return res.status(400).json({ error: "Invalid series ID format." });
  }

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${FRED_KEY}&sort_order=desc&limit=2&file_type=json`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({ error: "FRED data unavailable" });
    }

    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
    res.json(data);
  } catch (err) {
    console.error("fred error:", err.message);
    res.status(500).json({ error: "Economic data request failed" });
  }
}
