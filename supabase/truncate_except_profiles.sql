-- ==============================================================================
-- DCTECH | Pickleball: supabase/truncate_except_profiles.sql
-- Reset all matches, queues, sessions, and courts while KEEPING all registered profiles
-- ==============================================================================

-- 1. Ensure staff monitoring columns exist
alter table public.courts
  add column if not exists assigned_staff_id uuid references public.profiles(id) on delete set null;

alter table public.matches
  add column if not exists referee_id uuid references public.profiles(id) on delete set null,
  add column if not exists serving_team public.match_team default 'team_a',
  add column if not exists server_number integer default 1;

-- 2. Truncate operational data (Matches, Queue, Sessions, Checkins, Courts, Rating History)
-- (PROFILES TABLE IS PRESERVED!)
truncate table 
  public.player_ratings_history,
  public.match_players,
  public.matches,
  public.queue_entries,
  public.session_checkins,
  public.sessions,
  public.courts
cascade;

-- 3. Optional: Reset player game counters back to 0 while keeping accounts & skill ratings intact
update public.profiles
set games_played = 0,
    games_won = 0;
