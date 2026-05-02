import { supabase } from './supabase';

export const OWNER_EMAIL = 'samuelbliss36@gmail.com';

export function isOwner(user) {
  return user?.email === OWNER_EMAIL;
}

export async function getSubscription() {
  if (!supabase) return null;
  const { data } = await supabase.from('subscriptions').select('*').single();
  return data;
}

export async function startCheckout() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not signed in');
  const r = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  if (d.url) window.location.href = d.url;
  else throw new Error(d.error || 'Checkout failed');
}

export async function openPortal() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not signed in');
  const r = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  if (d.url) window.location.href = d.url;
  else throw new Error(d.error || 'Portal failed');
}
