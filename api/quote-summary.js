import { setCors } from './_cors.js';
import { withCircuitBreaker } from './_circuitBreaker.js';

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
  if (!setCors(req, res)) return;

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
    const response = await withCircuitBreaker('yahoo-quote-summary', () => fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
    }));
    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    }
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.json(data);
  } catch (err) {
    console.error('quote-summary error:', err.message);
    if (err.circuitOpen) return res.status(503).json({ error: 'Yahoo Finance temporarily unavailable — try again shortly' });
    res.status(500).json({ error: 'Quote summary request failed' });
  }
}
