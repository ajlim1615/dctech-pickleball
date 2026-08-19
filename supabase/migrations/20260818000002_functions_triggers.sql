-- ==============================================================================
-- DCPaddl: 20260818000002_functions_triggers.sql
-- Automation: Profile creation triggers, Match completion, & Queue assignment
-- ==============================================================================

-- 1. Automatic User Profile Creation on Signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
    id,
    email,
    full_name,
    display_name,
    avatar_url,
    role,
    skill_rating,
    games_played,
    games_won,
    is_active
  ) values (
    new.id,
    new.email,
    user_full_name,
    user_full_name,
    user_avatar,
    'player',
    3.00,
    0,
    0,
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

-- Trigger on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. Function: Complete Match & Update Player Statistics
create or replace function public.complete_match(
  p_match_id uuid,
  p_team_a_score integer,
  p_team_b_score integer,
  p_recorded_by uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  v_winner public.winning_team;
  v_player record;
begin
  -- Fetch existing match
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match with ID % not found', p_match_id;
  end if;

  -- Determine winner
  if p_team_a_score > p_team_b_score then
    v_winner := 'team_a';
  elsif p_team_b_score > p_team_a_score then
    v_winner := 'team_b';
  else
    v_winner := 'tie';
  end if;

  -- Update Match Record
  update public.matches
  set
    team_a_score = p_team_a_score,
    team_b_score = p_team_b_score,
    winning_team = v_winner,
    status = 'completed',
    ended_at = now(),
    recorded_by = coalesce(p_recorded_by, auth.uid(), recorded_by),
    updated_at = now()
  where id = p_match_id;

  -- Set Court back to available
  update public.courts
  set
    status = 'available',
    current_match_id = null,
    updated_at = now()
  where id = v_match.court_id;

  -- Update Player stats (games_played, games_won)
  for v_player in
    select player_id, team from public.match_players where match_id = p_match_id
  loop
    update public.profiles
    set
      games_played = games_played + 1,
      games_won = case
        when (v_winner = 'team_a' and v_player.team = 'team_a') or
             (v_winner = 'team_b' and v_player.team = 'team_b') then games_won + 1
        else games_won
      end,
      updated_at = now()
    where id = v_player.player_id;

    -- Update queue status for these players
    update public.queue_entries
    set status = 'left'
    where player_id = v_player.player_id and session_id = v_match.session_id and status = 'playing';
  end loop;

  return json_build_object(
    'success', true,
    'match_id', p_match_id,
    'winner', v_winner
  );
end;
$$;
