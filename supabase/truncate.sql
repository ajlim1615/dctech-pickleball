-- ==============================================================================
-- DCPaddl: supabase/truncate.sql
-- Fresh Start Script: Resets all match data, queues, sessions, players, and courts
-- ==============================================================================

-- 1. Ensure staff monitoring columns exist on courts & matches
alter table public.courts
  add column if not exists assigned_staff_id uuid references public.profiles(id) on delete set null;

alter table public.matches
  add column if not exists referee_id uuid references public.profiles(id) on delete set null,
  add column if not exists serving_team public.match_team default 'team_a',
  add column if not exists server_number integer default 1;

-- 2. Truncate all match, queue, checkin, session, court, and profile tables
truncate table 
  public.player_ratings_history,
  public.match_players,
  public.matches,
  public.queue_entries,
  public.session_checkins,
  public.sessions,
  public.courts,
  public.profiles
cascade;
