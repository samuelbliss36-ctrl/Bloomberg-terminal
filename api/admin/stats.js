import { createClient } from '@supabase/supabase-js';

const OWNER_EMAIL = 'samuelbliss36@gmail.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user || user.email !== OWNER_EMAIL) return res.status(403).json({ error: 'Forbidden' });

  const admin = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const [usersRes, subsRes, recentRes] = await Promise.all([
    admin.from('subscriptions').select('*', { count: 'exact', head: true }),
    admin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('subscriptions').select('stripe_customer_id, status, current_period_end, updated_at').order('updated_at', { ascending: false }).limit(10),
  ]);

  // Count total auth users via admin API
  const usersListRes = await admin.auth.admin.listUsers({ perPage: 1 });
  const totalUsers = usersListRes.data?.total ?? 0;

  const activeCount = subsRes.count ?? 0;
  const mrr = activeCount * 9.99;

  res.json({
    totalUsers,
    activeSubscribers: activeCount,
    mrr: mrr.toFixed(2),
    recentActivity: recentRes.data || [],
  });
}
