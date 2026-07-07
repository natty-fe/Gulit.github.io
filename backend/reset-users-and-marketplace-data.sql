-- FULL GULIT DATA RESET
-- Run this in Supabase SQL Editor when you want to delete all app data and
-- start signups/listings from scratch.
--
-- This deletes users, shops, products, product/listing data, orders,
-- complaints, logs, and optional marketplace tables if they exist.
-- It keeps the database tables/schema themselves.

do $$
begin
  if to_regclass('public.audit_logs') is not null then
    truncate table public.audit_logs restart identity cascade;
  end if;

  if to_regclass('public.complaints') is not null then
    truncate table public.complaints restart identity cascade;
  end if;

  if to_regclass('public.orders') is not null then
    truncate table public.orders restart identity cascade;
  end if;

  if to_regclass('public.refunds') is not null then
    truncate table public.refunds restart identity cascade;
  end if;

  if to_regclass('public.deliveries') is not null then
    truncate table public.deliveries restart identity cascade;
  end if;

  if to_regclass('public.inventory') is not null then
    truncate table public.inventory restart identity cascade;
  end if;

  if to_regclass('public.product_proposals') is not null then
    truncate table public.product_proposals restart identity cascade;
  end if;

  if to_regclass('public.price_ranges') is not null then
    truncate table public.price_ranges restart identity cascade;
  end if;

  if to_regclass('public.notifications') is not null then
    truncate table public.notifications restart identity cascade;
  end if;

  if to_regclass('public.location_change_requests') is not null then
    truncate table public.location_change_requests restart identity cascade;
  end if;

  if to_regclass('public.shops') is not null then
    truncate table public.shops restart identity cascade;
  end if;

  if to_regclass('public.products') is not null then
    truncate table public.products restart identity cascade;
  end if;

  if to_regclass('public.users') is not null then
    truncate table public.users restart identity cascade;
  end if;
end $$;

-- Optional legacy cleanup:
-- If you previously used Supabase Auth/profiles and also want those accounts
-- removed, uncomment these lines and run them after confirming you want to
-- delete auth users too.
--
-- truncate table public.profiles restart identity cascade;
-- delete from auth.users;
