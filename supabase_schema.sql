-- ============================================================
-- FabCoverz — Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Products ──────────────────────────────────────────────
create table if not exists products (
  id              text primary key,
  title           text not null,
  price           numeric not null default 0,
  compare_price   numeric not null default 0,
  discount        numeric not null default 0,
  description     text,
  collection_id   text,
  tags            text[]  default '{}',
  stock_status    text    default 'in_stock'
                  check (stock_status in ('in_stock','low_stock','out_of_stock')),
  is_featured     boolean default false,
  is_trending     boolean default false,
  is_new_arrival  boolean default false,
  is_best_seller  boolean default false,
  images          text[]  default '{}',
  models          text[]  default '{}',
  reviews_count   integer default 0,
  rating          numeric default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Collections ───────────────────────────────────────────
create table if not exists collections (
  id          text primary key,
  name        text not null,
  slug        text not null unique,
  image       text,
  description text
);

-- ── Banners ───────────────────────────────────────────────
create table if not exists banners (
  id        text primary key,
  title     text,
  subtitle  text,
  badge     text default '',
  image_url text,
  link      text,
  active    boolean default true,
  "order"   integer default 0
);

-- ── Store Settings ────────────────────────────────────────
create table if not exists store_settings (
  id   text primary key default 'main',
  data jsonb not null default '{}'
);

-- We store all settings as a flat jsonb blob for flexibility.
-- The app reads/writes the entire row as one object.
-- Re-create as flat columns for easier admin queries:
drop table if exists store_settings;
create table if not exists store_settings (
  id                         text primary key default 'main',
  announcements              jsonb   default '[]',
  free_shipping_threshold    numeric default 499,
  contact_email              text    default '',
  contact_phone              text    default '',
  contact_address            text    default '',
  instagram_url              text    default '',
  facebook_url               text    default '',
  offer_text                 text    default '',
  logo_url                   text    default '',
  logo_text                  text    default '',
  logo_subtext               text    default '',
  brand_models               jsonb   default '{}',
  reassurance_card1_title    text    default '',
  reassurance_card1_body     text    default '',
  reassurance_card2_title    text    default '',
  reassurance_card2_body     text    default '',
  reassurance_card3_title    text    default '',
  reassurance_card3_body     text    default '',
  about_section_title        text    default '',
  about_section_subtitle     text    default '',
  about_section_desc1        text    default '',
  about_section_desc2        text    default '',
  banner_story_badge         text    default '',
  reviews_badge              text    default '',
  reviews_title              text    default '',
  reviews_subtitle           text    default '',
  footer_disclaimer          text    default '',
  trending_section_title     text    default '',
  trending_section_subtitle  text    default '',
  bestseller_section_badge   text    default '',
  bestseller_section_title   text    default '',
  bestseller_section_subtitle text   default '',
  contact_section_badge      text    default '',
  contact_section_title      text    default '',
  contact_section_subtitle   text    default '',
  newsletter_badge           text    default '',
  newsletter_title           text    default '',
  newsletter_subtitle        text    default '',
  newsletter_disclaimer      text    default '',
  top_selling_title          text    default '',
  top_selling_product_ids    jsonb   default '[]',
  collection_order           jsonb   default '[]',
  product_order              jsonb   default '{}',
  best_selling_metal_product_ids jsonb default '[]',
  updated_at                 timestamptz default now()
);

-- Migration: add missing columns if upgrading existing DB
alter table store_settings add column if not exists top_selling_title text default '';
alter table store_settings add column if not exists top_selling_product_ids jsonb default '[]';
alter table store_settings add column if not exists collection_order jsonb default '[]';
alter table store_settings add column if not exists product_order jsonb default '{}';
alter table store_settings add column if not exists best_selling_metal_product_ids jsonb default '[]';

-- ── FAQs ──────────────────────────────────────────────────
create table if not exists faqs (
  id       text primary key,
  question text not null,
  answer   text not null
);

-- ── Reviews ───────────────────────────────────────────────
create table if not exists reviews (
  id       text primary key,
  name     text not null,
  location text,
  review   text not null,
  rating   integer default 5,
  verified boolean default true
);

-- ── Orders ────────────────────────────────────────────────
create table if not exists orders (
  id               text primary key,
  items            jsonb not null default '[]',
  subtotal         numeric not null default 0,
  shipping         numeric not null default 0,
  total            numeric not null default 0,
  customer_name    text,
  customer_email   text,
  customer_phone   text,
  shipping_address text,
  city             text,
  state            text,
  pincode          text,
  payment_method   text default 'cod'
                   check (payment_method in ('cod','card','upi','razorpay')),
  status           text default 'pending'
                   check (status in ('pending','processing','shipped','delivered')),
  customer_alt_phone text,
  created_at       timestamptz default now()
);

-- ── Row Level Security (Public Read, Authenticated Write) ─
-- Enable RLS on all tables
alter table products        enable row level security;
alter table collections     enable row level security;
alter table banners         enable row level security;
alter table store_settings  enable row level security;
alter table faqs            enable row level security;
alter table reviews         enable row level security;
alter table orders          enable row level security;

-- Allow public (anon) to READ everything (storefront needs it)
create policy "Public read products"        on products        for select using (true);
create policy "Public read collections"     on collections     for select using (true);
create policy "Public read banners"         on banners         for select using (true);
create policy "Public read store_settings"  on store_settings  for select using (true);
create policy "Public read faqs"            on faqs            for select using (true);
create policy "Public read reviews"         on reviews         for select using (true);

-- Allow anon to INSERT orders (customers placing orders)
create policy "Public insert orders"        on orders          for insert with check (true);
-- Allow anon to read orders (admin panel uses anon key)
create policy "Public read orders"          on orders          for select using (true);

-- Allow anon full write access for admin panel
-- (In production, replace with service-role key or auth check)
create policy "Anon write products"         on products        for all    using (true) with check (true);
create policy "Anon write collections"      on collections     for all    using (true) with check (true);
create policy "Anon write banners"          on banners         for all    using (true) with check (true);
create policy "Anon write store_settings"   on store_settings  for all    using (true) with check (true);
create policy "Anon write faqs"             on faqs            for all    using (true) with check (true);
create policy "Anon write reviews"          on reviews         for all    using (true) with check (true);
create policy "Anon update orders"          on orders          for update using (true) with check (true);

-- Migration: add badge to banners if upgrading existing DB
alter table banners add column if not exists badge text default '';
