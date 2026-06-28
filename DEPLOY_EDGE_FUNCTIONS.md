# Deploy Edge Functions — Step by Step

## Option A: Supabase Dashboard (No CLI needed)

### Deploy `nimbuspost-create-shipment`
1. Go to: https://supabase.com/dashboard/project/rrirrmjfdocqtfifzuiz/functions
2. Click **"Create a new function"**
3. Function name: `nimbuspost-create-shipment`
4. Paste the contents of: `supabase/functions/nimbuspost-create-shipment/index.ts`
5. Click **Deploy**
6. ⚠️ **CRITICAL — Disable JWT Verification:**
   - Click on `nimbuspost-create-shipment` → **Settings** tab
   - Toggle **"Verify JWT"** to **OFF**
   - This is required — without this, calls from the browser and from `verify-razorpay-payment`
     will get **401 Unauthorized** because the anon key is not a JWT Bearer token.

### Deploy `verify-razorpay-payment` (update existing)
1. In Functions list, click `verify-razorpay-payment`
2. Click **Edit**
3. Replace all code with contents of: `supabase/functions/verify-razorpay-payment/index.ts`
4. Click **Deploy**
5. ⚠️ **CRITICAL — Disable JWT Verification** (same as above → Settings → Verify JWT → OFF)

## Option B: Supabase CLI (recommended — auto-applies config.toml)

```bash
npx supabase login
npx supabase link --project-ref rrirrmjfdocqtfifzuiz
npx supabase functions deploy nimbuspost-create-shipment
npx supabase functions deploy verify-razorpay-payment
```

> **Note:** CLI deploy automatically applies `verify_jwt = false` from `config.toml`.
> Dashboard deploy ignores `config.toml` — you must set it manually in Settings.

## Secrets to Add (Dashboard → Edge Functions → Secrets)

Already set ✓ (confirmed in screenshot):
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `META_PIXEL_ID`
- `META_ACCESS_TOKEN`
- `ADMIN_PASSWORD`
- `NIMBUSPOST_API_KEY`
- `NIMBUSPOST_EMAIL`
- `NIMBUSPOST_PASSWORD`

`SUPABASE_URL` / `SUPABASE_SECRET_KEYS` are built-in ✓

## SQL (run once in SQL Editor)

```sql
-- Add AWB column (NimbusPost tracking number)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS awb TEXT;

-- Add alternate phone column (if not already done)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_alt_phone TEXT;
```

> **Or just re-run `FULL_DATABASE_SETUP.sql` / `MIGRATION_razorpay_cod_fix.sql` — both are idempotent.**
