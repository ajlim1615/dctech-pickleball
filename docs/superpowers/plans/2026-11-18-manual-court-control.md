# Manual Court Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins pick and swap players by hand, see and edit stored Up Next cards, and no game ever starts without an admin tapping Start.

**Architecture:** Cards live in `up_next_matches` + `up_next_players` (a unique index makes "one card per player" impossible to break); a trigger on `queue_entries` drops a player from cards when they stop waiting. Live-court actions are plpgsql procedures that lock the session row and write a `court_changes` row, which is both the audit trail and the server-side undo log. Matchmaking for auto cards stays in TypeScript (`decide()`), written through a line-version-guarded procedure, and every line-changing server action calls one `afterLineChange` helper. UI is split into `LiveCourt` / `FreeCourt` / `UpNextPanel` components sharing one `useCourtActions` hook, with screen rules in pure, unit-tested functions.

**Tech Stack:** Next.js (read `node_modules/next/dist/docs/` before touching app code; see AGENTS.md), Supabase Postgres (plpgsql, RLS, realtime), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-manual-court-control-design.md`

## Global Constraints

- Every game-state write goes through a plpgsql procedure that does `perform 1 from public.sessions where id = <session> for update` first; app code never writes `courts.status = 'occupied'` / `current_match_id`, `match_players`, `up_next_*` or `court_changes` directly.
- Procedures: `security definer`, `set search_path = ''`, `if not public.is_admin() then return json_build_object('error', 'not_admin')`, then `revoke ... from public, anon; grant ... to authenticated`.
- **Compatibility:** never drop or rename a procedure input the live app passes. Add inputs with defaults; keep unused inputs and ignore them. To add an input to an existing function, `drop function` the old signature and `create` the new one in the same migration (one transaction), with every old input still present.
- Errors are returned as `json_build_object('error', '<code>')`, never raised. Each new code goes into `GAME_STATE_ERRORS` + `MESSAGES` (`src/features/matches/utils/gameStateErrors.ts`) and the `it.each` list in `gameStateErrors.test.ts` in the same task. `swap_window_closed` stays (an old migration still contains it).
- Players per side come from `matches.format` (live games) or the card's `per_side` (cards). No new SQL reads `sessions.description`.
- Player picks exclude house accounts through `public.is_house_account(p_player uuid)` (Task 1), never a hard-coded email.
- Pairs (`queue_entries.group_id`): automatic picks never split a pair; a manual action that splits one sets `group_id = null` on both entries.
- Requeue positions: Replace → **back** as `waiting` (`joined_at = now()`). Remove → **front** as `waiting` (`joined_at` = oldest waiting `joined_at` − 1 ms, or `now()` if nobody waits). No-show → `on_break`, back.
- Undo: 10 seconds, only the latest not-undone change for that match, any admin device.
- Migrations: write the file, apply with Supabase MCP `apply_migration`, rename the local file to the recorded version, regenerate `src/types/database.types.ts`, then run `get_advisors` (security) — no new warnings. Never `supabase db push`.
- SQL tests: `supabase/tests/<name>.test.sql`, run as ONE `execute_sql` of `_fixtures.sql` + (unapplied migration, if any) + the test; pass = error text `ALL TESTS PASSED`.
- Release order: migrations (compatible with the live app) → app deploy → later release drops `swap_match_player.p_window_minutes`.
- Keep the dark stadium look; preview UI locally (`preview_start {name: "web"}`) before pushing. Tablet app (`tablet/`) is out of scope.
- Scale: a session's line is a few dozen players; full card rebuilds per change are fine — do not add incremental rebuild logic.

## Review Focus

1. **A carded player gets started another way** (Choose Players, Replace, Fill, another card) → removed from their card, never on two courts. → Task 1 `card_cleanup_on_start`, Task 2 `card_player_busy`.
2. **Two admins at once:** a stale rebuild must not overwrite newer cards or any hand-edited card; Undo from a second device works and a double Undo is refused. → Task 2 `stale_line_version`, `keeps_manual_cards`; Task 4 `undo_twice_refused`.
3. **Result saved with an empty slot or 2-v-1** after a Remove → refused. → Task 3 `finish_refuses_incomplete`.
4. **Pairs:** replacing one half leaves the partner on court and clears the pairing; auto cards keep pairs together. → Task 3 `replace_splits_pair`; Task 5 `keeps pairs together`.
5. **King/Queen card sent to the wrong court** → refused. → Task 2 `bound_card_wrong_court`.

---

### Task 1: Card tables, cleanup trigger, house-account helper, close_session

**Files:**
- Create: `supabase/migrations/<version>_up_next_tables.sql`
- Test: `supabase/tests/up_next.test.sql`
- Modify: `src/types/database.types.ts` (regenerate)

**Interfaces:**
- Produces tables `public.up_next_matches(id, session_id, position int, per_side smallint check in (1,2), target_court_id uuid null → courts on delete set null, is_auto boolean default true, created_at, updated_at)` and `public.up_next_players(card_id → up_next_matches on delete cascade, session_id, player_id → profiles on delete cascade, team public.match_team, slot smallint check in (1,2))` with `unique (session_id, player_id)`, `unique (card_id, team, slot)`, primary key `(card_id, player_id)`.
- Produces trigger `up_next_drop_unavailable` (`after insert or update of status on queue_entries`): when `new.status <> 'waiting'`, `delete from up_next_players where session_id = new.session_id and player_id = new.player_id`.
- Produces `public.is_house_account(p_player uuid) returns boolean` (stable): true for the system admin profile (email `admin@dctechmicro.com`, the only place the address appears in new SQL). Replace the inline email check in `swap_match_player` when Task 3 recreates it.
- `close_session` recreated (from `20261117140746_game_state_close_session.sql`) with `delete from public.up_next_matches where session_id = p_session_id`.

- [ ] **Step 1: Write `up_next.test.sql`** (shape of `swap_match_player.test.sql`; insert rows directly as the superuser). Cases: `card_cleanup_on_start` (card with p1–p4; `start_match(s, c1, [p1,p5], [p6,p7], true)` → p1's row gone, p2–p4 remain); `card_cleanup_on_break`; `one_card_per_player` (second insert of p2 in another card raises unique violation); `close_session_clears_cards`; `rls_read_only` (as a player: select works, insert fails); `house_account` (`is_house_account` true for the system admin, false for p1).
- [ ] **Step 2: Run** — FAIL (`relation "public.up_next_matches" does not exist`).
- [ ] **Step 3: Write the migration.** RLS select policies copy `queue_entries`' read policy (`20260818000001_security_rls.sql:98`); no write policies. Add both tables to `supabase_realtime`.
- [ ] **Step 4: Run** this test plus `close_session.test.sql`, `start_match.test.sql` — all `ALL TESTS PASSED`.
- [ ] **Step 5: Apply, rename, regenerate types, advisors.**
- [ ] **Step 6: Commit** — `feat(db): up next card tables with cleanup trigger`

### Task 2: Card procedures and `start_match` from a card

**Files:**
- Create: `supabase/migrations/<version>_up_next_procedures.sql`
- Test: `supabase/tests/up_next_procedures.test.sql`
- Modify: `gameStateErrors.ts`, `gameStateErrors.test.ts`

**Interfaces:**
- Consumes: Task 1 tables.
- Produces (all `json`):
  - `up_next_line_version(p_session_id uuid) returns text` (stable): `md5` over waiting entries' `id:joined_at:group_id` in line order, plus every manual card's `id:updated_at`.
  - `save_up_next_card(p_session_id uuid, p_card_id uuid, p_team_a uuid[], p_team_b uuid[], p_per_side smallint, p_target_court_id uuid default null) → {card_id}` — replaces that card's player rows; `is_auto = false`; new cards go to `max(position)+1`. Errors: `in_other_card`, `not_waiting`, `bad_teams` (a side longer than `p_per_side`, or a duplicate). Splitting a pair clears `group_id` on both entries and returns `{card_id, unpaired: uuid[]}`.
  - `delete_up_next_card(p_card_id uuid) → {ok}` — renumbers positions 1..n.
  - `replace_auto_up_next(p_session_id uuid, p_cards jsonb, p_line_version text) → {ok} | {error: 'line_changed'}` — `p_cards = [{team_a, team_b, per_side, target_court_id}]`; deletes auto cards, inserts new ones after the manual cards.
  - `start_match(p_session_id, p_court_id, p_team_a, p_team_b, p_from_queue, p_up_next_id uuid default null)` — body from `20261117142842_game_state_busy_player_fixes.sql`. With `p_up_next_id`: teams come from the card; card must be full (`teams_incomplete`); `target_court_id` set and ≠ `p_court_id` → `wrong_court`; card deleted in the same transaction.
- TS codes: `in_other_card` "That player is already in another Up Next match.", `not_waiting` "That player isn't waiting in line.", `teams_incomplete` "Fill every slot before starting or saving this game.", `wrong_court` "This match is set for a different court."

- [ ] **Step 1: Write the test.** Cases: `save_new_card`; `in_other_card`; `not_waiting`; `save_splits_pair` (p1+p2 paired, card has p1 only with p3 → both `group_id` null); `keeps_manual_cards`; `stale_line_version`; `manual_edit_invalidates_version` (read version, edit a manual card, rebuild → `line_changed`); `start_from_card`; `start_incomplete_card`; `card_player_busy`; `bound_card_wrong_court`; `start_match_old_call` (5 named args still works).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Write the migration.**
- [ ] **Step 4: Run** this test plus `start_match.test.sql`, `up_next.test.sql` — pass.
- [ ] **Step 5: Add TS codes**; `npm test -- gameStateErrors` — PASS.
- [ ] **Step 6: Apply, rename, types, advisors, commit** — `feat(db): up next card procedures`

### Task 3: Live-court actions with the change log

**Files:**
- Create: `supabase/migrations/<version>_court_player_actions.sql`
- Test: `supabase/tests/court_player_actions.test.sql`; modify `swap_match_player.test.sql` (case 3 now succeeds after points), `finish_match.test.sql`
- Modify: `gameStateErrors.ts` + test

**Interfaces:**
- Produces table `public.court_changes(id uuid pk, session_id, match_id, court_id, actor_id, kind text check in ('replace','switch','remove','fill','no_show','undo'), before jsonb, after jsonb, created_at timestamptz default now(), undone_at timestamptz)`; RLS: admins select only; index `(match_id, created_at desc)`.
- Snapshot shape (`before`/`after`): `{players: [{player_id, team}], entries: [{id, status, joined_at, target_court_id, group_id}]}` — roster of the match plus every queue entry the action touched. Internal helper `public._court_snapshot(p_match_id uuid, p_entry_ids uuid[]) returns jsonb`.
- Each returns `{change_id}` (plus action-specific fields):
  - `replace_match_player(p_match_id, p_out, p_in)` — game `in_progress` (`game_not_live`), `p_out` in it (`not_in_game`), `p_in` waiting (`not_waiting`), not on a live court (`player_busy`), not a house account. Effects per Global Constraints; splitting a pair clears both `group_id`s; returns `{change_id, unpaired}`.
  - `switch_match_teams(p_match_id, p_player_1, p_player_2)` — `same_team` / `not_in_game`.
  - `remove_match_player(p_match_id, p_player)` — front of line; last player out → match `abandoned`, `ended_at = now()`, court `available` / `current_match_id = null`, returns `{change_id: null, abandoned: true}` (no log row: not undoable).
  - `fill_match_slot(p_match_id, p_team public.match_team, p_player)` — `slot_full` when the team already has the per-side count from `matches.format`.
  - `swap_match_player(p_match_id, p_out, p_window_minutes, p_in uuid default null)` — drop + create with the old three inputs kept; `p_window_minutes` ignored; `p_in null` = next waiting non-house player. Returns `{replacement_id, change_id}`.
  - `finish_match` — `teams_incomplete` when the two teams differ in size or are below the format's count.
- TS codes: `same_team` "Those two players are already on the same team.", `slot_full` "That team is already full."

- [ ] **Step 1: Write the test.** Cases: `replace_back_of_line`; `replace_mid_game` (score 5-3 allowed); `replace_busy`; `replace_splits_pair` (partner stays on court, both `group_id` null); `switch_teams`; `remove_front_of_line` (game live with 3); `remove_last_abandons`; `fill_slot`; `slot_full`; `noshow_pick` (`swap_match_player(m, p1, 5, p6)`); `noshow_old_call` (3 named args still works, no time limit); `finish_refuses_incomplete`; `change_logged` (each action writes one row with matching `before`/`after`).
- [ ] **Step 2: Update** `swap_match_player.test.sql` case 3 and add `teams_incomplete` to `finish_match.test.sql`.
- [ ] **Step 3: Run** — FAIL.
- [ ] **Step 4: Write the migration.**
- [ ] **Step 5: Run** these plus every other file in `supabase/tests/` — all pass.
- [ ] **Step 6: Add TS codes**; `npm test` — PASS.
- [ ] **Step 7: Apply, rename, types, advisors, commit** — `feat(db): replace, switch, remove and fill on live courts`

### Task 4: Undo

**Files:**
- Create: `supabase/migrations/<version>_undo_court_change.sql`
- Test: `supabase/tests/undo_court_change.test.sql`
- Modify: `gameStateErrors.ts` + test

**Interfaces:**
- Produces `undo_court_change(p_change_id uuid) → {change_id} | {error}`: locks the session; `undo_expired` when `created_at < now() - interval '10 seconds'`; `undo_stale` when it's already undone, isn't the latest not-undone change for its match, the match isn't `in_progress`, or the current snapshot ≠ `after`. Otherwise writes `before` back (roster rows and entry `status`/`joined_at`/`target_court_id`/`group_id`), sets `undone_at`, logs a `kind = 'undo'` row.
- TS codes: `undo_stale` "Too late to undo — something else changed on this court.", `undo_expired` "Undo is only available for 10 seconds."

- [ ] **Step 1: Write the test.** Cases: `undo_replace` (roster and both entries exactly restored, including `joined_at` and `group_id`); `undo_remove`; `undo_switch`; `undo_noshow`; `undo_twice_refused`; `undo_not_latest` (replace, then switch, undo the replace → `undo_stale`); `undo_stale_after_finish`; `undo_expired` (set `created_at` 11 s back).
- [ ] **Step 2: Run** — FAIL. **Step 3:** write the migration. **Step 4:** run all SQL tests — pass.
- [ ] **Step 5: TS codes; `npm test`** — PASS.
- [ ] **Step 6: Apply, rename, types, advisors, commit** — `feat(db): undo live-court changes`

### Task 5: Pure matchmaking helpers for cards and Auto-pick

**Files:**
- Create: `src/features/queue/upNext/buildCards.ts`, `src/features/queue/upNext/buildCards.test.ts`

**Interfaces:**
- Consumes: `decide`, `LineEntry`, `PastGame`, `MatchingStyle` (`src/features/queue/matchmaking`).
- Produces:
  - `COURT_BOUND_STYLES: MatchingStyle[] = ["king_queen"]`.
  - `buildAutoCards(input: { style: MatchingStyle; line: LineEntry[]; history: PastGame[]; courts: string[]; count: number; perSide: 1 | 2; exclude: Set<string>; settings: { skillSpread?: number }; random: () => number }): AutoCard[]` where `type AutoCard = { teamA: string[]; teamB: string[]; targetCourtId: string | null }`. Removes `exclude`, then for card i calls `decide` with `court = courts[i % courts.length]`, removes picked players, stops at the first `hold`. `targetCourtId` = that court for court-bound styles, else `null`.
  - `pickReplacement(input: { style: MatchingStyle; line: LineEntry[]; staying: { teamA: string[]; teamB: string[] }; missingTeam: "team_a" | "team_b"; inCards: Set<string>; random: () => number }): string | null` — candidates: waiting, unpaired (`pairId == null`), not in `inCards`; if none, unpaired in cards; for `balanced` / `skill_separated` the rating that brings team averages closest, else longest waiting.

- [ ] **Step 1: Tests:** `builds count cards without reusing players`; `skips excluded players`; `stops at hold`; `keeps pairs together` (pair at line positions 4–5, count 1 → both in or both out); `binds cards to courts for king_queen`; `pickReplacement prefers players not in cards`; `pickReplacement balances ratings` (staying A=[4.0], B=[3.0, 3.0]; candidates 2.0 / 4.0 → 2.0); `pickReplacement skips paired players`; `pickReplacement returns null on empty line`.
- [ ] **Step 2: Run `npm test -- buildCards`** — FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(queue): build up next cards and pick replacements`

