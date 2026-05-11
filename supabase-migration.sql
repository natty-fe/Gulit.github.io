-- GULIT — Supabase Phase 1 (auth + profiles)
-- Run this once in Supabase Studio → SQL Editor → New query → Run.
-- Safe to re-run: every CREATE/POLICY uses IF NOT EXISTS or is wrapped in
-- conditional logic.

-- ============================================================
-- 1. PROFILES TABLE
-- Mirrors the localStorage `users` shape (minus email, which lives in
-- auth.users) and keys to the Supabase auth user via foreign key.
-- ============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  phone         text,
  role          text not null check (role in ('customer','owner','delivery','branch','main')),
  sub_city      text,
  committee_id  text,
  work_id       text,
  fayda_fan     text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Unique constraints (only when value is present so customer profiles don't
-- conflict on NULL).
create unique index if not exists profiles_work_id_unique
  on public.profiles (work_id)
  where work_id is not null;

create unique index if not exists profiles_fayda_fan_unique
  on public.profiles (fayda_fan)
  where fayda_fan is not null;

-- ============================================================
-- 2. ROW-LEVEL SECURITY
-- Authenticated users can read any profile (needed for the Accounts panel,
-- live availability checks, etc.). Users can insert / update only their own.
-- ============================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- 3. updated_at TRIGGER
-- ============================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- Done. Phase 2 (shops/inventory/orders/etc.) is not part of this migration —
-- those tables stay in localStorage for now.
-- ============================================================
