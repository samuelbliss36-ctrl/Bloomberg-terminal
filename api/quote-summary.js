const ALLOWED_MODULES = new Set([
  'defaultKeyStatistics', 'financialData', 'summaryProfile', 'summaryDetail',
  'balanceSheetHistory', 'balanceSheetHistoryQuarterly',
  'incomeStatementHistory', 'incomeStatementHistoryQuarterly',
  'cashflowStatementHistory', 'cashflowStatementHistoryQuarterly',
  'earningsTrend', 'earningsHistory', 'recommendationTrend',
  'upgradeDowngradeHistory', 'insiderHolders', 'institutionOwnership',
  'calendarEvents', 'price',
]);

export default async function handler(req, res) {
  const { ticker, modules = "defaultKeyStatistics" } = req.query;

  if (!ticker || typeof ticker !== 'string') {
    return res.status(400).json({ error: 'ticker required' });
  }
  if (!/^[A-Z0-9.^=-]{1,10}$/i.test(ticker)) {
    return res.status(400).json({ error: 'Invalid ticker' });
  }

  // Allowlist every module — never inject raw user input into URLs
  const safeModules = String(modules)
    .split(',')
    .map(m => m.trim())
    .filter(m => ALLOWED_MODULES.has(m))
    .join(',') || 'defaultKeyStatistics';

  try {
    const safeTicker = encodeURIComponent(ticker);
    const url = `https://query1.finance.yahoo.com/v8/finance/quoteSummary/${safeTicker}?modules=${safeModules}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
    });
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.json(data);
  } catch (err) {
    console.error('quote-summary error:', err.message);
    res.status(500).json({ error: 'Quote summary request failed' });
  }
}
