export default async function handler(req, res) {
  const { ticker, date } = req.query;
  if (!ticker) return res.status(400).json({ error: "ticker required" });

  try {
    const safe = encodeURIComponent(ticker.toUpperCase());
    const dateParam = date ? `&date=${date}` : "";
    const url = `https://query2.finance.yahoo.com/v7/finance/options/${safe}?corsDomain=finance.yahoo.com${dateParam}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Yahoo Finance returned ${response.status}` });
    }

    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Cache 5 minutes — options prices update frequently during market hours
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
