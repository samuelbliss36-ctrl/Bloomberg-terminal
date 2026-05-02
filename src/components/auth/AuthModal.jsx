import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { isConfigured } from '../../lib/supabase';

export default function AuthModal({ onClose }) {
  const { user, syncing, signIn, signUp, signOut } = useAuth();
  const [tab,      setTab]      = useState('signin');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(null);

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!email.trim() || !password.trim()) { setError('Email and password required.'); return; }
    setLoading(true);
    try {
      if (tab === 'signin') {
        await signIn(email.trim(), password);
        onClose();
      } else {
        await signUp(email.trim(), password);
        setSuccess('Account created! Check your email to confirm, then sign in.');
        setTab('signin');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
    background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const modalStyle = {
    background: 'var(--surface-1, #0f172a)',
    border: '1px solid var(--border, rgba(255,255,255,0.10))',
    borderRadius: 10, padding: 28, width: 360,
    fontFamily: "'IBM Plex Mono', monospace",
    boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
  };

  const inputStyle = {
    width: '100%', background: 'var(--surface-0, #1e293b)',
    border: '1px solid var(--border, rgba(255,255,255,0.10))',
    borderRadius: 6, padding: '8px 10px', fontSize: 12,
    color: 'var(--text-1, #f1f5f9)',
    fontFamily: "'IBM Plex Mono', monospace",
    outline: 'none', boxSizing: 'border-box',
  };
  const btnStyle = active => ({
    flex: 1, padding: '6px 0', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.07em', borderRadius: 5, cursor: 'pointer',
    fontFamily: "'IBM Plex Mono', monospace",
    background: active ? 'rgba(37,99,235,0.18)' : 'transparent',
    border: `1px solid ${active ? 'rgba(37,99,235,0.50)' : 'rgba(255,255,255,0.08)'}`,
    color: active ? '#60a5fa' : 'var(--text-3, #64748b)',
    transition: 'all 0.15s',
  });
  const submitStyle = {
    width: '100%', padding: '9px 0', marginTop: 18,
    background: loading ? 'rgba(37,99,235,0.30)' : 'rgba(37,99,235,0.85)',
    border: 'none', borderRadius: 6, color: '#fff',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
    fontFamily: "'IBM Plex Mono', monospace",
    cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
  };

  return createPortal(
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1, #f1f5f9)', letterSpacing: '0.05em' }}>
              ☁ CLOUD SYNC
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3, #64748b)', marginTop: 3 }}>
              Save portfolio, screens &amp; history
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-3, #64748b)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>✕</button>
        </div>

        {/* Not configured state */}
        {!isConfigured && (
          <div style={{ background: 'rgba(234,88,12,0.10)', border: '1px solid rgba(234,88,12,0.30)',
            borderRadius: 6, padding: '12px 14px', fontSize: 11, color: '#fb923c' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠ Supabase not configured</div>
            <div style={{ color: 'var(--text-3, #64748b)', lineHeight: 1.6 }}>
              Add to <code style={{ color: '#94a3b8' }}>.env</code>:
              <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(0,0,0,0.30)', borderRadius: 4 }}>
                <div style={{ color: '#7dd3fc' }}>REACT_APP_SUPABASE_URL=https://xxx.supabase.co</div>
                <div style={{ color: '#7dd3fc' }}>REACT_APP_SUPABASE_ANON_KEY=eyJ...</div>
              </div>
              <div style={{ marginTop: 8 }}>Create a free project at <span style={{ color: '#60a5fa' }}>supabase.com</span></div>
            </div>
          </div>
        )}

        {/* Signed-in state */}
        {isConfigured && user && (
          <div>
            {syncing && (
              <div style={{ fontSize: 11, color: '#60a5fa', textAlign: 'center', marginBottom: 16,
                padding: '8px', background: 'rgba(37,99,235,0.08)', borderRadius: 6 }}>
                ⟳ Syncing your data…
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-3, #64748b)', marginBottom: 4 }}>Signed in as</div>
            <div style={{ fontSize: 13, color: 'var(--text-1, #f1f5f9)', marginBottom: 20,
              padding: '8px 10px', background: 'rgba(37,99,235,0.08)', borderRadius: 6 }}>
              {user.email}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3, #64748b)', marginBottom: 14, lineHeight: 1.6 }}>
              ✓ Portfolio synced across devices<br/>
              ✓ Screener presets saved<br/>
              ✓ Copilot history preserved<br/>
              ✓ Recent research remembered
            </div>
            <button onClick={handleSignOut} style={{ ...submitStyle, background: 'rgba(225,29,72,0.60)' }}>
              SIGN OUT
            </button>
          </div>
        )}

        {/* Sign in / sign up form */}
        {isConfigured && !user && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              <button style={btnStyle(tab === 'signin')} onClick={() => { setTab('signin'); setError(null); }}>SIGN IN</button>
              <button style={btnStyle(tab === 'signup')} onClick={() => { setTab('signup'); setError(null); }}>CREATE ACCOUNT</button>
            </div>

            {success && (
              <div style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.30)',
                borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#34d399', marginBottom: 12 }}>
                {success}
              </div>
            )}
            {error && (
              <div style={{ background: 'rgba(225,29,72,0.10)', border: '1px solid rgba(225,29,72,0.30)',
                borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#fb7185', marginBottom: 12 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: 'var(--text-3, #64748b)', marginBottom: 5, letterSpacing: '0.08em' }}>EMAIL</div>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" style={inputStyle} autoComplete="email" />
              </div>
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, color: 'var(--text-3, #64748b)', marginBottom: 5, letterSpacing: '0.08em' }}>PASSWORD</div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" style={inputStyle} autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} />
              </div>
              <button type="submit" style={submitStyle} disabled={loading}>
                {loading ? '...' : tab === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </button>
            </form>

            <div style={{ fontSize: 9, color: 'var(--text-3, #64748b)', textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
              Your data is stored in your own Supabase project.<br/>
              API keys are never synced to the cloud.
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
