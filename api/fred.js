export default async function handler(req, res) {
  const FRED_KEY = process.env.FRED_KEY;
  if (!FRED_KEY) {
    return res.status(503).json({ error: "FRED_KEY env var not set." });
  }

  const { series } = req.query;
  if (!series) {
    return res.status(400).json({ error: "series query param required" });
  }

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${FRED_KEY}&sort_order=desc&limit=2&file_type=json`;
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
