// Yahoo Finance proxy — handles both chart data and heatmap batch quotes
// GET /api/chart?ticker=AAPL&range=1y&interval=1d  → candle chart data
// GET /api/chart?type=heatmap                       → S&P 500 batch quotes

import { setCors } from './_cors.js';

const VALID_RANGES    = new Set(["1d","5d","1mo","3mo","6mo","1y","2y","5y","10y","ytd","max"]);
const VALID_INTERVALS = new Set(["1m","2m","5m","15m","30m","60m","90m","1h","1d","5d","1wk","1mo","3mo"]);

// ── Heatmap batch-quote logic ─────────────────────────────────────────────────
const HEATMAP_TICKERS = [
  // Technology
  'AAPL','MSFT','NVDA','AVGO','AMD','ADBE','TXN','QCOM','INTC','INTU',
  'CRM','CSCO','ANET','LRCX','KLAC','ADI','SNPS','CDNS','MCHP','PANW',
  'FTNT','ACN','IBM','ADP','MU',
  // Healthcare
  'UNH','JNJ','MRK','LLY','ABBV','TMO','ABT','PEP','MDT','ISRG',
  'SYK','VRTX','REGN','AMGN','GILD','BIIB','DXCM','EW','IDXX','MRNA',
  'ELV','HUM','CVS','HCA','DHR','ZTS','CI','STE',
  // Financials
  'JPM','V','MA','BAC','WFC','GS','MS','AXP','BLK','C',
  'SCHW','CME','AON','MCO','ICE','AFL','USB','CB','PGR','FISV',
  'BRK.B','MMC','PYPL',
  // Consumer Discretionary
  'AMZN','TSLA','MCD','HD','NKE','SBUX','BKNG','TJX','ORLY',
  // Communication
  'GOOGL','META','NFLX','T','TMUS','VRSN',
  // Industrials
  'HON','CAT','RTX','DE','UPS','MMM','NSC','CSX','GE','CTAS',
  'ETN','ROP','CARR','GD','NOC','LMT','BA','TDG','FDX','ITW',
  // Consumer Staples
  'WMT','PG','COST','PM','KO','MO','MDLZ','DG','MNST',
  // Energy
  'XOM','CVX','SLB',
  // Materials
  'LIN','SHW',
  // Utilities
  'NEE','DUK','SO',
  // Real Estate
  'PLD','AMT','CCI','WELL','SPG','PSA','WM',
];

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

// Use the spark endpoint — v7/quote requires auth now, spark is open
async function fetchHeatmapBatch(symbols) {
  const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbols.join(','))}&range=1d&interval=1d`;
  const r = await fetch(url, { headers: YF_HEADERS });
  if (!r.ok) throw new Error(`Yahoo Finance spark ${r.status}`);
  const data = await r.json();
  const results = data?.spark?.result ?? [];
  const map = {};
  for (const item of results) {
    if (!item?.symbol) continue;
    const meta = item.response?.[0]?.meta;
    if (!meta) continue;
    const price = meta.regularMarketPrice ?? null;
    const prev  = meta.chartPreviousClose ?? null;
    const change    = price != null && prev != null ? price - prev : null;
    const changePct = price != null && prev != null && prev !== 0
      ? ((price - prev) / prev) * 100 : null;
    map[item.symbol] = {
      price,
      change,
      changePct,
      volume:    meta.regularMarketVolume ?? null,
      marketCap: null, // not in spark — front-end uses static marketCap for sizing
      name:      meta.shortName ?? meta.longName ?? item.symbol,
    };
  }
  return map;
}

async function handleHeatmap(res) {
  const BATCH = 20; // spark endpoint max is 20 symbols per request
  const batches = [];
  for (let i = 0; i < HEATMAP_TICKERS.length; i += BATCH) {
    batches.push(HEATMAP_TICKERS.slice(i, i + BATCH));
  }
  const results = await Promise.all(batches.map(fetchHeatmapBatch));
  const quotes = Object.assign({}, ...results);
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  return res.json({ quotes });
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!setCors(req, res)) return;

  const { type, ticker, range, interval } = req.query;

  // ── Branch: heatmap batch quotes ──
  if (type === 'heatmap') {
    try {
      return await handleHeatmap(res);
    } catch (err) {
      console.error('heatmap error:', err.message);
      return res.status(502).json({ error: 'Failed to fetch market data' });
    }
  }

  // ── Branch: day gainers / losers (Yahoo Finance spark) ──
  if (type === 'gainers' || type === 'losers') {
    try {
      // Reuse the heatmap universe — fetch all quotes, sort by % change
      const BATCH = 20;
      const batches = [];
      for (let i = 0; i < HEATMAP_TICKERS.length; i += BATCH) {
        batches.push(HEATMAP_TICKERS.slice(i, i + BATCH));
      }
      const results = await Promise.all(batches.map(fetchHeatmapBatch));
      const allQuotes = Object.assign({}, ...results);

      const sorted = Object.entries(allQuotes)
        .filter(([, q]) => q.changePct != null && q.price != null)
        .map(([symbol, q]) => ({
          symbol,
          name:      q.name,
          price:     q.price,
          change:    q.change,
          changePct: q.changePct,
        }))
        .sort((a, b) => type === 'gainers'
          ? b.changePct - a.changePct
          : a.changePct - b.changePct
        )
        .slice(0, 10);

      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
      return res.json({ data: sorted });
    } catch (err) {
      console.error('movers error:', err.message);
      return res.status(502).json({ error: 'Failed to fetch movers' });
    }
  }

  // ── Branch: standard chart data ──
  if (!ticker || typeof ticker !== 'string') {
    return res.status(400).json({ error: 'ticker required' });
  }
  if (!VALID_RANGES.has(range)) {
    return res.status(400).json({ error: `Invalid range. Allowed: ${[...VALID_RANGES].join(', ')}` });
  }
  if (!VALID_INTERVALS.has(interval)) {
    return res.status(400).json({ error: `Invalid interval. Allowed: ${[...VALID_INTERVALS].join(', ')}` });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
    const response = await fetch(url, { headers: YF_HEADERS });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Upstream chart data unavailable' });
    }
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.json(data);
  } catch (err) {
    console.error('chart error:', err.message);
    res.status(500).json({ error: 'Chart data request failed' });
  }
}
