-- ==============================================================================
-- Game state, part 2: swap_match_player swaps a no-show for the next waiting
-- player in one transaction. The no-show goes on a break at the back of the line.
-- The swap window (minutes) comes from the app's NO_SHOW_WINDOW_MINUTES.
-- Call with the signed-in admin's client, never the service key.
-- ==============================================================================

create or replace function public.swap_match_player(
  p_match_id uuid,
  p_out uuid,
  p_window_minutes integer
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
  v_court uuid;
  v_status public.match_status;
  v_score_a integer;
  v_score_b integer;
  v_started timestamptz;
  v_slot uuid;
  v_entry uuid;
  v_replacement uuid;
begin
  if not public.is_admin() then
    return json_build_object('error', 'not_admin');
  end if;

  select session_id into v_session from public.matches where id = p_match_id;
  if not found then
    return json_build_object('error', 'not_found');
  end if;

  -- Every game-state change in a session runs one at a time.
  perform 1 from public.sessions where id = v_session for update;

  select status, court_id, team_a_score, team_b_score, started_at
    into v_status, v_court, v_score_a, v_score_b, v_started
  from public.matches where id = p_match_id for update;

  if v_status <> 'in_progress' then
    return json_build_object('error', 'game_not_live');
  end if;
  if v_score_a <> 0 or v_score_b <> 0
     or (v_started is not null and v_started < now() - make_interval(mins => p_window_minutes)) then
    return json_build_object('error', 'swap_window_closed');
  end if;

  select id into v_slot from public.match_players where match_id = p_match_id and player_id = p_out;
  if not found then
    return json_build_object('error', 'not_in_game');
  end if;

  select q.id, q.player_id into v_entry, v_replacement
  from public.queue_entries q
  join public.profiles pr on pr.id = q.player_id
  where q.session_id = v_session
    and q.status = 'waiting'
    and q.player_id not in (select mp.player_id from public.match_players mp where mp.match_id = p_match_id)
    and lower(coalesce(pr.email, '')) <> 'admin@dctechmicro.com'
  order by q.joined_at, q.id
  limit 1
  for update of q;
  if not found then
    return json_build_object('error', 'no_replacement');
  end if;

  update public.queue_entries
  set status = 'playing', called_at = now(), target_court_id = v_court
  where id = v_entry;

  update public.match_players set player_id = v_replacement where id = v_slot;

  update public.queue_entries
  set status = 'on_break', joined_at = now(), target_court_id = null
  where session_id = v_session and player_id = p_out and status = 'playing';

  return json_build_object('replacement_id', v_replacement);
end;
$$;

revoke execute on function public.swap_match_player(uuid, uuid, integer) from public, anon;
grant execute on function public.swap_match_player(uuid, uuid, integer) to authenticated;
