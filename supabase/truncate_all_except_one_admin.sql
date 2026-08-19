-- ==============================================================================
-- DCTECH | Pickleball: Reset Database (Keep 1 Admin Profile)
-- File: supabase/truncate_all_except_one_admin.sql
-- ==============================================================================

-- 1. Truncate all operational and match data tables
truncate table 
  public.player_ratings_history,
  public.match_players,
  public.matches,
  public.queue_entries,
  public.session_checkins,
  public.sessions,
  public.courts
cascade;

-- 2. Delete all player profiles EXCEPT the primary Admin account
delete from public.profiles
where id not in (
  select id from public.profiles
  where role = 'admin'
  order by created_at asc
  limit 1
);

-- 3. Reset game stats on the remaining Admin profile
update public.profiles
set games_played = 0,
    games_won = 0;

