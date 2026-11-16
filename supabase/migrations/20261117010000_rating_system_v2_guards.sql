-- ==============================================================================
-- 20261117010000_rating_system_v2_guards.sql
-- Fix round 1 for rating_system_v2. ADDITIVE: only CREATE OR REPLACE of the two
-- new-only functions; complete_match and the old 8-arg apply_result_correction
-- (still used by the live site) are untouched.
--
--   * record_match_result: greatest/least ignore NULL, so a missing new_rating
--     used to clamp to the minimum. Null-check the raw values and raise first.
--     Lock each profile and raise if its rating is not the one the app saw
--     (stale or defaulted old_rating). On a ranked game, require exactly one
--     rating change per player in the game.
--   * apply_result_correction (11-arg): same null guard for delta / new_change.
-- ==============================================================================

create or replace function public.record_match_result(
  p_match_id uuid,
  p_team_a_score integer,
  p_team_b_score integer,
  p_winning_team public.winning_team,
  p_ranked boolean,
  p_rating_changes jsonb, -- [{ "player_id": uuid, "old_rating": numeric, "new_rating": numeric, "change": numeric }]
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
  v_match record;
  v_player record;
  r jsonb;
  v_player_id uuid;
  v_old numeric;
  v_new numeric;
  v_current numeric;
  v_players integer;
  v_changes integer;
  v_distinct integer;
begin
  if not public.is_admin() then
    return json_build_object('error', 'Only admins can record game results.');
  end if;

  if p_team_a_score is null or p_team_b_score is null or p_winning_team is null or p_ranked is null then
    raise exception 'record_match_result: score, winner and ranked are required';
  end if;
  if p_ranked and (p_rules_version is null or p_min_rating is null or p_max_rating is null
                   or p_min_rating > p_max_rating) then
    raise exception 'record_match_result: invalid rating rules (version %, min %, max %)',
      p_rules_version, p_min_rating, p_max_rating;
  end if;

  select id, status, court_id, session_id into v_match
  from public.matches where id = p_match_id for update;

  if not found then
    return json_build_object('error', 'Game not found.');
  end if;
  if v_match.status <> 'in_progress' then
    return json_build_object('error', 'This game was already saved.');
  end if;

  -- A ranked game needs exactly one rating change for each player in it.
  if p_ranked then
    if p_rating_changes is null or jsonb_typeof(p_rating_changes) <> 'array' then
      raise exception 'record_match_result: rating changes must be an array';
    end if;
    select count(*) into v_players from public.match_players mp where mp.match_id = p_match_id;
    select count(*), count(distinct x->>'player_id')
      into v_changes, v_distinct
    from jsonb_array_elements(p_rating_changes) x;
    if v_changes <> v_players or v_distinct <> v_players then
      raise exception 'record_match_result: expected % rating changes (one per player), got % (% distinct)',
        v_players, v_changes, v_distinct;
    end if;
  end if;

  update public.matches
  set team_a_score = p_team_a_score,
      team_b_score = p_team_b_score,
      winning_team = p_winning_team,
      status = 'completed',
      ended_at = now(),
      recorded_by = auth.uid(),
      updated_at = now()
  where id = p_match_id;

  -- Free the court, unless it has already moved on to another game.
  if v_match.court_id is not null then
    update public.courts
    set status = 'available', current_match_id = null, updated_at = now()
    where id = v_match.court_id
      and (current_match_id is null or current_match_id = p_match_id);
  end if;

  -- The players are off the court.
  update public.queue_entries
  set status = 'left'
  where session_id = v_match.session_id
    and status = 'playing'
    and player_id in (select mp.player_id from public.match_players mp where mp.match_id = p_match_id);

  if p_ranked then
    -- Totals: one more game for everyone, one more win for the winners.
    for v_player in
      select mp.player_id, mp.team from public.match_players mp where mp.match_id = p_match_id
    loop
      update public.profiles
      set games_played = games_played + 1,
          games_won = games_won + case when v_player.team::text = p_winning_team::text then 1 else 0 end,
          updated_at = now()
      where id = v_player.player_id;
    end loop;

    -- Ratings: the app computed them before calling; apply and log each one.
    for r in select * from jsonb_array_elements(p_rating_changes) loop
      -- Check the raw values: greatest/least ignore NULL and would clamp it.
      if (r->>'player_id') is null or (r->>'old_rating') is null or (r->>'new_rating') is null then
        raise exception 'record_match_result: incomplete rating change %', r;
      end if;

      v_player_id := (r->>'player_id')::uuid;
      v_old := round((r->>'old_rating')::numeric, 2);
      v_new := round(least(p_max_rating, greatest(p_min_rating, (r->>'new_rating')::numeric)), 2);

      if not exists (
        select 1 from public.match_players mp where mp.match_id = p_match_id and mp.player_id = v_player_id
      ) then
        raise exception 'record_match_result: player % is not in game %', v_player_id, p_match_id;
      end if;

      -- Lock the profile and make sure the app saw the current rating.
      select skill_rating into v_current from public.profiles where id = v_player_id for update;
      if not found then
        raise exception 'record_match_result: player % not found', v_player_id;
      end if;
      if round(v_current, 2) <> v_old then
        raise exception 'record_match_result: stale rating for player % (current %, supplied %)',
          v_player_id, v_current, v_old;
      end if;

      update public.profiles
      set skill_rating = v_new, updated_at = now()
      where id = v_player_id;

      insert into public.player_ratings_history
        (player_id, match_id, old_rating, new_rating, rating_change, rules_version, reason)
      values
        (v_player_id, p_match_id, v_old, v_new, round(v_new - v_old, 2), p_rules_version, 'game');
    end loop;
  end if;

  return json_build_object('success', true);
end;
$$;

revoke execute on function public.record_match_result(uuid, integer, integer, public.winning_team, boolean, jsonb, integer, numeric, numeric) from public, anon;
grant execute on function public.record_match_result(uuid, integer, integer, public.winning_team, boolean, jsonb, integer, numeric, numeric) to authenticated;

create or replace function public.apply_result_correction(
  p_match_id uuid,
  p_expected_a integer,
  p_expected_b integer,
  p_new_a integer,
  p_new_b integer,
  p_winning_team public.winning_team,
  p_rating_updates jsonb, -- [{ "player_id": uuid, "delta": numeric, "new_change": numeric }]
  p_wins_moves jsonb,     -- [{ "player_id": uuid, "by": 1 | -1 }]
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
  v_match record;
  r jsonb;
begin
  if not public.is_admin() then
    return json_build_object('error', 'Only admins can correct results.');
  end if;

  if p_rules_version is null or p_min_rating is null or p_max_rating is null or p_min_rating > p_max_rating then
    raise exception 'apply_result_correction: invalid rating rules (version %, min %, max %)',
      p_rules_version, p_min_rating, p_max_rating;
  end if;

  select id, status, team_a_score, team_b_score into v_match
  from public.matches where id = p_match_id for update;

  if not found then
    return json_build_object('error', 'Game not found.');
  end if;
  if v_match.status <> 'completed' then
    return json_build_object('error', 'Only finished games can be corrected.');
  end if;
  if v_match.team_a_score is distinct from p_expected_a or v_match.team_b_score is distinct from p_expected_b then
    return json_build_object('error', 'This game was just changed by someone else. Reload and try again.');
  end if;

  update public.matches
  set team_a_score = p_new_a, team_b_score = p_new_b, winning_team = p_winning_team, updated_at = now()
  where id = p_match_id;

  for r in select * from jsonb_array_elements(coalesce(p_rating_updates, '[]'::jsonb)) loop
    -- Check the raw values: greatest/least ignore NULL and would clamp it.
    if (r->>'player_id') is null or (r->>'delta') is null or (r->>'new_change') is null then
      raise exception 'apply_result_correction: incomplete rating update %', r;
    end if;

    update public.profiles
    set skill_rating = round(least(p_max_rating, greatest(p_min_rating, skill_rating + (r->>'delta')::numeric)), 2),
        updated_at = now()
    where id = (r->>'player_id')::uuid;

    update public.player_ratings_history
    set rating_change = (r->>'new_change')::numeric,
        new_rating = round(old_rating + (r->>'new_change')::numeric, 2),
        reason = 'correction',
        rules_version = p_rules_version
    where match_id = p_match_id and player_id = (r->>'player_id')::uuid;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_wins_moves, '[]'::jsonb)) loop
    update public.profiles
    set games_won = greatest(0, games_won + (r->>'by')::integer), updated_at = now()
    where id = (r->>'player_id')::uuid;
  end loop;

  return json_build_object('success', true);
end;
$$;

revoke execute on function public.apply_result_correction(uuid, integer, integer, integer, integer, public.winning_team, jsonb, jsonb, integer, numeric, numeric) from public, anon;
grant execute on function public.apply_result_correction(uuid, integer, integer, integer, integer, public.winning_team, jsonb, jsonb, integer, numeric, numeric) to authenticated;
