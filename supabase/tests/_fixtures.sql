-- Test-only helpers. They live in pg_temp, so they exist only for the one query
-- they are sent with. Every test file ends with `raise exception 'ALL TESTS PASSED'`,
-- which rolls back everything, fixtures included.
--
-- Run a test: send this file + any migrations not yet applied + the test file as ONE
-- execute_sql query (no BEGIN/COMMIT). Pass = the error text "ALL TESTS PASSED".

-- A throwaway user; the auth trigger creates the profile.
create function pg_temp.itest_user(p_role text default 'player') returns uuid
language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role)
  values (v, 'itest-' || v || '@example.test', 'authenticated', 'authenticated');
  if p_role <> 'player' then
    update public.profiles set role = p_role::public.user_role where id = v;
  end if;
  return v;
end $$;

-- Act as this user (auth.uid() / is_admin() read these claims).
create function pg_temp.itest_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.itest_session(p_admin uuid, p_status text default 'active') returns uuid
language plpgsql as $$
declare v uuid;
begin
  insert into public.sessions (title, status, start_time, end_time, created_by)
  values ('itest', p_status::public.session_status, now(), now() + interval '2 hours', p_admin)
  returning id into v;
  return v;
end $$;

create function pg_temp.itest_court(p_name text, p_sort int) returns uuid
language plpgsql as $$
declare v uuid;
begin
  insert into public.courts (name, status, sort_order) values (p_name, 'available', p_sort) returning id into v;
  return v;
end $$;

-- Waiting entries 1 s apart in array order (first = front of the line), all checked in.
create function pg_temp.itest_line(p_session uuid, p_players uuid[]) returns void
language plpgsql as $$
begin
  insert into public.queue_entries (session_id, player_id, status, joined_at)
  select p_session, t.p, 'waiting', now() - interval '1 hour' + (t.i || ' seconds')::interval
  from unnest(p_players) with ordinality t(p, i);
  insert into public.session_checkins (session_id, player_id, status)
  select p_session, p, 'checked_in' from unnest(p_players) p;
end $$;
