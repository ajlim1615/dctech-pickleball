do $$
declare a uuid; p uuid[]; s uuid; c1 uuid; c2 uuid; m uuid; other uuid; busy uuid; r json; outsider uuid;
begin
  a := pg_temp.itest_user('admin');
  select array_agg(pg_temp.itest_user()) into p from generate_series(1, 6);
  outsider := pg_temp.itest_user();
  perform pg_temp.itest_as(a);
  s := pg_temp.itest_session(a);
  c1 := pg_temp.itest_court('itest A', 901);
  perform pg_temp.itest_line(s, p);
  m := (public.start_match(s, c1, array[p[1], p[2]], array[p[3], p[4]], true)->>'match_id')::uuid;

  -- 1. the no-show goes on a break at the back; the next waiting player takes the slot
  r := public.swap_match_player(m, p[1], 5);
  if (r->>'replacement_id')::uuid is distinct from p[5] then raise exception 'FAIL 1: %', r; end if;
  if not exists (select 1 from public.match_players where match_id = m and player_id = p[5])
     or exists (select 1 from public.match_players where match_id = m and player_id = p[1]) then raise exception 'FAIL 1b'; end if;
  if not exists (select 1 from public.queue_entries where session_id = s and player_id = p[5] and status = 'playing' and target_court_id = c1)
     then raise exception 'FAIL 1c'; end if;
  if not exists (
    select 1 from public.queue_entries q1, public.queue_entries q6
    where q1.session_id = s and q1.player_id = p[1] and q1.status = 'on_break' and q1.target_court_id is null
      and q6.session_id = s and q6.player_id = p[6] and q6.status = 'waiting' and q1.joined_at > q6.joined_at
  ) then raise exception 'FAIL 1d'; end if;

  -- 2. nobody waiting
  update public.queue_entries set status = 'on_break' where session_id = s and player_id = p[6];
  r := public.swap_match_player(m, p[2], 5);
  if r->>'error' is distinct from 'no_replacement' then raise exception 'FAIL 2: %', r; end if;
  if not exists (select 1 from public.match_players where match_id = m and player_id = p[2]) then raise exception 'FAIL 2b'; end if;
  update public.queue_entries set status = 'waiting' where session_id = s and player_id = p[6];

  -- 3. allowed after points and after the old window (no time limit any more)
  update public.matches set team_a_score = 3, team_b_score = 2, started_at = now() - interval '20 minutes' where id = m;
  r := public.swap_match_player(m, p[3], 5);
  if (r->>'replacement_id')::uuid is distinct from p[6] or r->>'change_id' is null then raise exception 'FAIL 3: %', r; end if;
  update public.matches set team_a_score = 0, team_b_score = 0, started_at = now() where id = m;

  -- 4. the player must be in this game
  r := public.swap_match_player(m, outsider, 5);
  if r->>'error' is distinct from 'not_in_game' then raise exception 'FAIL 4: %', r; end if;

  -- 7. never swap in someone who is playing on another court, even if they look
  --    'waiting' at the front of the line (older data, or a manual match)
  busy := pg_temp.itest_user();
  c2 := pg_temp.itest_court('itest B', 902);
  insert into public.queue_entries (session_id, player_id, status, joined_at)
    values (s, busy, 'waiting', now() - interval '2 hours');
  insert into public.matches (session_id, court_id, status) values (s, c2, 'in_progress') returning id into other;
  insert into public.match_players (match_id, player_id, team) values (other, busy, 'team_a');
  -- (only `busy` waits now, so skipping them leaves no one)
  r := public.swap_match_player(m, p[4], 5);
  if r->>'error' is distinct from 'no_replacement' then raise exception 'FAIL 7: %', r; end if;

  -- 5. the game must be live
  update public.matches set status = 'completed', ended_at = now() where id = m;
  r := public.swap_match_player(m, p[3], 5);
  if r->>'error' is distinct from 'game_not_live' then raise exception 'FAIL 5: %', r; end if;

  -- 6. admins only
  perform pg_temp.itest_as(p[2]);
  r := public.swap_match_player(m, p[3], 5);
  if r->>'error' is distinct from 'not_admin' then raise exception 'FAIL 6: %', r; end if;

  raise exception 'ALL TESTS PASSED';
end $$;
