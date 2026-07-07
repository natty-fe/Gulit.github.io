-- Gulit backend schema for the Express MVC API.
-- Run in Supabase SQL Editor after the existing migration.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  phone text unique,
  password_hash text not null,
  role text not null check (role in ('customer','owner','delivery','branch','main')),
  sub_city text,
  committee_id text,
  work_id text unique,
  fayda_fan text unique,
  avatar text,
  rating numeric default 0,
  reviews jsonb default '[]'::jsonb,
  password_reset_token_hash text,
  password_reset_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  name_am text,
  category text not null,
  unit text,
  icon text,
  image text,
  min_price numeric,
  max_price numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete cascade,
  name text not null,
  sub_city text,
  branch_committee_id text,
  status text not null default 'pending',
  rating numeric default 0,
  reviews jsonb default '[]'::jsonb,
  payment_accounts jsonb default '[]'::jsonb,
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  status_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.users(id),
  customer_name text,
  customer_sub_city text,
  shop_id uuid references public.shops(id),
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0 check (total >= 0),
  payment_type text,
  payment_status text,
  payment_proofs jsonb default '[]'::jsonb,
  status text not null default 'created',
  delivery_id uuid,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  shop_id uuid references public.shops(id),
  from_id uuid references public.users(id),
  from_name text,
  type text,
  message text not null,
  status text not null default 'open',
  decision text,
  decision_note text,
  decision_by uuid references public.users(id),
  wants_refund boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_users_role on public.users(role);
create index if not exists idx_shops_owner_id on public.shops(owner_id);
create index if not exists idx_inventory_shop_id on public.inventory(shop_id);
create index if not exists idx_inventory_product_id on public.inventory(product_id);
create index if not exists idx_inventory_status on public.inventory(status);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_shop_id on public.orders(shop_id);
create index if not exists idx_deliveries_order_id on public.deliveries(order_id);
create index if not exists idx_deliveries_courier_id on public.deliveries(courier_id);
create index if not exists idx_complaints_order_id on public.complaints(order_id);

alter table public.users add column if not exists password_reset_token_hash text;
alter table public.users add column if not exists password_reset_expires_at timestamptz;
create index if not exists idx_users_password_reset_token_hash on public.users(password_reset_token_hash);
