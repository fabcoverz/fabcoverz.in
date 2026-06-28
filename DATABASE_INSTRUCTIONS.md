# FabCoverz — Complete Database Setup Instructions
# Run in Supabase Dashboard → SQL Editor (in order)

## ✅ STEP 1: Run FULL_DATABASE_SETUP.sql
This creates all core tables with RLS policies.
Copy and run the entire contents of `FULL_DATABASE_SETUP.sql`.

---

## ✅ STEP 2: Add Atomic Order Counter + Increment Function
Run this SQL to enable sequential order IDs (e.g., FC-1001, FC-1002...):

```sql
-- Atomic order counter
CREATE TABLE IF NOT EXISTS order_counter (
  id TEXT PRIMARY KEY DEFAULT 'fc_counter',
  value INTEGER NOT NULL DEFAULT 1000
);
INSERT INTO order_counter (id, value) VALUES ('fc_counter', 1000) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION increment_order_counter()
RETURNS INTEGER AS $$
DECLARE next_val INTEGER;
BEGIN
  UPDATE order_counter SET value = value + 1 WHERE id = 'fc_counter'
  RETURNING value INTO next_val;
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- RLS for order_counter
ALTER TABLE order_counter ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public use order_counter" ON order_counter;
CREATE POLICY "Public use order_counter" ON order_counter FOR ALL USING (true) WITH CHECK (true);
```

---

## ✅ STEP 3: Razorpay + COD Payment Method Migration
Run this to allow 'razorpay' as a payment method:

```sql
DO $$
DECLARE v_constraint text;
BEGIN
  SELECT tc.constraint_name INTO v_constraint
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_name = 'orders'
    AND tc.constraint_type = 'CHECK'
    AND ccu.column_name = 'payment_method'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE orders DROP CONSTRAINT ' || quote_ident(v_constraint);
  END IF;

  ALTER TABLE orders
    ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('cod', 'card', 'upi', 'razorpay'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

---

## ✅ STEP 4: Subcollection Product Order Column
```sql
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS subcollection_product_order JSONB DEFAULT '{}';
```

---

## ✅ STEP 5: Verify — Should return 10 rows
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'products','collections','banners','store_settings',
    'faqs','reviews','orders','visitor_sessions','abandoned_carts','order_counter'
  )
ORDER BY table_name;
```

---

## ✅ STEP 6: Deploy Edge Functions (Supabase CLI)
```bash
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
supabase functions deploy meta-capi
```

## ✅ STEP 7: Add Edge Function Secrets
In Supabase Dashboard → Edge Functions → Secrets, add:
- `RAZORPAY_KEY_ID` — your Razorpay key ID
- `RAZORPAY_KEY_SECRET` — your Razorpay secret key

## ✅ STEP 8: Create .env.local in project root
```
VITE_ADMIN_PASSWORD=FABCOVERZ@100607
```

---

## Summary of All Tables
| Table | Purpose |
|-------|---------|
| products | Product catalog |
| collections | Product collections/categories |
| banners | Homepage hero banners |
| store_settings | All admin-configurable settings |
| faqs | FAQ section |
| reviews | Customer reviews |
| orders | Customer orders (COD + Razorpay) |
| visitor_sessions | Live visitor tracking |
| abandoned_carts | Abandoned cart tracking |
| order_counter | Atomic sequential order IDs |
