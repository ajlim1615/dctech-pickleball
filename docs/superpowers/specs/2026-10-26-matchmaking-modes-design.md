# Matchmaking modes that do what they say

Date: 2026-10-26
Status: Design approved in chat, awaiting spec review

## Why

The session create screen describes eight matchmaking modes. Only Balanced's rating split is real. The rest
promise behaviour the engine doesn't have: nothing avoids repeat partners or opponents, Winners / Losers
splits winners up instead of grouping them, King/Queen never moves anyone between courts, and Skill
Separated never holds a court. Web matchmaking also has a bug: in Winners / Losers (and King/Queen when the
last winners aren't both waiting) the last game's winners are put on court even when they aren't among the
called players, or in the queue at all, and two called players are dropped.

The club mainly runs Balanced and Social Mix, but every mode should do what its description says.

## Scope

This spec covers the five modes that need only rules, no new data:

- Balanced
- Social Mix
- Winners / Losers
- King/Queen of the Court
- Skill Separated

It also fixes the Winners / Losers bug and makes all visible copy truthful.

Out of scope, each a later project with its own spec: **Mixed Doubles** (needs a gender per player),
**Club Wars** (needs a side per player per session), **Skill Courts** (needs rating ranges per court).
Until then they keep today's behaviour and their web copy says so plainly.

The legacy styles `fifo` and `winners_stay` stay supported so saved sessions and tablet backups keep working.

## Shared rules (all modes)

- **Line window:** the first person in line is always called. The other three come from the next five in
  line, so the search window is six people. With fewer than four waiting the court holds with
  `not_enough_players`. Exceptions: King/Queen promoted and staying pairs (they're placed first), and
  Skill Separated when no valid group includes the first in line.
- **Locked pairs:** players queued together (`group_id` / `pairId`) are called together and play on the
  same team. Options that separate a pair or put it on opposite teams are discarded.
- **Options:** an option is a choice of four from the window plus one of the three ways to split them into
  two teams (at most 10 × 3 = 30). Each mode scores options; the lowest cost wins.
- **History** is this session's finished games only.

## Module

New folder `src/features/queue/matchmaking/`, imported by the web app and by the tablet (through the
existing `@/` alias).

```ts
interface LineEntry { playerId: string; rating: number; pairId?: string | null }
interface PastGame  { courtId: string; teamA: string[]; teamB: string[]; winner: "A" | "B" | null; endedAt: string }

interface MatchmakingInput {
  style: MatchingStyle;
  line: LineEntry[];        // waiting players, queue order
  history: PastGame[];      // this session's finished games
  court: string;            // court being filled
  courts: string[];         // open courts in court order, Court 1 first
  settings: { skillSpread: number };
  random: () => number;     // seeded for previews, Math.random for real calls
  force?: boolean;          // Skill Separated override: decide with Balanced rules
}

type Decision =
  | { teamA: [string, string]; teamB: [string, string] }
  | { hold: "not_enough_players"; needed: number }
  | { hold: "no_skill_match" };
```

Files:

- `index.ts`: `decide(input): Decision`. Applies the shared rules and dispatches to the strategy.
- `strategies/<mode>.ts`: one per mode, including `fifo` and `winners_stay`.
- `history.ts`: partner counts, opponent counts, each player's last result, King/Queen promoted and staying
  pairs.
- `scoring.ts`: option enumeration, the cost ingredients, and the weight constants.

`matchingEngine.ts` (`createMatchupFromPod`, `previewMatchupFromPod`) and `podSelection.ts` (`selectPod`,
`buildTeams`) are removed once all callers use `decide`. `seededRandom` and the `MatchingStyle` type move to
the new module.

## Cost ingredients

| Ingredient | Meaning |
|---|---|
| `partnerRepeats` | For both teams, times these two have already partnered this session |
| `opponentRepeats` | For each of the four cross-team pairs, times they've already faced each other |
| `ratingGap` | Absolute gap between the teams' average ratings (missing rating = 3.0) |
| `skips` | Sum of the chosen line positions minus the sum for the first four (calling #1–#4 = 0) |

Weights are named constants in `scoring.ts`. Tests assert behaviour through examples, not exact costs.

## Modes

### Balanced

`cost = 10·ratingGap + 3·partnerRepeats + 1·opponentRepeats + 0.5·skips`

A 0.3 rating gap weighs about the same as one repeat partner. If two options cost the same, the one closer
to line order wins, so results are deterministic. Never holds except for `not_enough_players`.

### Social Mix

`cost = 3·partnerRepeats + 1·opponentRepeats + 0.5·skips`

Ratings are ignored. Ties are broken with `random`, so the first game is a random split of the first four.
Never holds except for `not_enough_players`.

### Winners / Losers

Each waiting player has a last result: `won`, `lost` or `new` (no finished game this session).

`cost = 10·mixedResults + Balanced cost`

`mixedResults` is how many of the four don't share the group's majority result, where `new` counts as
matching either. The queue looks down the window for four players with the same result. If none exist, it
takes the cheapest mix. Never holds except for `not_enough_players`. Candidates only ever come from the
line, which fixes the web bug.

### King/Queen of the Court

Open courts are ranked by `courts` order.

- **Staying pair (Court 1 only):** Court 1's last winning team, if both are waiting and neither has
  played since.
- **Promoted pair:** the last winning team on court *k* (*k* > 1), if both are waiting and neither has
  played since. It is reserved for the open court ranked just above *k*.
- A court's next game:
  - **Court 1:** staying pair vs the pair promoted from Court 2. A missing side is filled from the line.
  - **Middle court:** the pair promoted from below vs two from the line.
  - **Bottom court:** four from the line, split by Balanced cost.
- A team filled from the line includes the first available person in line and the best partner from the
  next five, by Balanced cost against the opposing pair.
- Winning partners stay together as they climb. Losers return to the back of the line as today.
- Other courts skip reserved players. A promoted pair whose target court is busy waits for it; admins can
  still start any game by hand.
- A promotion is cancelled if either player goes on break or leaves. The other becomes an ordinary waiting
  player.
- Ranks are computed over open courts, so closing a court shifts promotion targets.

### Skill Separated

Session setting `skillSpread`, default 0.75. An option is valid when max − min rating of the four is within
the spread.

1. The cheapest valid option (Balanced cost) that includes the first person in line.
2. Otherwise, the cheapest valid option from the rest of the window. The first person stays at the front
   and is called as soon as a match appears.
3. Otherwise `{ hold: "no_skill_match" }`.

With `force: true` the decision uses Balanced rules instead.

### Legacy

- `fifo`: first four in line, #1 + #2 vs #3 + #4.
- `winners_stay`: today's behaviour. The court's last winners, if both waiting, stay and are split across
  teams with the next two in line.

### Interim (until their own projects)

`skill_courts` behaves like Skill Separated. `mixed_doubles` and `club_wars` behave like Social Mix.

## Web wiring

- `callNextUp` (`src/features/queue/api/queueActions.ts`):
  - Replace the last-match-on-this-court query with one query for all of this session's completed
    matches (court, winner, players by team). That becomes `history`.
  - Read open courts ordered by `sort_order` and the `[skill_spread:x]` tag.
  - Call `decide`. A hold returns an error message: "Waiting for N more players" or "No group within
    0.75 rating of each other yet."
  - New optional `force` argument passed through to `decide`.
- The admin console shows a **Call anyway** button next to the `no_skill_match` message, which calls
  `callNextUp` with `force`.
- `SessionQueueLiveBoard` preview calls `decide` with the same history and courts and a seeded `random`
  (seed: waiting entry ids), so the preview matches the real call.
- Session create/edit (`AdminDashboard.tsx`, `adminActions.ts`, `sessionActions.ts`): when Skill Separated
  is selected, a "Max rating spread" input (default 0.75) is saved as `[skill_spread:x]`. The tag-stripping
  and tag-parsing helpers in `src/lib/utils.ts` handle the new tag.

## Tablet wiring

- `suggestGame` / `suggestAll` (`tablet/src/engine/game.ts`) build the input from `state.games`,
  `waitingLine` and the open courts in order, then call `decide`. `suggestAll` already marks players taken
  by earlier courts; King/Queen reservations come from history.
- Results: `{ waitingFor }` as today, plus `{ hold: "no_skill_match" }`. The free-court card shows "Waiting
  for a skill match" with a **Start anyway** button that suggests with `force`.
- `DeskSession.skillSpread?: number` (default 0.75), optional in the backup schema (`tablet/src/io/backup.ts`)
  so old backups still load. New Session shows a spread selector when Skill Separated is chosen.

## Copy

Rewrite to match the rules above:

- The web create-session picker and edit select (`AdminDashboard.tsx`).
- The dashboard's mode reference cards and "how the engine works" steps (`AdminDashboard.tsx`, from the
  Balanced card around line 2081 through Step 3 around line 2180).
- The player-facing mode guide (`src/features/guide/components/GuideView.tsx`, from around line 200).
- Tablet `MATCHING_STYLES` hints (`tablet/src/lib/ctx.ts`).

Skill Courts, Mixed Doubles and Club Wars descriptions say what they do for now, for example "Shuffled
teams for now. Gender pairing coming soon."

## Testing (Vitest)

- Per strategy, example-based:
  - Balanced/Social Mix: last game's partners are split up when #5 is available; Balanced won't accept
    a lopsided swap to avoid a repeat.
  - Winners / Losers: three winners plus a winner from further down beats three winners plus a loser;
    newcomers fill either side.
  - King/Queen: Court 2 winners are reserved for Court 1; Court 1 champions stay and face the promoted
    pair; promotion cancels when one partner goes on break; closing a court shifts the target.
  - Skill Separated: an outlier at the front lets others play; holds only when no group fits; `force`
    returns a Balanced decision.
- Shared rules: locked pair plays together; first in line always called; window never exceeds six.
- Regression: winners who aren't in the line are never placed on court.
- Tablet engine tests move from `selectPod` to `decide`; existing `fifo` / `winners_stay` tests keep passing.
- `matchingEngine.test.ts` and `podSelection.test.ts` are retired with their modules; still-relevant cases
  move to the new strategy tests.
