// Post-login onboarding wizard — runs once after first sign-in.
// Lets users optionally configure Telegram alerts and AI Copilot API key.
// Completion flag is written to Supabase user_metadata (cross-device) AND
// localStorage (fast cache) so the wizard never re-appears on any device.

import { useState } from 'react';
import { Zap, Bell, Bot, CheckCircle, ArrowRight, ChevronRight, Send, Key, Eye, EyeOff } from 'lucide-react';
import { useAlerts } from '../../context/AlertsContext';
import { supabase } from '../../lib/supabase';

const LS_DONE = 'ov_onboarding_done';

async function markOnboardingDone() {
  localStorage.setItem(LS_DONE, 'true');
  // Write to Supabase user metadata — survives across devices
  try {
    if (supabase) await supabase.auth.updateUser({ data: { onboarding_done: true } });
  } catch (e) { console.warn('Could not save onboarding flag to Supabase:', e.message); }
}

const BG = {
  position: 'fixed', inset: 0, zIndex: 99998,
  background: 'linear-gradient(135deg, #0a0f1e 0%, #0f172a 50%, #0d1b2e 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: "'Inter','IBM Plex Sans',sans-serif",
  padding: 16,
};

const GRID = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  backgroundImage: `
    linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px)
  `,
  backgroundSize: '40px 40px',
};

function StepDot({ n, active, done }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, transition: 'all 0.25s',
      background: done ? '#059669' : active ? 'rgba(37,99,235,0.30)' : 'rgba(255,255,255,0.06)',
      border: done ? '1.5px solid #059669' : active ? '1.5px solid rgba(37,99,235,0.70)' : '1.5px solid rgba(255,255,255,0.10)',
      color: done ? '#fff' : active ? '#93c5fd' : 'rgba(148,163,184,0.5)',
    }}>
      {done ? <CheckCircle size={13} /> : n}
    </div>
  );
}

