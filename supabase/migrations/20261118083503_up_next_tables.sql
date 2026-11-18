-- ==============================================================================
-- Up Next cards (manual court control, part 1).
--   * up_next_matches: one row per planned match ("card"); up_next_players: who is
--     in it. unique (session_id, player_id) = a player is in at most one card.
--   * Players in a card stay 'waiting' in queue_entries (a plan, not a claim). When
--     an entry stops waiting (left, break, called, playing) the trigger below takes
--     that player out of every card, whatever path changed the entry.
--   * is_house_account: the one place procedures recognise the system admin profile.
--   * close_session also clears the session's cards.
-- Writes go only through security-definer procedures; clients can only read.
-- ==============================================================================

create table public.up_next_matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  position integer not null,
  per_side smallint not null default 2 check (per_side in (1, 2)),
  -- Set for court-bound styles (King/Queen): only shown on, and only started on, this court.
  target_court_id uuid references public.courts (id) on delete set null,
  -- true = built by matchmaking and may be rebuilt; false = edited by an admin, kept as is.
  is_auto boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index up_next_matches_session_idx on public.up_next_matches (session_id, position);
create index up_next_matches_court_idx on public.up_next_matches (target_court_id);

create table public.up_next_players (
  card_id uuid not null references public.up_next_matches (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  team public.match_team not null,
  slot smallint not null check (slot in (1, 2)),
  primary key (card_id, player_id),
  unique (session_id, player_id),
  unique (card_id, team, slot)
);
create index up_next_players_player_idx on public.up_next_players (player_id);

alter table public.up_next_matches enable row level security;
alter table public.up_next_players enable row level security;

create policy "Up next cards are viewable by authenticated users"
  on public.up_next_matches for select to authenticated using (true);
create policy "Up next players are viewable by authenticated users"
  on public.up_next_players for select to authenticated using (true);

alter publication supabase_realtime add table public.up_next_matches;
alter publication supabase_realtime add table public.up_next_players;

-- A player who stops waiting leaves every card. Runs as the owner so a player's own
-- Leave / break (which can't write cards) still cleans up.
create or replace function public.up_next_drop_unavailable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'waiting' then
    delete from public.up_next_players
    where session_id = new.session_id and player_id = new.player_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.up_next_drop_unavailable() from public, anon, authenticated;

create trigger up_next_drop_unavailable
  after insert or update of status on public.queue_entries
  for each row execute function public.up_next_drop_unavailable();

-- The system admin's own profile is never picked to play.
create or replace function public.is_house_account(p_player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select lower(coalesce(email, '')) = 'admin@dctechmicro.com' from public.profiles where id = p_player),
    false
  );
$$;
revoke execute on function public.is_house_account(uuid) from public, anon;
grant execute on function public.is_house_account(uuid) to authenticated;

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

  delete from public.up_next_matches where session_id = p_session_id;

  update public.sessions
  set status = p_status, updated_at = now()
  where id = p_session_id;

  return json_build_object('success', true, 'abandoned', v_abandoned);
end;
$$;

revoke execute on function public.close_session(uuid, public.session_status) from public, anon;
grant execute on function public.close_session(uuid, public.session_status) to authenticated;