### Task 6: Server actions, `afterLineChange`, events

**Files:**
- Create: `src/features/queue/api/upNextActions.ts`, `src/features/courts/api/courtPlayerActions.ts`, `src/features/queue/server/afterLineChange.ts`
- Modify: `src/features/queue/api/queueActions.ts`, `src/features/matches/api/matchActions.ts`, `src/features/activity/utils/describeEvent.ts` + `describeEvent.test.ts`, `src/features/activity/utils/waitEstimate.ts` + `waitEstimate.test.ts`, the session event type union (where `SessionEventType` is defined) and its DB check/enum if one exists (search `session_events` migrations)

**Interfaces:**
- `afterLineChange(sessionId: string, extraPaths?: string[]): Promise<void>` — `refreshUpNext(sessionId)` then `revalidatePath` for `/sessions/${sessionId}`, `/`, and `extraPaths`. Replace the ad-hoc `revalidatePath` blocks in `joinQueue`, `bulkAddPlayersToQueue`, `leaveQueue`, `adminRemovePlayerFromQueue`, `setQueueBreak`, `swapQueuePlayers`, `substituteQueuePlayer`, `bumpPlayerInQueue`, `callNextUp`, `swapNoShow`, `finalizeMatch` with it.
- `upNextActions.ts` (`"use server"`, admin via `requireAdminUser`, result `{ success: true, ... } | { error: string }` via `gameStateErrorMessage`): `refreshUpNext(sessionId)`, `getUpNext(sessionId): Promise<UpNextCard[]>`, `saveUpNextCard(sessionId, cardId: string | null, teamA: string[], teamB: string[])`, `deleteUpNextCard(cardId)`, `rebuildUpNext(sessionId)`, `sendUpNextToCourt(sessionId, cardId, courtId)`, `startChosenPlayers(sessionId, courtId, teamA, teamB)`.
- `type UpNextCard = { id: string; position: number; perSide: 1 | 2; targetCourtId: string | null; isAuto: boolean; teamA: string[]; teamB: string[] }` — exported from `src/features/queue/upNext/types.ts`.
- `courtPlayerActions.ts`: `replacePlayer(matchId, outId, inId)`, `autoPickReplacement(matchId, outId)`, `switchTeams(matchId, p1, p2)`, `removeFromCourt(matchId, playerId)`, `fillSlot(matchId, team, playerId)`, `markNoShow(matchId, playerId, inId?)`, `undoCourtChange(changeId)`. Each returns `{ success: true, changeId: string | null, unpaired?: string[] }`, records its event, and calls `afterLineChange`.
- `swapNoShow` becomes a thin wrapper over `markNoShow` (kept for existing callers).
- Events: `court_player_replaced` "{actor} put {in} in for {out} on {court}", `court_player_removed` "{actor} took {out} off {court}", `court_teams_switched` "{actor} switched {a} and {b} on {court}", `court_slot_filled` "{actor} added {in} to {court}", `court_change_undone` "{actor} undid a change on {court}", `up_next_edited` "{actor} changed Up Next". Add the first two and `court_change_undone` to `AFFECTING` in `waitEstimate.ts`.
- `fillOpenCourts(sessionId)` starts cards in order onto open courts (bound cards only on their court) via `sendUpNextToCourt`.

