

create table if not exists public.inventory (
  id text primary key default gen_random_uuid()::text,
  shop_id uuid references public.shops(id) on delete cascade,
  product_id text references public.products(id) on delete cascade,
  qty numeric not null default 0 check (qty >= 0),
  price numeric not null default 0 check (price >= 0),
  old_price numeric,
  status text not null default 'approved',
  decision_by uuid references public.users(id),
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (shop_id, product_id)
);

create index if not exists idx_inventory_shop_id on public.inventory(shop_id);
create index if not exists idx_inventory_product_id on public.inventory(product_id);
create index if not exists idx_inventory_status on public.inventory(status);

