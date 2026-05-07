// Vercel KV (Upstash Redis) cache helper — no-ops gracefully if not configured.
// Set KV_REST_API_URL + KV_REST_API_TOKEN in Vercel → Settings → Environment Variables.

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function pipeline(commands) {
  if (!KV_URL || !KV_TOKEN) return commands.map(() => null);
  try {
    const r = await fetch(`${KV_URL}/pipeline`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(commands),
    });
    const data = await r.json();
    return Array.isArray(data) ? data.map(d => d.result) : commands.map(() => null);
  } catch (err) {
    console.error('KV pipeline error:', err.message);
    return commands.map(() => null);
  }
}

export async function kvGet(key) {
  const [result] = await pipeline([['GET', key]]);
  if (result == null) return null;
  try { return JSON.parse(result); } catch { return result; }
}

export async function kvSet(key, value, ttlSeconds) {
  await pipeline([['SET', key, JSON.stringify(value), 'EX', ttlSeconds]]);
}
