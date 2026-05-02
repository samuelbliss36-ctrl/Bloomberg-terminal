-- Omnes Videntes — Supabase schema
-- Run this in your Supabase project SQL editor (supabase.com → SQL Editor)

-- ── Portfolio Positions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_positions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker     text        NOT NULL,
  shares     numeric(18,6) NOT NULL,
  avg_cost   numeric(18,6) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ticker)
);
CREATE INDEX IF NOT EXISTS portfolio_positions_user_id_idx ON portfolio_positions(user_id);
ALTER TABLE portfolio_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own positions"
  ON portfolio_positions FOR ALL USING (auth.uid() = user_id);

-- ── Copilot Conversations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS copilot_conversations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text        NOT NULL DEFAULT 'Untitled',
  messages     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  page_context text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS copilot_conversations_user_id_idx ON copilot_conversations(user_id);
CREATE INDEX IF NOT EXISTS copilot_conversations_updated_at_idx ON copilot_conversations(updated_at DESC);
ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own conversations"
  ON copilot_conversations FOR ALL USING (auth.uid() = user_id);

-- ── Screener Presets ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS screener_presets (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  filters    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS screener_presets_user_id_idx ON screener_presets(user_id);
ALTER TABLE screener_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own presets"
  ON screener_presets FOR ALL USING (auth.uid() = user_id);

-- ── Recent Research ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recent_research (
  user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker    text        NOT NULL,
  label     text        NOT NULL,
  item_type text        NOT NULL DEFAULT 'equity',
  category  text        NOT NULL DEFAULT 'Equities',
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ticker)
);
CREATE INDEX IF NOT EXISTS recent_research_user_id_idx ON recent_research(user_id);
ALTER TABLE recent_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own history"
  ON recent_research FOR ALL USING (auth.uid() = user_id);
