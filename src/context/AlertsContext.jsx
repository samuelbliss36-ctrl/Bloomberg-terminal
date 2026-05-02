// Price-alert state + background polling engine.
// Mounts once at the app level so polling runs regardless of which page is active.
// Browser Notification + Telegram message fire when a target is crossed.

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { alerts as dbAlerts } from '../lib/db';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

const AlertsContext = createContext({
  alerts:      [],
  addAlert:    () => {},
  removeAlert: () => {},
  reActivate:  () => {},
  telegram:    { token: '', chatId: '' },
  setTelegram: () => {},
  activeCount: 0,
  prices:      {},
});

export function useAlerts() { return useContext(AlertsContext); }

const POLL_MS = 60_000;   // poll every 60 s

// Keys are scoped to the user so two accounts on the same device stay isolated
const telegramKey = (uid) => uid ? `ov_telegram_${uid}` : 'ov_telegram';

function lsGet(key, fb) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fb; } catch { return fb; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

async function sendTelegram(token, chatId, text) {
  try {
    const r = await fetch('/api/telegram', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, chatId, message: text }),
    });
    return r.ok;
  } catch { return false; }
}

export function AlertsProvider({ children }) {
  const { user } = useAuth();
  const [alertList, setAlertList] = useState(() => dbAlerts.load());
  const [telegram,  setTgState]   = useState(() => lsGet(telegramKey(user?.id), { token: '', chatId: '' }));
  const [prices,    setPrices]    = useState({});   // { TICKER: latestPrice }

  // Refs so the polling closure always sees the latest values
  const alertsRef   = useRef(alertList);
  const telegramRef = useRef(telegram);
  const userRef     = useRef(user);
  useEffect(() => { alertsRef.current = alertList;  }, [alertList]);
  useEffect(() => { telegramRef.current = telegram; }, [telegram]);
  useEffect(() => { userRef.current = user; },         [user]);

  // ── Reload from localStorage when cloud sync completes ───────────────────
  useEffect(() => {
    const handler = () => {
      const synced = dbAlerts.load();
      setAlertList(synced);
      alertsRef.current = synced;
    };
    window.addEventListener('ov:data-synced', handler);
    return () => window.removeEventListener('ov:data-synced', handler);
  }, []);

  // ── Persist helpers ──────────────────────────────────────────────────────
  const saveAlerts = useCallback((list) => {
    setAlertList(list);
    dbAlerts.save(list, userRef.current?.id);
  }, []);

  const setTelegram = useCallback((cfg) => {
    setTgState(cfg);
    lsSet(telegramKey(userRef.current?.id), cfg);
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const addAlert = useCallback(({ ticker, targetPrice, condition, note = '' }) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const a = {
      id,
      ticker:       ticker.trim().toUpperCase(),
      targetPrice:  parseFloat(targetPrice),
      condition,            // 'above' | 'below'
      note:         note.trim(),
      active:       true,
      createdAt:    new Date().toISOString(),
      triggeredAt:  null,
      triggeredPrice: null,
    };
    saveAlerts([...alertsRef.current, a]);
  }, [saveAlerts]);

  const removeAlert = useCallback((id) => {
    saveAlerts(alertsRef.current.filter(a => a.id !== id));
  }, [saveAlerts]);

  const reActivate = useCallback((id) => {
    saveAlerts(alertsRef.current.map(a =>
      a.id === id ? { ...a, active: true, triggeredAt: null, triggeredPrice: null } : a
    ));
  }, [saveAlerts]);

  // ── Polling engine ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const active = alertsRef.current.filter(a => a.active);
      if (!active.length) return;

      // Deduplicate tickers
      const tickers = [...new Set(active.map(a => a.ticker))];
      const fresh   = {};

      for (const sym of tickers) {
        try {
          const q = await api('/quote?symbol=' + sym);
          if (q?.c) fresh[sym] = q.c;
        } catch {}
        if (cancelled) return;
      }

      if (!Object.keys(fresh).length) return;
      setPrices(prev => ({ ...prev, ...fresh }));

      // Check each active alert against fresh prices
      const updated = alertsRef.current.map(a => {
        if (!a.active) return a;
        const price = fresh[a.ticker];
        if (price == null) return a;
        const hit = a.condition === 'above' ? price >= a.targetPrice : price <= a.targetPrice;
        if (!hit) return a;

        // ── Triggered! ──
        const title = `🔔 ${a.ticker} alert triggered`;
        const body  = `${a.ticker} is $${price.toFixed(2)} — ${a.condition === 'above' ? 'above' : 'below'} your $${Number(a.targetPrice).toFixed(2)} target${a.note ? `. ${a.note}` : ''}`;

        // Browser notification
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try { new Notification(title, { body, icon: '/favicon.ico' }); } catch {}
        }

        // Telegram
        const tg = telegramRef.current;
        if (tg.token && tg.chatId) {
          const msg =
            `<b>🔔 Price Alert Triggered</b>\n\n` +
            `<b>${a.ticker}</b> hit <b>$${price.toFixed(2)}</b>\n` +
            `Condition: ${a.condition === 'above' ? 'above' : 'below'} <b>$${Number(a.targetPrice).toFixed(2)}</b>` +
            (a.note ? `\nNote: ${a.note}` : '');
          sendTelegram(tg.token, tg.chatId, msg);
        }

        return { ...a, active: false, triggeredAt: new Date().toISOString(), triggeredPrice: price };
      });

      if (!cancelled) saveAlerts(updated);
    };

    poll();                             // Run immediately on mount
    const iv = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount = alertList.filter(a => a.active).length;

  return (
    <AlertsContext.Provider value={{
      alerts: alertList, addAlert, removeAlert, reActivate,
      telegram, setTelegram,
      activeCount, prices,
    }}>
      {children}
    </AlertsContext.Provider>
  );
}
