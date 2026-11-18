-- ==============================================================================
-- Up Next cards (manual court control, part 2): the procedures that write cards,
-- and start_match starting a game straight from a card.
--   * save_up_next_card: an admin creates or edits one card (it becomes "manual").
--   * delete_up_next_card.
--   * replace_auto_up_next: swaps in freshly built auto cards, only if the line
--     (and the manual cards) are unchanged since the app read up_next_line_version.
--   * start_match gains p_up_next_id (default null, so the current five-input call
--     keeps working).
-- All lock the session row first. Call with the signed-in admin's client.
-- ==============================================================================

-- Only procedures need it (they run as the owner).
revoke execute on function public.is_house_account(uuid) from authenticated;

-- Changes whenever the waiting line or any manual card changes.
create or replace function public.up_next_line_version(p_session_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select md5(
    coalesce((
      select string_agg(q.id::text || ':' || q.joined_at::text || ':' || coalesce(q.group_id::text, ''), ',' order by q.joined_at, q.id)
      from public.queue_entries q
      where q.session_id = p_session_id and q.status = 'waiting'
    ), '')
    || '|' ||
    coalesce((
      select string_agg(c.id::text || ':' || c.updated_at::text, ',' order by c.id)
      from public.up_next_matches c
      where c.session_id = p_session_id and not c.is_auto
    ), '')
  );
$$;
revoke execute on function public.up_next_line_version(uuid) from public, anon;
grant execute on function public.up_next_line_version(uuid) to authenticated;

create or replace function public.save_up_next_card(
  p_session_id uuid,
  p_card_id uuid,
  p_team_a uuid[],
  p_team_b uuid[],
  p_per_side smallint,
  p_target_court_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_players uuid[];
  v_card uuid := p_card_id;
  v_unpaired uuid[];
begin
  if not public.is_admin() then
    return json_build_object('error', 'not_admin');
  end if;

  v_players := coalesce(p_team_a, '{}') || coalesce(p_team_b, '{}');
  if p_per_side not in (1, 2)
     or coalesce(array_length(p_team_a, 1), 0) > p_per_side
     or coalesce(array_length(p_team_b, 1), 0) > p_per_side
     or (select count(distinct x) from unnest(v_players) x where x is not null) <> coalesce(array_length(v_players, 1), 0) then
    return json_build_object('error', 'bad_teams');
  end if;

  perform 1 from public.sessions where id = p_session_id for update;
  if not found then
    return json_build_object('error', 'not_found');
  end if;
  if v_card is not null and not exists (
    select 1 from public.up_next_matches where id = v_card and session_id = p_session_id
  ) then
    return json_build_object('error', 'not_found');
  end if;

  if exists (
    select 1 from unnest(v_players) x
    where not exists (
      select 1 from public.queue_entries q
      where q.session_id = p_session_id and q.player_id = x and q.status = 'waiting'
    )
  ) then
    return json_build_object('error', 'not_waiting');
  end if;
  if exists (
    select 1 from public.up_next_players u
    where u.session_id = p_session_id and u.player_id = any (v_players)
      and u.card_id is distinct from v_card
  ) then
    return json_build_object('error', 'in_other_card');
  end if;

  if v_card is null then
    insert into public.up_next_matches (session_id, position, per_side, target_court_id, is_auto, updated_at)
    values (
      p_session_id,
      coalesce((select max(position) from public.up_next_matches where session_id = p_session_id), 0) + 1,
      p_per_side, p_target_court_id, false, clock_timestamp()
    )
    returning id into v_card;
  else
    update public.up_next_matches
    set per_side = p_per_side, target_court_id = p_target_court_id, is_auto = false, updated_at = clock_timestamp()
    where id = v_card;
    delete from public.up_next_players where card_id = v_card;
  end if;

  insert into public.up_next_players (card_id, session_id, player_id, team, slot)
  select v_card, p_session_id, x, 'team_a'::public.match_team, i from unnest(p_team_a) with ordinality a(x, i)
  union all
  select v_card, p_session_id, x, 'team_b'::public.match_team, i from unnest(p_team_b) with ordinality b(x, i);

  -- A pair split by hand (one partner in this card, the other not) is no longer a pair.
  select array_agg(q.player_id) into v_unpaired
  from public.queue_entries q
  where q.session_id = p_session_id and q.status <> 'left' and q.group_id in (
    select q2.group_id
    from public.queue_entries q2
    where q2.session_id = p_session_id and q2.status <> 'left' and q2.group_id is not null
      and q2.player_id = any (v_players)
      and exists (
        select 1 from public.queue_entries q3
        where q3.session_id = p_session_id and q3.status <> 'left' and q3.group_id = q2.group_id
          and not (q3.player_id = any (v_players))
      )
  );
  if v_unpaired is not null then
    update public.queue_entries
    set group_id = null
    where session_id = p_session_id and status <> 'left' and player_id = any (v_unpaired);
  end if;

  return json_build_object('card_id', v_card, 'unpaired', coalesce(to_json(v_unpaired), '[]'::json));
end;
$$;
revoke execute on function public.save_up_next_card(uuid, uuid, uuid[], uuid[], smallint, uuid) from public, anon;
grant execute on function public.save_up_next_card(uuid, uuid, uuid[], uuid[], smallint, uuid) to authenticated;

create or replace function public.delete_up_next_card(p_card_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  if not public.is_admin() then
    return json_build_object('error', 'not_admin');
  end if;
  select session_id into v_session from public.up_next_matches where id = p_card_id;
  if not found then
    return json_build_object('error', 'not_found');
  end if;
  perform 1 from public.sessions where id = v_session for update;

  delete from public.up_next_matches where id = p_card_id;
  update public.up_next_matches c
  set position = r.rn
  from (
    select id, row_number() over (order by position, created_at) as rn
    from public.up_next_matches where session_id = v_session
  ) r
  where c.id = r.id and c.position <> r.rn;

  return json_build_object('ok', true);
end;
$$;
revoke execute on function public.delete_up_next_card(uuid) from public, anon;
grant execute on function public.delete_up_next_card(uuid) to authenticated;

-- p_cards: [{team_a: [uuid], team_b: [uuid], per_side: 1|2, target_court_id: uuid|null}]
create or replace function public.replace_auto_up_next(
  p_session_id uuid,
  p_cards jsonb,
  p_line_version text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card jsonb;
  v_i bigint;
  v_base integer;
  v_id uuid;
  v_all uuid[];
begin
  if not public.is_admin() then
    return json_build_object('error', 'not_admin');
  end if;
  perform 1 from public.sessions where id = p_session_id for update;
  if not found then
    return json_build_object('error', 'not_found');
  end if;
  if p_line_version is distinct from public.up_next_line_version(p_session_id) then
    return json_build_object('error', 'line_changed');
  end if;

  -- Every player must be waiting and not in a manual card; anything else means the
  -- cards were built from an older picture of the line.
  select coalesce(array_agg(x::uuid), '{}') into v_all
  from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) c,
       lateral jsonb_array_elements_text(coalesce(c->'team_a', '[]') || coalesce(c->'team_b', '[]')) x;
  if (select count(distinct x) from unnest(v_all) x) <> coalesce(array_length(v_all, 1), 0)
     or exists (
       select 1 from unnest(v_all) x
       where not exists (
         select 1 from public.queue_entries q
         where q.session_id = p_session_id and q.player_id = x and q.status = 'waiting'
       )
     )
     or exists (
       select 1 from public.up_next_players u
       join public.up_next_matches m on m.id = u.card_id
       where u.session_id = p_session_id and not m.is_auto and u.player_id = any (v_all)
     ) then
    return json_build_object('error', 'line_changed');
  end if;

  delete from public.up_next_matches where session_id = p_session_id and is_auto;
  select coalesce(max(position), 0) into v_base from public.up_next_matches where session_id = p_session_id;

  for v_card, v_i in select e, n from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) with ordinality t(e, n) loop
    insert into public.up_next_matches (session_id, position, per_side, target_court_id, is_auto)
    values (
      p_session_id, v_base + v_i::integer,
      coalesce((v_card->>'per_side')::smallint, 2),
      nullif(v_card->>'target_court_id', '')::uuid,
      true
    )
    returning id into v_id;

    insert into public.up_next_players (card_id, session_id, player_id, team, slot)
    select v_id, p_session_id, x::uuid, 'team_a'::public.match_team, i from jsonb_array_elements_text(coalesce(v_card->'team_a', '[]')) with ordinality a(x, i)
    union all
    select v_id, p_session_id, x::uuid, 'team_b'::public.match_team, i from jsonb_array_elements_text(coalesce(v_card->'team_b', '[]')) with ordinality b(x, i);
  end loop;

  return json_build_object('ok', true);
end;
$$;
revoke execute on function public.replace_auto_up_next(uuid, jsonb, text) from public, anon;
grant execute on function public.replace_auto_up_next(uuid, jsonb, text) to authenticated;

-- start_match: same as 20261117142842 plus p_up_next_id. With a card, the teams come
-- from the card (the passed arrays are ignored) and the card is removed in the same
-- transaction. The session is locked before anything is read.
drop function public.start_match(uuid, uuid, uuid[], uuid[], boolean);

create function public.start_match(
  p_session_id uuid,
  p_court_id uuid,
  p_team_a uuid[],
  p_team_b uuid[],
  p_from_queue boolean,
  p_up_next_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_a uuid[] := p_team_a;
  v_team_b uuid[] := p_team_b;
  v_players uuid[];
  v_count integer;
  v_session_status public.session_status;
  v_court_status public.court_status;
  v_match_id uuid;
  v_card public.up_next_matches%rowtype;
begin
  if not public.is_admin() then
    return json_build_object('error', 'not_admin');
  end if;

  -- Every game-state change in a session runs one at a time.
  select status into v_session_status from public.sessions where id = p_session_id for update;
  if not found then
    return json_build_object('error', 'not_found');
  end if;

  if p_up_next_id is not null then
    select * into v_card from public.up_next_matches where id = p_up_next_id and session_id = p_session_id;
    if not found then
      return json_build_object('error', 'not_found');
    end if;
    if v_card.target_court_id is not null and v_card.target_court_id <> p_court_id then
      return json_build_object('error', 'wrong_court');
    end if;
    select coalesce(array_agg(player_id order by slot) filter (where team = 'team_a'), '{}'),
           coalesce(array_agg(player_id order by slot) filter (where team = 'team_b'), '{}')
      into v_team_a, v_team_b
    from public.up_next_players where card_id = p_up_next_id;
    if coalesce(array_length(v_team_a, 1), 0) <> v_card.per_side
       or coalesce(array_length(v_team_b, 1), 0) <> v_card.per_side then
      return json_build_object('error', 'teams_incomplete');
    end if;
  end if;

  -- Equal sides of 1 or 2, nobody listed twice.
  v_players := coalesce(v_team_a, '{}') || coalesce(v_team_b, '{}');
  if coalesce(array_length(v_team_a, 1), 0) not in (1, 2)
     or coalesce(array_length(v_team_a, 1), 0) <> coalesce(array_length(v_team_b, 1), 0)
     or (select count(distinct x) from unnest(v_players) x where x is not null) <> array_length(v_players, 1) then
    return json_build_object('error', 'bad_teams');
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
  -- waits for this game to start (and then finds them on court).
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
  -- (The up_next trigger takes these players out of any card.)
  update public.queue_entries
  set status = 'playing', called_at = now(), target_court_id = p_court_id
  where session_id = p_session_id
    and player_id = any (v_players)
    and status in ('waiting', 'called', 'on_break', 'playing');

  -- Picked by hand without a place in line: give them an on-court entry.
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
    case when array_length(v_team_a, 1) = 2 then 'doubles'::public.match_format else 'singles'::public.match_format end,
    'in_progress', 0, 0, now()
  )
  returning id into v_match_id;

  insert into public.match_players (match_id, player_id, team, created_at)
  select v_match_id, t.x, t.team, clock_timestamp()
  from (
    select x, 'team_a'::public.match_team as team, i from unnest(v_team_a) with ordinality a(x, i)
    union all
    select x, 'team_b'::public.match_team, 10 + i from unnest(v_team_b) with ordinality b(x, i)
  ) t
  order by t.i;

  update public.courts
  set status = 'occupied', current_match_id = v_match_id, updated_at = now()
  where id = p_court_id;

  if p_up_next_id is not null then
    delete from public.up_next_matches where id = p_up_next_id;
  end if;

  return json_build_object('match_id', v_match_id);
end;
$$;

revoke execute on function public.start_match(uuid, uuid, uuid[], uuid[], boolean, uuid) from public, anon;
grant execute on function public.start_match(uuid, uuid, uuid[], uuid[], boolean, uuid) to authenticated;
