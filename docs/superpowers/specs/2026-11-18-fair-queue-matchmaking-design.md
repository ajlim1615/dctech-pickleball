# Fair Queue Matchmaking, Live Wait Timers, and Match Durations — Design

Date: 2026-11-18

## Why

In multi-court open play (such as the 2-hour `Balhai CrossCourt` session), players who arrive at the same time can still finish 1–2 games apart because `Balanced` and other rotation styles only pick from the top 6 longest-waiting players without considering how many games each player has already completed. Players who happen to land in shorter 6-minute games rotate faster than peers who played 13–14 minute games.

At the same time, neither the Queue list nor the admin court pickers show how many games each waiting player has played in the session or a live ticking wait timer, and Match History views don't display how long each finished game lasted even though `started_at` and `ended_at` are already stored.

## Goals

1. **Fairer game counts for rotation styles:** Gently prioritize players who have played fewer games relative to how long they have been at the session, without letting latecomers leapfrog on-time players or starving anyone in line.
2. **Transparent queue & picker metadata:** Show each waiting player's session games played (`3 games`) and live ticking wait time (`MM:SS` / `H:MM:SS`) on the Queue list and inside admin pickers (`PlayerPickerSheet`, `ChoosePlayersSheet`).
3. **Plain-English player explanation:** Explain right in the Queue UI (and `/guide`) *how* and *why* matching works — why `#1` always plays, why wait time and games played are shown, and how late arrivals stay fair.
4. **Completed match durations in Match History:** Display how long each completed game lasted (`12m 34s`) across all four Match History views.
5. **Zero database migrations:** Derive everything from existing columns (`queue_entries.joined_at`, `session_checkins.checkin_time`, `matches.started_at`, `matches.ended_at`, and `match_players`).

## Non-goals

- Changing strict non-rotation styles (`fifo`, `winners_stay`, `winners_losers`, `king_queen`).
- Reordering the visual Queue list away from longest-waiting (`joined_at`) order.
- Counting abandoned/unfinished games toward session games played.
- Adding new Realtime subscriptions for `matches` on passive session tabs (server matchmaking always queries live `matches`; UI `gamesPlayed` follows the existing `history` / SSR revalidation model used by Standings and Match Logs).
- Changes to the offline tablet app (`tablet/`).

## Anti-goals (a failure even if it "works")

- A late arrival with `0` games jumps ahead of on-time players just to "catch up" to total session games.
- An admin re-adding a player (which overwrites `session_checkins.checkin_time`) corrupts fairness math (`playShare > 1`).
- The longest-waiting player (`#1` in line) gets repeatedly skipped and starved.
- A paired couple (`pairId`) gets split by matchmaking.
- A 1-second timer causes React hydration warnings, ESLint `set-state-in-effect` errors, or full-board re-renders every second.
- Queue rows overflow or crowd out player names on `375 px` phones.

---

## Design

### 1. Matchmaking Fairness (`src/features/queue/matchmaking/`)

#### Data shape (`types.ts`)
Add optional, backwards-compatible fields to `LineEntry`:
- `arrivedAt?: string | null` — when the player checked into the session (`session_checkins.checkin_time`, falling back to `queue_entries.joined_at`).

Keep `WINDOW_SIZE = 6` as the default for non-rotation styles, and add `ROTATION_WINDOW_SIZE = 8` for rotation styles:
- **Rotation styles (use fairness + 8-player window):** `balanced`, `social_mixer`, `mixed_doubles`, `club_wars`, `skill_separated`, `skill_courts`.
- **Unchanged styles (6-player window, no fairness term):** `fifo`, `winners_stay`, `winners_losers`, `king_queen`.

