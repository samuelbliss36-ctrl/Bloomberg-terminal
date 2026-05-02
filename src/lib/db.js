// Persistence abstraction — localStorage always, Supabase when signed in.
// localStorage writes are synchronous (instant). Supabase writes are fire-and-forget background.
// The app works 100% without Supabase configured.

import { supabase } from './supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function lsGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── Portfolio ─────────────────────────────────────────────────────────────────
// Shape: [{ticker, shares, avgCost}]
const LS_PORTFOLIO = 'ov_portfolio';

async function _syncPortfolioUp(userId, holdings) {
  if (!supabase || !userId) return;
  try {
    // Full replace: delete all, then re-insert
    await supabase.from('portfolio_positions').delete().eq('user_id', userId);
    if (holdings.length) {
      const rows = holdings.map(h => ({
        user_id:    userId,
        ticker:     h.ticker,
        shares:     h.shares,
        avg_cost:   h.avgCost,
        updated_at: new Date().toISOString(),
      }));
      await supabase.from('portfolio_positions').insert(rows);
    }
  } catch (e) { console.warn('portfolio sync-up failed:', e.message); }
}

export const portfolio = {
  load() { return lsGet(LS_PORTFOLIO, []); },

  save(holdings, userId) {
    lsSet(LS_PORTFOLIO, holdings);
    if (userId) _syncPortfolioUp(userId, holdings); // fire-and-forget
  },

  async sync(userId) {
    if (!supabase || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('portfolio_positions').select('*').eq('user_id', userId);
      if (error || !data?.length) return null;
      const holdings = data.map(r => ({ ticker: r.ticker, shares: +r.shares, avgCost: +r.avg_cost }));
      lsSet(LS_PORTFOLIO, holdings);
      return holdings;
    } catch (e) { console.warn('portfolio sync-down failed:', e.message); return null; }
  },
};

// ─── Copilot Conversations ─────────────────────────────────────────────────────
// Shape: [{id, title, messages, pageContext, updatedAt}]  — most recent first, max 20
const LS_CONVERSATIONS = 'ov_copilot_history';
const MAX_CONVERSATIONS = 20;

async function _syncConversationsUp(userId, conversations) {
  if (!supabase || !userId) return;
  try {
    const rows = conversations.map(c => ({
      id:           c.id,
      user_id:      userId,
      title:        c.title || 'Untitled',
      messages:     c.messages,
      page_context: c.pageContext || null,
      updated_at:   c.updatedAt || new Date().toISOString(),
    }));
    await supabase.from('copilot_conversations').upsert(rows, { onConflict: 'id' });
    // Prune old ones beyond MAX_CONVERSATIONS
    const { data } = await supabase
      .from('copilot_conversations').select('id').eq('user_id', userId)
      .order('updated_at', { ascending: false }).range(MAX_CONVERSATIONS, 9999);
    if (data?.length) {
      await supabase.from('copilot_conversations').delete()
        .in('id', data.map(r => r.id));
    }
  } catch (e) { console.warn('conversations sync-up failed:', e.message); }
}

export const conversations = {
  load() { return lsGet(LS_CONVERSATIONS, []); },

  save(convs, userId) {
    const trimmed = convs.slice(0, MAX_CONVERSATIONS);
    lsSet(LS_CONVERSATIONS, trimmed);
    if (userId) _syncConversationsUp(userId, trimmed);
  },

  async sync(userId) {
    if (!supabase || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('copilot_conversations').select('*').eq('user_id', userId)
        .order('updated_at', { ascending: false }).limit(MAX_CONVERSATIONS);
      if (error || !data?.length) return null;
      const convs = data.map(r => ({
        id:          r.id,
        title:       r.title,
        messages:    r.messages,
        pageContext: r.page_context,
        updatedAt:   r.updated_at,
      }));
      lsSet(LS_CONVERSATIONS, convs);
      return convs;
    } catch (e) { console.warn('conversations sync-down failed:', e.message); return null; }
  },
};

// ─── Saved Screener Presets ────────────────────────────────────────────────────
// Shape: [{id, name, filters, createdAt}]
const LS_SAVED_SCREENS = 'ov_saved_screens';

async function _syncScreensUp(userId, screens) {
  if (!supabase || !userId) return;
  try {
    await supabase.from('screener_presets').delete().eq('user_id', userId);
    if (screens.length) {
      const rows = screens.map(s => ({
        id:         s.id,
        user_id:    userId,
        name:       s.name,
        filters:    s.filters,
        created_at: s.createdAt || new Date().toISOString(),
      }));
      await supabase.from('screener_presets').insert(rows);
    }
  } catch (e) { console.warn('screens sync-up failed:', e.message); }
}

export const savedScreens = {
  load() { return lsGet(LS_SAVED_SCREENS, []); },

  save(screens, userId) {
    lsSet(LS_SAVED_SCREENS, screens);
    if (userId) _syncScreensUp(userId, screens);
  },

  async sync(userId) {
    if (!supabase || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('screener_presets').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error || !data?.length) return null;
      const screens = data.map(r => ({
        id:        r.id,
        name:      r.name,
        filters:   r.filters,
        createdAt: r.created_at,
      }));
      lsSet(LS_SAVED_SCREENS, screens);
      return screens;
    } catch (e) { console.warn('screens sync-down failed:', e.message); return null; }
  },
};

