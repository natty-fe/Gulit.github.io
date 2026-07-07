-- Add global committee price ranges to products.
-- Run this once in Supabase SQL Editor for an existing Gulit database.

alter table public.products
  add column if not exists min_price numeric,
  add column if not exists max_price numeric;

