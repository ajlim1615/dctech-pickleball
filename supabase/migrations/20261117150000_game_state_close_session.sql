-- ==============================================================================
-- Game state, part 4: close_session ends or cancels ONE session. It abandons only
-- that session's in-progress games, frees only the courts those games held, and
-- takes that session's remaining entries out of the line. Other sessions (e.g. a
-- live one while a future one is cancelled) are untouched.
-- Call with the signed-in admin's client, never the service key.
-- ==============================================================================

create or replace function public.close_session(
  p_session_id uuid,
  p_status public.session_status
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_abandoned integer := 0;
begin
  if not public.is_admin() then
    return json_build_object('error', 'not_admin');
  end if;
  if p_status not in ('completed', 'cancelled') then
    return json_build_object('error', 'bad_status');
  end if;

  -- Every game-state change in a session runs one at a time.
  perform 1 from public.sessions where id = p_session_id for update;
  if not found then
    return json_build_object('error', 'not_found');
  end if;

  update public.courts c
  set status = 'available', current_match_id = null, updated_at = now()
  from public.matches m
  where m.session_id = p_session_id and m.status = 'in_progress' and c.id = m.court_id;

  update public.matches
  set status = 'abandoned', ended_at = now(), updated_at = now()
  where session_id = p_session_id and status = 'in_progress';
  get diagnostics v_abandoned = row_count;

  update public.queue_entries
  set status = 'left'
  where session_id = p_session_id and status <> 'left';

  update public.sessions
  set status = p_status, updated_at = now()
  where id = p_session_id;

  return json_build_object('success', true, 'abandoned', v_abandoned);
end;
$$;

revoke execute on function public.close_session(uuid, public.session_status) from public, anon;
grant execute on function public.close_session(uuid, public.session_status) to authenticated;
