-- Rating system v2 cleanup: the app now saves results with record_match_result
-- and corrects them with the 11-argument apply_result_correction.
-- Drop the v1 functions (complete_match still floored ratings at 2.0).
drop function if exists public.complete_match(uuid, integer, integer, uuid);
drop function if exists public.apply_result_correction(uuid, integer, integer, integer, integer, public.winning_team, jsonb, jsonb);
