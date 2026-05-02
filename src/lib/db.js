/**
 * Storage abstraction layer.
 *
 * Design principles:
 * - localStorage is always written first (instant, synchronous)
 * - Supabase sync is async background (fire-and-forget, never throws to caller)
 * - App works 100% without Supabase configured
 */

import { supabase } from './supabase';

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage quota exceeded or unavailable — ignore silently
  }
}

// ── Portfolio ─────────────────────────────────────────────────────────────────
// Shape: [{ ticker, shares, avgCost }]
// Table: portfolio_positions (user_id, ticker, shares, avg_cost, updated_at)

const portfolio = {
  load() {
    return safeGet('ov_portfolio', []);
  },

  save(data, userId) {
    safeSet('ov_portfolio', data);
    if (!supabase || !userId) return;
    (async () => {
      try {
        // Delete all existing positions for this user, then insert current
        await supabase
          .from('portfolio_positions')
          .delete()
          .eq('user_id', userId);

        if (data.length > 0) {
          const rows = data.map(h => ({
            user_id: userId,
            ticker: h.ticker,
            shares: h.shares,
            avg_cost: h.avgCost,
            updated_at: new Date().toISOString(),
          }));
          await supabase.from('portfolio_positions').insert(rows);
        }
      } catch (err) {
        // Never let Supabase errors surface to the caller
        console.warn('[db.portfolio.save]', err?.message || err);
      }
    })();
  },

  async sync(userId) {
    if (!supabase || !userId) return safeGet('ov_portfolio', []);
    try {
      const { data, error } = await supabase
        .from('portfolio_positions')
        .select('ticker, shares, avg_cost')
        .eq('user_id', userId);

      if (error) throw error;
      const holdings = (data || []).map(r => ({
        ticker: r.ticker,
        shares: r.shares,
        avgCost: r.avg_cost,
      }));
      safeSet('ov_portfolio', holdings);
      return holdings;
    } catch (err) {
      console.warn('[db.portfolio.sync]', err?.message || err);
      return safeGet('ov_portfolio', []);
    }
  },
};

// ── Conversations ─────────────────────────────────────────────────────────────
// Shape: [{ id, title, messages, page_context, updated_at }]
// Table: copilot_conversations (user_id, id uuid, title, messages jsonb, page_context, updated_at)
// Limit: last 20 by updated_at desc

const conversations = {
  load() {
    return safeGet('ov_copilot_history', []);
  },

  save(data, userId) {
    // Keep only last 20
    const limited = data.slice(0, 20);
    safeSet('ov_copilot_history', limited);
    if (!supabase || !userId) return;
    (async () => {
      try {
        for (const conv of limited) {
          await supabase
            .from('copilot_conversations')
            .upsert(
              {
                user_id: userId,
                id: conv.id,
                title: conv.title,
                messages: conv.messages,
                page_context: conv.page_context || null,
                updated_at: conv.updated_at || new Date().toISOString(),
              },
              { onConflict: 'id' }
            );
        }
      } catch (err) {
        console.warn('[db.conversations.save]', err?.message || err);
      }
    })();
  },

  async sync(userId) {
    if (!supabase || !userId) return safeGet('ov_copilot_history', []);
    try {
      const { data, error } = await supabase
        .from('copilot_conversations')
        .select('id, title, messages, page_context, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      const convs = data || [];
      safeSet('ov_copilot_history', convs);
      return convs;
    } catch (err) {
      console.warn('[db.conversations.sync]', err?.message || err);
      return safeGet('ov_copilot_history', []);
    }
  },
};

// ── Saved Screens ─────────────────────────────────────────────────────────────
// Shape: [{ id, name, filters, created_at }]
// Table: screener_presets (user_id, id uuid, name, filters jsonb, created_at)

const savedScreens = {
  load() {
    return safeGet('ov_saved_screens', []);
  },

  save(data, userId) {
    safeSet('ov_saved_screens', data);
    if (!supabase || !userId) return;
    (async () => {
      try {
        // Full replace: delete all, then insert all
        await supabase
          .from('screener_presets')
          .delete()
          .eq('user_id', userId);

        if (data.length > 0) {
          const rows = data.map(s => ({
            user_id: userId,
            id: s.id,
            name: s.name,
            filters: s.filters,
            created_at: s.created_at || new Date().toISOString(),
          }));
          await supabase.from('screener_presets').insert(rows);
        }
      } catch (err) {
        console.warn('[db.savedScreens.save]', err?.message || err);
      }
    })();
  },

  async sync(userId) {
    if (!supabase || !userId) return safeGet('ov_saved_screens', []);
    try {
      const { data, error } = await supabase
        .from('screener_presets')
        .select('id, name, filters, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const screens = data || [];
      safeSet('ov_saved_screens', screens);
      return screens;
    } catch (err) {
      console.warn('[db.savedScreens.sync]', err?.message || err);
      return safeGet('ov_saved_screens', []);
    }
  },
};

// ── Recent Research ───────────────────────────────────────────────────────────
// Shape: [{ id, label, type, ticker?, category }]
// Table: recent_research (user_id, ticker text, label, item_type, category, viewed_at)

const recentResearch = {
  load() {
    return safeGet('ov_research_recent', []);
  },

  save(data, userId) {
    safeSet('ov_research_recent', data);
    if (!supabase || !userId) return;
    (async () => {
      try {
        for (const item of data) {
          await supabase
            .from('recent_research')
            .upsert(
              {
                user_id: userId,
                ticker: item.ticker || item.id,
                label: item.label,
                item_type: item.type,
                category: item.category || null,
                viewed_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,ticker' }
            );
        }
      } catch (err) {
        console.warn('[db.recentResearch.save]', err?.message || err);
      }
    })();
  },

  async sync(userId) {
    if (!supabase || !userId) return safeGet('ov_research_recent', []);
    try {
      const { data, error } = await supabase
        .from('recent_research')
        .select('ticker, label, item_type, category, viewed_at')
        .eq('user_id', userId)
        .order('viewed_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      const items = (data || []).map(r => ({
        id: r.ticker,
        label: r.label,
        type: r.item_type,
        ticker: r.ticker,
        category: r.category,
      }));
      safeSet('ov_research_recent', items);
      return items;
    } catch (err) {
      console.warn('[db.recentResearch.sync]', err?.message || err);
      return safeGet('ov_research_recent', []);
    }
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export const db = {
  portfolio,
  conversations,
  savedScreens,
  recentResearch,
};
