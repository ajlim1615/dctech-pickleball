-- ==============================================================================
-- Game state, part 3: finish_match saves a result AND puts the players back in
-- line in one transaction (before, the app re-inserted them in a second step,
-- and a failure there dropped them from the line).
--
-- Same arguments as record_match_result, which it calls and which becomes internal.
-- Requeue rules: only while the session is active; only players still checked in;
-- team A then team B in court order (match_players.created_at), joined_at 1 ms
-- apart; partners keep their group only if both rejoin; anyone who already holds
-- an active entry keeps it.
-- Call with the signed-in admin's client, never the service key.
-- ==============================================================================

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
  v_session_status public.session_status;
  v_saved json;
  v_requeued integer := 0;
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

  select status, court_id into v_status, v_court from public.matches where id = p_match_id for update;
  if v_status <> 'in_progress' then
    return json_build_object('error', 'already_saved');
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

-- Only finish_match saves results now.
revoke execute on function public.record_match_result(uuid, integer, integer, public.winning_team, boolean, jsonb, integer, numeric, numeric) from authenticated;
