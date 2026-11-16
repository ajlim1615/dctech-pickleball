-- Everyone starts at Beginner (2.0) and ratings never drop below it.
-- (All existing profiles were reset to 2.00 on 2026-11-16; the old values are in
-- public.profile_ratings_backup_20261116, readable only with the service role.)

-- 1. New profiles start at Beginner.
alter table public.profiles alter column skill_rating set default 2.00;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  user_full_name text;
  user_avatar text;
begin
  user_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  user_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    null
  );

  insert into public.profiles (
    id, email, full_name, display_name, avatar_url, role,
    skill_rating, games_played, games_won, is_active
  ) values (
    new.id, new.email, user_full_name, user_full_name, user_avatar, 'player',
    2.00, 0, 0, true
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  return new;
end;
$function$;

-- 2. Correcting a saved result can't push a rating below Beginner either.
create or replace function public.apply_result_correction(
  p_match_id uuid, p_expected_a integer, p_expected_b integer, p_new_a integer, p_new_b integer,
  p_winning_team public.winning_team, p_rating_updates jsonb, p_wins_moves jsonb
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    set skill_rating = round(least(6.0, greatest(2.0, skill_rating + (r->>'delta')::numeric)), 2),
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
$function$;
