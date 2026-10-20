-- ==============================================================================
-- 20261019000000_queue_on_break.sql
-- Lets a checked-in player take a break without losing their place in the queue.
-- A queue entry "on_break" keeps its joined_at, so returning puts the player back
-- where they were; calling the next group only picks "waiting" entries.
-- ==============================================================================

alter type public.queue_status add value if not exists 'on_break';
