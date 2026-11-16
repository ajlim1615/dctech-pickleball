# Realistic Rating System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rank players by rating (5-game minimum), count ranked games as soon as they are recorded, replace the hard 2.0 floor with a 1.5 soft floor, speed up new players, and build it on foundations that scale (database-side counting, all-or-nothing result saving, one rules config, versioned rating history).

**Architecture:** `ratingConfig.ts` is the single source of the rules. The pure `ratingEngine.ts` and a new pure `buildLeaderboard()` hold the logic and carry the tests. The database does the heavy and atomic work: `record_match_result` saves a ranked or casual result in one transaction, `leaderboard_stats(p_since)` returns one row of totals per player, `apply_result_correction` and `admin_set_rating` take the limits as arguments. Server actions only compute ratings (via the engine) and call these functions.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, TypeScript, Tailwind 4, Supabase Postgres (plpgsql, RLS), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-rating-system-design.md` (decisions 1–10)

## Global Constraints

- All rule numbers come from `RATING_RULES` in `src/features/rankings/ratingConfig.ts`; no other file may hard-code them (SQL receives them as arguments, copy interpolates them).
- `RATING_RULES = { version: 2, start: 2.0, min: 1.5, max: 6.0, baseK: 0.1, scale: 1.0, maxMarginBonus: 0.5, newPlayerSchedule: [{ beforeGames: 5, multiplier: 2 }, { beforeGames: 15, multiplier: 1.5 }], qualifyGames: 5 }`.
- Ranked order: rating desc → win rate desc → games won desc → name asc (case-insensitive). Rank numbers are unique and consecutive (1, 2, 3, …).
- A game counts when its match is `completed` and its session is `active` or `completed` and not `[ranked:false]`.
- Every new database function: `security definer`, `set search_path = ''` (or `public` with fully qualified names), starts with `if not public.is_admin()` unless it is read-only, `revoke execute … from public, anon`, `grant execute … to authenticated`.
- Migrations are applied to prod with Supabase `apply_migration` and also committed under `supabase/migrations/`.
- Copy: sentence case, plain words, "rating" never "DUPR".
- Existing interactions keep working: search, every sort, View stats, photo viewer, admin photo removal, result correction, admin rating edits.

## Review Focus

1. **The rating write fails halfway** (network drop after the game is marked done). Expect nothing saved: the game is still in progress and can be submitted again. → Task 2, verification `record_match_result is all-or-nothing`.
2. **More than 1,000 completed games.** Expect correct totals. → Task 2, `leaderboard_stats` aggregates in SQL; Task 3 test feeds totals, never raw games.
3. **Fewer than 3 ranked players** (today: zero). Expect "Open spot" places, no unranked people on the podium. → Task 4, test `podiumSlots pads with nulls`.
4. **A 1.50 player loses again.** Stays 1.50 in the app and in a correction. → Task 1 test `stops at the hard minimum`; Task 2 verification for `apply_result_correction`.
5. **A casual game in a live session** never changes ratings, counts or rank. → Task 2 verification (`p_ranked = false` writes no history, no counts); Task 3 test `ignores games outside counted totals`.

---

### Task 1: Rules config and rating engine

**Files:**
- Create: `src/features/rankings/ratingConfig.ts`
- Modify: `src/features/rankings/utils/ratingEngine.ts`
- Modify: `src/features/rankings/ratingEngine.test.ts`
- Modify (constants only): `src/features/queue/matchmaking/types.ts` (`DEFAULT_RATING`), `src/lib/security/validation.ts` (walk-in default), `src/features/admin/components/AdminDashboard.tsx` (`handleRatingChange` clamp)

**Interfaces:**
- Produces: `RATING_RULES` (values in Global Constraints) and `type RatingRules = typeof RATING_RULES`.
- Produces from `ratingEngine.ts`: `kMultiplier(gamesPlayed: number, rules?: RatingRules): number`; `calculateRatingChanges(...)` and `correctionDeltas(...)` keep their signatures and take an optional trailing `rules: RatingRules = RATING_RULES`. Keep exporting `RATING_MIN`, `RATING_MAX`, `STARTING_RATING` as aliases of `RATING_RULES.min/max/start` for existing imports.

- [ ] **Step 1: Write failing tests**
  - `kMultiplier`: `0→2`, `4→2`, `5→1.5`, `14→1.5`, `15→1`.
  - `even game, first game: winners +0.1, losers -0.1`.
  - `stops at the hard minimum`: a 1.5 player losing an even game stays `1.5`; winners still gain `> 0`.
  - `starts at 2.0 and floors at 1.5`: `STARTING_RATING === 2`, `RATING_MIN === 1.5`.
  - `rules can be overridden`: passing `{ ...RATING_RULES, baseK: 0.2 }` doubles an even game's change.
- [ ] **Step 2: Run, expect failures**: `npx vitest run src/features/rankings/ratingEngine.test.ts`
- [ ] **Step 3: Implement** the config and read every engine constant from `rules` (remove `BASE_K`, `SCALE`, `PROVISIONAL_*`, `MAX_MARGIN_BONUS`). Point the three listed constant sites at `RATING_RULES.start` / `.min` / `.max`.
- [ ] **Step 4: Check level labels (no change expected):** `getPlayerTier` in `AdminDashboard.tsx` returns "Beginner (2.0)" for any rating `< 2.25`.
- [ ] **Step 5: Run all tests and types**: `npx vitest run`, `npx tsc --noEmit -p .`
- [ ] **Step 6: Commit**: `feat(ratings): one rules config; 1.5 soft floor and faster start`

### Task 2: Database: atomic result saving, totals, versioned history

**Files:**
- Create: `supabase/migrations/20261117000000_rating_system_v2.sql`
- Modify: `src/features/matches/api/matchActions.ts` (finalize, correction, history writes)
- Modify: `src/features/admin/api/adminActions.ts` (`adjustPlayerRating` and the set-rating action)
- Modify: `src/types/database.types.ts` (new columns and functions)

**Interfaces:**
- Produces (SQL):
  - `player_ratings_history`: `match_id` becomes nullable; add `rules_version smallint not null default 1`, `reason text not null default 'game' check (reason in ('game','correction','admin'))`.
  - `record_match_result(p_match_id uuid, p_team_a_score int, p_team_b_score int, p_winning_team public.winning_team, p_ranked boolean, p_rating_changes jsonb, p_rules_version int, p_min_rating numeric, p_max_rating numeric) returns json`. `p_rating_changes` is `[{player_id, old_rating, new_rating, change}]`. In one transaction: lock the match `for update`, return `{error}` unless `status = 'in_progress'`; set scores, winner, `completed`, `ended_at`, `recorded_by = auth.uid()`; free the court; if `p_ranked`, bump each player's `games_played` and (winners) `games_won`, set `skill_rating = least(p_max_rating, greatest(p_min_rating, new_rating))`, insert one history row per change with `reason 'game'`. Returns `{success: true}`.
  - `apply_result_correction(...)` gains `p_rules_version int, p_min_rating numeric, p_max_rating numeric`; uses them in place of the hard-coded `2.0`/`6.0`; history rows it touches get `reason 'correction'` and the version. Drop the old signature in the same migration.
  - `admin_set_rating(p_player_id uuid, p_new_rating numeric, p_rules_version int, p_min_rating numeric, p_max_rating numeric) returns json`: clamps, updates `skill_rating`, inserts history with `match_id null`, `reason 'admin'`. Refuses `admin@dctechmicro.com`.
  - `leaderboard_stats(p_since timestamptz default null) returns table(player_id uuid, games int, wins int, losses int, points_for int, points_against int)`: `security invoker`, `stable`; counts completed matches in sessions with status `active`/`completed` whose description does not contain `[ranked:false]`, optionally `ended_at >= p_since`.
- Consumes: `RATING_RULES`, `calculateRatingChanges` (Task 1).

- [ ] **Step 1: Write the migration** with the four changes above and the grants from Global Constraints. Leave `complete_match` in place but unused (dropped in a later cleanup).
- [ ] **Step 2: Apply to prod**, then verify each in a transaction that is rolled back (`begin; … rollback;`), using a scratch session and match:
  - `record_match_result is all-or-nothing`: a call with a bad `player_id` in `p_rating_changes` raises, and the match is still `in_progress` with no history rows.
  - ranked call: counts +1, ratings set, 4 history rows with `rules_version 2`, `reason 'game'`; second call returns `{error}`.
  - casual call (`p_ranked = false`): match completed, no rating, count or history change.
  - `apply_result_correction` with `p_min_rating 1.5` keeps a 1.5 player at 1.5.
  - `leaderboard_stats()` returns one row per player who has counted games; `leaderboard_stats(now())` returns none.
- [ ] **Step 3: Switch the app over**: finalize calls `record_match_result` for both ranked and casual (remove the `complete_match` call, the fallback branch and `applyRatingChanges`' direct writes); ranked/casual comes from `parseSessionMetadata(...).isRanked` (remove the `.includes("[ranked:false]")` check); correction and admin edits call the new signatures with `RATING_RULES`.
- [ ] **Step 4: Types, tests, build**: update `database.types.ts`; `npx tsc --noEmit -p .`, `npx vitest run`, `npx next build`.
- [ ] **Step 5: Commit**: `feat(ratings): atomic result saving, database totals, versioned rating history`

### Task 3: Leaderboard: rank by rating from database totals

**Files:**
- Create: `src/features/rankings/utils/leaderboard.ts`
- Create: `src/features/rankings/leaderboard.test.ts`
- Modify: `src/features/rankings/api/rankingActions.ts`

**Interfaces:**
- Produces in `leaderboard.ts`:
  - `export interface PlayerTotals { player_id: string; games: number; wins: number; losses: number; points_for: number; points_against: number }`
  - `export interface RankedPlayer extends Profile { rank: number | null; games_played: number; games_won: number; games_lost: number; win_rate: number; qualified: boolean; gamesToQualify: number }` (re-exported from `rankingActions.ts` so existing imports keep working).
  - `export function buildLeaderboard(profiles: Profile[], totals: PlayerTotals[], rules?: RatingRules): RankedPlayer[]`: ranked players first (`rank 1..n`, Global Constraints order), then new players (`rank null`) by games desc, then name.
- Produces in `rankingActions.ts`: `getLeaderboard(options?: { since?: string }): Promise<RankedPlayer[]>` that reads active profiles (excluding `admin@dctechmicro.com`) and `rpc("leaderboard_stats", { p_since })`.

- [ ] **Step 1: Write failing tests**
  - `ranks by rating, not wins`: A (2.4, 5 games, 2 wins) above B (2.2, 9 games, 7 wins).
  - `needs 5 ranked games to be ranked`: 4 games → `qualified false`, `rank null`, `gamesToQualify 1`.
  - `ties fall back to win rate, then wins, then name`.
  - `gives unique consecutive ranks even when tied`: two identical players get `1` and `2`.
  - `ignores games outside counted totals`: a profile with no totals row has `games_played 0`.
  - `computes W-L and win rate`: totals 5 games / 3 wins / 2 losses → `win_rate 60`.
- [ ] **Step 2: Run, expect failures**: `npx vitest run src/features/rankings/leaderboard.test.ts`
- [ ] **Step 3: Implement** `buildLeaderboard`, then reduce `getLeaderboard` to the two reads plus `buildLeaderboard` (delete the in-app counting loop and old sort).
- [ ] **Step 4: Consistency check (prod, read-only)**: `leaderboard_stats()` games/wins equal `profiles.games_played`/`games_won` for every player (today both are 0).
- [ ] **Step 5: Tests, types**: `npx vitest run`, `npx tsc --noEmit -p .`
- [ ] **Step 6: Commit**: `feat(rankings): rank by rating with a 5-game minimum from database totals`

### Task 4: Rankings page: split, open spots, new players

**Files:**
- Create: `src/features/rankings/components/RankingsLadder.tsx` (ranked rows and column sorting)
- Create: `src/features/rankings/components/NewPlayersList.tsx`
- Create: `src/features/rankings/components/PlayerStatsModal.tsx` (moved out of `LeaderboardTable.tsx` unchanged)
- Create: `src/features/rankings/utils/podium.ts`, `src/features/rankings/podium.test.ts`
- Modify: `src/features/rankings/components/LeaderboardTable.tsx` (becomes the container: state, search, sort, wiring)
- Modify: `src/features/rankings/components/RankingsPodium.tsx`

**Interfaces:**
- Consumes: `RankedPlayer`, `RATING_RULES.qualifyGames`.
- Produces: `podiumSlots(players: RankedPlayer[]): (RankedPlayer | null)[]`, always 3 entries: first three qualified players padded with `null`.

- [ ] **Step 1: Split first, no behaviour change**: move the stats modal and the ladder rows into the new files; `npx next build` passes and `/rankings` looks the same.
- [ ] **Step 2: Failing tests**: `podiumSlots pads with nulls` (0 qualified → three nulls; 2 qualified + 5 new → `[q1, q2, null]`), `podiumSlots skips new players`.
- [ ] **Step 3: Implement** `podiumSlots`; podium renders a `null` slot as its step with a dashed empty ring and "Open spot"; the note reads `Players need ${RATING_RULES.qualifyGames} ranked games to get ranked.` whenever a slot is empty.
- [ ] **Step 4: Ladder and new players**: default view lists ranked players with `rank > 3` ("No one is ranked yet." when empty); `NewPlayersList` (`<h2>New players</h2>`) shows each unranked player with "N more ranked games". Search and non-rank sorts show one combined list where new players show "New" in place of `#rank`; the `rank` sort puts `rank: null` last in both directions.
- [ ] **Step 5: Verify**: `npx vitest run`, `npx tsc --noEmit -p .`, `npx next build`; on localhost `/rankings` with today's data shows three open spots, the note, "No one is ranked yet." and every player under New players with "5 more ranked games".
- [ ] **Step 6: Commit**: `feat(rankings): ranked podium and ladder, new players listed apart`

