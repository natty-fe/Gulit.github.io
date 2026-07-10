create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('shop','product')),
  target_id text not null,
  created_at timestamptz default now(),
  unique (user_id, target_type, target_id)
);

delete from public.favorites where user_id is null;

alter table public.favorites
  alter column user_id set not null;

create index if not exists idx_favorites_user_id on public.favorites(user_id);
create index if not exists idx_favorites_target on public.favorites(target_type, target_id);

notify pgrst, 'reload schema';
