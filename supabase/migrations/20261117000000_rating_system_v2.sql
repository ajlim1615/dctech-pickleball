-- ==============================================================================
-- 20261117000000_rating_system_v2.sql
-- Rating system v2, database side. ADDITIVE ONLY: the live site keeps running the
-- old code until this branch ships, so nothing is dropped or changed in place.
--
--   1. player_ratings_history: match_id nullable (admin edits have no game),
--      rules_version + reason columns with defaults so old inserts still work.
--   2. record_match_result: saves a game (score, court, totals, ratings, history)
--      in one transaction. Any bad input raises, so nothing is half-saved.
--   3. apply_result_correction: new overload taking the rules version and the
--      rating bounds. The old 8-argument version is left for the live site.
--   4. admin_set_rating: an admin's manual rating edit, with a history row.
--   5. leaderboard_stats: games / wins / losses / points per player, counted from
--      the games themselves.
--
-- Rule numbers (min, max, version) always come from the app's RATING_RULES as
-- arguments; nothing here hard-codes them. complete_match is left in place but
-- unused by the new code (dropped in a later cleanup).
-- ==============================================================================

-- 1. History: versioned and tagged by reason. -----------------------------------
alter table public.player_ratings_history alter column match_id drop not null;
alter table public.player_ratings_history
  add column if not exists rules_version smallint not null default 1,
  add column if not exists reason text not null default 'game';
alter table public.player_ratings_history
  drop constraint if exists player_ratings_history_reason_check;
alter table public.player_ratings_history
  add constraint player_ratings_history_reason_check check (reason in ('game', 'correction', 'admin'));

-- 2. record_match_result ----------------------------------------------------------
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
    for r in select * from jsonb_array_elements(coalesce(p_rating_changes, '[]'::jsonb)) loop
      v_player_id := (r->>'player_id')::uuid;
      v_old := round((r->>'old_rating')::numeric, 2);
      v_new := round(least(p_max_rating, greatest(p_min_rating, (r->>'new_rating')::numeric)), 2);

      if v_player_id is null or v_old is null or v_new is null then
        raise exception 'record_match_result: incomplete rating change %', r;
      end if;
      if not exists (
        select 1 from public.match_players mp where mp.match_id = p_match_id and mp.player_id = v_player_id
      ) then
        raise exception 'record_match_result: player % is not in game %', v_player_id, p_match_id;
      end if;

      update public.profiles
      set skill_rating = v_new, updated_at = now()
      where id = v_player_id;
      if not found then
        raise exception 'record_match_result: player % not found', v_player_id;
      end if;

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

-- 3. apply_result_correction, versioned overload -----------------------------------
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

-- 4. admin_set_rating -----------------------------------------------------------
create or replace function public.admin_set_rating(
  p_player_id uuid,
  p_new_rating numeric,
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
  v_profile record;
  v_new numeric;
begin
  if not public.is_admin() then
    return json_build_object('error', 'Only admins can change ratings.');
  end if;

  if p_new_rating is null or p_rules_version is null or p_min_rating is null or p_max_rating is null
     or p_min_rating > p_max_rating then
    raise exception 'admin_set_rating: invalid arguments (rating %, version %, min %, max %)',
      p_new_rating, p_rules_version, p_min_rating, p_max_rating;
  end if;

  select id, email, skill_rating into v_profile
  from public.profiles where id = p_player_id for update;

  if not found then
    return json_build_object('error', 'Player not found.');
  end if;
  if lower(coalesce(v_profile.email, '')) = 'admin@dctechmicro.com' then
    return json_build_object('error', 'The System Admin account (admin@dctechmicro.com) is a non-playing administrator and cannot have a rating.');
  end if;

  v_new := round(least(p_max_rating, greatest(p_min_rating, p_new_rating)), 2);
  if v_new = v_profile.skill_rating then
    return json_build_object('success', true, 'rating', v_new);
  end if;

  update public.profiles
  set skill_rating = v_new, updated_at = now()
  where id = p_player_id;

  insert into public.player_ratings_history
    (player_id, match_id, old_rating, new_rating, rating_change, rules_version, reason)
  values
    (p_player_id, null, v_profile.skill_rating, v_new, round(v_new - v_profile.skill_rating, 2), p_rules_version, 'admin');

  return json_build_object('success', true, 'rating', v_new);
end;
$$;

revoke execute on function public.admin_set_rating(uuid, numeric, integer, numeric, numeric) from public, anon;
grant execute on function public.admin_set_rating(uuid, numeric, integer, numeric, numeric) to authenticated;

-- 5. leaderboard_stats (read-only, runs with the caller's rights) -----------------
-- A game counts when it is completed and its session is active or completed and
-- not marked [ranked:false].
create or replace function public.leaderboard_stats(p_since timestamptz default null)
returns table (
  player_id uuid,
  games integer,
  wins integer,
  losses integer,
  points_for integer,
  points_against integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    mp.player_id,
    count(*)::integer as games,
    count(*) filter (where m.winning_team::text = mp.team::text)::integer as wins,
    count(*) filter (
      where m.winning_team is not null
        and m.winning_team::text <> 'tie'
        and m.winning_team::text <> mp.team::text
    )::integer as losses,
    coalesce(sum(case when mp.team::text = 'team_a' then m.team_a_score else m.team_b_score end), 0)::integer as points_for,
    coalesce(sum(case when mp.team::text = 'team_a' then m.team_b_score else m.team_a_score end), 0)::integer as points_against
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  join public.sessions s on s.id = m.session_id
  where m.status = 'completed'
    and s.status in ('active', 'completed')
    and strpos(coalesce(s.description, ''), '[ranked:false]') = 0
    and (p_since is null or m.ended_at >= p_since)
  group by mp.player_id;
$$;

revoke execute on function public.leaderboard_stats(timestamptz) from public, anon;
grant execute on function public.leaderboard_stats(timestamptz) to authenticated;
