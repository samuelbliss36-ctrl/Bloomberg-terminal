// Client-side key used only in local development (npm start).
// In production all Finnhub calls go through /api/finnhub so the key
// never appears in the browser JS bundle.
export const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_KEY;
export const IS_DEV      = process.env.NODE_ENV === "development";

if (IS_DEV && !FINNHUB_KEY) {
  console.error(
    "[Bloomberg Terminal] REACT_APP_FINNHUB_KEY is not set.\n" +
    "Add it to your .env file for local development.\n" +
    "Get a free key at https://finnhub.io"
  );
}

// In-memory client cache — deduplicate rapid repeated calls (60 s TTL)
export const _apiCache = new Map();
export const api = (path) => {
  // Dev: call Finnhub directly (no /api/ routes on CRA dev server)
  // Prod: route through /api/finnhub — Vercel edge cache shared across all users
  if (IS_DEV) {
    if (!FINNHUB_KEY) return Promise.reject(new Error("Finnhub API key not configured."));
    const hit = _apiCache.get(path);
    if (hit && Date.now() - hit.ts < 60_000) return Promise.resolve(hit.data);
    return fetch(`https://finnhub.io/api/v1${path}&token=${FINNHUB_KEY}`)
      .then(r => { if (!r.ok) throw new Error(`Finnhub ${r.status}: ${path}`); return r.json(); })
      .then(data => { _apiCache.set(path, { data, ts: Date.now() }); return data; });
  }

  // Production path — proxy with edge caching
  const hit = _apiCache.get(path);
  if (hit && Date.now() - hit.ts < 60_000) return Promise.resolve(hit.data);
  return fetch(`/api/finnhub?_q=${encodeURIComponent(path)}`)
    .then(r => { if (!r.ok) throw new Error(`Finnhub proxy ${r.status}: ${path}`); return r.json(); })
    .then(data => { _apiCache.set(path, { data, ts: Date.now() }); return data; });
};

// Chart data cache — 5 min TTL (OHLCV data doesn't change rapidly)
export const _chartCache = new Map();
export const fetchChart = (ticker, range, interval) => {
  const key = ticker + "|" + range + "|" + interval;
  const hit = _chartCache.get(key);
  if (hit && Date.now() - hit.ts < 300_000) return Promise.resolve(hit.data);
  return fetch("/api/chart?ticker=" + encodeURIComponent(ticker) + "&range=" + range + "&interval=" + interval)
    .then(r => r.json())
    .then(data => { _chartCache.set(key, { data, ts: Date.now() }); return data; });
};
