

alter table public.products
  add column if not exists min_price numeric,
  add column if not exists max_price numeric;

