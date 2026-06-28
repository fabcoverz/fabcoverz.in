-- ============================================================
-- FabCoverz — Visitor Tracking & Abandoned Cart Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Visitor Sessions (Live Tracking) ─────────────────────
create table if not exists visitor_sessions (
  id            text primary key,
  page          text not null default '/',
  cart_count    integer not null default 0,
  last_seen     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  ip_address    text,
  city          text,
  country       text
);

-- ── Abandoned Carts ───────────────────────────────────────
-- Saved when user fills address but doesn't complete payment
create table if not exists abandoned_carts (
  id              text primary key,
  session_id      text,
  customer_name   text,
  customer_phone  text,
  customer_email  text,
  city            text,
  state           text,
  pincode         text,
  items           jsonb not null default '[]',
  total           numeric not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────
alter table visitor_sessions  enable row level security;
alter table abandoned_carts   enable row level security;

-- Public can upsert visitor sessions (storefront heartbeat)
create policy "Public upsert visitor_sessions"
  on visitor_sessions for all using (true) with check (true);

-- Public can upsert abandoned_carts (checkout page writes)
create policy "Public upsert abandoned_carts"
  on abandoned_carts for all using (true) with check (true);

-- ── Auto-cleanup: remove stale sessions older than 6s ────
-- (heartbeat is 2s — 3 missed beats = visitor left)
-- Run as a pg_cron job every minute:
-- SELECT cron.schedule('cleanup-visitors', '* * * * *',
--   $$DELETE FROM visitor_sessions WHERE last_seen < now() - interval '6 seconds'$$);

-- ── Migration: add location columns to existing table ────
-- Run this if you already have visitor_sessions created:
alter table visitor_sessions add column if not exists ip_address text;
alter table visitor_sessions add column if not exists city       text;
alter table visitor_sessions add column if not exists country    text;
