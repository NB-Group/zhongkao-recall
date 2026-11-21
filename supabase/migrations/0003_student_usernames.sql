alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
alter table public.profiles add constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,24}$');
