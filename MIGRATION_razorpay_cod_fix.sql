-- ══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Razorpay + COD fix for existing FabCoverz DBs
-- Run this in Supabase → SQL Editor if your DB was already set up.
-- Safe to run multiple times (idempotent).
-- ══════════════════════════════════════════════════════════════════════════

-- Step 1: Drop old payment_method check constraint & re-add with razorpay
do $$
declare
  v_constraint text;
begin
  select tc.constraint_name into v_constraint
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name
  where tc.table_name = 'orders'
    and tc.constraint_type = 'CHECK'
    and ccu.column_name = 'payment_method'
  limit 1;

  if v_constraint is not null then
    execute 'alter table orders drop constraint ' || quote_ident(v_constraint);
  end if;

  alter table orders
    add constraint orders_payment_method_check
    check (payment_method in ('cod', 'card', 'upi', 'razorpay'));
exception when duplicate_object then
  null;
end $$;

-- Step 2: Add customer_alt_phone column (safe if already exists)
alter table orders add column if not exists customer_alt_phone text;

-- Step 3: Add awb (NimbusPost AWB tracking number) column (safe if already exists)
alter table orders add column if not exists awb text;

-- Done! Orders with paymentMethod "razorpay" and "cod" will now save correctly.
