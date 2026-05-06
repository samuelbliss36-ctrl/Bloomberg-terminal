// Shared auth helper — extracts and verifies the user from the Authorization header,
// checks owner status and active subscription, returns a standardised auth object.
//
// Usage:
//   const auth = await getAuth(req);
//   // auth = { user, isOwner, serverKeyAllowed }

import { createClient } from '@supabase/supabase-js';

const OWNER_EMAIL = process.env.OWNER_EMAIL;

export async function getAuth(req) {
  const result = { user: null, isOwner: false, serverKeyAllowed: false };

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return result;

  try {
    const supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.REACT_APP_SUPABASE_ANON_KEY
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return result;

    result.user = user;

    if (user.email === OWNER_EMAIL) {
      result.isOwner = true;
      result.serverKeyAllowed = true;
      return result;
    }

    // Check subscription
    const admin = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: sub } = await admin
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .single();

    if (sub?.status === 'active') {
      result.serverKeyAllowed = true;
    }
  } catch {}

  return result;
}
