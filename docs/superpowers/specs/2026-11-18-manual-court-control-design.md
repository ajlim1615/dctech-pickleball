# Manual court control, Up Next cards, and no auto-call — design

Date: 2026-11-18 (revised the same day after an architecture review)
Reference: pickleq.app live screen (Courts / Up Next / Queue), tried on a test club.

## Why

During a live session the admin can't steer who plays:

- An open court only has **Call next**, which runs matchmaking (often shuffled). The admin can't pick the four players.
- On a live game the only swap is the no-show swap. It works only before the first point, always takes the next in line, and puts the swapped-out player on a break.
- Saving a result immediately calls the next group (`finalizeMatch` → `callNextUp`). "Auto-fill courts" is a per-browser switch, default on, and the court monitor ignores it. So at the end of a night every finished game pulls four more people on, and the admin can't wind the session down.

The goal is to make the admin fast and in control, the way PickleQ works: see the next matches, edit them, pick players by hand, swap anyone on court, and start games only when they say so.

## Goals

1. **Up Next cards.** The next matches are visible as two teams each, stored in the database and the same on every admin device, the TV board and the player view. They can be edited (remove a player, add a player, rebuild) and sent to a court.
2. **Choose players.** On any open court the admin fills Team 1 / Team 2 slots by tapping players, then starts the game.
3. **Live-court player actions.** Tapping a player on a live court offers:
   - **Replace player:** pick from the line, or **Auto-pick best match**. The game continues; the player who comes off goes to the **back** of the line (as waiting).
   - **Switch teams:** swap with a player on the other team.
   - **Mark as no-show:** next in line (or a chosen player) comes in; the no-show goes on a break (today's rule).
   - **× Remove** (button on the slot): the player goes to the **front** of the line and the slot is left empty, with **Tap to add player** / **Fill empty slots**.
   - **Undo** for Replace, Switch, Remove, Fill and No-show, from any admin device, for 10 seconds after the change.
   - All of these work at any point in the game, not only before the first point.
4. **No auto-call.** Saving a result frees the court. The court shows its next Up Next card as **ready** with a **Start** button. Nothing starts until an admin taps Start.
5. **Ratings:** whoever is on court when the result is saved gets the win/loss and the rating change. A player subbed out mid-game gets nothing for that game.

## Non-goals

- The tablet desk app (`tablet/`). It has its own local engine; it is unchanged this round.
- Undo for a saved result (the change log below makes it easy to add later).
- Moving session settings out of `sessions.description` into columns (worth doing separately; this work must not add new SQL that depends on that text).
- PickleQ's "Call Players" announcement, self check-in, and its other modes.
- Changing the matchmaking styles themselves.

## Anti-goals (a failure even if it "works")

- A player ends up on two courts, or in two Up Next cards, or on a court and in a card.
- Two admins see different Up Next cards, or an admin's hand edits get overwritten by an auto rebuild.
- A game with an empty slot or uneven teams gets a result saved.
- Anything that silently starts a game without an admin tapping Start.
- A deploy step that breaks the live app between the database change and the app release.

## Approaches considered

- **A. Up Next stored in the database (chosen).** Shared live across devices, survives refresh, reuses the busy-player checks in `start_match`. Cost: migrations and logic to keep cards valid.
- **B. Up Next in the browser only.** Each screen sees different cards, refresh loses edits, auto cards reshuffle under the admin.
- **C. A new "staged" queue status.** Every place that reads queue status would need changes; higher risk.

The user picked **A**.

## Design

### Data

`up_next_matches` (one row per card):

| column | notes |
|---|---|
| `id` uuid pk | |
| `session_id` uuid → sessions, on delete cascade | |
| `position` int | order (1 = next) |
| `per_side` smallint | 1 or 2 |
| `target_court_id` uuid → courts, null | set for court-dependent styles (King/Queen): the card is only shown on, and can only start on, that court. Null = any free court. |
| `is_auto` boolean | true = built by matchmaking, may be rebuilt; false = edited by an admin, kept as is |
| `created_at`, `updated_at` | |

`up_next_players` (one row per player in a card), built like `match_players`:

| column | notes |
|---|---|
| `card_id` uuid → up_next_matches, on delete cascade | |
| `session_id` uuid | copied from the card; **unique (session_id, player_id)** so a player can be in only one card |
| `player_id` uuid → profiles, on delete cascade | |
| `team` match_team | |
| `slot` smallint | 1 or 2 within the team; unique (card_id, team, slot) |

- Read: same access as `queue_entries`. Write: only through procedures.
- Both tables in realtime.
- Players in a card stay `waiting` in `queue_entries`, so they keep their place in line. Cards are a plan, not a claim.
- A trigger on `queue_entries` deletes a player's `up_next_players` row whenever their entry stops being `waiting` (left, break, playing, called). That covers every path: `start_match`, app-side leave/break, `close_session`, and anything added later.

`court_changes` (the undo log and audit trail for live-court actions):

| column | notes |
|---|---|
| `id` uuid pk | |
| `session_id`, `match_id`, `court_id` | |
| `actor_id` uuid | the admin |
| `kind` text | `replace`, `switch`, `remove`, `fill`, `no_show`, `undo` |
| `before` jsonb, `after` jsonb | the game's roster and every queue entry the action touched, before and after |
| `created_at`, `undone_at` | |

Read: admins only. Written only by the procedures.

### Partners (pairs)

Sessions can let players join as a pair (`queue_entries.group_id`).

- **Auto-built cards and Auto-pick never split a pair:** both play or neither. (`decide()` already handles `pairId`.)
- **An admin may split a pair by hand** (Replace, Remove, editing a card, Choose Players). Doing so ends the pairing: both entries' `group_id` is cleared, and the UI says so ("Ana and Ben are no longer paired").
- When one half of a pair is replaced or removed, the partner stays where they are.

### Procedures

All lock the session row first, return `{error: code}` rather than raising, and are admin-only.

**Compatibility rule:** a release never removes or renames a procedure input that the live app passes. New inputs get defaults; inputs that are no longer used are kept and ignored, and are dropped in a later release.

- `save_up_next_card(p_session_id, p_card_id, p_team_a uuid[], p_team_b uuid[], p_per_side, p_target_court_id default null)`: create or update one card, set `is_auto = false`. Cards may be incomplete. A player already in another card, or not waiting, is refused. A pair split here ends the pairing.
- `delete_up_next_card(p_card_id)`.
- `replace_auto_up_next(p_session_id, p_cards jsonb, p_line_version text)`: replaces only the `is_auto` cards; refuses (`line_changed`) when the line or any hand-edited card changed since the app read `up_next_line_version(p_session_id)`.
- `start_match(..., p_up_next_id uuid default null)`: when set, starts that card's teams (it must be full, and its `target_court_id`, if set, must match) and deletes the card in the same transaction.
- `replace_match_player(p_match_id, p_out, p_in)`, `switch_match_teams(p_match_id, p_player_1, p_player_2)`, `remove_match_player(p_match_id, p_player)`, `fill_match_slot(p_match_id, p_team, p_player)`: any time while the game is live. Each writes a `court_changes` row and returns `{change_id}`. Players per side come from `matches.format`. Removing the last player ends the game as abandoned and frees the court (not undoable).
- `swap_match_player(p_match_id, p_out, p_window_minutes, p_in default null)`: same inputs as today plus `p_in`; `p_window_minutes` is kept but ignored (no time limit any more). Writes a `court_changes` row.
- `undo_court_change(p_change_id)`: if the game and touched entries still match that change's `after`, restores `before`, sets `undone_at`, and logs an `undo` change. Otherwise `undo_stale`. Only within 10 seconds (`undo_expired`).
- `finish_match`: refuses (`teams_incomplete`) when a team is short or the teams are uneven.
- `close_session`: also deletes the session's cards.
- One helper `public.is_house_account(p_player uuid)` replaces the hard-coded `admin@dctechmicro.com` email check in procedures that pick players.

### Keeping auto cards fresh

- `refreshUpNext(sessionId)` (server) reads the line, history and manual cards, runs `decide()` per card (with `Math.random` for shuffled styles, as the real call-up does), and calls `replace_auto_up_next`.
- One helper, `afterLineChange(sessionId)`, is called by every server action that changes the line or courts; it refreshes the cards and revalidates the pages. New actions call the same helper.
- Backups: the admin screen refreshes on any realtime line change (debounced), and when a session page opens.
- Card count: the session's court count (or the courts in use), plus any extra cards an admin added. For King/Queen each auto card is bound to a court.
- Scale: a session's line is a few dozen players, so a full rebuild on each change is cheap; no incremental logic is needed.

### No auto-call

- `finalizeMatch` no longer calls `callNextUp`; the `autoFill` option, the "Auto-fill courts" switch and its guide text are removed. `StaffCourtMonitor` stops auto-calling.
- After a result, the free court shows its card (bound card first, otherwise the first unbound card not shown on a lower-numbered free court) with **Start**, plus **Choose Players**.
- "Fill all courts" stays as an explicit admin button and starts cards in order onto open courts.
- `callNextUp` stays as the engine for Auto-pick and rebuilds; nothing calls it automatically.

### Screens

Session page (admin), following the PickleQ layout and keeping the current dark stadium look:

```
[ Courts (2) ]  [ Up Next (2) ]  [ Queue (5) ]

Court 1                    0:00   ×        Court 2   Available
Team 1      | Team 2                       Test C  vs  Test B
Test A   ×  | Test C   ×                   Test D      Test A
Test B   ×  | Test E   ×                   [ Start Up Next 1 ]
[Team 1 wins] [Team 2 wins]                [ Choose Players ]

Up Next 1  Auto            ⟳ Rebuild
Team 1: Test C ×  Test D ×   Team 2: Test B ×  Test A ×
[ Send to Court 2 ]
```

- Tapping a live-court player opens: Replace player, Switch teams, Mark as no-show, Cancel.
- Replace: **Auto-pick best match** on top, then a searchable list of waiting players (games played, wait time, W-L).
- Choose Players: Team 1 / Team 2 slots; tap players to fill; × to clear; **Fill Court** starts the game.
- Up Next card: × on each player; tap an empty slot to add; **Send to Court** when full and a court is free.
- Players and the TV board see the cards read-only, in place of today's preview.
- Court monitor (`StaffCourtMonitor`) uses the same court components and actions as the session page.

Code structure: `CourtCard` is split into `LiveCourt` and `FreeCourt`; court actions live in one `useCourtActions` hook shared by the session page and the court monitor; the Courts / Up Next / Queue layout is its own component rather than more code in `SessionDetailView`. Screen rules (which card a court shows, slot filling, when results and Send are allowed) are pure functions with unit tests.

### Activity log

New event types: `court_player_replaced`, `court_player_removed`, `court_teams_switched`, `court_slot_filled`, `court_change_undone`, `up_next_edited`. Replace, Remove and Undo are added to the player's "Why the wait?" list (`waitEstimate.ts` `AFFECTING`); Switch, Fill and Up Next edits are not.

## Release order

1. Apply migrations (compatible with the app currently live), run the SQL tests and the advisor check.
2. Deploy the app.
3. In a later release, drop the inputs kept only for compatibility (`swap_match_player.p_window_minutes`).

## Constraints

- All game-state writes go through plpgsql procedures that lock the session row first; app code never writes court occupancy, rosters or cards directly.
- Migrations applied with `apply_migration`, then the local file renamed to the recorded version; never `supabase db push`.
- SQL tests use `supabase/tests/_fixtures.sql` + test file in one `execute_sql` call.
- Preview UI changes locally before pushing; keep the dark stadium look.

## Calls made in design (can be revisited)

- Auto-pick uses the session's matchmaking style against the three players staying on court, prefers players not already in a card, and never splits a pair.
- Removing the last player ends the game as abandoned.
- Undo: 10 seconds, any admin device, the most recent change on that court only.
- Splitting a pair by hand ends the pairing for the rest of the session.
