// Floating alerts panel — rendered via createPortal to avoid CSS containment clipping.
// Shows: add-alert form, active alerts (with live price %), triggered history, Telegram config.

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Bell, BellOff, Plus, Trash2, RefreshCw, Send } from 'lucide-react';
import { useAlerts } from '../../context/AlertsContext';
import { supabase } from '../../lib/supabase';

const PANEL = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 340,
  zIndex: 99998,
  background: 'var(--surface-1, #fff)',
  borderLeft: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: "'Inter','IBM Plex Sans',sans-serif",
  boxShadow: 'var(--shadow-lg)',
};

const OVERLAY = {
  position: 'fixed',
  inset: 0,
  zIndex: 99997,
  background: 'rgba(0,0,0,0.25)',
};

function pctAway(current, target) {
  if (!current || !target) return null;
  return ((current - target) / target * 100).toFixed(1);
}

function AddForm({ onAdd, telegramConnected }) {
  const [ticker,    setTicker]    = useState('');
  const [target,    setTarget]    = useState('');
  const [condition, setCondition] = useState('above');
  const [alertType, setAlertType] = useState('price'); // 'price' | 'changePct'
  const [note,      setNote]      = useState('');
  const [err,       setErr]       = useState('');
  const [success,   setSuccess]   = useState('');

  const isChangePct = alertType === 'changePct';

  const submit = useCallback(() => {
    const sym = ticker.trim().toUpperCase();
    const val = parseFloat(target);
    if (!sym) return setErr('Enter a ticker symbol.');
    if (isNaN(val)) return setErr(`Enter a valid ${isChangePct ? 'percentage' : 'price'}.`);
    if (!isChangePct && val <= 0) return setErr('Price must be greater than 0.');
    setErr('');
    onAdd({ ticker: sym, targetPrice: val, condition, note, type: alertType });
    const dir = condition === 'above' ? 'above' : 'below';
    const valStr = isChangePct ? `${val > 0 ? '+' : ''}${val}%` : `$${val.toFixed(2)}`;
    setSuccess(`✓ Alert set — ${sym} ${dir} ${valStr}${telegramConnected ? ' · Telegram ready' : ''}`);
    setTimeout(() => setSuccess(''), 4000);
    setTicker(''); setTarget(''); setNote('');
  }, [ticker, target, condition, note, alertType, isChangePct, onAdd, telegramConnected]);

  const row = { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 };
  const label = { fontSize: 9, fontWeight: 700, color: 'var(--text-3, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.07em' };
  const inp = {
    fontSize: 11, padding: '5px 8px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--surface-0)',
    color: 'var(--text-1)', fontFamily: "'IBM Plex Mono',monospace",
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
      {/* Header row with Telegram status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.06em' }}>NEW ALERT</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: "'IBM Plex Mono',monospace",
          color: telegramConnected ? '#059669' : '#94a3b8' }}>
          <Send size={9} />
          {telegramConnected ? 'Telegram connected' : 'Telegram not set up'}
        </div>
      </div>

      {/* Alert type toggle */}
      <div style={{ ...row, marginBottom: 10 }}>
        <span style={label}>Alert Type</span>
        <div style={{ display: 'flex', background: 'var(--surface-0)', borderRadius: 6, padding: 2, border: '1px solid var(--border)' }}>
          {[
            { key: 'price',     label: '$ Price' },
            { key: 'changePct', label: '% Day Change' },
          ].map(t => (
            <button key={t.key} onClick={() => { setAlertType(t.key); setTarget(''); }}
              style={{ flex: 1, padding: '4px 0', border: 'none', borderRadius: 5, cursor: 'pointer', transition: 'all 0.15s',
                fontSize: 10, fontWeight: 700, fontFamily: "'Inter',sans-serif",
                background: alertType === t.key ? 'rgba(37,99,235,0.14)' : 'transparent',
                color: alertType === t.key ? '#2563eb' : 'var(--text-3)' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={row}>
          <span style={label}>Ticker</span>
          <input style={inp} value={ticker} placeholder="NVDA"
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        <div style={row}>
          <span style={label}>{isChangePct ? 'Target (%)' : 'Target ($)'}</span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 8, fontSize: 11, color: 'var(--text-3)', fontFamily: "'IBM Plex Mono',monospace", pointerEvents: 'none' }}>
              {isChangePct ? '%' : '$'}
            </span>
            <input style={{ ...inp, paddingLeft: 20 }}
              value={target}
              placeholder={isChangePct ? '3.0' : '500.00'}
              type="number"
              step={isChangePct ? '0.1' : '0.01'}
              onChange={e => setTarget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          {isChangePct && (
            <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: "'IBM Plex Mono',monospace", marginTop: 2 }}>
              e.g. 3 = alert when up 3%, -2 = alert when down 2%
            </span>
          )}
        </div>
      </div>
      <div style={{ ...row, marginBottom: 8 }}>
        <span style={label}>Condition</span>
        <div style={{ display: 'flex', background: 'var(--surface-0)', borderRadius: 6, padding: 2, border: '1px solid var(--border)' }}>
          {['above', 'below'].map(c => (
            <button key={c} onClick={() => setCondition(c)}
              style={{ flex: 1, padding: '4px 0', border: 'none', borderRadius: 5, cursor: 'pointer', transition: 'all 0.15s',
                fontSize: 10, fontWeight: 700, fontFamily: "'Inter',sans-serif",
                background: condition === c ? (c === 'above' ? 'rgba(5,150,105,0.14)' : 'rgba(225,29,72,0.12)') : 'transparent',
                color: condition === c ? (c === 'above' ? '#059669' : '#e11d48') : 'var(--text-3)' }}>
              {c === 'above'
                ? (isChangePct ? '▲ UP MORE THAN' : '▲ ABOVE')
                : (isChangePct ? '▼ DOWN MORE THAN' : '▼ BELOW')}
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

      {err     && <div style={{ fontSize: 10, color: '#e11d48', marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace" }}>{err}</div>}
      {success && (
        <div style={{ fontSize: 10, color: '#059669', marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace",
          background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.20)', borderRadius: 5, padding: '5px 8px' }}>
          {success}
        </div>
      )}

      <button onClick={submit}
        style={{ width: '100%', padding: '7px 0', border: 'none', borderRadius: 7, cursor: 'pointer',
          background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: "'Inter',sans-serif",
          letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'opacity 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
        <Plus size={12} /> SET ALERT
      </button>

      {!telegramConnected && (
        <div style={{ marginTop: 7, fontSize: 9, color: '#94a3b8', textAlign: 'center', fontFamily: "'Inter',sans-serif" }}>
          Set up Telegram below to receive alerts on your phone
        </div>
      )}
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
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) { setStatus('Not signed in'); return; }
      const r = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
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
    border: '1px solid var(--border)', background: 'var(--surface-0)',
    color: 'var(--text-1)', fontFamily: "'IBM Plex Mono',monospace",
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };
  const label = { fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3 };
  const connected = telegram.token && telegram.chatId;

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 14px' }}>
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
  const { alerts, addAlert, removeAlert, reActivate, prices, changePcts, activeCount, telegram } = useAlerts();
  const [tab, setTab] = useState('active');
  const telegramConnected = !!(telegram.token && telegram.chatId);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <Bell size={14} style={{ color: activeCount > 0 ? '#f59e0b' : 'var(--text-3)' }} />
          <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)', letterSpacing: '0.08em', flex: 1 }}>PRICE ALERTS</span>
          {activeCount > 0 && (
            <span style={{ background: '#f59e0b', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 6px', fontFamily: "'Inter',sans-serif" }}>
              {activeCount} ACTIVE
            </span>
          )}
          {telegramConnected && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#059669', fontFamily: "'IBM Plex Mono',monospace" }}>
              <Send size={9} /> TG
            </span>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
            <X size={14} />
          </button>
        </div>

        {/* Add form */}
        <AddForm onAdd={addAlert} telegramConnected={telegramConnected} />

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
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
                  const isChgPct = (a.type || 'price') === 'changePct';
                  const curPrice = prices[a.ticker];
                  const curChg   = changePcts[a.ticker];
                  const curVal   = isChgPct ? curChg : curPrice;
                  const pct      = !isChgPct ? pctAway(curPrice, a.targetPrice) : null;
                  const dir      = a.condition === 'above' ? '▲' : '▼';
                  const clr      = a.condition === 'above' ? '#059669' : '#e11d48';
                  const targetStr = isChgPct
                    ? `${Number(a.targetPrice) > 0 ? '+' : ''}${Number(a.targetPrice).toFixed(1)}%`
                    : `$${Number(a.targetPrice).toFixed(2)}`;
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--text-1)' }}>{a.ticker}</span>
                          <span style={{ fontSize: 9, background: isChgPct ? 'rgba(124,58,237,0.10)' : 'rgba(37,99,235,0.10)',
                            color: isChgPct ? '#7c3aed' : '#2563eb', border: `1px solid ${isChgPct ? 'rgba(124,58,237,0.25)' : 'rgba(37,99,235,0.25)'}`,
                            borderRadius: 4, padding: '1px 5px', fontFamily: "'IBM Plex Mono',monospace" }}>
                            {isChgPct ? '% chg' : '$ price'}
                          </span>
                          <span style={{ fontSize: 10, color: clr, fontWeight: 600 }}>{dir} {targetStr}</span>
                        </div>
                        {curVal != null && (
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'var(--text-3)' }}>
                            {isChgPct ? (
                              <>
                                Today: <span style={{ color: curChg >= 0 ? '#059669' : '#e11d48' }}>
                                  {curChg >= 0 ? '+' : ''}{curChg.toFixed(2)}%
                                </span>
                                {curPrice != null && <span style={{ marginLeft: 6 }}>(${curPrice.toFixed(2)})</span>}
                              </>
                            ) : (
                              <>
                                Now: <span style={{ color: 'var(--text-1)' }}>${curPrice.toFixed(2)}</span>
                                {pct != null && (
                                  <span style={{ color: Math.abs(pct) < 2 ? '#f59e0b' : 'var(--text-3)', marginLeft: 6 }}>
                                    {pct > 0 ? '+' : ''}{pct}% away
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        {curVal == null && <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'var(--text-3)' }}>Pending first poll…</div>}
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
              : triggered.map(a => {
                  const isChgPct = (a.type || 'price') === 'changePct';
                  const targetStr = isChgPct
                    ? `${Number(a.targetPrice) > 0 ? '+' : ''}${Number(a.targetPrice).toFixed(1)}%`
                    : `$${Number(a.targetPrice).toFixed(2)}`;
                  const hitStr = isChgPct
                    ? `${a.triggeredPrice >= 0 ? '+' : ''}${Number(a.triggeredPrice).toFixed(2)}% move`
                    : `$${Number(a.triggeredPrice).toFixed(2)}`;
                  return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <BellOff size={12} style={{ color: '#94a3b8', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--text-1)' }}>{a.ticker}</span>
                        {isChgPct && (
                          <span style={{ fontSize: 9, background: 'rgba(124,58,237,0.10)', color: '#7c3aed',
                            border: '1px solid rgba(124,58,237,0.25)', borderRadius: 4, padding: '1px 5px', fontFamily: "'IBM Plex Mono',monospace" }}>
                            % chg
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: a.condition === 'above' ? '#059669' : '#e11d48', fontWeight: 600 }}>
                          {a.condition === 'above' ? '▲' : '▼'} {targetStr}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'var(--text-3)' }}>
                        Hit {hitStr} · {new Date(a.triggeredAt).toLocaleString()}
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
                  );
                })
          )}
        </div>

        {/* Telegram config */}
        <TelegramSection />
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
