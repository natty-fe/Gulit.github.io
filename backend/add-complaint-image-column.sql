alter table public.complaints
add column if not exists image text;

notify pgrst, 'reload schema';
