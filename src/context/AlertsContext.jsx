// Price-alert state + background polling engine.
// Mounts once at the app level so polling runs regardless of which page is active.
// Browser Notification + Telegram message fire when a target is crossed.

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { alerts as dbAlerts } from '../lib/db';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

const AlertsContext = createContext({
  alerts:      [],
  addAlert:    () => {},
  removeAlert: () => {},
  reActivate:  () => {},
  telegram:    { token: '', chatId: '' },
  setTelegram: () => {},
  activeCount: 0,
  prices:      {},
  changePcts:  {},
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
    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) return false;
    const r = await fetch('/api/telegram', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({ token, chatId, message: text }),
    });
    return r.ok;
  } catch { return false; }
}

// Read telegram config from localStorage only — never from user_metadata
// (bot tokens must not live in the JWT)
function loadTelegram(user) {
  return lsGet(telegramKey(user?.id), { token: '', chatId: '' });
}

export function AlertsProvider({ children }) {
  const { user } = useAuth();
  const [alertList, setAlertList] = useState(() => dbAlerts.load());
  const [telegram,  setTgState]   = useState(() => loadTelegram(user));
  const [prices,    setPrices]    = useState({});
  const [changePcts, setChangePcts] = useState({});

  // Refs so the polling closure always sees the latest values
  const alertsRef   = useRef(alertList);
  const telegramRef = useRef(telegram);
  const userRef     = useRef(user);
  useEffect(() => { alertsRef.current = alertList;  }, [alertList]);
  useEffect(() => { telegramRef.current = telegram; }, [telegram]);
  useEffect(() => { userRef.current = user; },         [user]);

  // ── When user signs in, reload telegram from metadata if not in localStorage ─
  useEffect(() => {
    if (!user) return;
    const cfg = loadTelegram(user);
    setTgState(cfg);
    telegramRef.current = cfg;
  }, [user]); // eslint-disable-line

  // ── Reload alerts from localStorage when cloud sync completes ────────────
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

  // Save telegram: localStorage only — bot tokens must not be stored in Supabase
  // user_metadata because they are embedded in the JWT and visible to any decoder.
  const setTelegram = useCallback((cfg) => {
    setTgState(cfg);
    lsSet(telegramKey(userRef.current?.id), cfg);
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const addAlert = useCallback(({ ticker, targetPrice, condition, note = '', type = 'price' }) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const a = {
      id,
      ticker:         ticker.trim().toUpperCase(),
      type,                 // 'price' | 'changePct'
      targetPrice:    parseFloat(targetPrice),
      condition,            // 'above' | 'below'
      note:           note.trim(),
      active:         true,
      createdAt:      new Date().toISOString(),
      triggeredAt:    null,
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
      const fresh      = {};   // { sym: price }
      const freshChgPct = {}; // { sym: dayChangePct }

      for (const sym of tickers) {
        try {
          const q = await api('/quote?symbol=' + sym);
          if (q?.c)  fresh[sym]       = q.c;
          if (q?.dp != null) freshChgPct[sym] = q.dp;
        } catch {}
        if (cancelled) return;
      }

      if (!Object.keys(fresh).length) return;
      setPrices(prev    => ({ ...prev, ...fresh }));
      setChangePcts(prev => ({ ...prev, ...freshChgPct }));

      // Check each active alert against fresh data
      const updated = alertsRef.current.map(a => {
        if (!a.active) return a;
        const alertType = a.type || 'price'; // backward compat

        let currentValue;
        if (alertType === 'changePct') {
          currentValue = freshChgPct[a.ticker];
        } else {
          currentValue = fresh[a.ticker];
        }
        if (currentValue == null) return a;

        const hit = a.condition === 'above'
          ? currentValue >= a.targetPrice
          : currentValue <= a.targetPrice;
        if (!hit) return a;

        // ── Triggered! ──
        let title, body, telegramMsg;
        const price = fresh[a.ticker];

        if (alertType === 'changePct') {
          const sign = currentValue >= 0 ? '+' : '';
          title = `🔔 ${a.ticker} move alert triggered`;
          body  = `${a.ticker} is ${sign}${currentValue.toFixed(2)}% today — ${a.condition === 'above' ? 'above' : 'below'} your ${Number(a.targetPrice).toFixed(1)}% threshold${a.note ? `. ${a.note}` : ''}`;
          telegramMsg =
            `<b>🔔 Day Change Alert Triggered</b>\n\n` +
            `<b>${a.ticker}</b> is <b>${sign}${currentValue.toFixed(2)}%</b> today` +
            (price ? ` (now $${price.toFixed(2)})` : '') + `\n` +
            `Condition: ${a.condition === 'above' ? 'above' : 'below'} <b>${Number(a.targetPrice).toFixed(1)}%</b>` +
            (a.note ? `\nNote: ${a.note}` : '');
        } else {
          title = `🔔 ${a.ticker} alert triggered`;
          body  = `${a.ticker} is $${currentValue.toFixed(2)} — ${a.condition === 'above' ? 'above' : 'below'} your $${Number(a.targetPrice).toFixed(2)} target${a.note ? `. ${a.note}` : ''}`;
          telegramMsg =
            `<b>🔔 Price Alert Triggered</b>\n\n` +
            `<b>${a.ticker}</b> hit <b>$${currentValue.toFixed(2)}</b>\n` +
            `Condition: ${a.condition === 'above' ? 'above' : 'below'} <b>$${Number(a.targetPrice).toFixed(2)}</b>` +
            (a.note ? `\nNote: ${a.note}` : '');
        }

        // Browser notification
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try { new Notification(title, { body, icon: '/favicon.ico' }); } catch {}
        }

        // Telegram
        const tg = telegramRef.current;
        if (tg.token && tg.chatId) {
          sendTelegram(tg.token, tg.chatId, telegramMsg);
        }

        return {
          ...a,
          active:         false,
          triggeredAt:    new Date().toISOString(),
          triggeredPrice: alertType === 'changePct' ? currentValue : price,
        };
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
      activeCount, prices, changePcts,
    }}>
      {children}
    </AlertsContext.Provider>
  );
}
