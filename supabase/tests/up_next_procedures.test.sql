do $$
declare a uuid; p uuid[]; s uuid; c1 uuid; c2 uuid; card uuid; card2 uuid; r json; v text; m uuid;
begin
  a := pg_temp.itest_user('admin');
  select array_agg(pg_temp.itest_user()) into p from generate_series(1, 12);
  perform pg_temp.itest_as(a);
  s := pg_temp.itest_session(a);
  c1 := pg_temp.itest_court('itest A', 901);
  c2 := pg_temp.itest_court('itest B', 902);
  perform pg_temp.itest_line(s, p);

  -- save_new_card: manual, position 1, may be incomplete
  r := public.save_up_next_card(s, null, array[p[1], p[2]], array[p[3]], 2::smallint);
  card := (r->>'card_id')::uuid;
  if card is null then raise exception 'FAIL save_new_card: %', r; end if;
  if (select is_auto from public.up_next_matches where id = card) or (select position from public.up_next_matches where id = card) <> 1
     then raise exception 'FAIL save_new_card b'; end if;
  if (select count(*) from public.up_next_players where card_id = card) <> 3 then raise exception 'FAIL save_new_card c'; end if;

  -- in_other_card
  r := public.save_up_next_card(s, null, array[p[1]], array[p[5]], 2::smallint);
  if r->>'error' is distinct from 'in_other_card' then raise exception 'FAIL in_other_card: %', r; end if;

  -- not_waiting
  update public.queue_entries set status = 'on_break' where session_id = s and player_id = p[12];
  r := public.save_up_next_card(s, null, array[p[12]], array[p[5]], 2::smallint);
  if r->>'error' is distinct from 'not_waiting' then raise exception 'FAIL not_waiting: %', r; end if;
  update public.queue_entries set status = 'waiting' where session_id = s and player_id = p[12];

  -- bad_teams: more than per_side
  r := public.save_up_next_card(s, null, array[p[5], p[6], p[7]], array[]::uuid[], 2::smallint);
  if r->>'error' is distinct from 'bad_teams' then raise exception 'FAIL bad_teams: %', r; end if;

  -- save_splits_pair: p9+p10 paired; a card with only p9 ends the pairing for both
  update public.queue_entries set group_id = gen_random_uuid() where session_id = s and player_id = p[9];
  update public.queue_entries set group_id = (select group_id from public.queue_entries where session_id = s and player_id = p[9])
    where session_id = s and player_id = p[10];
  r := public.save_up_next_card(s, null, array[p[9]], array[p[11]], 2::smallint);
  card2 := (r->>'card_id')::uuid;
  if exists (select 1 from public.queue_entries where session_id = s and player_id in (p[9], p[10]) and group_id is not null)
     then raise exception 'FAIL save_splits_pair: %', r; end if;
  if not (r->'unpaired')::jsonb ? p[9]::text then raise exception 'FAIL save_splits_pair b: %', r; end if;

  -- delete renumbers
  r := public.delete_up_next_card(card2);
  if exists (select 1 from public.up_next_matches where id = card2) then raise exception 'FAIL delete'; end if;

  -- keeps_manual_cards: rebuild replaces only auto cards, after the manual one
  v := public.up_next_line_version(s);
  r := public.replace_auto_up_next(s, jsonb_build_array(
         jsonb_build_object('team_a', jsonb_build_array(p[5], p[6]), 'team_b', jsonb_build_array(p[7], p[8]), 'per_side', 2, 'target_court_id', null),
         jsonb_build_object('team_a', jsonb_build_array(p[9], p[10]), 'team_b', jsonb_build_array(p[11], p[12]), 'per_side', 2, 'target_court_id', c2)), v);
  if r->>'error' is not null then raise exception 'FAIL keeps_manual_cards: %', r; end if;
  if (select count(*) from public.up_next_matches where session_id = s) <> 3 then raise exception 'FAIL keeps_manual_cards b'; end if;
  if (select position from public.up_next_matches where id = card) <> 1 then raise exception 'FAIL keeps_manual_cards c'; end if;
  if (select count(*) from public.up_next_matches where session_id = s and is_auto) <> 2 then raise exception 'FAIL keeps_manual_cards d'; end if;
  -- a second rebuild replaces the auto ones, never the manual one
  v := public.up_next_line_version(s);
  r := public.replace_auto_up_next(s, jsonb_build_array(
         jsonb_build_object('team_a', jsonb_build_array(p[5], p[6]), 'team_b', jsonb_build_array(p[7], p[8]), 'per_side', 2, 'target_court_id', null)), v);
  if (select count(*) from public.up_next_matches where session_id = s) <> 2 or not exists (select 1 from public.up_next_matches where id = card)
     then raise exception 'FAIL keeps_manual_cards e: %', r; end if;

  -- stale_line_version: line moved since the version was read
  v := public.up_next_line_version(s);
  update public.queue_entries set joined_at = now() where session_id = s and player_id = p[12];
  r := public.replace_auto_up_next(s, '[]'::jsonb, v);
  if r->>'error' is distinct from 'line_changed' then raise exception 'FAIL stale_line_version: %', r; end if;
  if (select count(*) from public.up_next_matches where session_id = s) <> 2 then raise exception 'FAIL stale_line_version b'; end if;

  -- manual_edit_invalidates_version
  v := public.up_next_line_version(s);
  r := public.save_up_next_card(s, card, array[p[1], p[2]], array[p[3], p[4]], 2::smallint);
  r := public.replace_auto_up_next(s, '[]'::jsonb, v);
  if r->>'error' is distinct from 'line_changed' then raise exception 'FAIL manual_edit_invalidates_version: %', r; end if;

  -- start_incomplete_card
  r := public.save_up_next_card(s, null, array[p[9]], array[p[10]], 2::smallint);
  card2 := (r->>'card_id')::uuid;
  r := public.start_match(s, c1, null, null, true, card2);
  if r->>'error' is distinct from 'teams_incomplete' then raise exception 'FAIL start_incomplete_card: %', r; end if;

  -- bound_card_wrong_court
  update public.up_next_matches set target_court_id = c2 where id = card;
  r := public.start_match(s, c1, null, null, true, card);
  if r->>'error' is distinct from 'wrong_court' then raise exception 'FAIL bound_card_wrong_court: %', r; end if;
  update public.up_next_matches set target_court_id = null where id = card;

  -- start_from_card: the card's teams play, the card is gone
  r := public.start_match(s, c1, null, null, true, card);
  m := (r->>'match_id')::uuid;
  if m is null then raise exception 'FAIL start_from_card: %', r; end if;
  if (select array_agg(player_id order by player_id) from public.match_players where match_id = m and team = 'team_a')
     <> (select array_agg(x order by x) from unnest(array[p[1], p[2]]) x) then raise exception 'FAIL start_from_card teams'; end if;
  if exists (select 1 from public.up_next_matches where id = card) then raise exception 'FAIL start_from_card card left'; end if;

  -- card_player_busy: a card holding someone now on court can't start
  -- (save refuses non-waiting players, so put on-court p1 into the card directly)
  r := public.save_up_next_card(s, card2, array[p[9], p[11]], array[p[10], p[12]], 2::smallint);
  delete from public.up_next_players where card_id = card2 and player_id = p[9];
  insert into public.up_next_players (card_id, session_id, player_id, team, slot) values (card2, s, p[1], 'team_a', 1);
  r := public.start_match(s, c2, null, null, true, card2);
  if r->>'error' is distinct from 'player_busy' then raise exception 'FAIL card_player_busy: %', r; end if;

  -- start_match_old_call: the five-input call still works
  r := public.start_match(p_session_id => s, p_court_id => c2, p_team_a => array[p[5], p[6]], p_team_b => array[p[7], p[8]], p_from_queue => true);
  if r->>'match_id' is null then raise exception 'FAIL start_match_old_call: %', r; end if;

  -- admins only
  perform pg_temp.itest_as(p[2]);
  r := public.save_up_next_card(s, null, array[p[11]], array[]::uuid[], 2::smallint);
  if r->>'error' is distinct from 'not_admin' then raise exception 'FAIL not_admin: %', r; end if;

  raise exception 'ALL TESTS PASSED';
end $$;
