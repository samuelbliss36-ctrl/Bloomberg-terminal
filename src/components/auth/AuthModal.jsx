import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isConfigured } from '../../lib/supabase';

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 12,
      height: 12,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'ov-spin 0.7s linear infinite',
      verticalAlign: 'middle',
      marginRight: 6,
    }} />
  );
}

// ── AuthModal ─────────────────────────────────────────────────────────────────
export default function AuthModal({ onClose }) {
  const { user, signIn, signUp, signOut, syncing } = useAuth();
  const [tab, setTab]         = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (tab === 'signin') {
        await signIn(email.trim(), password);
        onClose();
      } else {
        await signUp(email.trim(), password);
        setSuccess('Account created! Check your email to confirm, then sign in.');
      }
    } catch (err) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      onClose();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const overlay = {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: 'rgba(1,4,9,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const panel = {
    background: 'var(--surface-1, #f8fafc)',
    border: '1px solid var(--border-solid, #e2e8f0)',
    borderRadius: 12,
    boxShadow: '0 16px 64px rgba(0,0,0,0.32)',
    width: 380,
    maxWidth: 'calc(100vw - 32px)',
    fontFamily: "'IBM Plex Mono', monospace",
    overflow: 'hidden',
  };
  const header = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--border-solid, #e2e8f0)',
    background: 'var(--surface-2, #f1f5f9)',
  };
  const tabBtn = (active) => ({
    flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.07em', textTransform: 'uppercase',
    background: active ? 'var(--surface-0, #fff)' : 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
    color: active ? '#2563eb' : 'var(--text-3, #94a3b8)',
    cursor: 'pointer', transition: 'all 0.15s',
    fontFamily: "'IBM Plex Mono', monospace",
  });
  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--surface-0, #fff)',
    border: '1px solid var(--border-solid, #e2e8f0)',
    borderRadius: 7, padding: '8px 10px',
    fontSize: 12, color: 'var(--text-1, #0f172a)',
    fontFamily: "'IBM Plex Mono', monospace",
    outline: 'none',
  };
  const btnPrimary = {
    width: '100%', padding: '9px 0',
    background: loading ? '#1d3a7a' : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    border: 'none', borderRadius: 8,
    color: '#fff', fontSize: 12, fontWeight: 700,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontFamily: "'IBM Plex Mono', monospace",
    transition: 'opacity 0.15s',
    opacity: loading ? 0.75 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const labelStyle = {
    display: 'block', fontSize: 9, fontWeight: 700,
    color: 'var(--text-3, #94a3b8)', letterSpacing: '0.09em',
    textTransform: 'uppercase', marginBottom: 5,
  };

  // ── Not configured state ──────────────────────────────────────────────────
  if (!isConfigured) {
    return (
      <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={panel}>
          <div style={header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>☁</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1, #0f172a)' }}>Cloud Sync</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-3, #94a3b8)', lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ padding: '24px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 12, letterSpacing: '0.05em' }}>
              ☁ NOT CONFIGURED
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2, #475569)', lineHeight: 1.7, marginBottom: 16 }}>
              Supabase is not set up. To enable cloud sync, add these variables to your{' '}
              <code style={{ background: 'var(--surface-2, #f1f5f9)', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>.env</code>{' '}
              file and restart the dev server:
            </div>
            <div style={{ background: 'var(--surface-0, #fff)', border: '1px solid var(--border-solid, #e2e8f0)', borderRadius: 8, padding: '12px 14px', fontSize: 10, lineHeight: 2, color: 'var(--text-1, #0f172a)' }}>
              <div><span style={{ color: '#7c3aed' }}>REACT_APP_SUPABASE_URL</span>=https://your-project.supabase.co</div>
              <div><span style={{ color: '#7c3aed' }}>REACT_APP_SUPABASE_ANON_KEY</span>=your-anon-key</div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3, #94a3b8)', marginTop: 12 }}>
              Find these in your Supabase project under Settings → API.
            </div>
            <button
              onClick={onClose}
              style={{ ...btnPrimary, marginTop: 20, background: 'var(--surface-2, #f1f5f9)', color: 'var(--text-1, #0f172a)', border: '1px solid var(--border-solid, #e2e8f0)' }}>
              Close
            </button>
          </div>
        </div>
        <style>{`@keyframes ov-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Already signed in ─────────────────────────────────────────────────────
  if (user) {
    return (
      <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={panel}>
          <div style={header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                {user.email?.[0]?.toUpperCase() || '?'}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1, #0f172a)' }}>Account</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-3, #94a3b8)', lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ padding: '20px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', boxShadow: '0 0 6px rgba(5,150,105,0.5)', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>Signed in</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2, #475569)', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-3, #94a3b8)', fontSize: 9, display: 'block', marginBottom: 2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Email</span>
              {user.email}
            </div>
            {syncing && (
              <div style={{ fontSize: 10, color: '#2563eb', marginTop: 10, marginBottom: 4 }}>
                <Spinner /> Syncing data…
              </div>
            )}
            <button
              onClick={handleSignOut}
              disabled={loading}
              style={{ ...btnPrimary, marginTop: 20, background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
              {loading ? <><Spinner />Signing out…</> : 'Sign Out'}
            </button>
          </div>
        </div>
        <style>{`@keyframes ov-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Sign in / Sign up ─────────────────────────────────────────────────────
  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panel}>
        {/* Header */}
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>☁</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1, #0f172a)' }}>Cloud Sync</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-3, #94a3b8)', lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-solid, #e2e8f0)' }}>
          <button style={tabBtn(tab === 'signin')} onClick={() => { setTab('signin'); setError(''); setSuccess(''); }}>
            Sign In
          </button>
          <button style={tabBtn(tab === 'signup')} onClick={() => { setTab('signup'); setError(''); setSuccess(''); }}>
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3, #94a3b8)', lineHeight: 1.6 }}>
            {tab === 'signin'
              ? 'Sign in to sync your portfolio, screens, and AI conversations across devices.'
              : 'Create a free account to save your data to the cloud.'}
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={tab === 'signup' ? 'Min 6 characters' : '••••••••'}
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ fontSize: 11, color: '#e11d48', background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.20)', borderRadius: 7, padding: '8px 10px', lineHeight: 1.5 }}>
              ⚠ {error}
            </div>
          )}

          {success && (
            <div style={{ fontSize: 11, color: '#059669', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.20)', borderRadius: 7, padding: '8px 10px', lineHeight: 1.5 }}>
              ✓ {success}
            </div>
          )}

          <button type="submit" disabled={loading} style={btnPrimary}>
            {loading ? (
              <><Spinner />{tab === 'signin' ? 'Signing in…' : 'Creating account…'}</>
            ) : (
              tab === 'signin' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>
      </div>
      <style>{`@keyframes ov-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
