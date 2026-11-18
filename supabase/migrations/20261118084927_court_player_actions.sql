-- ==============================================================================
-- Manual court control, part 3: change players on a live court, and undo it.
--   * court_changes: one row per change (who, what, before/after snapshot). It is
--     the audit trail and the undo log; only admins can read it.
--   * replace_match_player: someone from the line comes in; the player who comes
--     off goes to the BACK of the line (waiting).
--   * switch_match_teams: two players in the game change teams.
--   * remove_match_player: the player goes to the FRONT of the line; the slot stays
--     empty. The last player out ends the game (abandoned) and frees the court.
--   * fill_match_slot: a waiting player takes an empty slot.
--   * swap_match_player (no-show): any time now; optional p_in picks the
--     replacement. p_window_minutes is kept for the app still live and ignored.
--   * undo_court_change: puts back the latest change on that game, within 10 s,
--     only if nothing else changed since.
--   * finish_match refuses uneven or short teams (teams_incomplete).
-- Pairs: an action that separates partners clears group_id on both.
-- All lock the session row first. Call with the signed-in admin's client.
-- ==============================================================================

create table public.court_changes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  court_id uuid references public.courts (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('replace', 'switch', 'remove', 'fill', 'no_show', 'undo')),
  before jsonb not null,
  after jsonb not null,
  -- clock_timestamp: changes made in one transaction still have an order.
  created_at timestamptz not null default clock_timestamp(),
  undone_at timestamptz
);
create index court_changes_match_idx on public.court_changes (match_id, created_at desc);
create index court_changes_session_idx on public.court_changes (session_id);
create index court_changes_court_idx on public.court_changes (court_id);
create index court_changes_actor_idx on public.court_changes (actor_id);

alter table public.court_changes enable row level security;
create policy "Admins can read court changes"
  on public.court_changes for select to authenticated using (public.is_admin());

-- The game's roster and the given queue entries, in a stable order (for comparing).
create or replace function public._court_snapshot(p_match_id uuid, p_entry_ids uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('player_id', mp.player_id, 'team', mp.team) order by mp.player_id)
      from public.match_players mp where mp.match_id = p_match_id
    ), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'status', q.status, 'joined_at', q.joined_at,
        'target_court_id', q.target_court_id, 'group_id', q.group_id
      ) order by q.id)
      from public.queue_entries q where q.id = any (coalesce(p_entry_ids, '{}'))
    ), '[]'::jsonb)
  );
$$;
revoke execute on function public._court_snapshot(uuid, uuid[]) from public, anon, authenticated;

-- The active entry of each player, plus the active entry of any partner.
create or replace function public._entries_with_partners(p_session_id uuid, p_players uuid[])
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(distinct q.id), '{}')
  from public.queue_entries q
  where q.session_id = p_session_id and q.status <> 'left'
    and (
      q.player_id = any (p_players)
      or q.group_id in (
        select q2.group_id from public.queue_entries q2
        where q2.session_id = p_session_id and q2.status <> 'left'
          and q2.group_id is not null and q2.player_id = any (p_players)
      )
    );
$$;
revoke execute on function public._entries_with_partners(uuid, uuid[]) from public, anon, authenticated;

-- Run after a change: a listed player whose partner is now on the other side of this
-- game (one in it, one not) is no longer paired; both lose group_id.
-- Returns the players who were unpaired.
create or replace function public._unpair_split(p_session_id uuid, p_match_id uuid, p_players uuid[])
returns uuid[]
language plpgsql
set search_path = ''
as $$
declare
  v_unpaired uuid[];
begin
  select array_agg(distinct x) into v_unpaired
  from (
    select unnest(array[q2.player_id, q3.player_id]) as x
    from public.queue_entries q2
    join public.queue_entries q3
      on q3.session_id = q2.session_id and q3.group_id = q2.group_id
     and q3.player_id <> q2.player_id and q3.status <> 'left'
    where q2.session_id = p_session_id and q2.status <> 'left' and q2.group_id is not null
      and q2.player_id = any (p_players)
      and exists (select 1 from public.match_players mp where mp.match_id = p_match_id and mp.player_id = q2.player_id)
          is distinct from
          exists (select 1 from public.match_players mp where mp.match_id = p_match_id and mp.player_id = q3.player_id)
  ) t;
  if v_unpaired is not null then
    update public.queue_entries set group_id = null
    where session_id = p_session_id and status <> 'left' and player_id = any (v_unpaired);
  end if;
  return coalesce(v_unpaired, '{}');
