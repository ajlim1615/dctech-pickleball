-- Explicit guest flag so non-employee walk-ins (no login) are cleanly separated
-- from unregistered employees without an email.
alter table public.profiles
  add column if not exists is_guest boolean not null default false;

update public.profiles
set is_guest = true
where email like 'guest_%@dctechmicro.local'
  and is_guest = false;

create index if not exists profiles_is_guest_idx
  on public.profiles (is_guest);
