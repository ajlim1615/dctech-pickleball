-- Company employee ID number (the "ID" column of the HR employee list).
-- Nullable: guests / walk-ins have none. Unique when present. Admin-only to change.

alter table public.profiles
  add column if not exists employee_no integer;

create unique index if not exists profiles_employee_no_key
  on public.profiles (employee_no)
  where employee_no is not null;

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.skill_rating is distinct from old.skill_rating
     or new.games_played is distinct from old.games_played
     or new.games_won is distinct from old.games_won
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email
     or new.employee_no is distinct from old.employee_no
     or new.created_at is distinct from old.created_at then
    raise exception 'Only admins can change role, rating, stats, status, email or employee ID.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;
