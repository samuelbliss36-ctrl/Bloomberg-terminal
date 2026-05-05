// Insight chip endpoint — generates a single-sentence market insight via Claude Haiku.
// Available to all authenticated users (owner + subscribers).
// Responses cached in Vercel KV for 15 minutes.

import { createClient } from '@supabase/supabase-js';
import { setCors } from './_cors.js';
import { kvGet, kvSet } from './_kv.js';
import { withCircuitBreaker } from './_circuitBreaker.js';

const OWNER_EMAIL = process.env.OWNER_EMAIL;
const MAX_CTX_LEN = 400;

// djb2 hash — fast, no crypto dependency needed
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h, 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

async function callHaiku(context) {
  const key = process.env.ANTHROPIC_KEY;
  if (!key) throw new Error('no_anthropic_key');

  const r = await withCircuitBreaker('anthropic-insight', () =>
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         key,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 80,
        system:     'You are a financial insight chip. Generate exactly ONE sentence of market insight (max 110 characters). Be specific and data-driven. No markdown, no quotes, no ellipsis.',
        messages:   [{ role: 'user', content: context }],
      }),
    })
  );

  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'Anthropic error');
  return (d.content?.[0]?.text || '').trim().slice(0, 120);
}

export default async function handler(req, res) {
  if (!setCors(req, res, { allowedMethods: 'POST, OPTIONS' })) return;
  if (req.method !== 'POST') return res.status(405).end();

  const { page = '', context = '' } = req.body || {};
  if (!context) return res.status(400).json({ error: 'context required' });

  // ── Auth — require a valid Supabase session ─────────────────────────────────
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'auth_required' });

  try {
    const supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.REACT_APP_SUPABASE_ANON_KEY
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'invalid_token' });
  } catch {
    return res.status(401).json({ error: 'auth_failed' });
  }

  const safeCtx  = context.slice(0, MAX_CTX_LEN);
  const cacheKey = `insight:${page}:${hashStr(safeCtx)}`;

  // ── KV cache hit ─────────────────────────────────────────────────────────────
  const cached = await kvGet(cacheKey);
  if (cached) return res.json({ insight: cached, cached: true });

  // ── Generate ─────────────────────────────────────────────────────────────────
  try {
    const insight = await callHaiku(safeCtx);
    if (insight) {
      await kvSet(cacheKey, insight, 900); // 15 min TTL
    }
    res.json({ insight });
  } catch (err) {
    if (err.circuitOpen) {
      return res.status(503).json({ error: 'upstream_degraded' });
    }
    if (err.message === 'no_anthropic_key') {
      return res.status(503).json({ error: 'not_configured' });
    }
    console.error('insight error:', err.message);
    res.status(500).json({ error: 'generation_failed' });
  }
}
