-- ==============================================================================
-- Game state, part 1: the database owns game-state changes.
--   * One active queue entry per (session, player): active = status <> 'left'.
--   * One in-progress game per court.
--   * start_match: the only way a game starts (Call next and manual matches).
--
-- Busy court = an in_progress match on it (guaranteed one by the index below).
-- courts.status 'occupied' and courts.current_match_id are a display mirror that
-- only these procedures write.
--
-- Call with the signed-in admin's client, never the service key: is_admin() reads
-- the caller's auth.uid().
-- ==============================================================================

-- 1. One-time cleanup so the indexes can be built.
update public.queue_entries q
set status = 'left'
where q.status <> 'left'
  and exists (
    select 1 from public.queue_entries o
    where o.session_id = q.session_id and o.player_id = q.player_id and o.status <> 'left'
      and (o.joined_at, o.id) < (q.joined_at, q.id)
  );

update public.matches m
set status = 'abandoned', ended_at = coalesce(m.ended_at, now()), updated_at = now()
where m.status = 'in_progress'
  and exists (
    select 1 from public.matches o
    where o.court_id = m.court_id and o.status = 'in_progress'
      and (o.started_at, o.id) > (m.started_at, m.id)
  );

update public.courts c
set status = 'available', current_match_id = null, updated_at = now()
where (c.status = 'occupied' or c.current_match_id is not null)
  and not exists (
    select 1 from public.matches m where m.id = c.current_match_id and m.status = 'in_progress'
  );

-- 2. The rules.
create unique index if not exists queue_entries_one_active_per_player
  on public.queue_entries (session_id, player_id) where status <> 'left';

create unique index if not exists matches_one_live_per_court
  on public.matches (court_id) where status = 'in_progress';

-- 3. start_match
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

  update public.queue_entries
  set status = 'playing', called_at = now(), target_court_id = p_court_id
  where session_id = p_session_id
    and player_id = any (v_players)
    and status in ('waiting', 'called', 'on_break');

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
