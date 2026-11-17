-- ==============================================================================
-- Game state fixes (final review of the game-state branch):
--   * start_match locks the picked players' line entries before checking them, so
--     a Leave racing a Call next is either blocked or seen (line_changed).
--   * A manual match (p_from_queue = false) gives picked players who weren't in
--     line a 'playing' entry, so they can't rejoin the line, and be called onto a
--     second court, while they are on court.
--   * swap_match_player never swaps in someone who is in a game on another court.
-- Call with the signed-in admin's client, never the service key.
-- ==============================================================================

create or replace function public.start_match(
  p_session_id uuid,
  p_court_id uuid,
  p_team_a uuid[],
  p_team_b uuid[],
  p_from_queue boolean
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_players uuid[];
  v_count integer;
  v_session_status public.session_status;
  v_court_status public.court_status;
  v_match_id uuid;
begin
  if not public.is_admin() then
    return json_build_object('error', 'not_admin');
  end if;

  -- Equal sides of 1 or 2, nobody listed twice.
  v_players := coalesce(p_team_a, '{}') || coalesce(p_team_b, '{}');
  if coalesce(array_length(p_team_a, 1), 0) not in (1, 2)
     or coalesce(array_length(p_team_a, 1), 0) <> coalesce(array_length(p_team_b, 1), 0)
     or (select count(distinct x) from unnest(v_players) x where x is not null) <> array_length(v_players, 1) then
    return json_build_object('error', 'bad_teams');
  end if;

  -- Every game-state change in a session runs one at a time.
  select status into v_session_status from public.sessions where id = p_session_id for update;
  if not found then
    return json_build_object('error', 'not_found');
  end if;
  if v_session_status <> 'active' then
    return json_build_object('error', 'session_not_active');
  end if;

  select status into v_court_status from public.courts where id = p_court_id for update;
  if not found then
    return json_build_object('error', 'not_found');
  end if;
  if v_court_status in ('maintenance', 'reserved') then
    return json_build_object('error', 'court_closed');
  end if;
  if exists (select 1 from public.matches where court_id = p_court_id and status = 'in_progress') then
    return json_build_object('error', 'court_busy');
  end if;

  -- Lock the picked players' line entries: a Leave or break tapped at this moment
  -- waits for this game to start (and then finds them on court) instead of slipping
  -- between the check below and the claim.
  perform 1 from public.queue_entries
  where session_id = p_session_id and player_id = any (v_players) and status <> 'left'
  for update;

  if exists (
    select 1 from public.match_players mp
    join public.matches m on m.id = mp.match_id
    where m.status = 'in_progress' and mp.player_id = any (v_players)
  ) then
    return json_build_object('error', 'player_busy');
  end if;

  -- Check before writing: an error return does not undo earlier updates.
  if p_from_queue then
    select count(*) into v_count
    from public.queue_entries
    where session_id = p_session_id and player_id = any (v_players) and status = 'waiting';
    if v_count < array_length(v_players, 1) then
      return json_build_object('error', 'line_changed');
    end if;
  end if;

  -- 'playing' too: a stale on-court entry (no live game, checked above) is reused.
  update public.queue_entries
  set status = 'playing', called_at = now(), target_court_id = p_court_id
  where session_id = p_session_id
    and player_id = any (v_players)
    and status in ('waiting', 'called', 'on_break', 'playing');

  -- Picked by hand without a place in line: give them an on-court entry, so they
  -- can't join the line (and be called elsewhere) until this game is saved.
  if not p_from_queue then
    insert into public.queue_entries (session_id, player_id, status, called_at, target_court_id)
    select p_session_id, x, 'playing', now(), p_court_id
    from unnest(v_players) x
    where not exists (
      select 1 from public.queue_entries q
      where q.session_id = p_session_id and q.player_id = x and q.status <> 'left'
    )
    on conflict (session_id, player_id) where status <> 'left' do nothing;
  end if;

  insert into public.matches (session_id, court_id, format, status, team_a_score, team_b_score, started_at)
  values (
    p_session_id, p_court_id,
    case when array_length(p_team_a, 1) = 2 then 'doubles'::public.match_format else 'singles'::public.match_format end,
    'in_progress', 0, 0, now()
  )
  returning id into v_match_id;

  -- created_at follows the listed order (clock_timestamp ticks per row), so anything
  -- that replays "court order" (finish_match's requeue) is deterministic.
  insert into public.match_players (match_id, player_id, team, created_at)
  select v_match_id, t.x, t.team, clock_timestamp()
  from (
    select x, 'team_a'::public.match_team as team, i from unnest(p_team_a) with ordinality a(x, i)
    union all
    select x, 'team_b'::public.match_team, 10 + i from unnest(p_team_b) with ordinality b(x, i)
  ) t
  order by t.i;

  update public.courts
  set status = 'occupied', current_match_id = v_match_id, updated_at = now()
  where id = p_court_id;

  return json_build_object('match_id', v_match_id);
end;
$$;

revoke execute on function public.start_match(uuid, uuid, uuid[], uuid[], boolean) from public, anon;
grant execute on function public.start_match(uuid, uuid, uuid[], uuid[], boolean) to authenticated;

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
    -- never someone who is in a game on another court
    and not exists (
      select 1 from public.match_players mp2
      join public.matches m2 on m2.id = mp2.match_id
      where m2.status = 'in_progress' and mp2.player_id = q.player_id
    )
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
