-- Close two RLS holes and clear the performance advisor warnings.
--
-- 1. Players could promote themselves: the self-update policy on profiles
--    allowed every column, including role. A trigger now rejects changes to
--    privileged columns unless the caller is an admin.
-- 2. courts and sessions had "manage" policies of USING (true), so any
--    signed-in user could insert, update or delete them. Writes are now
--    admin-only; reads stay public.
-- 3. auth.uid() / is_admin() in policies are wrapped in (select ...) so they
--    run once per query instead of once per row.
-- 4. Overlapping permissive policies are split so each role/action has one.
-- 5. Every foreign key gets a covering index.

-- ---------------------------------------------------------------------------
-- profiles: privileged columns are admin-only
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only API callers are restricted. Inside SECURITY DEFINER functions
  -- (complete_match, handle_new_user, ...) and for the service role,
  -- current_user is not one of these.
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.skill_rating is distinct from old.skill_rating
     or new.games_played is distinct from old.games_played
     or new.games_won is distinct from old.games_won
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email
     or new.created_at is distinct from old.created_at then
    raise exception 'Only admins can change role, rating, stats, status or email.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

drop policy if exists "Admins can manage all profiles" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Admins can insert profiles" on public.profiles
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can delete profiles" on public.profiles
  for delete to authenticated
  using ((select public.is_admin()));

create policy "Users can update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()))
  with check ((select auth.uid()) = id or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- courts / sessions: admin-only writes
-- ---------------------------------------------------------------------------

drop policy if exists "Admins and Staff can manage courts" on public.courts;

create policy "Admins can insert courts" on public.courts
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update courts" on public.courts
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete courts" on public.courts
  for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins and Staff can manage sessions" on public.sessions;

create policy "Admins can insert sessions" on public.sessions
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update sessions" on public.sessions
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete sessions" on public.sessions
  for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Per-row auth.uid() re-evaluation (auth_rls_initplan)
-- ---------------------------------------------------------------------------

drop policy if exists "Users can check themselves into an active session" on public.session_checkins;
create policy "Users can check themselves into an active session" on public.session_checkins
  for insert to authenticated
  with check ((select auth.uid()) = player_id or (select public.is_admin()));

drop policy if exists "Users can update their own checkin status" on public.session_checkins;
create policy "Users can update their own checkin status" on public.session_checkins
  for update to authenticated
  using ((select auth.uid()) = player_id or (select public.is_admin()))
  with check ((select auth.uid()) = player_id or (select public.is_admin()));

drop policy if exists "Admins can delete checkins" on public.session_checkins;
create policy "Admins can delete checkins" on public.session_checkins
  for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Users can join the queue" on public.queue_entries;
create policy "Users can join the queue" on public.queue_entries
  for insert to authenticated
  with check ((select auth.uid()) = player_id or (select public.is_admin()));

drop policy if exists "Users can update or leave the queue" on public.queue_entries;
create policy "Users can update or leave the queue" on public.queue_entries
  for update to authenticated
  using ((select auth.uid()) = player_id or (select public.is_admin()))
  with check ((select auth.uid()) = player_id or (select public.is_admin()));

drop policy if exists "Users can delete their own queue entry" on public.queue_entries;
create policy "Users can delete their own queue entry" on public.queue_entries
  for delete to authenticated
  using ((select auth.uid()) = player_id or (select public.is_admin()));

drop policy if exists "Players can RSVP for themselves" on public.session_rsvps;
create policy "Players can RSVP for themselves" on public.session_rsvps
  for insert to authenticated
  with check ((select auth.uid()) = player_id);

drop policy if exists "Players or admins can remove an RSVP" on public.session_rsvps;
create policy "Players or admins can remove an RSVP" on public.session_rsvps
  for delete to authenticated
  using ((select auth.uid()) = player_id or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Covering indexes for foreign keys
-- ---------------------------------------------------------------------------

create index if not exists idx_courts_assigned_staff on public.courts (assigned_staff_id);
create index if not exists idx_courts_current_match on public.courts (current_match_id);
create index if not exists idx_matches_recorded_by on public.matches (recorded_by);
create index if not exists idx_matches_referee on public.matches (referee_id);
create index if not exists idx_ratings_history_match on public.player_ratings_history (match_id);
create index if not exists idx_queue_entries_player on public.queue_entries (player_id);
create index if not exists idx_queue_entries_target_court on public.queue_entries (target_court_id);
create index if not exists idx_session_checkins_player on public.session_checkins (player_id);
create index if not exists idx_session_events_actor on public.session_events (actor_id);
create index if not exists idx_session_events_court on public.session_events (court_id);
create index if not exists idx_session_events_match on public.session_events (match_id);
create index if not exists idx_session_rsvps_player on public.session_rsvps (player_id);
create index if not exists idx_sessions_created_by on public.sessions (created_by);
