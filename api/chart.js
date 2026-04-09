export default async function handler(req, res) {
  const { ticker, range, interval } = req.query;
  try {
    const safeTicker = encodeURIComponent(ticker);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${safeTicker}?range=${range}&interval=${interval}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
    });
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
