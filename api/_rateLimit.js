// Shared AI rate-limiting helper
// Called before and after every server-key AI request.
// Owner is always exempt. User-supplied-key users are exempt (their cost).
// Subscribers get 500,000 tokens/month across all AI features combined.

import { createClient } from '@supabase/supabase-js';

const OWNER_EMAIL  = 'samuelbliss36@gmail.com';
export const TOKEN_LIMIT = 500_000; // per user per calendar month

function getMonth() {
  // e.g. "2026-05" — resets automatically on the 1st of each month
  return new Date().toISOString().slice(0, 7);
}

function adminClient() {
  return createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Check whether a user is within their monthly token budget.
 * Returns { allowed, tokens, remaining, limit }
 * Owner always gets { allowed: true }.
 */
export async function checkRateLimit(userId, userEmail) {
  if (userEmail === OWNER_EMAIL) {
    return { allowed: true, tokens: 0, remaining: TOKEN_LIMIT, limit: TOKEN_LIMIT };
  }

  const supabase = adminClient();
  const month    = getMonth();

  const { data } = await supabase
    .from('ai_usage')
    .select('tokens')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  const tokens    = data?.tokens || 0;
  const remaining = Math.max(0, TOKEN_LIMIT - tokens);

  return { allowed: tokens < TOKEN_LIMIT, tokens, remaining, limit: TOKEN_LIMIT };
}

/**
 * Atomically add tokensUsed to this user's monthly bucket.
 * No-ops for owner and zero-token calls.
 */
export async function incrementUsage(userId, userEmail, tokensUsed) {
  if (userEmail === OWNER_EMAIL || !tokensUsed || tokensUsed <= 0) return;

  const supabase = adminClient();
  await supabase.rpc('increment_ai_usage', {
    p_user_id: userId,
    p_month:   getMonth(),
    p_tokens:  tokensUsed,
  });
}

/**
 * Standard 429 response body for rate-limited requests.
 */
export function rateLimitedResponse(remaining, limit) {
  return {
    error:   'rate_limit_exceeded',
    message: `You've used your monthly AI token budget (${limit.toLocaleString()} tokens). Resets on the 1st of next month.`,
    tokens_remaining: remaining,
    limit,
  };
}
