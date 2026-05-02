import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL  || "";
const key = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

// Custom storage adapter — routes auth tokens to sessionStorage when the user
// chose "don't remember me", otherwise uses localStorage (default).
// sessionStorage is wiped when the tab/window closes, protecting shared computers.
const LS_NO_PERSIST = 'ov_auth_session_only';

const authStorage = {
  getItem(k) {
    const noP = sessionStorage.getItem(LS_NO_PERSIST) === '1';
    return noP ? sessionStorage.getItem(k) : localStorage.getItem(k);
  },
  setItem(k, v) {
    const noP = sessionStorage.getItem(LS_NO_PERSIST) === '1';
    if (noP) {
      sessionStorage.setItem(k, v);
      localStorage.removeItem(k);     // keep localStorage clean
    } else {
      localStorage.setItem(k, v);
    }
  },
  removeItem(k) {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  },
};

export const supabase = url && key
  ? createClient(url, key, { auth: { storage: authStorage, autoRefreshToken: true, persistSession: true } })
  : null;

export const isConfigured = Boolean(url && key);

// Called from the sign-in form before signInWithPassword.
// 'remember' = true  → tokens in localStorage (auto sign-in on next visit)
// 'remember' = false → tokens in sessionStorage (gone when tab closes)
export function setRememberMe(remember) {
  if (remember) {
    sessionStorage.removeItem(LS_NO_PERSIST);
  } else {
    sessionStorage.setItem(LS_NO_PERSIST, '1');
  }
}
