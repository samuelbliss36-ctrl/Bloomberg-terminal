import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
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
        stripe_customer_id: event.data.object.customer,
        stripe_subscription_id: event.data.object.id,
        status: 'inactive',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'stripe_customer_id' });
      break;
    case 'invoice.payment_failed':
      await supabase.from('subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_customer_id', event.data.object.customer);
      break;
  }

  res.json({ received: true });
}
