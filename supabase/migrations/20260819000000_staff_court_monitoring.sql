-- ==============================================================================
-- DCPaddl: 20260819000000_staff_court_monitoring.sql
-- Staff Monitoring: Assign dedicated sports staff / umpires to courts & matches
-- ==============================================================================

-- 1. Add assigned_staff_id to courts
alter table public.courts
  add column if not exists assigned_staff_id uuid references public.profiles(id) on delete set null;

-- 2. Add referee_id and server_number to matches
alter table public.matches
  add column if not exists referee_id uuid references public.profiles(id) on delete set null,
  add column if not exists serving_team public.match_team default 'team_a',
  add column if not exists server_number integer default 1;

-- 3. Create index for fast staff lookup
create index if not exists idx_courts_assigned_staff on public.courts(assigned_staff_id);
create index if not exists idx_matches_referee on public.matches(referee_id);