- [ ] **Step 1: Tests** for the six describeEvent texts and the new `AFFECTING` entries. Run — FAIL.
- [ ] **Step 2: Implement** event types, text, `AFFECTING` — PASS.
- [ ] **Step 3: Implement** the actions and `afterLineChange`; grep shows no remaining direct `revalidatePath("/sessions/` in the listed functions.
- [ ] **Step 4: `npx tsc --noEmit`, `npm test`** — clean, pass.
- [ ] **Step 5: Commit** — `feat(courts): server actions for up next and live-court changes`

### Task 7: Remove auto-call

**Files:**
- Modify: `src/features/matches/api/matchActions.ts`, `src/features/courts/components/CourtCard.tsx`, `src/features/courts/components/CourtMatrix.tsx`, `src/features/sessions/components/SessionConsoleBar.tsx`, `src/features/sessions/components/SessionDetailView.tsx`, `src/features/courts/components/StaffCourtMonitor.tsx`, `src/features/admin/components/AdminRulesGuide.tsx:75`, `src/features/guide/data/guideData.ts:394`, `USER_GUIDE.md`
- Test: `src/features/matches/finalizeMatch.test.ts` (create)

**Interfaces:** `finalizeMatch(matchId: string, scoreA: number, scoreB: number): Promise<{ success: true } | { error: string }>`.

