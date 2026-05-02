// Floating alerts panel — rendered via createPortal to avoid CSS containment clipping.
// Shows: add-alert form, active alerts (with live price %), triggered history, Telegram config.

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Bell, BellOff, Plus, Trash2, RefreshCw, Send } from 'lucide-react';
import { useAlerts } from '../../context/AlertsContext';

const PANEL = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 340,
  zIndex: 99998,
  background: 'var(--surface-1, #fff)',
  borderLeft: '1px solid rgba(15,23,42,0.12)',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: "'Inter','IBM Plex Sans',sans-serif",
  boxShadow: '-4px 0 24px rgba(15,23,42,0.09)',
};

const OVERLAY = {
  position: 'fixed',
  inset: 0,
  zIndex: 99997,
  background: 'rgba(15,23,42,0.18)',
};

function pctAway(current, target) {
  if (!current || !target) return null;
  return ((current - target) / target * 100).toFixed(1);
}

function AddForm({ onAdd }) {
  const [ticker,    setTicker]    = useState('');
  const [target,    setTarget]    = useState('');
  const [condition, setCondition] = useState('above');
  const [note,      setNote]      = useState('');
  const [err,       setErr]       = useState('');

  const submit = useCallback(() => {
    const sym = ticker.trim().toUpperCase();
    const px  = parseFloat(target);
    if (!sym) return setErr('Enter a ticker symbol.');
    if (!px || isNaN(px) || px <= 0) return setErr('Enter a valid price.');
    setErr('');
    onAdd({ ticker: sym, targetPrice: px, condition, note });
    setTicker(''); setTarget(''); setNote('');
  }, [ticker, target, condition, note, onAdd]);

  const row = { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 };
  const label = { fontSize: 9, fontWeight: 700, color: 'var(--text-3, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.07em' };
  const inp = {
    fontSize: 11, padding: '5px 8px', borderRadius: 6,
    border: '1px solid rgba(15,23,42,0.15)', background: 'var(--surface-0, #f8fafc)',
    color: 'var(--text-1, #0f172a)', fontFamily: "'IBM Plex Mono',monospace",
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.06em', marginBottom: 8 }}>
        NEW ALERT
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={row}>
          <span style={label}>Ticker</span>
          <input style={inp} value={ticker} placeholder="NVDA"
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        <div style={row}>
          <span style={label}>Target ($)</span>
          <input style={inp} value={target} placeholder="500.00" type="number" step="0.01" min="0"
            onChange={e => setTarget(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
      </div>
      <div style={{ ...row, marginBottom: 8 }}>
        <span style={label}>Condition</span>
        <div style={{ display: 'flex', background: 'var(--surface-0)', borderRadius: 6, padding: 2, border: '1px solid rgba(15,23,42,0.11)' }}>
          {['above', 'below'].map(c => (
            <button key={c} onClick={() => setCondition(c)}
              style={{ flex: 1, padding: '4px 0', border: 'none', borderRadius: 5, cursor: 'pointer', transition: 'all 0.15s',
                fontSize: 10, fontWeight: 700, fontFamily: "'Inter',sans-serif",
                background: condition === c ? (c === 'above' ? 'rgba(5,150,105,0.14)' : 'rgba(225,29,72,0.12)') : 'transparent',
                color: condition === c ? (c === 'above' ? '#059669' : '#e11d48') : '#64748b' }}>
              {c === 'above' ? '▲ ABOVE' : '▼ BELOW'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ ...row, marginBottom: 10 }}>
        <span style={label}>Note (optional)</span>
        <input style={inp} value={note} placeholder="e.g. take-profit level"
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />
      </div>
      {err && <div style={{ fontSize: 10, color: '#e11d48', marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace" }}>{err}</div>}
      <button onClick={submit}
        style={{ width: '100%', padding: '7px 0', border: 'none', borderRadius: 7, cursor: 'pointer',
          background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: "'Inter',sans-serif",
          letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'opacity 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
        <Plus size={12} /> SET ALERT
      </button>
    </div>
  );
}

function TelegramSection() {
  const { telegram, setTelegram } = useAlerts();
  const [tok,  setTok]  = useState(telegram.token);
  const [cid,  setCid]  = useState(telegram.chatId);
  const [status, setStatus] = useState('');
  const [open,  setOpen] = useState(false);

  const save = () => {
    setTelegram({ token: tok.trim(), chatId: cid.trim() });
    setStatus('Saved!');
    setTimeout(() => setStatus(''), 2000);
  };

  const test = async () => {
    if (!tok.trim() || !cid.trim()) return setStatus('Fill in token + chat ID first.');
    setStatus('Sending…');
    try {
      const r = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tok.trim(), chatId: cid.trim(), message: '✅ <b>Omnes Videntes</b> — Telegram alerts are connected!' }),
      });
      const d = await r.json();
      setStatus(d.ok ? '✓ Test message sent!' : `Error: ${d.error}`);
    } catch {
      setStatus('Network error');
    }
    setTimeout(() => setStatus(''), 4000);
  };

  const inp = {
    fontSize: 10, padding: '5px 8px', borderRadius: 6,
    border: '1px solid rgba(15,23,42,0.15)', background: 'var(--surface-0)',
    color: 'var(--text-1)', fontFamily: "'IBM Plex Mono',monospace",
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };
  const label = { fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3 };
  const connected = telegram.token && telegram.chatId;

  return (
    <div style={{ borderTop: '1px solid rgba(15,23,42,0.08)', padding: '10px 14px' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%' }}>
        <Send size={11} style={{ color: connected ? '#2563eb' : 'var(--text-3)' }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.06em', flex: 1, textAlign: 'left' }}>
          TELEGRAM
        </span>
        {connected && <span style={{ fontSize: 9, color: '#059669', fontFamily: "'IBM Plex Mono',monospace" }}>● CONNECTED</span>}
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 8 }}>
            Create a bot via <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>@BotFather</a>, start a chat with it, then use <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>@userinfobot</a> to find your Chat ID.
          </p>
          <div style={{ marginBottom: 8 }}>
            <label style={label}>Bot Token</label>
            <input style={inp} value={tok} onChange={e => setTok(e.target.value)} placeholder="123456:ABC-DEF..." />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={label}>Chat ID</label>
            <input style={inp} value={cid} onChange={e => setCid(e.target.value)} placeholder="-100123456789" />
          </div>
          {status && <div style={{ fontSize: 10, color: status.startsWith('✓') ? '#059669' : '#e11d48', marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace" }}>{status}</div>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={save}
              style={{ flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                background: 'rgba(37,99,235,0.12)', color: '#2563eb', fontFamily: "'Inter',sans-serif" }}>
              SAVE
            </button>
            <button onClick={test}
              style={{ flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                background: 'rgba(5,150,105,0.12)', color: '#059669', fontFamily: "'Inter',sans-serif" }}>
              TEST
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AlertsPanel({ onClose }) {
  const { alerts, removeAlert, reActivate, prices, activeCount } = useAlerts();
  const [tab, setTab] = useState('active');
  const { addAlert } = useAlerts();

  // Request browser notification permission on first open
  useState(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  });

  const active    = alerts.filter(a => a.active);
  const triggered = alerts.filter(a => !a.active && a.triggeredAt).sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));

  const panel = (
    <>
      <div style={OVERLAY} onClick={onClose} />
      <div style={PANEL}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid rgba(15,23,42,0.10)', flexShrink: 0 }}>
          <Bell size={14} style={{ color: activeCount > 0 ? '#f59e0b' : 'var(--text-3)' }} />
          <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)', letterSpacing: '0.08em', flex: 1 }}>PRICE ALERTS</span>
          {activeCount > 0 && (
            <span style={{ background: '#f59e0b', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 6px', fontFamily: "'Inter',sans-serif" }}>
              {activeCount} ACTIVE
            </span>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
            <X size={14} />
          </button>
        </div>

        {/* Add form */}
        <AddForm onAdd={addAlert} />

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(15,23,42,0.08)', flexShrink: 0 }}>
          {['active', 'history'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                fontFamily: "'Inter',sans-serif", letterSpacing: '0.06em',
                background: tab === t ? 'rgba(37,99,235,0.07)' : 'transparent',
                color: tab === t ? '#2563eb' : 'var(--text-3)',
                borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
                transition: 'all 0.15s' }}>
              {t === 'active' ? `ACTIVE (${active.length})` : `HISTORY (${triggered.length})`}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {tab === 'active' && (
            active.length === 0
              ? <div style={{ padding: 20, fontSize: 11, color: 'var(--text-3)', fontFamily: "'IBM Plex Mono',monospace", textAlign: 'center' }}>No active alerts.<br />Add one above.</div>
              : active.map(a => {
                  const cur = prices[a.ticker];
                  const pct = pctAway(cur, a.targetPrice);
                  const dir = a.condition === 'above' ? '▲' : '▼';
                  const clr = a.condition === 'above' ? '#059669' : '#e11d48';
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 14px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--text-1)' }}>{a.ticker}</span>
                          <span style={{ fontSize: 10, color: clr, fontWeight: 600 }}>{dir} ${Number(a.targetPrice).toFixed(2)}</span>
                        </div>
                        {cur != null && (
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'var(--text-3)' }}>
                            Now: <span style={{ color: 'var(--text-1)' }}>${cur.toFixed(2)}</span>
                            {pct != null && (
                              <span style={{ color: Math.abs(pct) < 2 ? '#f59e0b' : 'var(--text-3)', marginLeft: 6 }}>
                                {pct > 0 ? '+' : ''}{pct}% away
                              </span>
                            )}
                          </div>
                        )}
                        {!cur && <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'var(--text-3)' }}>Pending first poll…</div>}
                        {a.note && <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: 'var(--text-3)', marginTop: 1, fontStyle: 'italic' }}>{a.note}</div>}
                      </div>
                      <button onClick={() => removeAlert(a.id)} title="Remove alert"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px 0', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#e11d48'}
                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
          )}

          {tab === 'history' && (
            triggered.length === 0
              ? <div style={{ padding: 20, fontSize: 11, color: 'var(--text-3)', fontFamily: "'IBM Plex Mono',monospace", textAlign: 'center' }}>No triggered alerts yet.</div>
              : triggered.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 14px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                    <BellOff size={12} style={{ color: '#94a3b8', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--text-1)' }}>{a.ticker}</span>
                        <span style={{ fontSize: 10, color: a.condition === 'above' ? '#059669' : '#e11d48', fontWeight: 600 }}>
                          {a.condition === 'above' ? '▲' : '▼'} ${Number(a.targetPrice).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'var(--text-3)' }}>
                        Hit ${a.triggeredPrice?.toFixed(2)} · {new Date(a.triggeredAt).toLocaleString()}
                      </div>
                      {a.note && <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: 'var(--text-3)', marginTop: 1, fontStyle: 'italic' }}>{a.note}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => reActivate(a.id)} title="Re-activate alert"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px 0', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#2563eb'}
                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                        <RefreshCw size={11} />
                      </button>
                      <button onClick={() => removeAlert(a.id)} title="Delete"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px 0', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#e11d48'}
                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))
          )}
        </div>

        {/* Telegram config */}
        <TelegramSection />
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
