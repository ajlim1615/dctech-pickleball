-- ==============================================================================
-- 20261020010000_apply_result_correction.sql
-- Applies an admin's correction to a saved game in one locked transaction:
-- the game row is locked, the correction only applies if the stored score is
-- still what the admin saw (so two admins can't double-apply it), and ratings
-- and wins move by relative amounts so concurrent games aren't overwritten.
-- The app computes the amounts; this function only checks and applies them.
-- ==============================================================================

create or replace function public.apply_result_correction(
  p_match_id uuid,
  p_expected_a integer,
  p_expected_b integer,
  p_new_a integer,
  p_new_b integer,
  p_winning_team public.winning_team,
  p_rating_updates jsonb, -- [{ "player_id": uuid, "delta": numeric, "new_change": numeric }]
  p_wins_moves jsonb      -- [{ "player_id": uuid, "by": 1 | -1 }]
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  r jsonb;
begin
  if not public.is_admin() then
    return json_build_object('error', 'Only admins can correct results.');
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
    set skill_rating = round(least(6.0, greatest(1.0, skill_rating + (r->>'delta')::numeric)), 2),
        updated_at = now()
    where id = (r->>'player_id')::uuid;

    update public.player_ratings_history
    set rating_change = (r->>'new_change')::numeric,
        new_rating = round(old_rating + (r->>'new_change')::numeric, 2)
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

grant execute on function public.apply_result_correction(uuid, integer, integer, integer, integer, public.winning_team, jsonb, jsonb) to authenticated;
