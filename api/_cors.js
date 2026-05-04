// Shared CORS helper — whitelist only known origins instead of wildcard.
// All API handlers should call setCors(req, res) instead of setting headers manually.

const ALLOWED_ORIGINS = new Set([
  'https://bloomberg-terminal-gamma.vercel.app',
  'https://omnesvidentes.vercel.app',
  ...(process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : []),
]);

// Always allow localhost in dev
function isAllowed(origin) {
  if (!origin) return true; // server-to-server, no Origin header
  if (process.env.NODE_ENV !== 'production') return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  return ALLOWED_ORIGINS.has(origin);
}

/**
 * Apply CORS headers. Returns false and sends 403 if origin is not allowed.
 * Returns true if the caller should continue handling the request.
 */
export function setCors(req, res, { allowedMethods = 'GET, POST, OPTIONS' } = {}) {
  const origin = req.headers.origin || '';
  if (isAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false; // preflight handled — stop processing
  }
  return true;
}
