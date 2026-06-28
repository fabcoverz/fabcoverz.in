-- ============================================================
-- FabCoverz — COMPLETE Database Setup
-- Run this ONCE in: Supabase Dashboard → SQL Editor
-- Safe to re-run (uses IF NOT EXISTS everywhere)
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

-- Safe column additions (ignored if column already exists)
alter table store_settings add column if not exists top_selling_title text default '';
alter table store_settings add column if not exists top_selling_product_ids jsonb default '[]';
alter table store_settings add column if not exists collection_order jsonb default '[]';
alter table store_settings add column if not exists product_order jsonb default '{}';
alter table store_settings add column if not exists subcollection_product_order jsonb default '{}';
alter table store_settings add column if not exists best_selling_metal_product_ids jsonb default '[]';
alter table banners add column if not exists badge text default '';
alter table banners add column if not exists mobile_image_url text default '';

-- ── Orders: payment_method migration (adds razorpay support, safe for existing DBs) ──
do $$
declare
  v_constraint text;
begin
  -- Find existing check constraint on payment_method
  select tc.constraint_name into v_constraint
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name
  where tc.table_name = 'orders'
    and tc.constraint_type = 'CHECK'
    and ccu.column_name = 'payment_method'
  limit 1;

  -- Drop it if found
  if v_constraint is not null then
    execute 'alter table orders drop constraint ' || quote_ident(v_constraint);
  end if;

  -- Add updated constraint with razorpay support
  alter table orders
    add constraint orders_payment_method_check
    check (payment_method in ('cod', 'card', 'upi', 'razorpay'));
exception when duplicate_object then
  null;
end $$;

-- Ensure payment_method column exists with cod as default (for very old schemas)
alter table orders add column if not exists payment_method text default 'cod';

-- Add customer_alt_phone column if not already present
alter table orders add column if not exists customer_alt_phone text;

-- Add awb (NimbusPost tracking number) column if not already present
alter table orders add column if not exists awb text;

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
                   check (payment_method in ('cod','card','upi')),
  status           text default 'pending'
                   check (status in ('pending','waiting_for_manufacturing','waiting_for_customer_confirmation','processing','ready_to_ship','waiting_for_pickup','shipped','out_for_delivery','delivered','cancelled','returned')),
  created_at       timestamptz default now()
);

-- ── Visitor Sessions (Live Tracking) ──────────────────────
create table if not exists visitor_sessions (
  id            text primary key,
  page          text not null default '/',
  cart_count    integer not null default 0,
  last_seen     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- ── Abandoned Carts ───────────────────────────────────────
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
alter table products        enable row level security;
alter table collections     enable row level security;
alter table banners         enable row level security;
alter table store_settings  enable row level security;
alter table faqs            enable row level security;
alter table reviews         enable row level security;
alter table orders          enable row level security;
alter table visitor_sessions enable row level security;
alter table abandoned_carts  enable row level security;

-- ── Policies (drop first to avoid duplicate errors on re-run)
-- Products
drop policy if exists "Public read products"    on products;
drop policy if exists "Anon write products"     on products;
create policy "Public read products"  on products for select using (true);
create policy "Anon write products"   on products for all    using (true) with check (true);

-- Collections
drop policy if exists "Public read collections" on collections;
drop policy if exists "Anon write collections"  on collections;
create policy "Public read collections"  on collections for select using (true);
create policy "Anon write collections"   on collections for all    using (true) with check (true);

-- Banners
drop policy if exists "Public read banners" on banners;
drop policy if exists "Anon write banners"  on banners;
create policy "Public read banners"  on banners for select using (true);
create policy "Anon write banners"   on banners for all    using (true) with check (true);

-- Store Settings
drop policy if exists "Public read store_settings" on store_settings;
drop policy if exists "Anon write store_settings"  on store_settings;
create policy "Public read store_settings"  on store_settings for select using (true);
create policy "Anon write store_settings"   on store_settings for all    using (true) with check (true);

-- FAQs
drop policy if exists "Public read faqs" on faqs;
drop policy if exists "Anon write faqs"  on faqs;
create policy "Public read faqs"  on faqs for select using (true);
create policy "Anon write faqs"   on faqs for all    using (true) with check (true);

-- Reviews
drop policy if exists "Public read reviews" on reviews;
drop policy if exists "Anon write reviews"  on reviews;
create policy "Public read reviews"  on reviews for select using (true);
create policy "Anon write reviews"   on reviews for all    using (true) with check (true);

-- Orders
drop policy if exists "Public insert orders" on orders;
drop policy if exists "Public read orders"   on orders;
drop policy if exists "Anon update orders"   on orders;
create policy "Public insert orders"  on orders for insert with check (true);
create policy "Public read orders"    on orders for select using (true);
create policy "Anon update orders"    on orders for update using (true) with check (true);

-- Visitor Sessions
drop policy if exists "Public upsert visitor_sessions" on visitor_sessions;
create policy "Public upsert visitor_sessions"
  on visitor_sessions for all using (true) with check (true);

-- Abandoned Carts
drop policy if exists "Public upsert abandoned_carts" on abandoned_carts;
create policy "Public upsert abandoned_carts"
  on abandoned_carts for all using (true) with check (true);

-- ── Verify: this should return 9 rows ─────────────────────
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'products','collections','banners','store_settings',
    'faqs','reviews','orders','visitor_sessions','abandoned_carts'
  )
order by table_name;