end;
$$;
revoke execute on function public._unpair_split(uuid, uuid, uuid[]) from public, anon, authenticated;

-- Shared check for a player coming onto a court: waiting in this session's line, not
-- on any live court, not the house account. Returns their entry id or an error code.
create or replace function public._incoming_entry(p_session_id uuid, p_player uuid, out o_entry uuid, out o_error text)
language plpgsql
set search_path = ''
as $$
begin
  select q.id into o_entry from public.queue_entries q
  where q.session_id = p_session_id and q.player_id = p_player and q.status = 'waiting'
  for update;
  if not found or public.is_house_account(p_player) then
    o_error := 'not_waiting';
    return;
  end if;
  if exists (
    select 1 from public.match_players mp join public.matches m on m.id = mp.match_id
    where m.status = 'in_progress' and mp.player_id = p_player
  ) then
    o_entry := null;
    o_error := 'player_busy';
  end if;
end;
$$;
revoke execute on function public._incoming_entry(uuid, uuid) from public, anon, authenticated;

create or replace function public.replace_match_player(p_match_id uuid, p_out uuid, p_in uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid; v_court uuid; v_status public.match_status;
  v_in_entry uuid; v_err text; v_ids uuid[]; v_before jsonb; v_unpaired uuid[]; v_change uuid;
begin
  if not public.is_admin() then return json_build_object('error', 'not_admin'); end if;
  select session_id into v_session from public.matches where id = p_match_id;
  if not found then return json_build_object('error', 'not_found'); end if;
  perform 1 from public.sessions where id = v_session for update;
  select status, court_id into v_status, v_court from public.matches where id = p_match_id for update;
  if v_status <> 'in_progress' then return json_build_object('error', 'game_not_live'); end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = p_out) then
    return json_build_object('error', 'not_in_game');
  end if;
  select o_entry, o_error into v_in_entry, v_err from public._incoming_entry(v_session, p_in);
  if v_err is not null then return json_build_object('error', v_err); end if;

  v_ids := public._entries_with_partners(v_session, array[p_out, p_in]);
  v_before := public._court_snapshot(p_match_id, v_ids);

  update public.match_players set player_id = p_in where match_id = p_match_id and player_id = p_out;
  update public.queue_entries set status = 'playing', called_at = now(), target_court_id = v_court where id = v_in_entry;
  update public.queue_entries set status = 'waiting', joined_at = clock_timestamp(), called_at = null, target_court_id = null
  where session_id = v_session and player_id = p_out and status <> 'left';
  v_unpaired := public._unpair_split(v_session, p_match_id, array[p_out, p_in]);

  insert into public.court_changes (session_id, match_id, court_id, actor_id, kind, before, after)
  values (v_session, p_match_id, v_court, auth.uid(), 'replace', v_before, public._court_snapshot(p_match_id, v_ids))
  returning id into v_change;
  return json_build_object('change_id', v_change, 'unpaired', to_json(v_unpaired));
end;
$$;
revoke execute on function public.replace_match_player(uuid, uuid, uuid) from public, anon;
grant execute on function public.replace_match_player(uuid, uuid, uuid) to authenticated;

