-- ==============================================================================
-- 20261020030000_session_events.sql
-- Activity log for each session: what happened, to whom, and when.
-- Players can read every event but never who acted (actor_id isn't granted to
-- them); admins get names through get_admin_audit(). Players can only log
-- their own actions; everything else needs an admin.
-- ==============================================================================

create table if not exists public.session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  type text not null check (type in (
    'session_started', 'session_ended', 'checked_in', 'checked_out',
    'joined_queue', 'left_queue', 'players_added', 'break_started', 'break_ended',
    'moved_in_queue', 'removed_from_queue', 'players_swapped',
    'game_started', 'game_result', 'result_corrected', 'no_show_swapped',
    'court_closed', 'court_reopened'
  )),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null check (actor_role in ('self', 'admin', 'system')),
  subject_ids uuid[] not null default '{}',
  court_id uuid references public.courts(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_session_events_session on public.session_events(session_id, created_at desc);
create index if not exists idx_session_events_created on public.session_events(created_at desc);

alter table public.session_events enable row level security;

-- Who acted stays private: players can read every column except actor_id.
revoke all on public.session_events from anon, authenticated;
grant select (id, session_id, type, actor_role, subject_ids, court_id, match_id, details, created_at)
  on public.session_events to authenticated;
grant insert on public.session_events to authenticated;

create policy "Signed-in users can read session activity"
  on public.session_events for select
  to authenticated
  using (true);

create policy "Players log their own actions; admins log the rest"
  on public.session_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and (
      (actor_role = 'self' and subject_ids = array[auth.uid()])
      or public.is_admin()
    )
  );

-- Realtime sends published columns only, so actor_id never reaches browsers.
alter publication supabase_realtime add table public.session_events
  (id, session_id, type, actor_role, subject_ids, court_id, match_id, details, created_at);

-- Admin audit: the same events with the acting person's name and the session title.
create or replace function public.get_admin_audit(
  p_session_id uuid default null,
  p_types text[] default null,
  p_limit integer default 200
)
returns table (
  id uuid,
  session_id uuid,
  session_title text,
  type text,
  actor_name text,
  actor_role text,
  subject_ids uuid[],
  court_id uuid,
  match_id uuid,
  details jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return;
  end if;

  return query
  select e.id, e.session_id, s.title, e.type,
         coalesce(p.full_name, p.display_name), e.actor_role,
         e.subject_ids, e.court_id, e.match_id, e.details, e.created_at
  from public.session_events e
  left join public.sessions s on s.id = e.session_id
  left join public.profiles p on p.id = e.actor_id
  where (p_session_id is null or e.session_id = p_session_id)
    and (p_types is null or e.type = any(p_types))
  order by e.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

revoke execute on function public.get_admin_audit(uuid, text[], integer) from public, anon;
grant execute on function public.get_admin_audit(uuid, text[], integer) to authenticated;
