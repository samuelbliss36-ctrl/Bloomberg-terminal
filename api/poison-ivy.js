// Poison-ivy image classifier — accepts a base64 image, asks Claude vision
// for a structured verdict, and returns { verdict, confidence, reasoning }.
//
// No auth required (public tool). Per-IP rate limit via Vercel KV when configured.

import { setCors } from './_cors.js';
import { withCircuitBreaker } from './_circuitBreaker.js';
import { kvGet, kvSet } from './_kv.js';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB after base64 decode
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const IP_LIMIT_PER_HOUR = 20;

const SYSTEM_PROMPT = `You are a plant-identification assistant specialised in distinguishing poison ivy (Toxicodendron radicans), poison oak (Toxicodendron diversilobum / pubescens), and poison sumac (Toxicodendron vernix) from common look-alikes (Virginia creeper, box elder seedlings, fragrant sumac, blackberry, etc.).

You will be shown a single photograph. Respond with STRICT JSON only — no prose, no markdown, no code fences. Schema:

{
  "verdict": "poison_ivy" | "poison_oak" | "poison_sumac" | "likely_safe" | "uncertain" | "not_a_plant",
  "confidence": number between 0 and 1,
  "species_guess": short string (common name) or null,
  "reasoning": 2-4 sentences citing the visual features you used (leaf count, leaflet shape, edge serration, vine vs shrub, hairy stem, berry colour, leaf sheen, etc.),
  "key_features": array of 2-5 short strings describing the diagnostic features actually visible in this photo,
  "safety_note": one short sentence of practical advice for the user
}

Be conservative — if the photo is blurry, lacks diagnostic detail, or could plausibly be a look-alike, return "uncertain" with a moderate confidence. Never claim certainty you don't have. If the image clearly isn't a plant, return "not_a_plant".`;

function getIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

async function checkIpRateLimit(ip) {
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const key = `pi:rl:${ip}:${hour}`;
  const current = (await kvGet(key)) || 0;
  if (typeof current === 'number' && current >= IP_LIMIT_PER_HOUR) {
    return { allowed: false, current };
  }
  await kvSet(key, (typeof current === 'number' ? current : 0) + 1, 3700);
  return { allowed: true, current: current + 1 };
}

function parseModelJson(text) {
  if (!text) return null;
  const trimmed = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try { return JSON.parse(trimmed); } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

export default async function handler(req, res) {
  if (!setCors(req, res, { allowedMethods: 'POST, OPTIONS' })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) return res.status(503).json({ error: 'not_configured', message: 'ANTHROPIC_KEY is not set.' });

  const { image, mediaType } = req.body || {};
  if (typeof image !== 'string' || !image.length) {
    return res.status(400).json({ error: 'missing_image', message: 'Provide a base64-encoded image in the "image" field.' });
  }
  const mt = typeof mediaType === 'string' ? mediaType.toLowerCase() : 'image/jpeg';
  if (!ALLOWED_MEDIA_TYPES.has(mt)) {
    return res.status(400).json({ error: 'unsupported_media_type', message: 'Use JPEG, PNG, WEBP, or GIF.' });
  }

  // Rough byte estimate from base64 length: 3/4 of chars.
  const estBytes = Math.floor(image.length * 0.75);
  if (estBytes > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: 'image_too_large', message: 'Image exceeds 6 MB. Please resize.' });
  }

  const ip = getIp(req);
  const rl = await checkIpRateLimit(ip);
  if (!rl.allowed) {
    return res.status(429).json({ error: 'rate_limited', message: `Hourly limit reached (${IP_LIMIT_PER_HOUR}/hour per IP).` });
  }

  try {
    const r = await withCircuitBreaker('anthropic-poison-ivy', () =>
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mt, data: image } },
              { type: 'text', text: 'Identify this plant. Return only the JSON object described in the system prompt.' },
            ],
          }],
        }),
      })
    );

    const data = await r.json();
    if (data.error) {
      console.error('anthropic error:', data.error);
      return res.status(502).json({ error: 'upstream_error', message: 'Vision provider returned an error.' });
    }

    const raw = data.content?.[0]?.text || '';
    const parsed = parseModelJson(raw);
    if (!parsed || typeof parsed.verdict !== 'string') {
      return res.status(502).json({ error: 'parse_error', message: 'Could not parse model response.', raw });
    }

    res.json({
      verdict: parsed.verdict,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
      species_guess: parsed.species_guess || null,
      reasoning: parsed.reasoning || '',
      key_features: Array.isArray(parsed.key_features) ? parsed.key_features.slice(0, 6) : [],
      safety_note: parsed.safety_note || '',
    });
  } catch (err) {
    if (err.circuitOpen) return res.status(503).json({ error: 'upstream_degraded' });
    console.error('poison-ivy error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
}