// ── Step 0: Welcome ────────────────────────────────────────────────────────────
function StepWelcome({ onNext }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(37,99,235,0.15)', border: '1.5px solid rgba(37,99,235,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <Zap size={28} style={{ color: '#60a5fa' }} />
      </div>
      <h2 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.01em' }}>Welcome to Omnes Videntes</h2>
      <p style={{ color: 'rgba(148,163,184,0.70)', fontSize: 13, lineHeight: 1.6, margin: '0 0 28px', maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
        Your Bloomberg-style financial terminal is ready. Let's take 60 seconds to set up two optional features that supercharge your experience.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
        {[
          { icon: Bell, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', title: 'Price Alerts', desc: 'Get notified via Telegram when stocks hit your targets' },
          { icon: Bot,  color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', title: 'AI Copilot',   desc: 'Ask the AI about any asset, earnings or market move' },
        ].map(({ icon: Icon, color, bg, border, title, desc }) => (
          <div key={title} style={{ padding: '14px 12px', background: bg, border: `1px solid ${border}`, borderRadius: 10, textAlign: 'left' }}>
            <Icon size={16} style={{ color, marginBottom: 8 }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.70)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
      <button onClick={onNext}
        style={{ width: '100%', padding: '12px 0', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 16px rgba(37,99,235,0.35)', transition: 'all 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
        Get Started <ArrowRight size={14} />
      </button>
    </div>
  );
}

// ── Step 1: Telegram ───────────────────────────────────────────────────────────
function StepTelegram({ onNext, onSkip }) {
  const { telegram, setTelegram } = useAlerts();
  const [tok,    setTok]    = useState(telegram.token);
  const [cid,    setCid]    = useState(telegram.chatId);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const save = () => {
    if (!tok.trim() || !cid.trim()) { setStatus('error:Please enter both fields.'); return; }
    setTelegram({ token: tok.trim(), chatId: cid.trim() });
    onNext();
  };

  const test = async () => {
    if (!tok.trim() || !cid.trim()) { setStatus('error:Fill in both fields first.'); return; }
    setSaving(true);
    setStatus('');
    try {
      const r = await fetch('/api/telegram', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tok.trim(), chatId: cid.trim(), message: '✅ <b>Omnes Videntes</b> connected! You\'ll receive price alerts here.' }),
      });
      const d = await r.json();
      setStatus(d.ok ? 'ok:Test message sent! Check Telegram.' : `error:${d.error}`);
    } catch { setStatus('error:Network error — check your connection.'); }
    setSaving(false);
  };

  const inp = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 7, color: '#f1f5f9', fontSize: 12, fontFamily: "'IBM Plex Mono',monospace",
    outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
  };
  const lbl = { fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.60)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 };

  const [type, msg] = status.startsWith('ok:') ? ['ok', status.slice(3)] : status.startsWith('error:') ? ['err', status.slice(6)] : [null, ''];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Send size={18} style={{ color: '#f59e0b' }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>Telegram Alerts</div>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.60)' }}>Get price alerts sent to your phone</div>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, padding: '12px 14px', marginBottom: 16, fontSize: 11, color: 'rgba(148,163,184,0.70)', lineHeight: 1.6 }}>
        <strong style={{ color: '#e2e8f0' }}>Quick setup:</strong>
        <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li>Open Telegram → search <strong style={{ color: '#93c5fd' }}>@BotFather</strong> → type <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>/newbot</code></li>
          <li>Follow prompts → copy the <strong style={{ color: '#93c5fd' }}>bot token</strong></li>
          <li>Search <strong style={{ color: '#93c5fd' }}>@userinfobot</strong> → it replies with your <strong style={{ color: '#93c5fd' }}>Chat ID</strong></li>
          <li>Start a chat with your new bot (press Start)</li>
        </ol>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Bot Token</label>
        <input style={inp} value={tok} placeholder="123456789:ABCdef..." onChange={e => setTok(e.target.value)}
          onFocus={e => { e.target.style.borderColor = 'rgba(37,99,235,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
          onBlur={e  => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Chat ID</label>
        <input style={inp} value={cid} placeholder="-100123456789" onChange={e => setCid(e.target.value)}
          onFocus={e => { e.target.style.borderColor = 'rgba(37,99,235,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
          onBlur={e  => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }} />
      </div>

      {msg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 7, marginBottom: 12, background: type === 'ok' ? 'rgba(5,150,105,0.12)' : 'rgba(225,29,72,0.10)', border: `1px solid ${type === 'ok' ? 'rgba(5,150,105,0.30)' : 'rgba(225,29,72,0.25)'}`, fontSize: 11, color: type === 'ok' ? '#4ade80' : '#f87171' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={test} disabled={saving}
          style={{ flex: 1, padding: '9px 0', border: '1px solid rgba(245,158,11,0.30)', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'Inter',sans-serif", background: 'rgba(245,158,11,0.10)', color: '#fbbf24', transition: 'opacity 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.75'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          {saving ? 'Sending…' : 'Test Connection'}
        </button>
        <button onClick={save}
          style={{ flex: 2, padding: '9px 0', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'Inter',sans-serif", background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, boxShadow: '0 4px 14px rgba(37,99,235,0.30)', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
          Save & Continue <ChevronRight size={13} />
        </button>
      </div>
      <button onClick={onSkip}
        style={{ width: '100%', padding: '8px 0', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, cursor: 'pointer', fontSize: 11, color: 'rgba(148,163,184,0.50)', fontFamily: "'Inter',sans-serif", transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'rgba(148,163,184,0.80)'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.50)'}>
        Skip for now
      </button>
    </div>
  );
}

// ── Step 2: AI Copilot API Key ─────────────────────────────────────────────────
function StepAI({ onNext, onSkip }) {
  const saved = localStorage.getItem('ov_copilot_key') || '';
  const [key,     setKey]     = useState(saved);
  const [show,    setShow]    = useState(false);
  const [status,  setStatus]  = useState('');

  const save = () => {
    const trimmed = key.trim();
    if (!trimmed) { setStatus('error:Enter your API key.'); return; }
    if (!/^sk-[A-Za-z0-9\-_]{20,}$/.test(trimmed) && !/^sk-ant-[A-Za-z0-9\-_]{20,}$/.test(trimmed)) {
      setStatus('error:Key should start with sk- (OpenAI) or sk-ant- (Anthropic).');
      return;
    }
    localStorage.setItem('ov_copilot_key', trimmed);
    onNext();
  };

  const inp = {
    width: '100%', boxSizing: 'border-box', padding: '10px 40px 10px 12px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 7, color: '#f1f5f9', fontSize: 12, fontFamily: "'IBM Plex Mono',monospace",
    outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const [type, msg] = status.startsWith('ok:') ? ['ok', status.slice(3)] : status.startsWith('error:') ? ['err', status.slice(6)] : [null, ''];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={18} style={{ color: '#a78bfa' }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>AI Copilot</div>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.60)' }}>Ask the AI about markets, stocks, and more</div>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, padding: '12px 14px', marginBottom: 16, fontSize: 11, color: 'rgba(148,163,184,0.70)', lineHeight: 1.6 }}>
        The AI copilot works with your own API key. Supported providers:
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          {[
            { name: 'OpenAI', prefix: 'sk-...', url: 'platform.openai.com/api-keys', color: '#4ade80' },
            { name: 'Anthropic', prefix: 'sk-ant-...', url: 'console.anthropic.com', color: '#a78bfa' },
          ].map(p => (
            <a key={p.name} href={`https://${p.url}`} target="_blank" rel="noreferrer"
              style={{ display: 'block', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, textDecoration: 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: p.color, marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.50)', fontFamily: "'IBM Plex Mono',monospace" }}>{p.prefix}</div>
            </a>
          ))}
        </div>
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 10, color: 'rgba(148,163,184,0.50)' }}>
          Your key is stored locally on your device only — never sent to our servers.
        </p>
      </div>

      <div style={{ marginBottom: 14, position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          style={inp} value={key}
          placeholder="sk-... or sk-ant-..."
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          onFocus={e => { e.target.style.borderColor = 'rgba(139,92,246,0.50)'; e.target.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.12)'; }}
          onBlur={e  => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }} />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(148,163,184,0.40)', display: 'flex', alignItems: 'center', padding: 0 }}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {key && /^sk-[A-Za-z0-9\-_]{20,}$/.test(key.trim()) && (
        <div style={{ fontSize: 10, color: '#4ade80', marginBottom: 10, fontFamily: "'IBM Plex Mono',monospace" }}>✓ Valid OpenAI key format</div>
      )}
      {key && /^sk-ant-[A-Za-z0-9\-_]{20,}$/.test(key.trim()) && (
        <div style={{ fontSize: 10, color: '#a78bfa', marginBottom: 10, fontFamily: "'IBM Plex Mono',monospace" }}>✓ Valid Anthropic key format</div>
      )}

      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 7, marginBottom: 12, background: type === 'ok' ? 'rgba(5,150,105,0.12)' : 'rgba(225,29,72,0.10)', border: `1px solid ${type === 'ok' ? 'rgba(5,150,105,0.30)' : 'rgba(225,29,72,0.25)'}`, fontSize: 11, color: type === 'ok' ? '#4ade80' : '#f87171' }}>
          {msg}
        </div>
      )}

      <button onClick={save}
        style={{ width: '100%', padding: '10px 0', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'Inter',sans-serif", background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, boxShadow: '0 4px 14px rgba(124,58,237,0.30)', transition: 'all 0.2s', marginBottom: 8 }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
        <Key size={12} /> Save Key & Continue
      </button>
      <button onClick={onSkip}
        style={{ width: '100%', padding: '8px 0', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, cursor: 'pointer', fontSize: 11, color: 'rgba(148,163,184,0.50)', fontFamily: "'Inter',sans-serif", transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'rgba(148,163,184,0.80)'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.50)'}>
        Skip for now
      </button>
    </div>
  );
}

// ── Step 3: Done ───────────────────────────────────────────────────────────────
function StepDone({ onLaunch }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(5,150,105,0.15)', border: '1.5px solid rgba(5,150,105,0.40)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <CheckCircle size={28} style={{ color: '#34d399' }} />
      </div>
      <h2 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>You're all set!</h2>
      <p style={{ color: 'rgba(148,163,184,0.70)', fontSize: 13, lineHeight: 1.6, margin: '0 0 28px', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
        Your terminal is configured and ready. You can update these settings at any time from the Alerts panel and AI Copilot.
      </p>
      <button onClick={onLaunch}
        style={{ width: '100%', padding: '13px 0', background: 'linear-gradient(135deg,#059669,#047857)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 18px rgba(5,150,105,0.35)', transition: 'all 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
        Launch Terminal <Zap size={14} />
      </button>
    </div>
  );
}

// ── Main Wizard ────────────────────────────────────────────────────────────────
const STEPS = ['Welcome', 'Telegram', 'AI Copilot', 'Done'];

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const next = () => setStep(s => s + 1);
  const finish = () => {
    markOnboardingDone(); // writes localStorage + Supabase user_metadata
    onComplete();
  };

  const CARD = {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: step === 0 ? 420 : 460,
    background: 'rgba(15,23,42,0.88)',
    border: '1px solid rgba(37,99,235,0.16)',
    borderRadius: 16,
    padding: '32px 32px 28px',
    boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(20px)',
    transition: 'max-width 0.3s',
  };

  return (
    <div style={BG}>
      <div style={GRID} />
      <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 350, background: 'radial-gradient(ellipse, rgba(37,99,235,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={CARD}>
        {/* Progress */}
        {step > 0 && step < STEPS.length - 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
            {STEPS.slice(1, -1).map((label, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StepDot n={i + 1} active={step === i + 1} done={step > i + 1} />
                <span style={{ fontSize: 9, fontWeight: 700, color: step === i + 1 ? '#93c5fd' : step > i + 1 ? '#34d399' : 'rgba(148,163,184,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
                {i < 1 && <div style={{ width: 28, height: 1, background: step > i + 1 ? 'rgba(52,211,153,0.40)' : 'rgba(255,255,255,0.10)', margin: '0 2px' }} />}
              </div>
            ))}
          </div>
        )}

        {step === 0 && <StepWelcome onNext={next} />}
        {step === 1 && <StepTelegram onNext={next} onSkip={next} />}
        {step === 2 && <StepAI onNext={next} onSkip={next} />}
        {step === 3 && <StepDone onLaunch={finish} />}
      </div>
    </div>
  );
}