- [ ] **Step 1: Write `finalize_does_not_call_next`** (mock Supabase and `queueActions`; `callNextUp` never called; `finish_match` RPC called once). Run — FAIL.
- [ ] **Step 2: Remove** the auto-call, the `autoFill` option/prop/switch/`useAutoFillPreference`; `grep -rn "autoFill\|Auto-fill" src USER_GUIDE.md` returns nothing. Guide copy: "When a game is saved the court frees up and shows the next Up Next match. Tap Start when you're ready."
- [ ] **Step 3: `npm test`, `npx tsc --noEmit`** — pass.
- [ ] **Step 4: Commit** — `fix(sessions): saving a result never starts the next game`

### Task 8: Screen rules (pure functions)

**Files:**
- Create: `src/features/courts/utils/courtRules.ts`, `src/features/courts/utils/courtRules.test.ts`

**Interfaces:**
- `cardForFreeCourt(courtId: string, freeCourtIds: string[], cards: UpNextCard[]): UpNextCard | null` — a card bound to this court first; otherwise the k-th unbound card, where k = this court's index among free courts with no bound card.
- `canSaveResult(teamA: string[], teamB: string[], perSide: 1 | 2): boolean`.
- `canSendCard(card: UpNextCard, freeCourtIds: string[]): boolean` — full, and (unbound with a free court, or its bound court is free).
- `chooseSlotsReducer(state: { teamA: string[]; teamB: string[]; active: "team_a" | "team_b"; perSide: 1 | 2 }, action: { type: "pick" | "clear"; playerId: string }): typeof state` — pick fills the active team's next slot, then switches to the other team if it has room; clear removes and makes that team active.

