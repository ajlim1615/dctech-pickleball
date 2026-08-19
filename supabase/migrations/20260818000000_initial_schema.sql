-- ==============================================================================
-- DCPaddl: 20260818000000_initial_schema.sql
-- Initial Schema: Extensions, Enums, Tables, Foreign Keys, and Indexes
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1. Create Enums
create type public.user_role as enum ('player', 'admin');
create type public.court_status as enum ('available', 'occupied', 'maintenance', 'reserved');
create type public.session_status as enum ('scheduled', 'active', 'completed', 'cancelled');
create type public.checkin_status as enum ('checked_in', 'checked_out');
create type public.queue_status as enum ('waiting', 'called', 'playing', 'left');
create type public.match_format as enum ('singles', 'doubles');
create type public.match_type as enum ('open_play', 'challenge', 'tournament');
create type public.match_status as enum ('pending', 'in_progress', 'completed', 'abandoned');
create type public.winning_team as enum ('team_a', 'team_b', 'tie');
create type public.match_team as enum ('team_a', 'team_b');

-- 2. Create Tables

-- PROFILES (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  display_name text,
  avatar_url text,
  role public.user_role not null default 'player',
  skill_rating numeric(4,2) not null default 3.00,
  games_played integer not null default 0,
  games_won integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- COURTS
create table public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  surface_type text default 'Cushioned Hardcourt',
  status public.court_status not null default 'available',
  current_match_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SESSIONS
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text not null default 'DCTECH Sports Arena',
  status public.session_status not null default 'scheduled',
  start_time timestamptz not null,
  end_time timestamptz not null,
  max_players integer,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SESSION CHECKINS
create table public.session_checkins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  status public.checkin_status not null default 'checked_in',
  checkin_time timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (session_id, player_id)
);

-- QUEUE ENTRIES
create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid, -- Group ID if paired for doubles
  status public.queue_status not null default 'waiting',
  joined_at timestamptz not null default now(),
  called_at timestamptz,
  target_court_id uuid references public.courts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- MATCHES
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  format public.match_format not null default 'doubles',
  match_type public.match_type not null default 'open_play',
  status public.match_status not null default 'in_progress',
  team_a_score integer not null default 0,
  team_b_score integer not null default 0,
  winning_team public.winning_team,
  started_at timestamptz default now(),
  ended_at timestamptz,
  recorded_by uuid references public.profiles(id) on delete set null,
  is_verified boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Circular FK link from courts to matches
alter table public.courts
  add constraint fk_courts_current_match
  foreign key (current_match_id) references public.matches(id) on delete set null;

-- MATCH PLAYERS
create table public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  team public.match_team not null,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

-- PLAYER RATINGS HISTORY
create table public.player_ratings_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  old_rating numeric(4,2) not null,
  new_rating numeric(4,2) not null,
  rating_change numeric(4,2) not null,
  recorded_at timestamptz not null default now()
);

-- 3. Create Indexes for High Performance
create index idx_profiles_role on public.profiles(role);
create index idx_courts_status on public.courts(status);
create index idx_sessions_status_start on public.sessions(status, start_time);
create index idx_session_checkins_session on public.session_checkins(session_id);
create index idx_queue_entries_session_status on public.queue_entries(session_id, status, joined_at);
create index idx_matches_session_status on public.matches(session_id, status);
create index idx_matches_court on public.matches(court_id);
create index idx_match_players_match on public.match_players(match_id);
create index idx_match_players_player on public.match_players(player_id);
create index idx_ratings_history_player on public.player_ratings_history(player_id, recorded_at desc);

-- 4. Enable Supabase Realtime for live court board and queue
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'courts') then
    alter publication supabase_realtime add table public.courts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'queue_entries') then
    alter publication supabase_realtime add table public.queue_entries;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'matches') then
    alter publication supabase_realtime add table public.matches;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'session_checkins') then
    alter publication supabase_realtime add table public.session_checkins;
  end if;
end $$;
