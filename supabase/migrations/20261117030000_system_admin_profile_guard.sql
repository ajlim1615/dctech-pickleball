-- Only the System Admin (admin@dctechmicro.com) may change a player's rating, name,
-- photo, email or role. Regular admins run sessions and can still turn accounts on
-- or off; players can still edit their own name and photo.
--
-- Also closes an older gap: the "update own profile" policy let any player change
-- their own role, rating or game counts straight through the API.

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@dctechmicro.com';
$$;

revoke execute on function public.is_system_admin() from public, anon;
grant execute on function public.is_system_admin() to authenticated;

-- Security invoker on purpose: current_user must stay the caller's role. Writes made
-- by trusted database functions (record_match_result, admin_set_rating, ...) run as
-- the function owner, and server writes use the service role, so both pass through.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' or public.is_system_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.skill_rating is distinct from old.skill_rating
     or new.games_played is distinct from old.games_played
     or new.games_won is distinct from old.games_won
     or new.email is distinct from old.email
     or new.employee_no is distinct from old.employee_no then
    raise exception 'Only the System Admin can change a player''s role, rating, games or email.'
      using errcode = '42501';
  end if;

  if old.id is distinct from auth.uid() and (
       new.full_name is distinct from old.full_name
       or new.display_name is distinct from old.display_name
       or new.avatar_url is distinct from old.avatar_url) then
    raise exception 'Only the System Admin can change another player''s name or photo.'
      using errcode = '42501';
  end if;

  if new.is_active is distinct from old.is_active and not public.is_admin() then
    raise exception 'Only admins can turn an account on or off.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Manual rating edits: System Admin only (games still move ratings via record_match_result).
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
as $function$
declare
  v_profile record;
  v_new numeric;
begin
  if not public.is_system_admin() then
    return json_build_object('error', 'Only the System Admin can change ratings.');
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
$function$;
