# Rating system: realistic rankings (design)

Date: 2026-11-17. Status: approved for planning.

## Problem (review of the current system)

- Ratings are Elo-style (team averages, K = 0.1, ±0.05 for an even game) and change **after every ranked game**. That part is sound and matches how DUPR-style systems work.
- But the Rankings order is by **total wins** (rating is only the 5th tie-breaker), so attendance beats skill.
- Wins, games and rank only count **finished** sessions, while ratings move live, so during a session the two disagree.
- The hard **2.0 floor** inflates ratings: in a simulation of 16 equal players over 400 coin-flip games, the average rose from 2.00 to 2.19.
- Everyone restarted at 2.0; a genuinely 3.5 player needs about 60 games to reach 3.0 with the current provisional boost (×1.5 for the first 10 games).

## Decisions

1. **Rank by rating.** Order: rating (desc), then win rate, then wins, then name. Wins, W–L and win % stay as stats.
2. **Minimum to be ranked: 5 ranked games.** Players below that are "new players", not ranked, not on the podium, listed separately with how many games they still need.
3. **Everything updates after each ranked game.** Ranked games count as soon as they are recorded, in live and finished sessions alike. Casual (`[ranked:false]`) sessions never count.
4. **Soft floor.** Everyone starts at 2.00. Ratings can fall to **1.50** (hard minimum) so wins and losses stay zero-sum near the bottom. Ceiling stays 6.00. Level names never go below "Beginner" (anything under 2.25 is Beginner).
5. **Faster start.** Rating change multiplier by games already played: **×2 for games 1–5, ×1.5 for games 6–15, ×1 after**.

## Architecture decisions (from the plan review, 2026-11-17)

6. **One source for the rules.** `ratingConfig.ts` holds `RATING_RULES` (version, start, min, max, base K, scale, margin bonus, new-player schedule, games to be ranked). App code, database calls and Guide copy read it; the database never hard-codes the floor or ceiling again (they are passed in).
7. **Count in the database.** Rankings read per-player totals from a `leaderboard_stats(p_since)` database function (one row per player), not every game ever played. This avoids the 1,000-row API limit and makes seasons (`p_since`) a filter, not a rebuild. Ranked sessions are still identified by the `[ranked:false]` description tag until session settings get their own columns.
8. **Saving a result is all-or-nothing.** A single `record_match_result` database function marks the game done, frees the court, updates games/wins counts, sets the new ratings and writes rating history in one transaction. It replaces the separate `complete_match` + app-side writes and the fallback path that skipped the counts.
9. **Ratings can be recalculated later.** Every rating-history row records `rules_version` and a `reason` (`game`, `correction`, `admin`); admin rating edits are logged (with no game). A full "recalculate from history" tool is a later task, but its data starts being recorded now.
10. **Unique rank numbers.** Ranked players get 1, 2, 3, … even when tied; ties are ordered by the rule in decision 1.

## Out of scope

Separate singles/doubles ratings, reliability scores, rating decay for inactivity, the recalculate tool itself, moving session settings out of the description into real columns, caching the Rankings page.
