import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const OWNER_EMAIL = 'samuelbliss36@gmail.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.email === OWNER_EMAIL) return res.status(400).json({ error: 'Owner has unlimited access' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = req.headers.origin || 'https://bloomberg-terminal-gamma.vercel.app';

  // Get or create Stripe customer
  let customerId;
  const supabaseAdmin = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: sub } = await supabaseAdmin.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).single();

  if (sub?.stripe_customer_id) {
    customerId = sub.stripe_customer_id;
  } else {
    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    if (existing.data.length) {
      customerId = existing.data[0].id;
    } else {
      const customer = await stripe.customers.create({ email: user.email, metadata: { supabase_uid: user.id } });
      customerId = customer.id;
    }
    await supabaseAdmin.from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: customerId, status: 'inactive', updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/?subscribed=true`,
    cancel_url: `${origin}/`,
    allow_promotion_codes: true,
  });

  res.json({ url: session.url });
}
