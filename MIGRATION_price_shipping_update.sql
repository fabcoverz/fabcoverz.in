-- ─────────────────────────────────────────────────────────────────────────────
-- FabCoverz Price & Shipping Update Migration
-- Run this in your Supabase SQL Editor to apply the changes.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Set ALL existing products price to ₹199
--    comparePrice stays as-is (your original MRP), but we ensure at least ₹299 MRP shown
UPDATE products
SET
  price        = 199,
  compare_price = GREATEST(COALESCE(compare_price, 1200), 299),
  discount     = ROUND(((GREATEST(COALESCE(compare_price, 1200), 299) - 199.0)
                         / GREATEST(COALESCE(compare_price, 1200), 299)) * 100),
  updated_at   = NOW()
WHERE price <> 199;

-- 2. Verify the update
SELECT id, title, price, compare_price, discount
FROM products
ORDER BY created_at DESC
LIMIT 20;