create or replace function public.switch_match_teams(p_match_id uuid, p_player_1 uuid, p_player_2 uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid; v_court uuid; v_status public.match_status;
  v_team_1 public.match_team; v_team_2 public.match_team; v_before jsonb; v_change uuid;
begin
  if not public.is_admin() then return json_build_object('error', 'not_admin'); end if;
  select session_id into v_session from public.matches where id = p_match_id;
  if not found then return json_build_object('error', 'not_found'); end if;
  perform 1 from public.sessions where id = v_session for update;
  select status, court_id into v_status, v_court from public.matches where id = p_match_id for update;
  if v_status <> 'in_progress' then return json_build_object('error', 'game_not_live'); end if;
  select team into v_team_1 from public.match_players where match_id = p_match_id and player_id = p_player_1;
  select team into v_team_2 from public.match_players where match_id = p_match_id and player_id = p_player_2;
  if v_team_1 is null or v_team_2 is null then return json_build_object('error', 'not_in_game'); end if;
  if v_team_1 = v_team_2 then return json_build_object('error', 'same_team'); end if;

  v_before := public._court_snapshot(p_match_id, '{}');
  update public.match_players set team = v_team_2 where match_id = p_match_id and player_id = p_player_1;
  update public.match_players set team = v_team_1 where match_id = p_match_id and player_id = p_player_2;

  insert into public.court_changes (session_id, match_id, court_id, actor_id, kind, before, after)
  values (v_session, p_match_id, v_court, auth.uid(), 'switch', v_before, public._court_snapshot(p_match_id, '{}'))
  returning id into v_change;
  return json_build_object('change_id', v_change);
end;
$$;
revoke execute on function public.switch_match_teams(uuid, uuid, uuid) from public, anon;
grant execute on function public.switch_match_teams(uuid, uuid, uuid) to authenticated;

create or replace function public.remove_match_player(p_match_id uuid, p_player uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid; v_court uuid; v_status public.match_status;
  v_ids uuid[]; v_before jsonb; v_front timestamptz; v_unpaired uuid[]; v_change uuid;
begin
  if not public.is_admin() then return json_build_object('error', 'not_admin'); end if;
  select session_id into v_session from public.matches where id = p_match_id;
  if not found then return json_build_object('error', 'not_found'); end if;
  perform 1 from public.sessions where id = v_session for update;
  select status, court_id into v_status, v_court from public.matches where id = p_match_id for update;
  if v_status <> 'in_progress' then return json_build_object('error', 'game_not_live'); end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = p_player) then
    return json_build_object('error', 'not_in_game');
  end if;

  v_ids := public._entries_with_partners(v_session, array[p_player]);
  v_before := public._court_snapshot(p_match_id, v_ids);

  select min(joined_at) - interval '1 millisecond' into v_front
  from public.queue_entries where session_id = v_session and status = 'waiting';
  delete from public.match_players where match_id = p_match_id and player_id = p_player;
  update public.queue_entries
  set status = 'waiting', joined_at = coalesce(v_front, clock_timestamp()), called_at = null, target_court_id = null
  where session_id = v_session and player_id = p_player and status <> 'left';
  v_unpaired := public._unpair_split(v_session, p_match_id, array[p_player]);

  if not exists (select 1 from public.match_players where match_id = p_match_id) then
    update public.matches set status = 'abandoned', ended_at = now(), updated_at = now() where id = p_match_id;
    update public.courts set status = 'available', current_match_id = null, updated_at = now()
    where id = v_court and current_match_id = p_match_id;
    return json_build_object('change_id', null, 'abandoned', true);
  end if;

  insert into public.court_changes (session_id, match_id, court_id, actor_id, kind, before, after)
  values (v_session, p_match_id, v_court, auth.uid(), 'remove', v_before, public._court_snapshot(p_match_id, v_ids))
  returning id into v_change;
  return json_build_object('change_id', v_change, 'unpaired', to_json(v_unpaired));
end;
$$;
revoke execute on function public.remove_match_player(uuid, uuid) from public, anon;
grant execute on function public.remove_match_player(uuid, uuid) to authenticated;

create or replace function public.fill_match_slot(p_match_id uuid, p_team public.match_team, p_player uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid; v_court uuid; v_status public.match_status; v_format public.match_format;
  v_entry uuid; v_err text; v_ids uuid[]; v_before jsonb; v_unpaired uuid[]; v_change uuid;
begin
  if not public.is_admin() then return json_build_object('error', 'not_admin'); end if;
  select session_id into v_session from public.matches where id = p_match_id;
  if not found then return json_build_object('error', 'not_found'); end if;
  perform 1 from public.sessions where id = v_session for update;
  select status, court_id, format into v_status, v_court, v_format from public.matches where id = p_match_id for update;
  if v_status <> 'in_progress' then return json_build_object('error', 'game_not_live'); end if;
  if (select count(*) from public.match_players where match_id = p_match_id and team = p_team)
     >= (case when v_format = 'doubles' then 2 else 1 end) then
    return json_build_object('error', 'slot_full');
  end if;
  select o_entry, o_error into v_entry, v_err from public._incoming_entry(v_session, p_player);
  if v_err is not null then return json_build_object('error', v_err); end if;

  v_ids := public._entries_with_partners(v_session, array[p_player]);
  v_before := public._court_snapshot(p_match_id, v_ids);

  insert into public.match_players (match_id, player_id, team, created_at) values (p_match_id, p_player, p_team, clock_timestamp());
  update public.queue_entries set status = 'playing', called_at = now(), target_court_id = v_court where id = v_entry;
  v_unpaired := public._unpair_split(v_session, p_match_id, array[p_player]);

  insert into public.court_changes (session_id, match_id, court_id, actor_id, kind, before, after)
  values (v_session, p_match_id, v_court, auth.uid(), 'fill', v_before, public._court_snapshot(p_match_id, v_ids))
  returning id into v_change;
  return json_build_object('change_id', v_change, 'unpaired', to_json(v_unpaired));
end;
$$;
revoke execute on function public.fill_match_slot(uuid, public.match_team, uuid) from public, anon;
grant execute on function public.fill_match_slot(uuid, public.match_team, uuid) to authenticated;

-- No-show: same inputs as before plus p_in. p_window_minutes is no longer used.
drop function public.swap_match_player(uuid, uuid, integer);
create function public.swap_match_player(
  p_match_id uuid,
  p_out uuid,
  p_window_minutes integer default null,
  p_in uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid; v_court uuid; v_status public.match_status;
  v_in uuid := p_in; v_entry uuid; v_err text; v_ids uuid[]; v_before jsonb; v_change uuid;
begin
  if not public.is_admin() then return json_build_object('error', 'not_admin'); end if;
  select session_id into v_session from public.matches where id = p_match_id;
  if not found then return json_build_object('error', 'not_found'); end if;
  perform 1 from public.sessions where id = v_session for update;
  select status, court_id into v_status, v_court from public.matches where id = p_match_id for update;
  if v_status <> 'in_progress' then return json_build_object('error', 'game_not_live'); end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = p_out) then
    return json_build_object('error', 'not_in_game');
  end if;

  if v_in is null then
    select q.player_id into v_in
    from public.queue_entries q
    where q.session_id = v_session and q.status = 'waiting'
      and not public.is_house_account(q.player_id)
      and not exists (
        select 1 from public.match_players mp2 join public.matches m2 on m2.id = mp2.match_id
        where m2.status = 'in_progress' and mp2.player_id = q.player_id
      )
    order by q.joined_at, q.id
    limit 1;
    if v_in is null then return json_build_object('error', 'no_replacement'); end if;
  end if;
  select o_entry, o_error into v_entry, v_err from public._incoming_entry(v_session, v_in);
  if v_err is not null then return json_build_object('error', v_err); end if;

  v_ids := public._entries_with_partners(v_session, array[p_out, v_in]);
  v_before := public._court_snapshot(p_match_id, v_ids);

  update public.match_players set player_id = v_in where match_id = p_match_id and player_id = p_out;
  update public.queue_entries set status = 'playing', called_at = now(), target_court_id = v_court where id = v_entry;
  update public.queue_entries set status = 'on_break', joined_at = clock_timestamp(), called_at = null, target_court_id = null
  where session_id = v_session and player_id = p_out and status <> 'left';
  perform public._unpair_split(v_session, p_match_id, array[p_out, v_in]);

  insert into public.court_changes (session_id, match_id, court_id, actor_id, kind, before, after)
  values (v_session, p_match_id, v_court, auth.uid(), 'no_show', v_before, public._court_snapshot(p_match_id, v_ids))
  returning id into v_change;
  return json_build_object('replacement_id', v_in, 'change_id', v_change);
end;
$$;
revoke execute on function public.swap_match_player(uuid, uuid, integer, uuid) from public, anon;
grant execute on function public.swap_match_player(uuid, uuid, integer, uuid) to authenticated;

create or replace function public.undo_court_change(p_change_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_change public.court_changes%rowtype;
  v_ids uuid[];
  v_status public.match_status;
  v_undo uuid;
begin
  if not public.is_admin() then return json_build_object('error', 'not_admin'); end if;
  select * into v_change from public.court_changes where id = p_change_id;
  if not found then return json_build_object('error', 'not_found'); end if;
  perform 1 from public.sessions where id = v_change.session_id for update;
  select * into v_change from public.court_changes where id = p_change_id for update;

  if v_change.kind = 'undo' or v_change.undone_at is not null then
    return json_build_object('error', 'undo_stale');
  end if;
  if v_change.created_at < now() - interval '10 seconds' then
    return json_build_object('error', 'undo_expired');
  end if;
  if exists (
    select 1 from public.court_changes c
    where c.match_id = v_change.match_id and c.kind <> 'undo' and c.undone_at is null
      and c.created_at > v_change.created_at
  ) then
    return json_build_object('error', 'undo_stale');
  end if;
  select status into v_status from public.matches where id = v_change.match_id for update;
  if v_status is distinct from 'in_progress' then return json_build_object('error', 'undo_stale'); end if;

  select coalesce(array_agg((e->>'id')::uuid), '{}') into v_ids from jsonb_array_elements(v_change.before->'entries') e;
  if public._court_snapshot(v_change.match_id, v_ids) <> v_change.after then
    return json_build_object('error', 'undo_stale');
  end if;

  delete from public.match_players where match_id = v_change.match_id;
  insert into public.match_players (match_id, player_id, team, created_at)
  select v_change.match_id, (p->>'player_id')::uuid, (p->>'team')::public.match_team, clock_timestamp()
  from jsonb_array_elements(v_change.before->'players') p;

  update public.queue_entries q
  set status = (e->>'status')::public.queue_status,
      joined_at = (e->>'joined_at')::timestamptz,
      target_court_id = (e->>'target_court_id')::uuid,
      group_id = (e->>'group_id')::uuid
  from jsonb_array_elements(v_change.before->'entries') e
  where q.id = (e->>'id')::uuid;

  update public.court_changes set undone_at = now() where id = p_change_id;
  insert into public.court_changes (session_id, match_id, court_id, actor_id, kind, before, after)
  values (v_change.session_id, v_change.match_id, v_change.court_id, auth.uid(), 'undo', v_change.after, v_change.before)
  returning id into v_undo;
  return json_build_object('change_id', v_undo);
end;
$$;
revoke execute on function public.undo_court_change(uuid) from public, anon;
grant execute on function public.undo_court_change(uuid) to authenticated;

-- finish_match: as in 20261117140742, plus the teams_incomplete check.
create or replace function public.finish_match(
  p_match_id uuid,
  p_team_a_score integer,
  p_team_b_score integer,
  p_winning_team public.winning_team,
  p_ranked boolean,
  p_rating_changes jsonb,
  p_rules_version integer,
  p_min_rating numeric,
  p_max_rating numeric
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
  v_format public.match_format;
  v_session_status public.session_status;
  v_saved json;
  v_requeued integer := 0;
  v_per_side integer;
begin
  if not public.is_admin() then
    return json_build_object('error', 'not_admin');
  end if;

  select session_id into v_session from public.matches where id = p_match_id;
  if not found then
    return json_build_object('error', 'not_found');
  end if;

  -- Every game-state change in a session runs one at a time.
  select status into v_session_status from public.sessions where id = v_session for update;

  select status, court_id, format into v_status, v_court, v_format from public.matches where id = p_match_id for update;
  if v_status <> 'in_progress' then
    return json_build_object('error', 'already_saved');
  end if;

  -- A slot left empty after a Remove must be filled before a result counts.
  v_per_side := case when v_format = 'doubles' then 2 else 1 end;
  if (select count(*) from public.match_players where match_id = p_match_id and team = 'team_a') <> v_per_side
     or (select count(*) from public.match_players where match_id = p_match_id and team = 'team_b') <> v_per_side then
    return json_build_object('error', 'teams_incomplete');
  end if;

  v_saved := public.record_match_result(
    p_match_id, p_team_a_score, p_team_b_score, p_winning_team, p_ranked,
    p_rating_changes, p_rules_version, p_min_rating, p_max_rating
  );
  if v_saved->>'error' is not null then
    -- Unreachable after the checks above; raising undoes everything.
    raise exception 'finish_match: record_match_result refused: %', v_saved->>'error';
  end if;

  if v_session_status = 'active' then
    with players as (
      select mp.player_id,
             row_number() over (order by mp.team, mp.created_at, mp.id) as n
      from public.match_players mp
      join public.session_checkins sc
        on sc.session_id = v_session and sc.player_id = mp.player_id and sc.status = 'checked_in'
      where mp.match_id = p_match_id
    ),
    latest as (
      select distinct on (q.player_id) q.player_id, q.group_id
      from public.queue_entries q
      where q.session_id = v_session and q.player_id in (select player_id from players)
      order by q.player_id, q.joined_at desc, q.id desc
    ),
    pairs as (
      select group_id from latest where group_id is not null group by group_id having count(*) = 2
    )
    insert into public.queue_entries (session_id, player_id, group_id, status, joined_at)
    select v_session,
           p.player_id,
           case when l.group_id in (select group_id from pairs) then l.group_id end,
           'waiting',
           clock_timestamp() + p.n * interval '1 millisecond'
    from players p
    left join latest l on l.player_id = p.player_id
    order by p.n
    on conflict (session_id, player_id) where status <> 'left' do nothing;

    get diagnostics v_requeued = row_count;
  end if;

  return json_build_object(
    'success', true,
    'requeued', v_requeued,
    'session_id', v_session,
    'court_id', v_court
  );
end;
$$;

revoke execute on function public.finish_match(uuid, integer, integer, public.winning_team, boolean, jsonb, integer, numeric, numeric) from public, anon;
grant execute on function public.finish_match(uuid, integer, integer, public.winning_team, boolean, jsonb, integer, numeric, numeric) to authenticated;
