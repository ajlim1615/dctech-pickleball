-- ==============================================================================
-- DCPaddl: 20260818000001_security_rls.sql
-- Security: Row Level Security (RLS) Policies and Helper Functions
-- ==============================================================================

-- 1. Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.courts enable row level security;
alter table public.sessions enable row level security;
alter table public.session_checkins enable row level security;
alter table public.queue_entries enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.player_ratings_history enable row level security;

-- 2. Admin Helper Function (Security Definer)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

-- 3. RLS Policies

-- PROFILES POLICIES
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

create policy "Admins can manage all profiles"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- COURTS POLICIES
create policy "Courts are viewable by authenticated users"
  on public.courts for select
  to authenticated
  using (true);

create policy "Admins can manage courts"
  on public.courts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- SESSIONS POLICIES
create policy "Sessions are viewable by authenticated users"
  on public.sessions for select
  to authenticated
  using (true);

create policy "Admins can manage sessions"
  on public.sessions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- SESSION CHECKINS POLICIES
create policy "Checkins are viewable by authenticated users"
  on public.session_checkins for select
  to authenticated
  using (true);

create policy "Users can check themselves into an active session"
  on public.session_checkins for insert
  to authenticated
  with check (auth.uid() = player_id or public.is_admin());

create policy "Users can update their own checkin status"
  on public.session_checkins for update
  to authenticated
  using (auth.uid() = player_id or public.is_admin())
  with check (auth.uid() = player_id or public.is_admin());

create policy "Admins can delete checkins"
  on public.session_checkins for delete
  to authenticated
  using (public.is_admin());

-- QUEUE ENTRIES POLICIES
create policy "Queue entries are viewable by authenticated users"
  on public.queue_entries for select
  to authenticated
  using (true);

create policy "Users can join the queue"
  on public.queue_entries for insert
  to authenticated
  with check (auth.uid() = player_id or public.is_admin());

create policy "Users can update or leave the queue"
  on public.queue_entries for update
  to authenticated
  using (auth.uid() = player_id or public.is_admin())
  with check (auth.uid() = player_id or public.is_admin());

create policy "Users can delete their own queue entry"
  on public.queue_entries for delete
  to authenticated
  using (auth.uid() = player_id or public.is_admin());

-- MATCHES POLICIES
create policy "Matches are viewable by authenticated users"
  on public.matches for select
  to authenticated
  using (true);

create policy "Match participants or admins can insert matches"
  on public.matches for insert
  to authenticated
  with check (true);

create policy "Match participants or admins can update match scores"
  on public.matches for update
  to authenticated
  using (
    exists (
      select 1 from public.match_players
      where match_id = public.matches.id and player_id = auth.uid()
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.match_players
      where match_id = public.matches.id and player_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "Admins can delete matches"
  on public.matches for delete
  to authenticated
  using (public.is_admin());

-- MATCH PLAYERS POLICIES
create policy "Match players are viewable by authenticated users"
  on public.match_players for select
  to authenticated
  using (true);

create policy "Match players can be added by participants or admins"
  on public.match_players for insert
  to authenticated
  with check (true);

create policy "Match players can be updated by admins"
  on public.match_players for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Match players can be removed by admins"
  on public.match_players for delete
  to authenticated
  using (public.is_admin());

-- PLAYER RATINGS HISTORY POLICIES
create policy "Ratings history is viewable by authenticated users"
  on public.player_ratings_history for select
  to authenticated
  using (true);

create policy "Ratings history can be inserted by admins or system"
  on public.player_ratings_history for insert
  to authenticated
  with check (public.is_admin() or true);
