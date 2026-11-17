do $$
declare a uuid; p uuid[]; s uuid; c1 uuid; c2 uuid; c3 uuid; x1 uuid; x2 uuid; r json; n int;
begin
  a := pg_temp.itest_user('admin');
  select array_agg(pg_temp.itest_user()) into p from generate_series(1, 6);
  perform pg_temp.itest_as(a);
  s := pg_temp.itest_session(a);
  c1 := pg_temp.itest_court('itest A', 901);
  c2 := pg_temp.itest_court('itest B', 902);
  perform pg_temp.itest_line(s, p);

  -- 1. one active entry per player per session
  begin
    insert into public.queue_entries (session_id, player_id, status) values (s, p[1], 'on_break');
    raise exception 'FAIL 1: duplicate active entry allowed';
  exception when unique_violation then null; end;

  -- 2. start from the line
  r := public.start_match(s, c1, array[p[1], p[2]], array[p[3], p[4]], true);
  if r->>'match_id' is null then raise exception 'FAIL 2: %', r; end if;
  select count(*) into n from public.queue_entries where session_id = s and status = 'playing' and target_court_id = c1;
  if n <> 4 then raise exception 'FAIL 2b: playing = %', n; end if;
  if (select current_match_id from public.courts where id = c1) is distinct from (r->>'match_id')::uuid
     or (select status from public.courts where id = c1) <> 'occupied' then raise exception 'FAIL 2c'; end if;
  if (select count(*) from public.match_players where match_id = (r->>'match_id')::uuid and team = 'team_a') <> 2
     then raise exception 'FAIL 2d'; end if;

  -- 3. same court again (busy is read from matches, so clearing the court mirror doesn't hide it)
  update public.courts set status = 'available', current_match_id = null where id = c1;
  r := public.start_match(s, c1, array[p[5]], array[p[6]], true);
  if r->>'error' is distinct from 'court_busy' then raise exception 'FAIL 3: %', r; end if;

  -- 4. manual match with a player already on court
  r := public.start_match(s, c2, array[p[1]], array[p[5]], false);
  if r->>'error' is distinct from 'player_busy' then raise exception 'FAIL 4: %', r; end if;

  -- 5. from the line, everyone must still be waiting; nothing is half-claimed
  update public.queue_entries set status = 'on_break' where session_id = s and player_id = p[5];
  r := public.start_match(s, c2, array[p[5]], array[p[6]], true);
  if r->>'error' is distinct from 'line_changed' then raise exception 'FAIL 5: %', r; end if;
  if (select status from public.queue_entries where session_id = s and player_id = p[6] and status <> 'left') <> 'waiting'
     then raise exception 'FAIL 5b: partial claim kept'; end if;

  -- 6. closed court
  update public.courts set status = 'maintenance' where id = c2;
  r := public.start_match(s, c2, array[p[5]], array[p[6]], false);
  if r->>'error' is distinct from 'court_closed' then raise exception 'FAIL 6: %', r; end if;
  update public.courts set status = 'available' where id = c2;

  -- 7. bad teams
  r := public.start_match(s, c2, array[p[5]], array[p[5]], false);
  if r->>'error' is distinct from 'bad_teams' then raise exception 'FAIL 7: %', r; end if;
  r := public.start_match(s, c2, array[p[5], p[6]], array[p[2]], false);
  if r->>'error' is distinct from 'bad_teams' then raise exception 'FAIL 7b: %', r; end if;

  -- 8. manual match claims waiting and on_break entries; singles format
  r := public.start_match(s, c2, array[p[5]], array[p[6]], false);
  if r->>'match_id' is null then raise exception 'FAIL 8: %', r; end if;
  if exists (select 1 from public.queue_entries where session_id = s and player_id in (p[5], p[6]) and status not in ('playing', 'left'))
     then raise exception 'FAIL 8b'; end if;
  if (select format from public.matches where id = (r->>'match_id')::uuid) <> 'singles' then raise exception 'FAIL 8c'; end if;

  -- 9. one live game per court, even written directly
  begin
    insert into public.matches (session_id, court_id, status) values (s, c1, 'in_progress');
    raise exception 'FAIL 9: second live game allowed';
  exception when unique_violation then null; end;

  -- 12. a manual match gives players who weren't in line a 'playing' entry, so they
  --     can't re-enter the line (and be called elsewhere) while on court
  x1 := pg_temp.itest_user();
  x2 := pg_temp.itest_user();
  c3 := pg_temp.itest_court('itest C', 903);
  r := public.start_match(s, c3, array[x1], array[x2], false);
  if r->>'match_id' is null then raise exception 'FAIL 12: %', r; end if;
  select count(*) into n from public.queue_entries
    where session_id = s and player_id in (x1, x2) and status = 'playing' and target_court_id = c3;
  if n <> 2 then raise exception 'FAIL 12b: playing entries = %', n; end if;
  begin
    insert into public.queue_entries (session_id, player_id, status) values (s, x1, 'waiting');
    raise exception 'FAIL 12c: player on court could rejoin the line';
  exception when unique_violation then null; end;

  -- 10. session must be live
  update public.sessions set status = 'scheduled' where id = s;
  r := public.start_match(s, c2, array[p[1]], array[p[2]], false);
  if r->>'error' is distinct from 'session_not_active' then raise exception 'FAIL 10: %', r; end if;

  -- 11. admins only
  perform pg_temp.itest_as(p[1]);
  r := public.start_match(s, c2, array[p[1]], array[p[2]], false);
  if r->>'error' is distinct from 'not_admin' then raise exception 'FAIL 11: %', r; end if;

  raise exception 'ALL TESTS PASSED';
end $$;
