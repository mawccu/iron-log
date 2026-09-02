-- Iron Log · Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard -> SQL -> New query -> paste -> Run).
-- Safe to re-run: every statement is idempotent.

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '',
  units         text not null default 'kg',
  schedule      jsonb not null default '["A","cardio","B","rest","C","cardio","rest"]'::jsonb,
  prefs         jsonb not null default '{}'::jsonb,
  deloads       jsonb not null default '{}'::jsonb,
  updated_at    bigint not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------- sessions (one finished workout) ----------
create table if not exists public.sessions (
  id           uuid primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null,
  day          text not null check (day in ('A','B','C')),
  started_at   timestamptz,
  finished_at  timestamptz,
  sets         jsonb not null default '[]'::jsonb,   -- [{key,i,w,r,variant}]
  volume       numeric not null default 0,
  set_count    int not null default 0,
  notes        text not null default '',
  updated_at   bigint not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists sessions_user_date on public.sessions (user_id, date);

-- ---------- daily (habits, cardio, bodyweight, schedule overrides) ----------
create table if not exists public.daily (
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  protein     boolean not null default false,
  creatine    boolean not null default false,
  cardio_min  int not null default 0,
  cardio_hr   int,
  bodyweight  numeric,
  done        boolean,            -- manual schedule override (null = automatic)
  notes       text not null default '',
  updated_at  bigint not null default 0,
  primary key (user_id, date)
);

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.daily    enable row level security;

drop policy if exists "profiles: own rows" on public.profiles;
create policy "profiles: own rows" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "sessions: own rows" on public.sessions;
create policy "sessions: own rows" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "daily: own rows" on public.daily;
create policy "daily: own rows" on public.daily
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- auto-create a profile row on sign-up ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Done. Then in Authentication -> Providers -> Email you can turn OFF
-- "Confirm email" so your own account works instantly without an email round-trip.
