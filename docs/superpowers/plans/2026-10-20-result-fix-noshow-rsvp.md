# Fix a Result, No-Show Swap, and RSVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins correct a saved game (ratings follow), swap a called player who doesn't show up for the next person in line, and let players RSVP to upcoming sessions.

**Architecture:** Each feature is a pure, unit-tested helper plus one server action plus a small UI entry point, following the patterns already on `feat/admin-session-console` (`ratingEngine.ts`, `requeue.ts`, `setQueueBreak`). Only RSVP needs a new table; its migration follows `20261019000000_queue_on_break.sql`.

**Tech Stack:** Next.js 16 (App Router, server actions — read `node_modules/next/dist/docs/` before writing Next code, per AGENTS.md), Supabase (Postgres + RLS), Tailwind, Vitest.

**Spec:** This plan's "Decisions" section below (agreed in conversation on 2026-10-20; there is no separate spec file).

## Decisions (the spec)

**1. Fix a result**
- Admins only. Any completed game from any session can be corrected, from the session page's Match logs.
- The admin enters a new score (or picks the winner in a win/loss session). The new result must pass the session's scoring rule (`getWinner` from `src/features/matches/utils/scoring.ts`).
- Ranked games: each player's rating moves by `newChange − oldChange`, where `oldChange` is that game's `player_ratings_history.rating_change` and `newChange` is `calculateRatingChanges` recomputed from the history row's `old_rating`. Later games are **not** replayed (accepted approximation; ratings drift by at most the difference of one game's change). The history row's `new_rating` and `rating_change` are updated in place.
- If the winner flips, `profiles.games_won` moves by one from each old-winner to each new-winner (ranked games only, since only ranked games counted wins).
- Casual games: only the match row changes.

**2. No-show**
- Admins only, from an in-play court card, only while the game is still 0–0.
- The admin picks which of the four players didn't show. The first `waiting` entry in the session queue (by `joined_at`) takes their place on the same team.
- The no-show is put **on a break** with `joined_at = now()` (back of the line, skipped until they tap "I'm back"). No rating or games change.
- If nobody is waiting, nothing changes and the admin sees "No one is waiting to swap in."

**3. RSVP**
- Any signed-in player can mark "I'm going" / undo it on a **scheduled** session. RSVPs close when the session starts.
- Everyone can see the count and the names (shown on the session page; count only in lists).
- An RSVP doesn't check anyone in, and it doesn't enforce `max_players` (the waitlist is a separate feature).

## Global Constraints

- Root system admin `admin@dctechmicro.com` is never a player: no RSVP, never swapped in (mirror `isRootSystemAdmin` in `src/lib/security/authGuard.ts`).
- Every new server action that changes another player's data starts with `requireAdminUser()`.
- Queue status filters must not list `"on_break"` in `.in(...)` literals; use `.not("status","in","(playing,left)")` / `.neq` (see `queueActions.ts`).
- UI copy: sentence case, plain verbs, no all-caps labels, no monospace except numbers (`font-mono tabular-nums`). Touch targets ≥ 44px (`h-11`). Primary action uses `variant="volt"`; one per area.
- Every `revalidatePath` includes `/sessions/${sessionId}` and `/`.

## Review Focus

