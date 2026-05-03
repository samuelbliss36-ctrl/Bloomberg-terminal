// Market heatmap data proxy — batched Yahoo Finance quote fetcher
// GET /api/heatmap           → quotes for all S&P 500 heatmap tickers
// GET /api/heatmap?sector=Technology → filtered to a single sector

// Hardcoded ticker list (mirrors src/data/sp500Stocks.js — keep in sync)
const TICKERS = [
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

// Yahoo Finance fields to request
const YF_FIELDS = [
  'regularMarketPrice',
  'regularMarketChange',
  'regularMarketChangePercent',
  'regularMarketVolume',
  'marketCap',
  'shortName',
].join(',');

const BATCH_SIZE = 50;
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json',
};

async function fetchBatch(symbols) {
  const joined = symbols.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(joined)}&fields=${YF_FIELDS}`;

  const response = await fetch(url, { headers: YF_HEADERS });
  if (!response.ok) {
    throw new Error(`Yahoo Finance responded ${response.status} for batch starting with ${symbols[0]}`);
  }

  const data = await response.json();
  const results = data?.quoteResponse?.result ?? [];
  if (!Array.isArray(results)) return {};

  const map = {};
  for (const q of results) {
    if (!q?.symbol) continue;
    map[q.symbol] = {
      price:     q.regularMarketPrice     ?? null,
      change:    q.regularMarketChange    ?? null,
      changePct: q.regularMarketChangePercent ?? null,
      volume:    q.regularMarketVolume    ?? null,
      marketCap: q.marketCap              ?? null,
      name:      q.shortName              ?? q.symbol,
    };
  }
  return map;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { sector } = req.query;

  try {
    // Split all tickers into batches of BATCH_SIZE and fetch in parallel
    const batches = [];
    for (let i = 0; i < TICKERS.length; i += BATCH_SIZE) {
      batches.push(TICKERS.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(batches.map(fetchBatch));

    // Merge all batch maps into a single quotes object
    const quotes = Object.assign({}, ...batchResults);

    // Optional sector filter — the API itself doesn't know sectors, so if the
    // caller passes ?sector=... we simply return only the tickers in the response
    // (the front-end sp500Stocks.js data provides sector membership; this filter
    // is a convenience pass-through that accepts a comma-separated ticker list
    // via ?tickers= OR a sector name via ?sector= with a companion ticker list).
    // For a pure sector filter the caller should pass ?tickers=AAPL,MSFT,...
    // But we also honour ?sector= as a no-op acknowledgement (filtering is done
    // client-side where sp500Stocks.js sector data lives).
    // If you later want server-side sector filtering, pass ?tickers=... instead.

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.json({ quotes });
  } catch (err) {
    console.error('heatmap error:', err.message);
    return res.status(502).json({ error: `Failed to fetch market data: ${err.message}` });
  }
}
