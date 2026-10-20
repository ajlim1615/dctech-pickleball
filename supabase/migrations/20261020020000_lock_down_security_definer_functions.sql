-- ==============================================================================
-- 20261020020000_lock_down_security_definer_functions.sql
-- Closes holes flagged by the Supabase security advisor:
--   * complete_match was callable by anyone holding the anon key and never
--     checked for an admin, so any in-progress game (and games_played /
--     games_won) could be changed without signing in.
--   * is_admin and handle_new_user were executable by anon over /rest/v1/rpc.
--   * get_philippines_time had a mutable search_path.
-- ==============================================================================

-- 1. complete_match: admins only. Same body as 20260818000002, plus the guard.
-- It raises (rather than returning an error json) because finalizeMatch only
-- checks the RPC's error, never its returned data.
create or replace function public.complete_match(
  p_match_id uuid,
  p_team_a_score integer,
  p_team_b_score integer,
  p_recorded_by uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  v_winner public.winning_team;
  v_player record;
begin
  if not public.is_admin() then
    raise exception 'Only admins can record game results.' using errcode = '42501';
  end if;

  -- Fetch existing match
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match with ID % not found', p_match_id;
  end if;

  -- Determine winner
  if p_team_a_score > p_team_b_score then
    v_winner := 'team_a';
  elsif p_team_b_score > p_team_a_score then
    v_winner := 'team_b';
  else
    v_winner := 'tie';
  end if;

  -- Update Match Record
  update public.matches
  set
    team_a_score = p_team_a_score,
    team_b_score = p_team_b_score,
    winning_team = v_winner,
    status = 'completed',
    ended_at = now(),
    recorded_by = coalesce(p_recorded_by, auth.uid(), recorded_by),
    updated_at = now()
  where id = p_match_id;

  -- Set Court back to available
  update public.courts
  set
    status = 'available',
    current_match_id = null,
    updated_at = now()
  where id = v_match.court_id;

  -- Update Player stats (games_played, games_won)
  for v_player in
    select player_id, team from public.match_players where match_id = p_match_id
  loop
    update public.profiles
    set
      games_played = games_played + 1,
      games_won = case
        when (v_winner = 'team_a' and v_player.team = 'team_a') or
             (v_winner = 'team_b' and v_player.team = 'team_b') then games_won + 1
        else games_won
      end,
      updated_at = now()
    where id = v_player.player_id;

    -- Update queue status for these players
    update public.queue_entries
    set status = 'left'
    where player_id = v_player.player_id and session_id = v_match.session_id and status = 'playing';
  end loop;

  return json_build_object(
    'success', true,
    'match_id', p_match_id,
    'winner', v_winner
  );
end;
$$;

-- Signed-in users only (the function itself also requires an admin).
revoke execute on function public.complete_match(uuid, integer, integer, uuid) from public, anon;
grant execute on function public.complete_match(uuid, integer, integer, uuid) to authenticated;

-- 2. handle_new_user is a trigger function; nobody should call it over RPC.
-- The on_auth_user_created trigger still fires (triggers don't need EXECUTE).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3. is_admin: RLS policies use it, and all of them apply to authenticated
-- only, so anonymous callers have no reason to reach it.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 4. Pin get_philippines_time's search_path (it only uses pg_catalog functions).
alter function public.get_philippines_time() set search_path = '';