### Task 5: Home card and Guide copy

**Files:**
- Modify: `src/app/page.tsx` (`topPlayers`)
- Modify: `src/features/guide/components/GuideView.tsx`

**Interfaces:**
- Consumes: `RankedPlayer.qualified`, `RATING_RULES`.

- [ ] **Step 1: Home card**: `topPlayers = leaderboard.filter((p) => p.qualified).slice(0, 3)`; when empty: `No one is ranked yet. Players need ${RATING_RULES.qualifyGames} ranked games.`
- [ ] **Step 2: Guide copy** built from `RATING_RULES` (numbers interpolated, never typed):
  - "Your rating changes after every ranked game. Beating a stronger team moves it more; losing to a weaker one costs more. Casual sessions don't count."
  - "Everyone starts at {start}. Your first {last schedule beforeGames} games move your rating faster so you reach your level quickly."
  - "You're ranked after {qualifyGames} ranked games. Rankings are ordered by rating; wins and win rate are shown too."
- [ ] **Step 3: Verify**: `npx tsc --noEmit -p .`, `npx next build`; home shows the empty message with today's data.
- [ ] **Step 4: Commit**: `copy: explain how ratings and rankings work`

### Later (separate plans, not part of this one)

- **Recalculate ratings:** replay every ranked game in `ended_at` order with the current `RATING_RULES`, writing new history rows with the new `rules_version`. Uses the data Task 2 starts recording.
- **Session settings as real columns:** move `[ranked:…]`, courts, partners and mode out of `description`; `leaderboard_stats` and `parseSessionMetadata` switch to the columns.
- **Seasons:** a "This month / All time" switch on Rankings calling `getLeaderboard({ since })`.
- **Caching:** cache Rankings and home, refreshed when `record_match_result` succeeds.
- ~~**Cleanup:** drop the unused `complete_match` function and the old 8-argument `apply_result_correction` (it still floors at 2.0).~~ Done 2026-11-17 (migration `drop_old_rating_functions`).
- **Ranked flag lock:** stop a session's ranked/casual setting (or a cancel) from changing once it has completed games, so counted games always match rated games.