// ─── Recent Research ──────────────────────────────────────────────────────────
// Shape: [{id, label, type, ticker?, category}]  — most recent first, max 20
const LS_RECENT = 'ov_research_recent';
const MAX_RECENT = 20;

async function _syncRecentUp(userId, recent) {
  if (!supabase || !userId) return;
  try {
    const rows = recent.map((r, i) => ({
      user_id:   userId,
      ticker:    r.ticker || r.id,
      label:     r.label,
      item_type: r.type || 'equity',
      category:  r.category || 'Equities',
      viewed_at: new Date(Date.now() - i * 1000).toISOString(), // preserve order
    }));
    await supabase.from('recent_research').upsert(rows, { onConflict: 'user_id,ticker' });
  } catch (e) { console.warn('recent sync-up failed:', e.message); }
}

export const recentResearch = {
  load() { return lsGet(LS_RECENT, []); },

  save(recent, userId) {
    const trimmed = recent.slice(0, MAX_RECENT);
    lsSet(LS_RECENT, trimmed);
    if (userId) _syncRecentUp(userId, trimmed);
  },

  async sync(userId) {
    if (!supabase || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('recent_research').select('*').eq('user_id', userId)
        .order('viewed_at', { ascending: false }).limit(MAX_RECENT);
      if (error || !data?.length) return null;
      const recent = data.map(r => ({
        id:       r.ticker,
        ticker:   r.ticker,
        label:    r.label,
        type:     r.item_type,
        category: r.category,
      }));
      lsSet(LS_RECENT, recent);
      return recent;
    } catch (e) { console.warn('recent sync-down failed:', e.message); return null; }
  },
};

// ─── Watchlist ────────────────────────────────────────────────────────────────
// Shape: string[]  — ticker symbols, e.g. ["SPY","QQQ","AAPL"]
const LS_WATCHLIST     = 'ov_watchlist';
const DEFAULT_WATCHLIST = ["SPY","QQQ","MSFT","NVDA","TSLA","GOOGL","AMZN","META"];

async function _syncWatchlistUp(userId, tickers) {
  if (!supabase || !userId) return;
  try {
    await supabase.from('watchlists')
      .upsert({ user_id: userId, tickers, updated_at: new Date().toISOString() },
               { onConflict: 'user_id' });
  } catch (e) { console.warn('watchlist sync-up failed:', e.message); }
}

export const watchlist = {
  load() {
    const stored = lsGet(LS_WATCHLIST, null);
    return stored ?? [...DEFAULT_WATCHLIST];
  },

  save(tickers, userId) {
    lsSet(LS_WATCHLIST, tickers);
    if (userId) _syncWatchlistUp(userId, tickers);
  },

  async sync(userId) {
    if (!supabase || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('watchlists').select('tickers').eq('user_id', userId).single();
      if (error || !data) return null;
      lsSet(LS_WATCHLIST, data.tickers);
      return data.tickers;
    } catch (e) { console.warn('watchlist sync-down failed:', e.message); return null; }
  },
};

// ─── Price Alerts ─────────────────────────────────────────────────────────────
// Shape: [{id, ticker, targetPrice, condition:'above'|'below', note, active, createdAt, triggeredAt, triggeredPrice}]
// Alert list syncs to Supabase. Telegram credentials stay local-only (security).
const LS_ALERTS = 'ov_alerts';

async function _syncAlertsUp(userId, list) {
  if (!supabase || !userId) return;
  try {
    await supabase.from('price_alerts').delete().eq('user_id', userId);
    if (list.length) {
      const rows = list.map(a => ({
        id:              a.id,
        user_id:         userId,
        ticker:          a.ticker,
        target_price:    a.targetPrice,
        condition:       a.condition,
        note:            a.note || '',
        active:          a.active,
        created_at:      a.createdAt,
        triggered_at:    a.triggeredAt   || null,
        triggered_price: a.triggeredPrice != null ? a.triggeredPrice : null,
        updated_at:      new Date().toISOString(),
      }));
      await supabase.from('price_alerts').insert(rows);
    }
  } catch (e) { console.warn('alerts sync-up failed:', e.message); }
}

export const alerts = {
  load() { return lsGet(LS_ALERTS, []); },

  save(list, userId) {
    lsSet(LS_ALERTS, list);
    if (userId) _syncAlertsUp(userId, list); // fire-and-forget
  },

  async sync(userId) {
    if (!supabase || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('price_alerts').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error || !data?.length) return null;
      const list = data.map(r => ({
        id:             r.id,
        ticker:         r.ticker,
        targetPrice:    +r.target_price,
        condition:      r.condition,
        note:           r.note || '',
        active:         r.active,
        createdAt:      r.created_at,
        triggeredAt:    r.triggered_at   || null,
        triggeredPrice: r.triggered_price != null ? +r.triggered_price : null,
      }));
      lsSet(LS_ALERTS, list);
      return list;
    } catch (e) { console.warn('alerts sync-down failed:', e.message); return null; }
  },
};

// ─── Convenience default export ───────────────────────────────────────────────
const db = { portfolio, conversations, savedScreens, recentResearch, watchlist, alerts };
export default db;