- [ ] **Step 1: Tests:** `bound card shows only on its court`; `unbound cards spread across free courts in order`; `no card when none left`; `canSaveResult false with 2 v 1`; `canSendCard false when bound court busy`; `reducer fills A then B`; `reducer clear reactivates that team`; `reducer ignores picks when full`.
- [ ] **Step 2: Run** — FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(courts): court screen rules`

### Task 9: Shared court actions and split court components

**Files:**
- Create: `src/features/courts/hooks/useCourtActions.ts`, `src/features/courts/components/LiveCourt.tsx`, `src/features/courts/components/FreeCourt.tsx`, `src/features/courts/components/CourtPlayerSheet.tsx`, `src/features/courts/components/ChoosePlayersSheet.tsx`, `src/features/courts/components/UndoToast.tsx`, `src/features/queue/components/PlayerPickerSheet.tsx`
- Modify: `src/features/courts/components/CourtCard.tsx` (becomes a thin switch between `LiveCourt` and `FreeCourt`), `src/features/courts/components/StaffCourtMonitor.tsx` (uses `LiveCourt` / `FreeCourt` and the hook instead of its own manual-match and auto-call code)

**Interfaces:**
- `useCourtActions(sessionId: string)` returns `{ replace, autoPick, switchTeams, remove, fill, noShow, undo, sendCard, startChosen, pending: boolean, error: string | null, lastChange: { id: string; message: string } | null }`, wrapping Task 6 actions in `startTransition`.
- `PlayerPickerSheet` props `{ title; candidates: QueueEntryWithPlayer[]; onPick(playerId): void; onAutoPick?(): void; onClose(): void }` — search box, games played, wait time, W-L; pair partners labelled.
- `CourtPlayerSheet` props `{ player: Profile; courtName; team; onReplace; onSwitch; onNoShow; onClose }`.
- `ChoosePlayersSheet` props `{ courtName; candidates; perSide: 1 | 2; onFill(teamA, teamB); onClose }`, state via `chooseSlotsReducer`.
- `UndoToast` props `{ message; changeId; onUndo(changeId) }`, hides after 10 s.
- `LiveCourt`: name → `CourtPlayerSheet`; × → `remove`; empty slot "+ Tap to add player" → picker → `fill`; "Fill empty slots" uses `autoPick`; win buttons disabled unless `canSaveResult`; shows "Ana and Ben are no longer paired" when `unpaired` comes back. Old no-show panel and `canSwapNoShow` gating removed.
- `FreeCourt`: `cardForFreeCourt` card with "Start Up Next N" (→ `sendCard`), "Choose Players"; no "Call next".

- [ ] **Step 1: Build** per the interfaces. **Step 2:** `npx tsc --noEmit`, `npm run lint`, `npm test` — clean.
- [ ] **Step 3: Verify in the browser** (`preview_start {name: "web"}`, admin login from the project's seed files), session with 10 players including one pair: Replace at 3-2 → incoming on court, outgoing at back; Undo → restored; Undo again from a second tab → refused; Remove → player #1, empty slot, win buttons disabled; Fill; Switch; No-show → on break; replace one half of the pair → "no longer paired"; save a result → court shows "Start Up Next 1", nothing starts by itself; Choose Players fills a free court. Repeat Replace/Undo on the court monitor page. Screenshots.
- [ ] **Step 4: Commit** — `feat(courts): pick, replace, switch and remove players on court`

### Task 10: Up Next panel and live session layout

**Files:**
- Create: `src/features/queue/hooks/useLiveUpNext.ts`, `src/features/queue/components/UpNextPanel.tsx`, `src/features/queue/components/UpNextCard.tsx`, `src/features/sessions/components/LiveSessionLayout.tsx`
- Modify: `src/features/sessions/components/SessionDetailView.tsx` (render `LiveSessionLayout`; net line count goes down), `src/features/sessions/components/SessionQueueLiveBoard.tsx` (stored cards replace the `preview` / `nextMatchup` block; read-only for players)

**Interfaces:**
- `useLiveUpNext(sessionId: string, initial: UpNextCard[]): UpNextCard[]` — realtime on both card tables, same pattern as `useLiveQueue`.
- `LiveSessionLayout` props `{ session; courts; queue; cards; isAdmin }` — Courts / Up Next / Queue tabs on narrow screens, columns on wide; on admin screens, debounced (1500 ms) `refreshUpNext` on `queue_entries` realtime changes and once on mount.
- `UpNextCard`: "Up Next N", "Auto" badge, "Rebuild", × per player, tap empty slot → `PlayerPickerSheet`, "Send to Court N" via `canSendCard` (menu when several free courts), "✕" delete; panel has "+ Add match" and "Refresh Up Next".

- [ ] **Step 1: Build** per the interfaces. **Step 2:** `npx tsc --noEmit`, `npm run lint` — clean.
- [ ] **Step 3: Verify in the browser:** 8+ players → auto cards; edit card 1 → "Auto" badge gone, survives Rebuild; second tab shows the same cards live; Send to Court starts exactly that foursome; King/Queen session → each card shows only on its court; player view read-only; End the session → cards gone. Screenshots.
- [ ] **Step 4: Commit** — `feat(sessions): editable up next cards`

### Task 11: Whole-branch check and docs

- [ ] **Step 1:** Run every `supabase/tests/*.test.sql` — all `ALL TESTS PASSED`.
- [ ] **Step 2:** `npm test`, `npx tsc --noEmit`, `npm run lint` — pass.
- [ ] **Step 3:** `get_advisors` (security and performance) — no new warnings.
- [ ] **Step 4:** Two admin browsers at once on one session: edit a card in one while the other rebuilds; Undo from the other device; both stay consistent.
- [ ] **Step 5:** Update `USER_GUIDE.md` (Up Next, Choose Players, court player actions, pairs, no auto-call) and add a follow-up note to `docs/superpowers/specs/2026-11-18-manual-court-control-design.md` for the later release that drops `swap_match_player.p_window_minutes`. Commit — `docs: manual court control guide`.
