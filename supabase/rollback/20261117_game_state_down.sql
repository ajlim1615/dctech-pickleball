-- Undo the game-state migrations (start_match, swap_match_player, finish_match,
-- close_session). Revert the app deploy FIRST: the app calls these procedures.
-- Run on production only with the user's OK.

drop function if exists public.start_match(uuid, uuid, uuid[], uuid[], boolean);
drop function if exists public.swap_match_player(uuid, uuid, integer);
drop function if exists public.close_session(uuid, public.session_status);
drop function if exists public.finish_match(uuid, integer, integer, public.winning_team, boolean, jsonb, integer, numeric, numeric);
grant execute on function public.record_match_result(uuid, integer, integer, public.winning_team, boolean, jsonb, integer, numeric, numeric) to authenticated;

drop index if exists public.queue_entries_one_active_per_player;
drop index if exists public.matches_one_live_per_court;

-- 20261117160000_game_state_busy_player_fixes only redefines start_match and
-- swap_match_player; dropping them above covers it.
