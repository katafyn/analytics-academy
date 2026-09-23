-- Analytics Academy accounts + cloud progress
-- Run this once in Supabase SQL Editor.
create table if not exists public.users (
  id uuid primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null
);
create index if not exists sessions_token_hash_idx on public.sessions(token_hash);

create table if not exists public.progress (
  user_id uuid primary key references public.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- The Node server uses the Supabase service-role key, so the tables are not
-- accessed directly by the browser. Keep the service-role key secret.
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.progress enable row level security;
