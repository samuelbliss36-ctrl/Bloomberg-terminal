import { useState } from 'react';
import { startCheckout, openPortal } from '../../lib/subscription';

const FEATURES = [
  { icon: '🔍', label: 'Perplexity live-search AI', desc: 'Real-time web search built into every answer' },
  { icon: '📊', label: 'Unlimited portfolio tracking', desc: 'Track all your positions with live P&L' },
  { icon: '🌍', label: 'Full terminal access', desc: 'All pages: macro, FX, crypto, commodities, earnings' },
  { icon: '🤖', label: 'AI Copilot on every page', desc: 'Context-aware analysis for each terminal view' },
  { icon: '🔔', label: 'Price alerts', desc: 'Get notified when your targets are hit' },
  { icon: '🛡️', label: 'Research history sync', desc: 'Saved across all your devices' },
];

export default function UpgradePage({ subscription }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState(null);

  const isPastDue = subscription?.status === 'past_due';

  const handleCheckout = async () => {
    setErr(null);
    setLoading(true);
    try {
      await startCheckout();
    } catch (e) {
      setErr(e.message);
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    setErr(null);
    setLoading(true);
    try {
      await openPortal();
    } catch (e) {
      setErr(e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '28px 20px', gap: 20,
      fontFamily: "'Inter','IBM Plex Sans',sans-serif",
      color: 'var(--text-1)',
    }}>
      {/* Lock icon */}
      <div style={{ fontSize: 32 }}>🔒</div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
          Upgrade to Pro
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
          The AI Copilot requires a Pro subscription.<br />
          Get live-search AI powered by Perplexity.
        </div>
      </div>

      {/* Past due banner */}
      {isPastDue && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8,
          padding: '10px 14px', fontSize: 11, color: '#92400e', textAlign: 'center',
          maxWidth: 320,
        }}>
          <strong>Payment failed.</strong> Please update your billing details to restore access.
        </div>
      )}

      {/* Price */}
      {!isPastDue && (
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-1)' }}>$9.99</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>/month</span>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Cancel any time</div>
        </div>
      )}

      {/* Feature list */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {FEATURES.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-solid)' }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{f.icon}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)' }}>{f.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA button */}
      {isPastDue ? (
        <button
          onClick={handlePortal}
          disabled={loading}
          style={{
            width: '100%', maxWidth: 280, padding: '11px 0', borderRadius: 8, border: 'none',
            background: loading ? '#94a3b8' : '#d97706', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
            transition: 'background 0.15s',
          }}>
          {loading ? 'Loading…' : 'Update Payment Method'}
        </button>
      ) : (
        <button
          onClick={handleCheckout}
          disabled={loading}
          style={{
            width: '100%', maxWidth: 280, padding: '11px 0', borderRadius: 8, border: 'none',
            background: loading ? '#94a3b8' : '#2563eb', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
            transition: 'background 0.15s',
          }}>
          {loading ? 'Loading…' : 'Start Pro — $9.99/month'}
        </button>
      )}

      {err && (
        <div style={{ fontSize: 10, color: '#e11d48', textAlign: 'center' }}>{err}</div>
      )}

      <div style={{ fontSize: 9, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.4 }}>
        Secure checkout via Stripe. No commitment — cancel any time from your billing portal.
      </div>
    </div>
  );
}
