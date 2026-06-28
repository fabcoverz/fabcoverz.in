-- Run this once on your existing Supabase DB
-- Adds mobile_image_url column to banners table

alter table banners add column if not exists mobile_image_url text default '';