#### Arrival-fair play deficit (`history.ts`)
Add two pure helpers:
1. `gamesPlayedCounts(history: PastGame[]): Map<string, number>` — counts completed games per player from `history` (abandoned games are already excluded by `pastGamesFromMatches`).
2. `gamesAheadByPlayer(window: LineEntry[], history: PastGame[]): Map<string, number>`:
   - For each player `p` in `window`:
     - `played = counts.get(p.playerId) ?? 0`.
     - `earliestGameEnd` = earliest `endedAt` among games in `history` containing `p.playerId` (if any).
     - `effectiveArrivedAt` = earliest timestamp between `p.arrivedAt` and `earliestGameEnd` (if `p.arrivedAt` is missing, treat as present from session start). This recovers true arrival time even when `session_checkins.checkin_time` was overwritten by a later re-check-in.
     - `eligibleRaw` = count of games in `history` with `endedAt >= effectiveArrivedAt` (or `history.length` when `effectiveArrivedAt` is missing).
     - `eligible = Math.max(eligibleRaw, played)` so `playShare` is strictly bounded to `[0, 1]`.
     - If `eligible === 0`, the player is neutral (excluded from `avgShare`, gets `gamesAhead = 0`).
   - `avgShare` = arithmetic mean of `played / eligible` across window members with `eligible > 0` (or `0` if none).
   - For each player with `eligible > 0`:
     `gamesAhead = clamp(played - avgShare * eligible, -1.5, +1.5)`.

