// Stripe handler — all three actions in one function to stay within Vercel Hobby 12-function limit
// Routes on ?action= query param:
//   POST /api/stripe?action=checkout  → create Checkout session
//   POST /api/stripe?action=portal    → create Billing Portal session
//   POST /api/stripe?action=webhook   → receive Stripe webhook (raw body, sig verification)

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const OWNER_EMAIL = 'samuelbliss36@gmail.com';

// Webhook requires raw body — parse it manually
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Disable Next.js/Vercel body parsing so webhook can read raw bytes
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { action } = req.query;

  // ── WEBHOOK ──────────────────────────────────────────────────────────────────
  if (action === 'webhook') {
    if (req.method !== 'POST') return res.status(405).end();

    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const getStatus = (sub) => {
      if (['active', 'trialing'].includes(sub.status)) return 'active';
      if (sub.status === 'past_due') return 'past_due';
      return 'inactive';
    };

    const upsertSub = async (subscription) => {
      await supabase.from('subscriptions').upsert({
        stripe_customer_id:     subscription.customer,
        stripe_subscription_id: subscription.id,
        status:                 getStatus(subscription),
        current_period_end:     new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end:   subscription.cancel_at_period_end,
        updated_at:             new Date().toISOString(),
      }, { onConflict: 'stripe_customer_id' });
    };

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await upsertSub(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await supabase.from('subscriptions').upsert({
          stripe_customer_id:     event.data.object.customer,
          stripe_subscription_id: event.data.object.id,
          status:                 'inactive',
          updated_at:             new Date().toISOString(),
        }, { onConflict: 'stripe_customer_id' });
        break;
      case 'invoice.payment_failed':
        await supabase.from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', event.data.object.customer);
        break;
    }

    return res.json({ received: true });
  }

  // ── CHECKOUT & PORTAL — require JWT auth ────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).end();

  // Read body manually since bodyParser is disabled
  let body = {};
  try {
    const rawBody = await getRawBody(req);
    if (rawBody.length) body = JSON.parse(rawBody.toString());
  } catch {}

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = req.headers.origin || 'https://bloomberg-terminal-gamma.vercel.app';
  const supabaseAdmin = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // ── CHECKOUT ──────────────────────────────────────────────────────────────
  if (action === 'checkout') {
    if (user.email === OWNER_EMAIL) return res.status(400).json({ error: 'Owner has unlimited access' });

    // Get or create Stripe customer
    let customerId;
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
      await supabaseAdmin.from('subscriptions').upsert(
        { user_id: user.id, stripe_customer_id: customerId, status: 'inactive', updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/?subscribed=true`,
      cancel_url: `${origin}/`,
      allow_promotion_codes: true,
    });

    return res.json({ url: session.url });
  }

  // ── PORTAL ────────────────────────────────────────────────────────────────
  if (action === 'portal') {
    const { data: sub } = await supabaseAdmin.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).single();
    if (!sub?.stripe_customer_id) return res.status(400).json({ error: 'No subscription found' });

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: origin,
    });

    return res.json({ url: session.url });
  }

  return res.status(400).json({ error: 'action must be checkout, portal, or webhook' });
}
