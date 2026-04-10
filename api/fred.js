export default async function handler(req, res) {
  const { series } = req.query;
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=689308cbff8ffcec10a3d45d662e4574&sort_order=desc&limit=2&file_type=json`;
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
