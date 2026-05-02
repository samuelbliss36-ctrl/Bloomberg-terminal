// Full-screen auth gate — shown when no user is signed in.
// Replaced the floating AuthModal for first-access flow.

import { useState } from 'react';
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { setRememberMe } from '../../lib/supabase';

const BG = {
  position: 'fixed', inset: 0, zIndex: 99999,
  background: 'linear-gradient(135deg, #0a0f1e 0%, #0f172a 50%, #0d1b2e 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: "'Inter','IBM Plex Sans',sans-serif",
};

const GRID_OVERLAY = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  backgroundImage: `
    linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px)
  `,
  backgroundSize: '40px 40px',
};

const CARD = {
  position: 'relative', zIndex: 1,
  width: '100%', maxWidth: 400,
  background: 'rgba(15,23,42,0.85)',
  border: '1px solid rgba(37,99,235,0.18)',
  borderRadius: 16,
  padding: '40px 36px',
  boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(37,99,235,0.08)',
  backdropFilter: 'blur(20px)',
};

function Input({ icon: Icon, type: typeProp, placeholder, value, onChange, onKeyDown }) {
  const [show, setShow] = useState(false);
  const type = typeProp === 'password' ? (show ? 'text' : 'password') : typeProp;
  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <Icon size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.6)', pointerEvents: 'none' }} />
      <input
        className="auth-input"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '11px 40px 11px 38px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, outline: 'none',
          color: '#f1f5f9', fontSize: 13,
          fontFamily: "'Inter',sans-serif",
          transition: 'border-color 0.2s, box-shadow 0.2s',
          colorScheme: 'dark',
          caretColor: '#f1f5f9',
        }}
        onFocus={e => { e.target.style.borderColor = 'rgba(37,99,235,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)'; }}
        onBlur={e  => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
      />
      {typeProp === 'password' && (
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(148,163,184,0.5)', display: 'flex', alignItems: 'center', padding: 0 }}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
    </div>
  );
}

export default function SignInPage() {
  const { signIn, signUp } = useAuth();
  const [mode,       setMode]       = useState('signin');   // 'signin' | 'signup'
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [rememberMe, setRememberMe_] = useState(true);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const submit = async () => {
    setError('');
    if (!email.trim() || !password)   return setError('Please enter your email and password.');
    if (mode === 'signup' && password !== confirm) return setError('Passwords do not match.');
    if (mode === 'signup' && password.length < 6)  return setError('Password must be at least 6 characters.');
    setLoading(true);
    try {
      setRememberMe(rememberMe); // configure storage BEFORE sign-in
      if (mode === 'signin') await signIn(email.trim(), password);
      else                   await signUp(email.trim(), password);
    } catch (e) {
      setError(e.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onKey = e => { if (e.key === 'Enter') submit(); };

  return (
    <div style={BG}>
      <style>{`
        .auth-input { color: #f1f5f9 !important; caret-color: #f1f5f9 !important; }
        .auth-input:-webkit-autofill,
        .auth-input:-webkit-autofill:hover,
        .auth-input:-webkit-autofill:focus,
        .auth-input:-webkit-autofill:active {
          -webkit-text-fill-color: #f1f5f9 !important;
          -webkit-box-shadow: 0 0 0px 1000px #0d1424 inset !important;
          caret-color: #f1f5f9 !important;
          transition: background-color 9999s ease-in-out 0s !important;
        }
      `}</style>
      <div style={GRID_OVERLAY} />

      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 300, background: 'radial-gradient(ellipse, rgba(37,99,235,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={CARD}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(37,99,235,0.20)', border: '1px solid rgba(37,99,235,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={17} style={{ color: '#60a5fa' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9', letterSpacing: '0.14em' }}>OMNES VIDENTES</div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.20em', marginTop: 1 }}>FINANCIAL INTELLIGENCE</div>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3, marginBottom: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
          {[['signin','Sign In'],['signup','Create Account']].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
                fontSize: 11, fontWeight: 700, fontFamily: "'Inter',sans-serif", letterSpacing: '0.04em',
                transition: 'all 0.15s',
                background: mode === m ? 'rgba(37,99,235,0.25)' : 'transparent',
                color: mode === m ? '#93c5fd' : 'rgba(148,163,184,0.6)',
                boxShadow: mode === m ? 'inset 0 0 0 1px rgba(37,99,235,0.30)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Fields */}
        <Input icon={Mail}  type="email"    placeholder="Email address"   value={email}    onChange={e => setEmail(e.target.value)}    onKeyDown={onKey} />
        <Input icon={Lock}  type="password" placeholder="Password"        value={password} onChange={e => setPassword(e.target.value)} onKeyDown={onKey} />
        {mode === 'signup' && (
          <Input icon={Lock} type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={onKey} />
        )}

        {/* Remember me — only shown on sign-in, not account creation */}
        {mode === 'signin' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
            <div
              onClick={() => setRememberMe_(r => !r)}
              style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                border: `1.5px solid ${rememberMe ? '#2563eb' : 'rgba(255,255,255,0.20)'}`,
                background: rememberMe ? '#2563eb' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
              {rememberMe && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.75)', userSelect: 'none' }}>
              Remember me on this device
            </span>
          </label>
        )}

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '10px 12px', background: 'rgba(225,29,72,0.10)', border: '1px solid rgba(225,29,72,0.25)', borderRadius: 7, marginBottom: 14 }}>
            <AlertCircle size={13} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 11, color: '#f87171', lineHeight: 1.4 }}>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button onClick={submit} disabled={loading}
          style={{
            width: '100%', padding: '12px 0', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(37,99,235,0.35)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif",
            letterSpacing: '0.07em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,0.35)',
            transition: 'all 0.2s',
            marginTop: error ? 0 : 4,
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
          {loading ? 'Please wait…' : (mode === 'signin' ? 'Sign In' : 'Create Account')}
          {!loading && <ArrowRight size={14} />}
        </button>

        {/* Footer note */}
        <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.40)', textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
          Your data is stored securely and never shared.<br />
          Supabase authentication · End-to-end encrypted sessions.
        </p>
      </div>
    </div>
  );
}
