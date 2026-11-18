do $$
declare a uuid; p uuid[]; s uuid; c1 uuid; c2 uuid; m uuid; m2 uuid; r json; ch uuid; ch2 uuid; j9 timestamptz; g uuid;
begin
  a := pg_temp.itest_user('admin');
  select array_agg(pg_temp.itest_user()) into p from generate_series(1, 12);
  perform pg_temp.itest_as(a);
  s := pg_temp.itest_session(a);
  c1 := pg_temp.itest_court('itest A', 901);
  c2 := pg_temp.itest_court('itest B', 902);
  perform pg_temp.itest_line(s, p);
  g := gen_random_uuid();
  update public.queue_entries set group_id = g where session_id = s and player_id in (p[3], p[4]);
  m := (public.start_match(s, c1, array[p[1], p[2]], array[p[3], p[4]], true)->>'match_id')::uuid;
  m2 := (public.start_match(s, c2, array[p[5], p[6]], array[p[7], p[8]], true)->>'match_id')::uuid;
  select joined_at into j9 from public.queue_entries where session_id = s and player_id = p[9];

  -- replace_mid_game / replace_back_of_line
  update public.matches set team_a_score = 5, team_b_score = 3 where id = m;
  r := public.replace_match_player(m, p[1], p[9]);
  ch := (r->>'change_id')::uuid;
  if ch is null then raise exception 'FAIL replace: %', r; end if;
  if not exists (select 1 from public.match_players where match_id = m and player_id = p[9] and team = 'team_a')
     or exists (select 1 from public.match_players where match_id = m and player_id = p[1]) then raise exception 'FAIL replace roster'; end if;
  if (select status from public.queue_entries where session_id = s and player_id = p[9] and status <> 'left') <> 'playing' then raise exception 'FAIL replace in entry'; end if;
  if (select joined_at from public.queue_entries where session_id = s and player_id = p[1] and status = 'waiting')
     <= (select max(joined_at) from public.queue_entries where session_id = s and status = 'waiting' and player_id <> p[1])
     then raise exception 'FAIL replace_back_of_line'; end if;

  -- undo_replace: roster and both entries exactly as before
  r := public.undo_court_change(ch);
  if r->>'change_id' is null then raise exception 'FAIL undo_replace: %', r; end if;
  if not exists (select 1 from public.match_players where match_id = m and player_id = p[1] and team = 'team_a')
     or exists (select 1 from public.match_players where match_id = m and player_id = p[9]) then raise exception 'FAIL undo_replace roster'; end if;
  if (select joined_at from public.queue_entries where session_id = s and player_id = p[9] and status = 'waiting') is distinct from j9
     then raise exception 'FAIL undo_replace joined_at'; end if;
  if (select status from public.queue_entries where session_id = s and player_id = p[1] and status <> 'left') <> 'playing'
     then raise exception 'FAIL undo_replace out entry'; end if;

  -- undo_twice_refused
  r := public.undo_court_change(ch);
  if r->>'error' is distinct from 'undo_stale' then raise exception 'FAIL undo_twice_refused: %', r; end if;

  -- replace_busy: a "waiting" player who is on another court
  update public.queue_entries set status = 'waiting' where session_id = s and player_id = p[5];
  r := public.replace_match_player(m, p[1], p[5]);
  if r->>'error' is distinct from 'player_busy' then raise exception 'FAIL replace_busy: %', r; end if;
  update public.queue_entries set status = 'playing' where session_id = s and player_id = p[5];

  -- replace_splits_pair: p3 goes off, partner p4 stays on court -> both unpaired
  r := public.replace_match_player(m, p[3], p[10]);
  ch := (r->>'change_id')::uuid;
  if exists (select 1 from public.queue_entries where session_id = s and player_id in (p[3], p[4]) and status <> 'left' and group_id is not null)
     then raise exception 'FAIL replace_splits_pair'; end if;
  if not (r->'unpaired')::jsonb ? p[4]::text then raise exception 'FAIL replace_splits_pair b: %', r; end if;

  -- switch_teams, same_team
  r := public.switch_match_teams(m, p[2], p[10]);
  ch2 := (r->>'change_id')::uuid;
  if (select team from public.match_players where match_id = m and player_id = p[2]) <> 'team_b'
     or (select team from public.match_players where match_id = m and player_id = p[10]) <> 'team_a' then raise exception 'FAIL switch_teams: %', r; end if;
  r := public.switch_match_teams(m, p[1], p[10]);
  if r->>'error' is distinct from 'same_team' then raise exception 'FAIL same_team: %', r; end if;

  -- undo_not_latest: the replace was followed by a switch
  r := public.undo_court_change(ch);
  if r->>'error' is distinct from 'undo_stale' then raise exception 'FAIL undo_not_latest: %', r; end if;

  -- remove_front_of_line: p4 to the front, the game stays live with 3
  r := public.remove_match_player(m, p[4]);
  if r->>'change_id' is null then raise exception 'FAIL remove: %', r; end if;
  if (select joined_at from public.queue_entries where session_id = s and player_id = p[4] and status = 'waiting')
     >= (select min(joined_at) from public.queue_entries where session_id = s and status = 'waiting' and player_id <> p[4])
     then raise exception 'FAIL remove_front_of_line'; end if;
  if (select count(*) from public.match_players where match_id = m) <> 3 or (select status from public.matches where id = m) <> 'in_progress'
     then raise exception 'FAIL remove keeps game'; end if;

  -- finish_refuses_incomplete
  r := public.finish_match(m, 11, 5, 'team_a', false, '[]'::jsonb, 2, 1, 7);
  if r->>'error' is distinct from 'teams_incomplete' then raise exception 'FAIL finish_refuses_incomplete: %', r; end if;
  if (select status from public.matches where id = m) <> 'in_progress' then raise exception 'FAIL finish_refuses_incomplete b'; end if;

  -- fill_slot, slot_full
  r := public.fill_match_slot(m, 'team_a', p[11]);
  if r->>'error' is distinct from 'slot_full' then raise exception 'FAIL slot_full: %', r; end if;
  r := public.fill_match_slot(m, 'team_b', p[11]);
  ch := (r->>'change_id')::uuid;
  if ch is null or not exists (select 1 from public.match_players where match_id = m and player_id = p[11] and team = 'team_b')
     then raise exception 'FAIL fill_slot: %', r; end if;

  -- undo_stale_after_finish
  r := public.finish_match(m, 11, 5, 'team_a', false, '[]'::jsonb, 2, 1, 7);
  if r->>'error' is not null then raise exception 'FAIL finish after fill: %', r; end if;
  r := public.undo_court_change(ch);
  if r->>'error' is distinct from 'undo_stale' then raise exception 'FAIL undo_stale_after_finish: %', r; end if;

  -- noshow_pick + undo_noshow
  r := public.swap_match_player(m2, p[5], 5, p[12]);
  ch := (r->>'change_id')::uuid;
  if (r->>'replacement_id')::uuid is distinct from p[12] then raise exception 'FAIL noshow_pick: %', r; end if;
  if (select status from public.queue_entries where session_id = s and player_id = p[5] and status <> 'left') <> 'on_break' then raise exception 'FAIL noshow on_break'; end if;
  r := public.undo_court_change(ch);
  if not exists (select 1 from public.match_players where match_id = m2 and player_id = p[5])
     or (select status from public.queue_entries where session_id = s and player_id = p[12] and status <> 'left') <> 'waiting'
     then raise exception 'FAIL undo_noshow: %', r; end if;

  -- undo_expired
  r := public.switch_match_teams(m2, p[6], p[7]);
  ch := (r->>'change_id')::uuid;
  update public.court_changes set created_at = now() - interval '11 seconds' where id = ch;
  r := public.undo_court_change(ch);
  if r->>'error' is distinct from 'undo_expired' then raise exception 'FAIL undo_expired: %', r; end if;

  -- remove_last_abandons
  perform public.remove_match_player(m2, p[5]);
  perform public.remove_match_player(m2, p[6]);
  perform public.remove_match_player(m2, p[7]);
  r := public.remove_match_player(m2, p[8]);
  if (r->>'abandoned')::boolean is distinct from true then raise exception 'FAIL remove_last_abandons: %', r; end if;
  if (select status from public.matches where id = m2) <> 'abandoned'
     or (select status from public.courts where id = c2) <> 'available'
     or (select current_match_id from public.courts where id = c2) is not null then raise exception 'FAIL remove_last_abandons b'; end if;

  -- change_logged
  if (select count(*) from public.court_changes where match_id = m and kind = 'replace' and before <> after and actor_id = a) <> 2
     then raise exception 'FAIL change_logged'; end if;

  -- admins only
  perform pg_temp.itest_as(p[2]);
  r := public.undo_court_change(ch);
  if r->>'error' is distinct from 'not_admin' then raise exception 'FAIL not_admin: %', r; end if;

  raise exception 'ALL TESTS PASSED';
end $$;
