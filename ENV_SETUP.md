# Environment Variables Setup

## Required: Create `.env.local` in the project root

```
VITE_ADMIN_PASSWORD=FABCOVERZ@100607
```

**Important:** Add `.env.local` to your `.gitignore` so this is never committed to source control.

## Required: Supabase Edge Function Secrets

Add these via the Supabase dashboard → Edge Functions → Secrets:
- `RAZORPAY_KEY_SECRET` — your Razorpay secret key (for signature verification)

## Required: Database Migration

Run this SQL in Supabase SQL editor to enable atomic order IDs:

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
```

## Required: New Edge Function

Deploy `supabase/functions/verify-razorpay-payment/index.ts` for payment signature verification.
