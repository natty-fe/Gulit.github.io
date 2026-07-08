

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete cascade,
  courier_id uuid references public.users(id),
  eta text,
  otp text,
  status text not null default 'assigned',
  courier_name text,
  courier_phone text,
  confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_deliveries_order_id on public.deliveries(order_id);
create index if not exists idx_deliveries_courier_id on public.deliveries(courier_id);