Why `gamesAhead` instead of raw `playShare`:
- Remains in units of **whole games** from minute 15 through minute 120 (doesn't shrink as total session games grows).
- Brand-new/late arrivals with `eligible === 0` score `0` (neutral, never jump ahead).
- Players who took a long voluntary break are capped at `-1.5` so they get at most a gentle nudge, never leapfrogging everyone.

#### Strategy cost integration (`balanced.ts`, `socialMix.ts`, `skillSeparated.ts`, `index.ts`)
- `StrategyCtx` gains `gamesAhead: Map<string, number>` (populated in `buildCtx`).
- Export `FAIRNESS_WEIGHT = 1.2` in `balanced.ts`.
- Helper `fairnessCost(four: LineEntry[], gamesAhead: Map<string, number>): number`: sum of `gamesAhead.get(p.playerId) ?? 0` over the 4 players in the candidate foursome.
- `balancedCost` (used by `balanced`, `skill_separated`, `skill_courts`):
  `10·ratingGap + 3·partnerRepeats + 1·opponentRepeats + 0.5·skips + 1.2·fairnessCost`
- `socialMix` (used by `social_mixer`, `mixed_doubles`, `club_wars`):
  `3·partnerRepeats + 1·opponentRepeats + 0.5·skips + 1.2·fairnessCost`
- **Starvation guarantee:** `enumerateOptions(ctx.window, true)` keeps `window[0]` (the longest-waiting player) required in every foursome (and in `skillSeparated`, still preferred first before falling back to `requireFirst = false`).
- **Pairs:** `enumerateOptions` already enforces pair integrity; both partners' `gamesAhead` values contribute to the foursome's cost.
- **Calibration check:** Being `1.0` game behind an on-time peer saves `1.2` cost — outweighing 2 queue skips (`1.0`) when ratings are similar, while still yielding to a `0.3` rating gap (`3.0`) or a partner repeat (`3.0`).

---

### 2. Data Flow (Zero Migrations)

#### Arrival times (`arrivedAt`)
- Add `loadSessionArrivals(supabase, sessionId): Promise<Map<string, string>>` in `src/features/queue/api/matchmakingData.ts` (`SELECT player_id, checkin_time FROM session_checkins WHERE session_id = ?`).
- Wire `arrivedAt: arrivals.get(playerId) ?? entry.joined_at` into `LineEntry` at all three `decide()` / `buildAutoCards()` call sites:
  1. `src/features/queue/api/upNextActions.ts` (`refreshUpNext`) — fetched in its existing `Promise.all`.
  2. `src/features/queue/api/queueActions.ts` (`callNextUp`) — fetched once before `withLineRetry`.
  3. `src/features/sessions/components/SessionDetailView.tsx` → `SessionQueueLiveBoard.tsx` — derived from `activeCheckins` (already loaded by `getSessionById`), keeping client preview deterministic with the server.

#### Session games played (`gamesPlayed`)
- Derive `gamesPlayed: Record<string, number>` once in `SessionDetailView` from `sessionHistory` using `gamesPlayedCounts(history)`.
- Pass `gamesPlayed` down to:
  - `SessionQueueLiveBoard` (Queue rows)
  - `UpNextPanel` → `PlayerPickerSheet`
  - `CourtMatrix` → `CourtCard` → `PlayerPickerSheet` & `ChoosePlayersSheet`
- Keep `gamesPlayed?: Record<string, number>` optional on pickers (default `{}`) so existing callers need no changes.

#### Shared duration & live wait-time utilities
Create two small, focused utilities:
1. **`src/lib/duration.ts`** (pure, unit-tested):
   - `formatClockDuration(startIso: string, nowMs: number): string` — live wait format: `MM:SS` under 1 hour (`00:42`, `06:15`), `H:MM:SS` at 1 hour+ (`1:05:12`); clamps negative clock skew to `00:00`.
   - `formatMatchDuration(startedAt?: string | null, endedAt?: string | null): string | null` — completed match duration: `45s` under 1 min, `12m 34s` under 1 hr (`6m` when seconds are 0), `1h 5m` at 1 hr+ (`1h` when minutes are 0); returns `null` if either timestamp is missing, invalid, or `endedAt <= startedAt`.
2. **`src/components/ui/wait-timer.tsx`** (client leaf component):
   - Uses one module-level shared 1-second clock via `useSyncExternalStore` (`getServerSnapshot = () => null`).
   - Starts the single `setInterval(1000)` when the first `<WaitTimer>` mounts and stops it when the last unmounts.
   - Renders `<span className="font-mono tabular-nums">{formatClockDuration(since, now)}</span>` (or `null` before client hydration) — zero hydration mismatch, zero `set-state-in-effect` lint violations, and zero parent board re-renders per second.

---

### 3. UI Display

#### Queue list (`SessionQueueLiveBoard.tsx`)
- Update `PlayerLine` (used by both `QueueRow` and `TeamBlock`) to show a compact 2-line left column (`min-w-0 flex-1`):
  - **Line 1:** player name (`truncate`) + optional `You` pill.
  - **Line 2 (subline, `text-xs text-slate-500 dark:text-slate-400`):**
    - Session games played: `{n} {n === 1 ? "game" : "games"}` (shown when session is active or `n > 0`).
    - Live wait timer: `· <WaitTimer since={joinedAt} />` — shown **only** when `isSessionActive` is true and `joinedAt` is present (never on `scheduled` / `completed` sessions or `on_break` pills).
- Right side keeps rating (`formatRating(...)`, `shrink-0`) and the `44×44` remove button, keeping row height `>= 44 px` (`min-h-11 py-1.5`) and giving names `~200 px` even on `375 px` phones.

#### Admin pickers (`PlayerPickerSheet.tsx`, `ChoosePlayersSheet.tsx`)
- **`PlayerPickerSheet`:**
  - Accepts optional `gamesPlayed?: Record<string, number>` and `showWait?: boolean` (default `true`).
  - Subtitle shows rating, session games played, live wait timer (when `showWait` is true), and `paired`: e.g. `2.1 · 3 games · waiting 06:15 · paired`.
  - In `CourtCard.tsx`'s **`Switch teams`** picker (which wraps on-court players with synthetic `joined_at`), pass `showWait={false}` so it never displays a fake `00:00` wait timer.
- **`ChoosePlayersSheet`:**
  - Accepts optional `gamesPlayed?: Record<string, number>`.
  - Candidate rows show player name on top (`truncate font-semibold`) and a compact muted subline underneath (`3 games · 06:15` + `· paired` when paired), keeping `min-h-11` and clean truncation on `375 px` phones.

#### Player-facing "How matching works" explainer (`SessionQueueLiveBoard.tsx`, `WaitCard.tsx`, `guideData.ts`)
- **Queue board (`SessionQueueLiveBoard.tsx`):** Add a compact collapsible `"How matching works"` disclosure button (`min-h-11`, `aria-expanded`) in the Queue section header so players don't see permanent clutter, but anyone curious can tap once to read a plain-English 3-bullet summary tailored to the session's active matching style:
  - *Rotation styles (`Balanced`, `Social Mixer`, `Skill Separated`, `Skill Courts`, `Mixed Doubles`, `Club Wars`):*
    1. **#1 in line always plays next** — waiting longest guarantees your spot.
    2. **Fair game pace:** Among the top 8 waiting, players who have played fewer games since arriving get a gentle nudge so faster vs. slower games stay even.
    3. **Late arrivals stay fair:** Joining later starts neutral (it won't jump you ahead of players who arrived earlier), while ratings and fresh partners are still balanced.
  - *Non-rotation styles (`FIFO`, `King/Queen`, `Winners Stay`, `Winners/Losers`):* concise 1–2 sentence explanation of that style's exact rule (no fair-pace boost).
- **"Why the wait?" (`WaitCard.tsx`):** Add a 1-line note showing the viewer's own session game count (`You've played X games this session`) alongside their wait estimate (and bump its `h-9` toggle button to `min-h-11`).
- **Player Guide (`/guide`, `src/features/guide/data/guideData.ts`):** Update the matching-style descriptions and FAQ entry so `/guide` explains wait timers, fair game pace from arrival, and why game counts can still differ for late arrivals or breaks.

#### Match History duration (all 4 views)
All four views already receive `started_at` and `ended_at` from Supabase (`getSessionMatches`, `getMatchesList`, and `playerActions.ts`):
1. **Session Match Logs** (`src/features/sessions/components/SessionLeaderboard.tsx`): show `formatMatchDuration(match.started_at, match.ended_at)` beside the finish time (`· 12m 34s`).
2. **Results page** (`src/features/matches/components/MatchHistoryList.tsx`): populate the existing `MatchItem.duration` field using `formatMatchDuration(m.started_at, m.ended_at)` and render it beside `m.date` in the card metadata row (`• 12m 34s`).
3. **Player Profile Match History** (`src/features/players/components/ProfileView.tsx`): show duration beside the match date/time in the match history list.
4. **Rankings Player Stats modal** (`src/features/rankings/components/PlayerStatsModal.tsx`): show duration beside the match date/time in Recent Match History.

When `formatMatchDuration` returns `null` (legacy or incomplete timestamps), omit the duration separator cleanly.

---

## Testing Strategy

1. **`src/lib/duration.test.ts`:**
   - `formatClockDuration`: `<1 min` (`00:42`), minutes (`06:15`), `>=1 hr` (`1:05:12`), negative/future skew clamped to `00:00`.
   - `formatMatchDuration`: seconds only (`45s`), minutes+seconds (`12m 34s`), exact minutes (`6m`), hours (`1h 5m`, `1h`), missing/invalid/reversed timestamps → `null`.
2. **`src/features/queue/matchmaking/history.test.ts`:**
   - `gamesPlayedCounts`: counts completed games across teams; empty history → empty map.
   - `gamesAheadByPlayer`: equal arrival times with 1-game and 2-game gaps; late arrival with 0 eligible games → `0` (neutral); late arrival after eligible games → fair relative rate; overwritten `checkin_time` recovered via `earliest(checkin_time, earliestGameEnd)`; extreme deficit/surplus clamped to `[-1.5, +1.5]`.
3. **`src/features/queue/matchmaking/decide.test.ts` & `winnersSkill.test.ts`:**
   - Rotation styles (`balanced`, `social_mixer`, `skill_separated`, `skill_courts`, `mixed_doubles`, `club_wars`) inspect up to 8 waiting players and gently pull an under-played peer ahead of a more-played peer when ratings are equal, while still guaranteeing `window[0]` plays and respecting pairs and large rating gaps.
   - Non-rotation styles (`fifo`, `winners_stay`, `winners_losers`, `king_queen`) remain completely unchanged.
   - 2-court / 16-player / 20-game session simulation (modeled on Balhai CrossCourt with fast vs. slow games and late arrivals) verifying tighter game-count spread among on-time players without letting latecomers jump ahead.
4. **Full suite + typecheck + lint + responsive browser check:**
   - `npx vitest run`, `npx tsc --noEmit`, `npx eslint` on all touched files.
   - Visual verification at `375×812` and `1280×800` confirming live ticking `MM:SS` timers, `games` sublines, no mobile crowding/overflow, and match duration display in Match History.
