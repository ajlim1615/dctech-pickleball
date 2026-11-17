do $$
declare a uuid; p uuid[]; live uuid; future uuid; c1 uuid; m uuid; r json;
begin
  a := pg_temp.itest_user('admin');
  select array_agg(pg_temp.itest_user()) into p from generate_series(1, 4);
  perform pg_temp.itest_as(a);
  live := pg_temp.itest_session(a);
  future := pg_temp.itest_session(a, 'scheduled');
  c1 := pg_temp.itest_court('itest A', 901);
  perform pg_temp.itest_line(live, p);
  m := (public.start_match(live, c1, array[p[1], p[2]], array[p[3], p[4]], true)->>'match_id')::uuid;

  -- 1. cancelling the future session leaves the live one alone
  r := public.close_session(future, 'cancelled');
  if r->>'success' is null then raise exception 'FAIL 1: %', r; end if;
  if (select status from public.sessions where id = future) <> 'cancelled' then raise exception 'FAIL 1a'; end if;
  if (select current_match_id from public.courts where id = c1) is distinct from m then raise exception 'FAIL 1b: live court freed'; end if;
  if (select status from public.matches where id = m) <> 'in_progress' then raise exception 'FAIL 1c'; end if;

  -- 2. completing the live session abandons its game, frees its court, empties its line
  r := public.close_session(live, 'completed');
  if (r->>'abandoned')::int is distinct from 1 then raise exception 'FAIL 2: %', r; end if;
  if (select status from public.matches where id = m) <> 'abandoned' or (select ended_at from public.matches where id = m) is null
     then raise exception 'FAIL 2a'; end if;
  if (select current_match_id from public.courts where id = c1) is not null or (select status from public.courts where id = c1) <> 'available'
     then raise exception 'FAIL 2b'; end if;
  if exists (select 1 from public.queue_entries where session_id = live and status <> 'left') then raise exception 'FAIL 2c'; end if;
  if (select status from public.sessions where id = live) <> 'completed' then raise exception 'FAIL 2d'; end if;

  -- 3. only completed / cancelled
  r := public.close_session(live, 'active');
  if r->>'error' is distinct from 'bad_status' then raise exception 'FAIL 3: %', r; end if;

  -- 4. admins only
  perform pg_temp.itest_as(p[1]);
  r := public.close_session(live, 'completed');
  if r->>'error' is distinct from 'not_admin' then raise exception 'FAIL 4: %', r; end if;

  raise exception 'ALL TESTS PASSED';
end $$;
