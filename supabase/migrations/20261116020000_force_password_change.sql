-- Force accounts still on the shared default password to set their own.
--
-- The flag lives in auth.users.raw_app_meta_data.must_change_password, which
-- only the server side can write, and the web proxy redirects flagged users to
-- /set-password. Admin-created accounts get the flag when they are created.

-- 1. Flag every account whose password is still the shared default.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"must_change_password": true}'::jsonb
where encrypted_password is not null
  and encrypted_password = extensions.crypt('dctech123', encrypted_password);

-- 2. Let a signed-in user clear their own flag, but only once their password
--    really is no longer the default.
create or replace function public.clear_password_change_flag()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  still_default boolean;
begin
  if uid is null then
    return false;
  end if;

  select u.encrypted_password = extensions.crypt('dctech123', u.encrypted_password)
    into still_default
    from auth.users u
   where u.id = uid;

  if coalesce(still_default, true) then
    return false;
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'must_change_password'
   where id = uid;

  return true;
end;
$$;

revoke execute on function public.clear_password_change_flag() from public, anon;
grant execute on function public.clear_password_change_flag() to authenticated;
