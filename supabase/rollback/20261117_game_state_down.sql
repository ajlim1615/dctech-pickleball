-- Undo the game-state migrations (start_match, swap_match_player, finish_match,
-- close_session). Revert the app deploy FIRST: the app calls these procedures.
-- Run on production only with the user's OK.

drop function if exists public.start_match(uuid, uuid, uuid[], uuid[], boolean);
drop function if exists public.swap_match_player(uuid, uuid, integer);

drop index if exists public.queue_entries_one_active_per_player;
drop index if exists public.matches_one_live_per_court;
