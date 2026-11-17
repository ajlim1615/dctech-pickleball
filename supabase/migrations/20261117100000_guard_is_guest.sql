-- profiles.is_guest decides who may play ranked sessions and who shows in Rankings
-- and the employee directory, so it gets the same protection as role and rating:
-- only the System Admin (or trusted server code using the service key, e.g.
-- createPlayerAccount) can change it. Players and regular admins can't.
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
     or new.employee_no is distinct from old.employee_no
     or new.is_guest is distinct from old.is_guest then
    raise exception 'Only the System Admin can change a player''s role, rating, games, email or guest status.'
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
