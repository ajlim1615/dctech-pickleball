do $$
declare a uuid; p uuid[]; s uuid; c1 uuid; c2 uuid; m uuid; m2 uuid; m3 uuid; r json; g uuid := gen_random_uuid();
begin
  a := pg_temp.itest_user('admin');
  select array_agg(pg_temp.itest_user()) into p from generate_series(1, 8);
  perform pg_temp.itest_as(a);
  s := pg_temp.itest_session(a);
  c1 := pg_temp.itest_court('itest A', 901);
  c2 := pg_temp.itest_court('itest B', 902);
  perform pg_temp.itest_line(s, p);
  update public.queue_entries set group_id = g where session_id = s and player_id in (p[1], p[2]);
  m := (public.start_match(s, c1, array[p[1], p[2]], array[p[3], p[4]], true)->>'match_id')::uuid;
  update public.session_checkins set status = 'checked_out' where session_id = s and player_id = p[4];

  -- 1. saves the result, frees the court, requeues the checked-in players
  r := public.finish_match(m, 11, 5, 'team_a', false, '[]'::jsonb, 2, 1, 7);
  if r->>'success' is null or (r->>'requeued')::int <> 3 then raise exception 'FAIL 1: %', r; end if;
  if (r->>'session_id')::uuid is distinct from s or (r->>'court_id')::uuid is distinct from c1 then raise exception 'FAIL 1a: %', r; end if;
  if (select status from public.matches where id = m) <> 'completed' then raise exception 'FAIL 1b'; end if;
  if (select status from public.courts where id = c1) <> 'available' or (select current_match_id from public.courts where id = c1) is not null
     then raise exception 'FAIL 1c'; end if;

  -- 2. back of the line, in court order, distinct times; the pair stays paired; p4 went home
  if exists (select 1 from public.queue_entries where session_id = s and player_id = p[4] and status <> 'left') then raise exception 'FAIL 2a'; end if;
  if not exists (
    select 1 from public.queue_entries e1, public.queue_entries e2, public.queue_entries e3, public.queue_entries e8
    where e1.session_id = s and e1.player_id = p[1] and e1.status = 'waiting'
      and e2.session_id = s and e2.player_id = p[2] and e2.status = 'waiting'
      and e3.session_id = s and e3.player_id = p[3] and e3.status = 'waiting'
      and e8.session_id = s and e8.player_id = p[8] and e8.status = 'waiting'
      and e8.joined_at < e1.joined_at and e1.joined_at < e2.joined_at and e2.joined_at < e3.joined_at
      and e1.group_id is not null and e1.group_id = e2.group_id and e3.group_id is null
  ) then raise exception 'FAIL 2b: order or pairing wrong'; end if;

  -- 3. a second save is refused
  r := public.finish_match(m, 11, 5, 'team_a', false, '[]'::jsonb, 2, 1, 7);
  if r->>'error' is distinct from 'already_saved' then raise exception 'FAIL 3: %', r; end if;

  -- 4. a player who rejoined while the game was being saved keeps exactly one entry
  m2 := (public.start_match(s, c2, array[p[5], p[6]], array[p[7], p[8]], true)->>'match_id')::uuid;
  update public.queue_entries set status = 'left' where session_id = s and player_id = p[5] and status = 'playing';
  insert into public.queue_entries (session_id, player_id, status) values (s, p[5], 'waiting');
  r := public.finish_match(m2, 11, 9, 'team_a', false, '[]'::jsonb, 2, 1, 7);
  if r->>'success' is null then raise exception 'FAIL 4: %', r; end if;
  if (select count(*) from public.queue_entries where session_id = s and player_id = p[5] and status <> 'left') <> 1
     then raise exception 'FAIL 4b'; end if;

  -- 5. nobody rejoins a session that is no longer live
  m3 := (public.start_match(s, c1, array[p[1], p[2]], array[p[3], p[6]], true)->>'match_id')::uuid;
  update public.sessions set status = 'completed' where id = s;
  r := public.finish_match(m3, 11, 2, 'team_b', false, '[]'::jsonb, 2, 1, 7);
  if r->>'success' is null or (r->>'requeued')::int <> 0 then raise exception 'FAIL 5: %', r; end if;

  -- 6. admins only
  perform pg_temp.itest_as(p[1]);
  r := public.finish_match(m, 11, 5, 'team_a', false, '[]'::jsonb, 2, 1, 7);
  if r->>'error' is distinct from 'not_admin' then raise exception 'FAIL 6: %', r; end if;

  -- 7. record_match_result is internal now
  if has_function_privilege('authenticated',
       'public.record_match_result(uuid,integer,integer,public.winning_team,boolean,jsonb,integer,numeric,numeric)', 'execute')
     then raise exception 'FAIL 7: authenticated can still call record_match_result'; end if;

  raise exception 'ALL TESTS PASSED';
end $$;
