-- Run this once in Supabase: Project > SQL Editor > New query > paste this > Run

create table if not exists pitches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  company text not null,
  ask text not null,
  subject text,
  body text,
  status text not null default 'drafted',
  created_at timestamptz not null default now(),
  last_contact timestamptz,
  history jsonb not null default '[]'::jsonb
);

alter table pitches enable row level security;

create policy "Users can view their own pitches"
  on pitches for select
  using (auth.uid() = user_id);

create policy "Users can insert their own pitches"
  on pitches for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own pitches"
  on pitches for update
  using (auth.uid() = user_id);

create policy "Users can delete their own pitches"
  on pitches for delete
  using (auth.uid() = user_id);

create table if not exists profiles (
  user_id uuid references auth.users primary key,
  voice text default '',
  style_rules text default '',
  name text default '',
  about_me text default '',
  portfolio_link text default ''
);

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = user_id);
