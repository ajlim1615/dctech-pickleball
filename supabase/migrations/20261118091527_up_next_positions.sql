-- ==============================================================================
-- Manual court control, part 5: a rebuild keeps hand-edited cards where they are.
-- New auto cards take the free positions around them (1, 3, ... if card 2 was edited)
-- instead of being appended after them, then positions are renumbered 1..n.
-- ==============================================================================

create or replace function public.replace_auto_up_next(p_session_id uuid, p_cards jsonb, p_line_version text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card jsonb;
  v_id uuid;
  v_all uuid[];
  v_taken integer[];
  v_pos integer := 0;
begin
  if not public.is_admin() then return json_build_object('error', 'not_admin'); end if;
  perform 1 from public.sessions where id = p_session_id for update;
  if not found then return json_build_object('error', 'not_found'); end if;
  if p_line_version is distinct from public.up_next_line_version(p_session_id) then
    return json_build_object('error', 'line_changed');
  end if;

  -- Every player must be waiting and not in a manual card; anything else means the
  -- cards were built from an older picture of the line.
  select coalesce(array_agg(x::uuid), '{}') into v_all
  from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) c,
       lateral jsonb_array_elements_text(coalesce(c->'team_a', '[]') || coalesce(c->'team_b', '[]')) x;
  if (select count(distinct x) from unnest(v_all) x) <> coalesce(array_length(v_all, 1), 0)
     or exists (select 1 from unnest(v_all) x where not exists (
         select 1 from public.queue_entries q where q.session_id = p_session_id and q.player_id = x and q.status = 'waiting'))
     or exists (select 1 from public.up_next_players u join public.up_next_matches m on m.id = u.card_id
       where u.session_id = p_session_id and not m.is_auto and u.player_id = any (v_all)) then
    return json_build_object('error', 'line_changed');
  end if;

  delete from public.up_next_matches where session_id = p_session_id and is_auto;
  select coalesce(array_agg(position), '{}') into v_taken from public.up_next_matches where session_id = p_session_id;

  for v_card in select e from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) with ordinality t(e, n) order by n loop
    -- The next position no hand-edited card holds.
    v_pos := v_pos + 1;
    while v_pos = any (v_taken) loop
      v_pos := v_pos + 1;
    end loop;

    insert into public.up_next_matches (session_id, position, per_side, target_court_id, is_auto)
    values (p_session_id, v_pos, coalesce((v_card->>'per_side')::smallint, 2), nullif(v_card->>'target_court_id', '')::uuid, true)
    returning id into v_id;

    insert into public.up_next_players (card_id, session_id, player_id, team, slot)
    select v_id, p_session_id, x::uuid, 'team_a'::public.match_team, i from jsonb_array_elements_text(coalesce(v_card->'team_a', '[]')) with ordinality a(x, i)
    union all
    select v_id, p_session_id, x::uuid, 'team_b'::public.match_team, i from jsonb_array_elements_text(coalesce(v_card->'team_b', '[]')) with ordinality b(x, i);
  end loop;

  -- Close any gaps (a manual card further down than the auto cards reach).
  update public.up_next_matches c
  set position = r.rn
  from (
    select id, row_number() over (order by position, created_at) as rn
    from public.up_next_matches where session_id = p_session_id
  ) r
  where c.id = r.id and c.position <> r.rn;

  return json_build_object('ok', true);
end;
$$;
revoke execute on function public.replace_auto_up_next(uuid, jsonb, text) from public, anon;
grant execute on function public.replace_auto_up_next(uuid, jsonb, text) to authenticated;
