do $$
declare a uuid; p uuid[]; s uuid; r json; v text; mid uuid;
begin
  a := pg_temp.itest_user('admin');
  select array_agg(pg_temp.itest_user()) into p from generate_series(1, 14);
  perform pg_temp.itest_as(a);
  s := pg_temp.itest_session(a);
  perform pg_temp.itest_line(s, p);

  -- three auto cards at 1, 2, 3
  v := public.up_next_line_version(s);
  r := public.replace_auto_up_next(s, jsonb_build_array(
    jsonb_build_object('team_a', jsonb_build_array(p[1], p[2]), 'team_b', jsonb_build_array(p[3], p[4]), 'per_side', 2),
    jsonb_build_object('team_a', jsonb_build_array(p[5], p[6]), 'team_b', jsonb_build_array(p[7], p[8]), 'per_side', 2),
    jsonb_build_object('team_a', jsonb_build_array(p[9], p[10]), 'team_b', jsonb_build_array(p[11], p[12]), 'per_side', 2)), v);
  select id into mid from public.up_next_matches where session_id = s and position = 2;

  -- the admin edits card 2 (now hand-edited, incomplete)
  r := public.save_up_next_card(s, mid, array[p[5], p[6]], array[p[7]], 2::smallint);

  -- manual_card_keeps_its_place: the rebuild fills 1 and 3 around it
  v := public.up_next_line_version(s);
  r := public.replace_auto_up_next(s, jsonb_build_array(
    jsonb_build_object('team_a', jsonb_build_array(p[1], p[2]), 'team_b', jsonb_build_array(p[3], p[4]), 'per_side', 2),
    jsonb_build_object('team_a', jsonb_build_array(p[9], p[10]), 'team_b', jsonb_build_array(p[11], p[12]), 'per_side', 2)), v);
  if r->>'error' is not null then raise exception 'FAIL rebuild: %', r; end if;
  if (select position from public.up_next_matches where id = mid) <> 2 then
    raise exception 'FAIL manual_card_keeps_its_place: %', (select array_agg(position || ':' || is_auto order by position) from public.up_next_matches where session_id = s);
  end if;
  if (select array_agg(position order by position) from public.up_next_matches where session_id = s) <> array[1, 2, 3] then
    raise exception 'FAIL positions: %', (select array_agg(position order by position) from public.up_next_matches where session_id = s);
  end if;
  if not exists (select 1 from public.up_next_matches m join public.up_next_players u on u.card_id = m.id
                 where m.session_id = s and m.position = 1 and m.is_auto and u.player_id = p[1]) then
    raise exception 'FAIL first auto card at 1';
  end if;

  raise exception 'ALL TESTS PASSED';
end $$;
