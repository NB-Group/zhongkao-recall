create extension if not exists pgcrypto;

create type public.learning_status as enum ('new', 'learning', 'review', 'suspended', 'mastered');
create type public.piece_status as enum ('locked', 'learning', 'learned', 'mastered');
create type public.review_grade as enum ('again', 'hard', 'good', 'easy');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  created_at timestamptz not null default now(),
  constraint profiles_nickname_length check (nickname is null or char_length(nickname) between 1 and 40)
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_new_words integer not null default 5 check (daily_new_words between 0 and 100),
  daily_review_limit integer not null default 30 check (daily_review_limit between 1 and 200),
  time_zone text not null default 'Asia/Shanghai',
  updated_at timestamptz not null default now()
);

create table public.learning_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  status public.learning_status not null default 'new',
  due_at timestamptz not null default now(),
  interval_days integer not null default 0 check (interval_days >= 0),
  lapse_count integer not null default 0 check (lapse_count >= 0),
  last_grade public.review_grade,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table public.review_events (
  event_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  grade public.review_grade not null,
  reviewed_at_client timestamptz not null,
  time_zone text not null,
  content_version text not null,
  created_at timestamptz not null default now()
);

create table public.piece_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  piece_id text not null,
  status public.piece_status not null default 'locked',
  full_check_grade public.review_grade,
  updated_at timestamptz not null default now(),
  primary key (user_id, piece_id)
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.learning_states enable row level security;
alter table public.review_events enable row level security;
alter table public.piece_progress enable row level security;

create policy "profiles are private" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "settings are private" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "learning states are private" on public.learning_states
  for select using (auth.uid() = user_id);

create policy "learning states can be inserted by owner" on public.learning_states
  for insert with check (auth.uid() = user_id);

create policy "learning states can be updated by owner" on public.learning_states
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "review events are private" on public.review_events
  for select using (auth.uid() = user_id);

create policy "review events can be appended by owner" on public.review_events
  for insert with check (auth.uid() = user_id);

create policy "piece progress is private" on public.piece_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
