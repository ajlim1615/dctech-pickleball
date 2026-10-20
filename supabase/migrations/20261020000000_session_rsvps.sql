-- ==============================================================================
-- 20261020000000_session_rsvps.sql
-- Players say "I'm going" to an upcoming session so admins can plan courts.
-- An RSVP doesn't check anyone in; it's only a head count.
-- ==============================================================================

create table if not exists public.session_rsvps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, player_id)
);

create index if not exists idx_session_rsvps_session on public.session_rsvps(session_id);

alter table public.session_rsvps enable row level security;

create policy "RSVPs are viewable by authenticated users"
  on public.session_rsvps for select
  to authenticated
  using (true);

create policy "Players can RSVP for themselves"
  on public.session_rsvps for insert
  to authenticated
  with check (auth.uid() = player_id);

create policy "Players or admins can remove an RSVP"
  on public.session_rsvps for delete
  to authenticated
  using (auth.uid() = player_id or public.is_admin());
