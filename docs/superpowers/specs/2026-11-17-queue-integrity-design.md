# Queue, Court and Session Integrity — Design

Source: the 2026-11-17 inspection of the queue / session / court / game lifecycle
(read-only trace of `queueActions.ts`, `matchActions.ts`, `sessionActions.ts`,
`adminActions.ts`, the migrations and the live database), revised after an
architecture review of the first plan.

## Problem

Integrity rules live only in application code that reads, decides, then writes in
several separate requests. The database has no constraint that stops:

1. Two active queue entries for one player in one session (double-tap Join, or
   check-in + Join at once). The duplicate check uses `.maybeSingle()`, which errors
   on two rows and reads as "not queued", so it inserts a third.
2. Two in-progress games on one court, or one player in two in-progress games.
3. A manual match (`createMatch`, Staff Court Monitor) using players who are still
   `waiting`, who can then be called onto a second court.
4. Two admins pressing Call next on the same court: the second call abandons the
   first game and the first four stay `playing` forever.
5. `callNextUp` failing after claiming players, leaving them `playing` with no game.
6. Finishing a game in two steps: `record_match_result` sets the players to `left`,
   then the app re-inserts them. If the second step fails they silently drop out.
7. `swapNoShow` claiming, swapping and benching in separate writes with a hand-made
   rollback.
8. `cancelSession` freeing every court even when the cancelled session was only
   scheduled, and leaving `playing` entries and in-progress games behind.
9. Starting a session auto-completing the previous one without clearing its line or
   abandoning its in-progress games.
10. Requeued players and bulk adds sharing one `joined_at`, so their order is undefined.
11. `callNextUp` on a `maintenance`/`reserved` court still starting a game.
12. The court monitor page falling back to `sessions[0]` when no session is live;
    `updateCourtStatus` with no admin guard and no limit on which status it sets.

## Architecture rule

**The database owns every game-state change; the app owns decisions.**

| Change | Owner (one stored procedure each) |
|---|---|
| Start a game (Call next, manual match) | `start_match` |
| Swap a no-show | `swap_match_player` |
| Finish a game and put its players back in line | `finish_match` (wraps `record_match_result`) |
| End or cancel a session | `close_session` |

The app keeps: the matchmaking engine (who plays, how teams split), rating
calculation, validation of the scoring rule, activity events, and revalidation.
Simple single-row player actions (Join, Leave, Take a break, check in/out) stay in
the app but go through one duplicate-safe insert helper.

## Decisions

- **Source of truth for "court busy"** is `matches` with `status = 'in_progress'`,
  guaranteed one per court by a partial unique index. `courts.status` is for admin
  states (`available`, `maintenance`, `reserved`); `occupied` and `current_match_id`
  are a display mirror written only by the procedures. No app code writes them.
- **Active queue entry** = `status <> 'left'`. One per (session, player), by partial
  unique index with that predicate, so a future status counts as active by default.
  The app's "in line, off court" list (`waiting`, `called`, `on_break`) is one
  exported constant.
- **Concurrency:** every procedure locks the session row first (`for update`). All
  game-state changes in a session run one at a time; no profile-row locks; no lock
  ordering to maintain.
- **Error contract:** every procedure returns `{"error": "<snake_case code>"}` on an
  expected failure and raises only on bugs. Codes live in one TS list
  (`GAME_STATE_ERRORS`); a test keeps the list and the SQL in sync. Unknown codes
  are logged.
- **Admin context:** procedures check `public.is_admin()` from the signed-in user, so
  they must be called with the user's client, never the service-key client.
- **`record_match_result`** becomes internal: only `finish_match` calls it
  (`execute` revoked from `authenticated`).
- **Requeue order:** team A then team B, in `match_players` order, `joined_at` 1 ms
  apart. Partners keep their `group_id` only if both rejoin. Only players still
  `checked_in` rejoin, and only while the session is `active`.
- **Tests** create their own users inside a transaction that always rolls back; they
  never depend on, or lock, real players.
- **Migrations:** versions after production's latest recorded version
  (`20261117110808`); after `apply_migration`, local files are renamed to the version
  production recorded. Never `supabase db push` this project (history already
  differs). Each plan ships a down script.

## Out of scope (next plans)

- Session settings stored as tags in `sessions.description` → a `settings jsonb` column.
- Courts are global (no `session_id`/`venue_id`); `start_match` is where a
  "court belongs to this session" check will go.
- `left` means four things (left, finished, removed, session closed) → an end reason.
- Generating `database.types.ts` instead of hand-editing it.
- Reconciling the older migration-history drift.
- Court name drift on court-count changes, dead `called`/`pending` statuses, the
  unused bump/swap/substitute actions, `target_court_id` on Join, the Skill Separated
  guide text, casual games not counting toward `games_played`.
