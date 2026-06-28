-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: Multi-Collection Products + Collection Visibility
-- Run this in your Supabase SQL editor BEFORE deploying the new code.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add collection_ids array to products table
--    This stores all collections a product belongs to.
--    We default to wrapping the existing collection_id so no data is lost.
alter table products
  add column if not exists collection_ids text[] default '{}';

-- 2. Back-fill collection_ids from existing collection_id for all products
--    (One-time migration — safe to run multiple times)
update products
set collection_ids = array[collection_id]
where
  (collection_ids is null or collection_ids = '{}')
  and collection_id is not null
  and collection_id <> '';

-- 3. Add is_visible boolean to collections table
--    Default TRUE so existing collections stay visible.
alter table collections
  add column if not exists is_visible boolean default true;

-- 4. Make sure all existing collections are visible
update collections
set is_visible = true
where is_visible is null;

-- Done! ✅
-- After running this, deploy the updated code.
-- New products will save to both collection_id (primary) and collection_ids (all).
