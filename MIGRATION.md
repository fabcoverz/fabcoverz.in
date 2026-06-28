# FabCoverz — Cloudinary + Supabase Migration Guide

## ⚡ COD (Cash on Delivery) — Existing DB Migration

If your Supabase `orders` table was created **before COD support** was added,
run this one-time fix in **Supabase Dashboard → SQL Editor**:

```sql
-- Safe: drops old payment_method constraint and adds one that includes 'cod'
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
    EXECUTE 'ALTER TABLE orders DROP CONSTRAINT IF EXISTS ' || quote_ident(v_constraint);
  END IF;

  ALTER TABLE orders
    ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('cod', 'card', 'upi'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

> **Fresh install?** No action needed — `FULL_DATABASE_SETUP.sql` already includes `'cod'` in the constraint.

---

## What Changed

| Before | After |
|--------|-------|
| Images → Browser IndexedDB (base64) | Images → **Cloudinary CDN** (https:// URL) |
| Products/Orders → IndexedDB | Products/Orders → **Supabase** (Postgres) |
| Only works in your browser | Works across all devices / users |
| Customer orders invisible to you | Orders saved → visible in Admin Panel |

---

## Step 1: Supabase — Run the Schema

1. Go to **https://supabase.com/dashboard** → your project
2. Click **SQL Editor** in the left sidebar
3. Paste the entire contents of `supabase_schema.sql` and click **Run**
4. All 7 tables will be created with proper RLS policies

---

## Step 2: Cloudinary — Create Upload Preset

1. Go to **https://cloudinary.com/console**
2. Click **Settings** (gear icon, top right) → **Upload** tab
3. Scroll to **Upload presets** → **Add upload preset**
4. Fill in:
   - **Preset name:** `fabcoverz_unsigned`
   - **Signing mode:** `Unsigned`
   - **Folder:** `fabcoverz`
5. Click **Save**

That's it — the app code already has your Cloud Name `dwpoqtu3a`.

---

## Step 3: Deploy

```bash
npm install
npm run build
# Upload the dist/ folder to Vercel / Netlify
```

---

## New Files Added

| File | Purpose |
|------|---------|
| `src/utils/supabase.ts` | Raw Supabase REST API helpers |
| `src/utils/remoteStore.ts` | Drop-in replacement for `localStore.ts` |
| `src/utils/cloudinary.ts` | Image upload to Cloudinary |
| `supabase_schema.sql` | Run once in Supabase SQL Editor |

## Files Modified

| File | Change |
|------|--------|
| `src/App.tsx` | Import from `remoteStore` instead of `localStore` |
| `src/components/AdminPanel.tsx` | Import from `remoteStore`, upload images via Cloudinary |
| `src/components/CartDrawer.tsx` | Import from `remoteStore` so orders save to Supabase |

---

## How It Works

### Image Upload Flow
```
Admin uploads image
  → processAndUpload() resizes with canvas
  → uploads to Cloudinary
  → returns https://res.cloudinary.com/dwpoqtu3a/...
  → URL saved in Supabase products.images[]
```

### Order Flow
```
Customer places order in Cart
  → addOrder() called
  → order saved to Supabase orders table
  → Admin sees it in Admin Panel → Orders tab instantly
```

### Data Flow
```
App boots → initDB() checks Supabase
  → if empty: seeds default products/collections/settings
  → if has data: loads from Supabase
  → renders storefront
```

---

## Troubleshooting

**"Cloudinary upload failed"**
→ Make sure you created the `fabcoverz_unsigned` preset in Cloudinary dashboard (Step 2 above).

**"Supabase 401 error"**
→ The anon key in `supabase.ts` is correct. Check that RLS policies were created (run the SQL again).

**Products not loading**
→ Open browser DevTools → Network tab → look for failed `/rest/v1/products` calls.
→ Check Supabase dashboard → Table Editor to verify data exists.

**Orders not appearing in Admin**
→ Confirm `CartDrawer.tsx` imports from `remoteStore` (not `localStore`).
