import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isOwner } from '../../lib/subscription';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOwner(user)) return;
    const fetchStats = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const r = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        setStats(d);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  if (!isOwner(user)) {
    return (
      <div style={{ padding: 40, fontFamily: "'Inter',sans-serif" }}>
        <div style={{ fontSize: 14, color: '#e11d48', fontWeight: 600 }}>Access Denied</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>This page is restricted to the site owner.</div>
      </div>
    );
  }

  const cardStyle = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '20px 24px',
    minWidth: 160,
    flex: '1 1 160px',
  };
  const cardLabel = { fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 };
  const cardValue = { fontSize: 28, fontWeight: 700, color: '#0f172a', lineHeight: 1 };
  const cardSub   = { fontSize: 11, color: '#64748b', marginTop: 4 };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Admin Dashboard</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Site analytics — owner only</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, padding: '6px 14px', borderRadius: 6, background: '#0f172a', color: '#fff', textDecoration: 'none', fontWeight: 500 }}>
            Vercel
          </a>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, padding: '6px 14px', borderRadius: 6, background: '#635bff', color: '#fff', textDecoration: 'none', fontWeight: 500 }}>
            Stripe
          </a>
        </div>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading stats…</div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#e11d48' }}>Error: {error}</div>
      )}

      {stats && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <div style={cardStyle}>
              <div style={cardLabel}>Total Users</div>
              <div style={cardValue}>{stats.totalUsers.toLocaleString()}</div>
              <div style={cardSub}>Registered accounts</div>
            </div>
            <div style={cardStyle}>
              <div style={cardLabel}>Active Subscribers</div>
              <div style={cardValue}>{stats.activeSubscribers.toLocaleString()}</div>
              <div style={cardSub}>Pro plan · active</div>
            </div>
            <div style={cardStyle}>
              <div style={cardLabel}>MRR</div>
              <div style={cardValue}>${Number(stats.mrr).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div style={cardSub}>Monthly recurring revenue</div>
            </div>
            <div style={cardStyle}>
              <div style={cardLabel}>Conversion</div>
              <div style={cardValue}>
                {stats.totalUsers > 0
                  ? ((stats.activeSubscribers / stats.totalUsers) * 100).toFixed(1) + '%'
                  : '—'}
              </div>
              <div style={cardSub}>Users subscribed</div>
            </div>
          </div>

          {/* Recent activity table */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
              Recent Subscription Activity
            </div>
            {stats.recentActivity.length === 0 ? (
              <div style={{ padding: '20px', fontSize: 11, color: '#94a3b8' }}>No recent activity.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '8px 20px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Customer</th>
                    <th style={{ padding: '8px 20px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Status</th>
                    <th style={{ padding: '8px 20px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Period End</th>
                    <th style={{ padding: '8px 20px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivity.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 20px', color: '#0f172a', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10 }}>
                        {row.stripe_customer_id || '—'}
                      </td>
                      <td style={{ padding: '10px 20px' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                          background: row.status === 'active' ? '#dcfce7' : row.status === 'past_due' ? '#fef3c7' : '#f1f5f9',
                          color:      row.status === 'active' ? '#059669' : row.status === 'past_due' ? '#d97706' : '#64748b',
                        }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 20px', color: '#475569' }}>
                        {row.current_period_end ? new Date(row.current_period_end).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '10px 20px', color: '#94a3b8' }}>
                        {row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
