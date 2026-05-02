-- ─────────────────────────────────────────────────────────────────────────────
-- Omnes Videntes — Bloomberg Terminal · Supabase Schema
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── portfolio_positions ───────────────────────────────────────────────────────
create table if not exists public.portfolio_positions (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  ticker      text not null,
  shares      numeric(20, 6) not null default 0,
  avg_cost    numeric(20, 6) not null default 0,
  updated_at  timestamptz not null default now(),
  constraint portfolio_positions_user_ticker_key unique (user_id, ticker)
);

alter table public.portfolio_positions enable row level security;

create policy "Users own their portfolio_positions"
  on public.portfolio_positions
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists portfolio_positions_user_id_idx
  on public.portfolio_positions (user_id);


-- ── copilot_conversations ─────────────────────────────────────────────────────
create table if not exists public.copilot_conversations (
  id           uuid not null default gen_random_uuid() primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text,
  messages     jsonb not null default '[]',
  page_context text,
  updated_at   timestamptz not null default now()
);

alter table public.copilot_conversations enable row level security;

create policy "Users own their copilot_conversations"
  on public.copilot_conversations
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists copilot_conversations_user_id_idx
  on public.copilot_conversations (user_id);

create index if not exists copilot_conversations_updated_at_idx
  on public.copilot_conversations (user_id, updated_at desc);


-- ── screener_presets ──────────────────────────────────────────────────────────
create table if not exists public.screener_presets (
  id          uuid not null default gen_random_uuid() primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  filters     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

alter table public.screener_presets enable row level security;

create policy "Users own their screener_presets"
  on public.screener_presets
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists screener_presets_user_id_idx
  on public.screener_presets (user_id);


-- ── recent_research ───────────────────────────────────────────────────────────
create table if not exists public.recent_research (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  ticker      text not null,
  label       text,
  item_type   text,
  category    text,
  viewed_at   timestamptz not null default now(),
  constraint recent_research_user_ticker_key unique (user_id, ticker)
);

alter table public.recent_research enable row level security;

create policy "Users own their recent_research"
  on public.recent_research
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists recent_research_user_id_idx
  on public.recent_research (user_id);

create index if not exists recent_research_viewed_at_idx
  on public.recent_research (user_id, viewed_at desc);


-- ── subscriptions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id     text,
  stripe_subscription_id text        UNIQUE,
  status                 text        NOT NULL DEFAULT 'inactive',
  plan                   text        NOT NULL DEFAULT 'pro',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean     NOT NULL DEFAULT false,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own subscription"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);