1. **Double-submitting a correction** (two taps or two admins): the second must not apply the rating delta again → pin with an idempotency test in Task 2 (`correctionDeltas` returns zero deltas when the new score equals the stored score).
2. **Correcting a game whose history rows are missing** (ranked game saved before ratings existed): must still fix the score and leave ratings alone, not throw → test in Task 2 (`planResultCorrection` with an empty history returns no rating updates).
3. **No-show when the replacement is a partner of someone already on court, or is the no-show themself** (they re-queued): the swap must skip anyone already in the match → test in Task 3 (`pickReplacement` skips match player ids).
4. **No-show after a point was scored**: refused with a clear message → test in Task 3 (`canSwapNoShow(1,0)` is false).
5. **RSVP after the session has started or for a cancelled session**: refused, and the button is hidden → test in Task 5 (`canRsvp` for `active`/`cancelled`/`completed` is false).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/features/rankings/utils/ratingEngine.ts` (modify) | add `correctionDeltas` |
| `src/features/matches/utils/resultCorrection.ts` (create) | pure planner: from stored game + new score → match update, rating updates, wins moves |
| `src/features/matches/api/matchActions.ts` (modify) | `correctMatchResult` server action |
| `src/features/matches/components/EditResultModal.tsx` (create) | admin dialog to enter the new result |
| `src/features/sessions/components/SessionLeaderboard.tsx` (modify) | "Fix result" button on completed games for admins |
| `src/features/queue/utils/noShow.ts` (create) | pure `canSwapNoShow`, `pickReplacement` |
| `src/features/queue/api/queueActions.ts` (modify) | `swapNoShow` server action |
| `src/features/courts/components/CourtCard.tsx` (modify) | "No-show?" picker on 0–0 in-play courts |
| `supabase/migrations/20261020000000_session_rsvps.sql` (create) | table + RLS |
| `src/types/database.types.ts` (modify) | `session_rsvps` table types |
| `src/features/sessions/utils/rsvp.ts` (create) | pure `canRsvp` |
| `src/features/sessions/api/rsvpActions.ts` (create) | `setRsvp`, `getRsvpCounts`, `getSessionRsvps` |
| `src/features/sessions/components/RsvpButton.tsx` (create) | "I'm going" toggle + count |
| `SessionRow.tsx`, `SessionList.tsx`, `HomeView.tsx`, `SessionDetailView.tsx`, `AdminDashboard.tsx`, pages (modify) | show counts / button |

---

### Task 1: Rating correction maths

**Files:**
- Modify: `src/features/rankings/utils/ratingEngine.ts`
- Test: `src/features/rankings/ratingEngine.test.ts`

**Interfaces:**
- Consumes: `calculateRatingChanges(teamA, teamB, scoreA, scoreB, targetPoints): RatingChange[]` (existing)
- Produces: `correctionDeltas(teamA: RatedPlayer[], teamB: RatedPlayer[], newScoreA: number, newScoreB: number, targetPoints: number, oldChanges: Record<string, number>): { playerId: string; newChange: number; delta: number }[]` — `RatedPlayer.rating` here is the player's rating *before* the game (history `old_rating`); `delta = round2(newChange - oldChanges[playerId] ?? 0)`.

- [ ] **Step 1: Write the failing tests** in `ratingEngine.test.ts`, `describe("correctionDeltas")`:
  - `"flipping the winner reverses and re-applies the change"`: equal 3.5 teams, old changes `{a:+0.05,b:-0.05}` from 11-9; correcting to 9-11 gives `delta(a) < 0`, `delta(b) > 0`, and `delta(a) ≈ -delta(b)`.
  - `"same score gives zero deltas"`: correcting to the stored score returns every `delta === 0`.
  - `"missing old change counts as zero"`: `oldChanges = {}` → `delta === newChange`.
- [ ] **Step 2: Run** `npx vitest run src/features/rankings` → FAIL (`correctionDeltas` not exported).
- [ ] **Step 3: Implement `correctionDeltas`** by calling `calculateRatingChanges` and subtracting.
- [ ] **Step 4: Run** `npx vitest run src/features/rankings` → PASS.
- [ ] **Step 5: Commit** `feat(ratings): add correctionDeltas for fixing a saved result`.

### Task 2: Fix-a-result server action

**Files:**
- Create: `src/features/matches/utils/resultCorrection.ts`
- Modify: `src/features/matches/api/matchActions.ts`
- Test: `src/features/matches/resultCorrection.test.ts`

**Interfaces:**
- Consumes: `correctionDeltas` (Task 1); `getWinner`, `describeRule`, `ScoringRule` (scoring.ts); `parseSessionMetadata`.
- Produces:
  - `planResultCorrection(input: { rule: ScoringRule; isRanked: boolean; oldScore: {a:number;b:number}; newScore: {a:number;b:number}; teamA: RatedPlayer[]; teamB: RatedPlayer[]; history: { playerId: string; oldRating: number; change: number }[] }): { error?: string; winningTeam?: "team_a"|"team_b"; ratingUpdates: { playerId: string; delta: number; newChange: number }[]; winsMoves: { playerId: string; by: 1 | -1 }[] }`
    - error when `getWinner(newScore)` is null: `` `${a}-${b} is not a finished game. This session plays ${describeRule(rule)}.` ``
    - `ratingUpdates` empty when `!isRanked` or `history` is empty; uses each history row's `oldRating` as the player's rating.
    - `winsMoves` empty unless ranked and the winner flipped: `-1` for each old-winner, `+1` for each new-winner.
  - `correctMatchResult(matchId: string, scoreA: number, scoreB: number): Promise<{ success?: true; error?: string }>` in `matchActions.ts`.

- [ ] **Step 1: Write the failing tests** for `planResultCorrection`:
  - `"rejects an unfinished score"` → `error` contains `"is not a finished game"`.
  - `"casual game: no rating updates or wins moves"`.
  - `"ranked, same winner: rating updates, no wins moves"`.
  - `"ranked, winner flipped: wins move from old winners to new"` → 4 entries, two `-1`, two `+1`.
  - `"ranked with no history rows: fixes nothing rating-wise"` → `ratingUpdates` empty (Review Focus 2).
  - `"same score as stored: all deltas zero"` (Review Focus 1).
- [ ] **Step 2: Run** `npx vitest run src/features/matches` → FAIL.
- [ ] **Step 3: Implement `planResultCorrection`.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Implement `correctMatchResult`**: `requireAdminUser()`; load match (`status` must be `"completed"`, else `"Only finished games can be corrected."`), its session description, `match_players`, `profiles` (games_played), and `player_ratings_history` rows for `match_id`; call `planResultCorrection`; then update `matches` (scores, `winning_team`, `updated_at`), each profile's `skill_rating` by `delta` (clamped 1.0–6.0, rounded to 0.01), each history row's `rating_change`/`new_rating`, and `games_won` by `winsMoves`; revalidate `/sessions/${sessionId}`, `/`, `/matches`, `/rankings`, `/profile`.
- [ ] **Step 6: Run** `npx tsc --noEmit -p .` → no errors.
- [ ] **Step 7: Commit** `feat(matches): let admins correct a saved result`.

### Task 3: No-show swap logic and action

**Files:**
- Create: `src/features/queue/utils/noShow.ts`
- Modify: `src/features/queue/api/queueActions.ts`
- Test: `src/features/queue/noShow.test.ts`

**Interfaces:**
- Produces:
  - `canSwapNoShow(scoreA: number, scoreB: number): boolean` → true only at 0–0.
  - `pickReplacement(waiting: { id: string; player_id: string; joined_at: string }[], excludePlayerIds: string[]): { id: string; player_id: string } | null` → earliest `joined_at` not in `excludePlayerIds`.
  - `swapNoShow(matchId: string, noShowPlayerId: string): Promise<{ success?: true; replacementName?: string; error?: string }>`.

- [ ] **Step 1: Write the failing tests**: `canSwapNoShow(0,0)` true, `(1,0)` false (Review Focus 4); `pickReplacement` returns earliest; skips excluded ids (Review Focus 3); returns `null` for an empty list.
- [ ] **Step 2: Run** `npx vitest run src/features/queue` → FAIL.
- [ ] **Step 3: Implement both helpers.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Implement `swapNoShow`**: `requireAdminUser()`; load match (must be `in_progress` and `canSwapNoShow`, else `"Players can only be swapped before the first point."`); load `match_players` ids; fetch session `waiting` entries (`.eq("status","waiting")`, ordered by `joined_at`), skipping the root admin; `pickReplacement` (null → `"No one is waiting to swap in."`); update that `match_players` row's `player_id`; set the replacement's queue entry to `playing` with `target_court_id`; set the no-show's latest `playing` entry to `on_break` with `joined_at = now()`; revalidate; return the replacement's name.
- [ ] **Step 6: Run** `npx tsc --noEmit -p .` → no errors.
- [ ] **Step 7: Commit** `feat(queue): swap a no-show for the next player in line`.

### Task 4: Admin UI for fix-result and no-show

**Files:**
- Create: `src/features/matches/components/EditResultModal.tsx`
- Modify: `src/features/sessions/components/SessionLeaderboard.tsx`, `src/features/sessions/components/SessionDetailView.tsx`, `src/features/courts/components/CourtCard.tsx`

**Interfaces:**
- Consumes: `correctMatchResult` (Task 2), `swapNoShow` (Task 3), `canSwapNoShow` (Task 3), `ScoringRule`, `resultOnlyScore`.
- Produces: `EditResultModal({ match, rule, onClose }: { match: { id: string; team_a_score: number; team_b_score: number; teamA: string[]; teamB: string[] }; rule: ScoringRule; onClose: () => void })`; `SessionLeaderboard` gains props `isAdmin?: boolean` and `rule?: ScoringRule`.

- [ ] **Step 1: Build `EditResultModal`**: points sessions show two number inputs (Team 1 / Team 2, `inputMode="numeric"`, `h-11`); win/loss sessions show two "Team N won" buttons; inline error from the action; buttons "Cancel" and "Save correction" (volt). Copy under the title: "Ratings and wins update to match."
- [ ] **Step 2: In `SessionLeaderboard`**, on completed games when `isAdmin`, add a ghost "Fix result" button that opens the modal; pass `isAdmin` and the session rule from `SessionDetailView`.
- [ ] **Step 3: In `CourtCard`**, when `isAdministrator && hasPlayersOnCourt && canSwapNoShow(scoreA, scoreB)`, show a ghost "No-show?" button in the header; it opens a small list of the four players ("Who didn't show?"); picking one calls `swapNoShow`, then shows `` `${replacementName} is in. ${noShowName} is on a break.` `` or the error, and `router.refresh()`.
- [ ] **Step 4: Run** `npx tsc --noEmit -p .` and `npx vitest run --dir src` → pass.
- [ ] **Step 5: Verify visually** with a temporary mock page under `src/app/(auth)/auth/` (only `/login` and `/auth/*` skip the auth redirect), at 375px and 1366px, light and dark; delete the page afterwards.
- [ ] **Step 6: Commit** `feat(ui): fix-result dialog and no-show swap for admins`.

### Task 5: RSVP data and actions

**Files:**
- Create: `supabase/migrations/20261020000000_session_rsvps.sql`, `src/features/sessions/utils/rsvp.ts`, `src/features/sessions/api/rsvpActions.ts`
- Modify: `src/types/database.types.ts`
- Test: `src/features/sessions/rsvp.test.ts`

**Interfaces:**
- Produces:
  - Table `public.session_rsvps (id uuid pk default gen_random_uuid(), session_id uuid not null references sessions on delete cascade, player_id uuid not null references profiles on delete cascade, created_at timestamptz not null default now(), unique (session_id, player_id))`; RLS: select `to authenticated using (true)`; insert `with check (auth.uid() = player_id)`; delete `using (auth.uid() = player_id or public.is_admin())`; index on `session_id`.
  - Type `SessionRsvp` exported from `src/types/index.ts`.
  - `canRsvp(status: SessionStatus): boolean` → true only for `"scheduled"`.
  - `setRsvp(sessionId: string, going: boolean): Promise<{ success?: true; error?: string }>` — refuses when `!canRsvp` (`"RSVPs close when the session starts."`) or for the root admin.
  - `getRsvpCounts(sessionIds: string[]): Promise<Record<string, number>>`.
  - `getSessionRsvps(sessionId: string): Promise<{ playerId: string; name: string }[]>`.

- [ ] **Step 1: Write the failing test**: `canRsvp("scheduled")` true; `"active"`, `"completed"`, `"cancelled"` false (Review Focus 5).
- [ ] **Step 2: Run** `npx vitest run src/features/sessions` → FAIL.
- [ ] **Step 3: Implement `canRsvp`**, the migration, the types, and the three actions. `getRsvpCounts` returns 0 (not an error) if the table is missing, so pages keep loading before the migration is applied.
- [ ] **Step 4: Run** tests and `npx tsc --noEmit -p .` → PASS.
- [ ] **Step 5: Commit** `feat(sessions): RSVP table and actions`.

### Task 6: RSVP UI

**Files:**
- Create: `src/features/sessions/components/RsvpButton.tsx`
- Modify: `src/features/sessions/components/SessionRow.tsx`, `SessionList.tsx`, `src/features/home/components/HomeView.tsx`, `SessionDetailView.tsx`, `src/features/admin/components/AdminDashboard.tsx`, and the pages that load them (`src/app/page.tsx`, `src/app/(app)/sessions/page.tsx`, `src/app/(app)/sessions/[id]/page.tsx`, `src/app/(app)/admin/page.tsx`)

**Interfaces:**
- Consumes: Task 5 actions and `canRsvp`.
- Produces: `RsvpButton({ sessionId, going, count }: { sessionId: string; going: boolean; count: number })`; `SessionRow` gains optional `rsvpCount?: number` (renders "N going" under the time when > 0).

- [ ] **Step 1: Build `RsvpButton`**: not going → outline "I'm going"; going → emerald "Going" with a check and an "Undo" ghost; optimistic toggle with rollback on error; `h-11`.
- [ ] **Step 2: Wire counts**: pages call `getRsvpCounts` for scheduled sessions (and the viewer's own RSVP ids); `SessionList`, `HomeView` "Coming up", and the admin Upcoming list pass `rsvpCount`; player lists show `RsvpButton` beside "View".
- [ ] **Step 3: Session page (scheduled)**: show `RsvpButton` in the header in place of check-in, and a "Who's going (N)" list of names under it.
- [ ] **Step 4: Run** `npx tsc --noEmit -p .`, `npx vitest run --dir src`, `npx next build` → all pass.
- [ ] **Step 5: Verify visually** (same temporary-page method as Task 4), then delete the page.
- [ ] **Step 6: Commit** `feat(ui): RSVP on upcoming sessions`.

---

**After all tasks:** apply `20261020000000_session_rsvps.sql` to Supabase (the user does this), then test with real accounts: correct a ranked game and confirm ratings/wins move; mark a no-show at 0–0; RSVP and undo on an upcoming session.
