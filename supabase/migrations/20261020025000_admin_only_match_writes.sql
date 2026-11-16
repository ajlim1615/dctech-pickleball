-- ==============================================================================
-- 20261020030000_admin_only_match_writes.sql
-- Only admins create, score or rate games. The app already does every write to
-- these tables from admin-only server actions (createMatch, callNextUp,
-- updateMatchScore, finalizeMatch, swapNoShow, updateSessionStatus), but the
-- policies from 20260818000001 still let any signed-in user, through the REST
-- API directly:
--   * insert matches and match_players (with check (true)),
--   * change the score/status of any game they play in,
--   * insert player_ratings_history rows (is_admin() or true).
-- complete_match and apply_result_correction are security definer and check
-- is_admin() themselves, so they are unaffected.
-- ==============================================================================

-- MATCHES
drop policy if exists "Match participants or admins can insert matches" on public.matches;
drop policy if exists "Admins can insert matches" on public.matches;
create policy "Admins can insert matches"
  on public.matches for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Match participants or admins can update match scores" on public.matches;
drop policy if exists "Admins can update matches" on public.matches;
create policy "Admins can update matches"
  on public.matches for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- MATCH PLAYERS
drop policy if exists "Match players can be added by participants or admins" on public.match_players;
drop policy if exists "Match players can be added by admins" on public.match_players;
create policy "Match players can be added by admins"
  on public.match_players for insert
  to authenticated
  with check (public.is_admin());

-- PLAYER RATINGS HISTORY
drop policy if exists "Ratings history can be inserted by admins or system" on public.player_ratings_history;
drop policy if exists "Ratings history can be inserted by admins" on public.player_ratings_history;
create policy "Ratings history can be inserted by admins"
  on public.player_ratings_history for insert
  to authenticated
  with check (public.is_admin());
