do $$
declare a uuid; p uuid[]; s uuid; c1 uuid; card uuid; card2 uuid; r json; ok boolean; house uuid;
begin
  a := pg_temp.itest_user('admin');
  select array_agg(pg_temp.itest_user()) into p from generate_series(1, 8);
  perform pg_temp.itest_as(a);
  s := pg_temp.itest_session(a);
  c1 := pg_temp.itest_court('itest A', 901);
  perform pg_temp.itest_line(s, p);

  insert into public.up_next_matches (session_id, position, per_side) values (s, 1, 2) returning id into card;
  insert into public.up_next_players (card_id, session_id, player_id, team, slot) values
    (card, s, p[1], 'team_a', 1), (card, s, p[2], 'team_a', 2), (card, s, p[3], 'team_b', 1), (card, s, p[4], 'team_b', 2);

  -- card_cleanup_on_start: a carded player started elsewhere leaves the card
  r := public.start_match(s, c1, array[p[1], p[5]], array[p[6], p[7]], true);
  if r->>'match_id' is null then raise exception 'FAIL setup: %', r; end if;
  if exists (select 1 from public.up_next_players where card_id = card and player_id = p[1]) then raise exception 'FAIL card_cleanup_on_start'; end if;
  if (select count(*) from public.up_next_players where card_id = card) <> 3 then raise exception 'FAIL card_cleanup_on_start b'; end if;

  -- card_cleanup_on_break
  update public.queue_entries set status = 'on_break' where session_id = s and player_id = p[2];
  if exists (select 1 from public.up_next_players where card_id = card and player_id = p[2]) then raise exception 'FAIL card_cleanup_on_break'; end if;

  -- waiting changes (e.g. joined_at moves) keep the card
  update public.queue_entries set joined_at = now() where session_id = s and player_id = p[3];
  if not exists (select 1 from public.up_next_players where card_id = card and player_id = p[3]) then raise exception 'FAIL keeps_waiting'; end if;

  -- one_card_per_player
  insert into public.up_next_matches (session_id, position, per_side) values (s, 2, 2) returning id into card2;
  begin
    insert into public.up_next_players (card_id, session_id, player_id, team, slot) values (card2, s, p[3], 'team_a', 1);
    raise exception 'FAIL one_card_per_player';
  exception when unique_violation then null;
  end;

  -- house_account
  if public.is_house_account(p[1]) then raise exception 'FAIL house_account p1'; end if;
  select id into house from public.profiles where lower(coalesce(email, '')) = 'admin@dctechmicro.com' limit 1;
  if house is not null and not public.is_house_account(house) then raise exception 'FAIL house_account admin'; end if;

  -- rls_read_only: a signed-in player can read cards but not write them
  perform pg_temp.itest_as(p[8]);
  execute 'set local role authenticated';
  if (select count(*) from public.up_next_matches where session_id = s) <> 2 then raise exception 'FAIL rls read'; end if;
  ok := false;
  begin
    insert into public.up_next_matches (session_id, position, per_side) values (s, 3, 2);
  exception when insufficient_privilege then ok := true;
  end;
  execute 'reset role';
  if not ok then raise exception 'FAIL rls write'; end if;
  perform pg_temp.itest_as(a);

  -- close_session_clears_cards
  r := public.close_session(s, 'completed');
  if exists (select 1 from public.up_next_matches where session_id = s) then raise exception 'FAIL close_session_clears_cards'; end if;

  raise exception 'ALL TESTS PASSED';
end $$;
