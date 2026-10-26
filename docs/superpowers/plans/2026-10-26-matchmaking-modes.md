# Matchmaking Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Balanced, Social Mix, Winners / Losers, King/Queen and Skill Separated pick players and teams the way their descriptions say, on the web console and the tablet app.

**Architecture:** A new pure module `src/features/queue/matchmaking/` exposes `decide(input) → Decision`. Each mode is a strategy that scores options built from a six-person line window, using this session's game history. The web (`callNextUp`, live board preview) and the tablet engine (`suggestGame`) build the input from their own storage and call `decide`. The old `matchingEngine.ts` and `podSelection.ts` are removed.

**Tech Stack:** TypeScript, Next.js server actions + Supabase (web), Vite + React + Dexie (tablet), Vitest (root config runs both).

**Spec:** `docs/superpowers/specs/2026-10-26-matchmaking-modes-design.md`

## Global Constraints

- Window: first person in line is always called; the other three come from the next five (six people). Exceptions only for King/Queen placed pairs and Skill Separated when no valid group includes #1.
- Locked pairs (`pairId`) are called together and play on the same team.
- Missing rating = `3.0`. Default `skillSpread` = `0.75`.
- Balanced `cost = 10·ratingGap + 3·partnerRepeats + 1·opponentRepeats + 0.5·skips`, ties → line order.
- Social Mix `cost = 3·partnerRepeats + 1·opponentRepeats + 0.5·skips`, ties → `random`.
- Winners / Losers `cost = 10·mixedResults + Balanced cost`; `new` matches either result.
- History is this session's finished games only.
- Legacy `fifo` and `winners_stay` keep today's behaviour; old sessions, descriptions without new tags, and old tablet backups must still load.
- Tests assert behaviour through examples, not exact cost numbers.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **First-in-line's partner is beyond the window** (e.g. #1 paired with #9): the window must extend to include that partner, or #1 can never be called and every court stalls. Test in Task 2.
2. **Games with no winner** (abandoned, `tie`, or tablet game finished without a result): they count for repeat partners/opponents, but never for last result or King/Queen promotion. Tests in Tasks 1 and 4.
3. **A court that is now closed / in maintenance** appears in history: its winners are not promoted anywhere, and promotion targets are recomputed over open courts only. Test in Task 4.
4. **Up next preview disagrees with the real call**: the preview must use the same history, courts, settings and first free court as `callNextUp`. Test in Task 7 (`previewCourtId`).
5. **Sessions created before this change** (no `[skill_spread]` tag, no tablet `skillSpread`): they default to 0.75 and load without errors. Tests in Tasks 6 and 8.

---

## File Structure

```
src/features/queue/matchmaking/
  types.ts          MatchingStyle, LineEntry, PastGame, MatchmakingInput, Teams, Decision, constants
  history.ts        pair counts, last results, King/Queen staying/promoted pairs
  scoring.ts        window, option enumeration, cost ingredients, pickCheapest, teamStats, seededRandom
  strategies/
    balanced.ts  socialMix.ts  fifo.ts  winnersLosers.ts  skillSeparated.ts  kingQueen.ts  winnersStay.ts
  index.ts          decide(), re-exports
  *.test.ts         one per file above (strategies tested in strategies.test.ts files per task)
src/features/queue/api/matchmakingData.ts   pastGamesFromMatches(), loadSessionHistory(), loadOpenCourtIds()
```

Removed at the end: `src/features/queue/utils/matchingEngine.ts`, `src/features/queue/utils/podSelection.ts`, `src/features/queue/matchingEngine.test.ts`, `src/features/queue/podSelection.test.ts`, `src/features/queue/matchupPreview.test.ts`.

---

### Task 1: Types, history and scoring helpers

**Files:**
- Create: `src/features/queue/matchmaking/types.ts`, `history.ts`, `scoring.ts`
- Test: `src/features/queue/matchmaking/history.test.ts`, `scoring.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type MatchingStyle = "balanced" | "social_mixer" | "skill_separated" | "winners_losers" | "skill_courts"
    | "mixed_doubles" | "king_queen" | "club_wars" | "fifo" | "winners_stay";
  export interface LineEntry { playerId: string; rating: number | null; pairId?: string | null }
  export interface PastGame { courtId: string; teamA: string[]; teamB: string[]; winner: "A" | "B" | null; endedAt: string }
  export interface MatchmakingInput {
    style: MatchingStyle; line: LineEntry[]; history: PastGame[]; court: string; courts: string[];
    settings: { skillSpread: number }; random: () => number; force?: boolean;
  }
  export interface Teams { teamA: [string, string]; teamB: [string, string] }
  export type Decision = Teams | { hold: "not_enough_players"; needed: number } | { hold: "no_skill_match" };
  export const DEFAULT_RATING = 3.0;
  export const DEFAULT_SKILL_SPREAD = 0.75;
  export const WINDOW_SIZE = 6;
  ```
- Produces (`history.ts`):
  - `pairKey(a: string, b: string): string` — order-independent key.
  - `pairCounts(history: PastGame[]): { partners: Map<string, number>; opponents: Map<string, number> }` — all games, winner or not.
  - `lastResults(history: PastGame[]): Map<string, "won" | "lost">` — from each player's latest (by `endedAt`) game that has a winner; players with none are absent (= new).
- Produces (`scoring.ts`):
  - `buildWindow(line: LineEntry[]): LineEntry[]` — first `WINDOW_SIZE`, plus #1's pair partner appended if it sits further down. A window member whose partner is in `line` but not in the window is dropped. A `pairId` whose partner isn't in `line` at all is treated as solo.
  - `interface Option { four: LineEntry[]; teams: Teams; skips: number }`
  - `enumerateOptions(window: LineEntry[], requireFirst: boolean): Option[]` — every 4-set (containing `window[0]` when `requireFirst`) × its three splits, dropping sets with half a pair and splits with a pair on opposite teams. `skips` = sum of chosen window indices − 6 (indices 0..3 sum to 6). Split order: `[0,1|2,3]`, `[0,2|1,3]`, `[0,3|1,2]` over the 4-set in window order.
  - `ratingOf(e: LineEntry): number`
  - `ratingGap(teams: Teams, ratings: Map<string, number>): number`
  - `repeatCounts(teams: Teams, counts: ReturnType<typeof pairCounts>): { partnerRepeats: number; opponentRepeats: number }`
  - `pickCheapest(options: Option[], cost: (o: Option) => number, tieBreak: "line" | (() => number)): Option | null` — `"line"` keeps the earliest option among equal cost (enumeration order is line order); a function picks uniformly among the cheapest. Costs equal when within `1e-9`.
  - `teamStats(teams: { teamA: string[]; teamB: string[] }, ratingOf: (id: string) => number): { teamARatingAvg: number; teamBRatingAvg: number; ratingDelta: number; balanceScorePercent: number }` — same rounding and `max(10, min(100, round(100 − delta·40)))` formula as today's `createMatchupFromPod`.
  - `seededRandom(seed: string): () => number` — moved verbatim from `matchingEngine.ts`.

- [ ] **Step 1: Write failing tests**

`history.test.ts`:
```ts
const g = (teamA: string[], teamB: string[], winner: "A" | "B" | null, endedAt: string, courtId = "c1"): PastGame =>
  ({ courtId, teamA, teamB, winner, endedAt });

it("counts partners and opponents across all games, including games without a winner", () => {
  const c = pairCounts([g(["a", "b"], ["c", "d"], "A", "1"), g(["a", "b"], ["c", "e"], null, "2")]);
  expect(c.partners.get(pairKey("b", "a"))).toBe(2);
  expect(c.opponents.get(pairKey("a", "c"))).toBe(2);
  expect(c.opponents.get(pairKey("a", "e"))).toBe(1);
  expect(c.partners.get(pairKey("a", "c"))).toBeUndefined();
});

it("last result comes from the latest game with a winner", () => {
  const r = lastResults([g(["a", "b"], ["c", "d"], "A", "1"), g(["a", "c"], ["e", "f"], "B", "2"), g(["a", "x"], ["y", "z"], null, "3")]);
  expect(r.get("a")).toBe("lost");
  expect(r.get("b")).toBe("won");
  expect(r.get("x")).toBeUndefined();
});
```

`scoring.test.ts`:
```ts
const e = (id: string, rating: number | null = 3, pairId?: string): LineEntry => ({ playerId: id, rating, pairId });

it("window is six, extended to first-in-line's partner", () => {
  const line = [e("p1", 3, "g"), ...["2", "3", "4", "5", "6", "7", "8"].map((i) => e(i)), e("p9", 3, "g")];
  expect(buildWindow(line).map((x) => x.playerId)).toEqual(["p1", "2", "3", "4", "5", "6", "p9"]);
});

it("drops a window member whose partner waits outside the window", () => {
  const line = [e("1"), e("2"), e("3"), e("4", 3, "g"), e("5"), e("6"), e("7"), e("8", 3, "g")];
  expect(buildWindow(line).map((x) => x.playerId)).toEqual(["1", "2", "3", "5", "6"]);
});

it("treats a pair as solo when the partner is not in line", () => {
  expect(buildWindow([e("1", 3, "g"), e("2"), e("3"), e("4")]).map((x) => x.playerId)).toEqual(["1", "2", "3", "4"]);
});

it("enumerates 10 sets x 3 splits from six with #1 required, and never splits a pair", () => {
  expect(enumerateOptions(["1", "2", "3", "4", "5", "6"].map((i) => e(i)), true)).toHaveLength(30);
  const paired = enumerateOptions([e("1"), e("2", 3, "g"), e("3", 3, "g"), e("4"), e("5")], true);
  for (const o of paired) {
    const ids = o.four.map((x) => x.playerId);
    expect(ids.includes("2")).toBe(ids.includes("3"));
    if (ids.includes("2")) expect(o.teams.teamA.includes("2")).toBe(o.teams.teamA.includes("3"));
  }
});

it("skips is 0 for the first four and grows with depth", () => {
  const opts = enumerateOptions(["1", "2", "3", "4", "5", "6"].map((i) => e(i)), true);
  expect(Math.min(...opts.map((o) => o.skips))).toBe(0);
  expect(Math.max(...opts.map((o) => o.skips))).toBe(6); // indices 0,3,4,5
});

it("teamStats matches the old balance formula", () => {
  const r = new Map([["a", 4], ["b", 3], ["c", 3], ["d", 3]]);
  expect(teamStats({ teamA: ["a", "b"], teamB: ["c", "d"] }, (id) => r.get(id)!)).toEqual(
    { teamARatingAvg: 3.5, teamBRatingAvg: 3, ratingDelta: 0.5, balanceScorePercent: 80 });
});

it("missing rating counts as 3.0", () => expect(ratingOf(e("x", null))).toBe(3));
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/queue/matchmaking`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `types.ts`, `history.ts`, `scoring.ts`** with the signatures above.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/queue/matchmaking`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/queue/matchmaking
git commit -m "feat(queue): matchmaking history and scoring helpers"
```

---

### Task 2: `decide` with Balanced, Social Mix and fifo

**Files:**
- Create: `src/features/queue/matchmaking/index.ts`, `strategies/balanced.ts`, `strategies/socialMix.ts`, `strategies/fifo.ts`
- Test: `src/features/queue/matchmaking/decide.test.ts`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces:
  - `decide(input: MatchmakingInput): Decision` in `index.ts`; re-exports Task 1 types, `seededRandom`, `teamStats`, `DEFAULT_SKILL_SPREAD`.
  - `type Strategy = (input: MatchmakingInput, ctx: StrategyCtx) => Decision` where `StrategyCtx = { window: LineEntry[]; counts: ReturnType<typeof pairCounts>; ratings: Map<string, number> }`, built once in `decide` from `input.line` (King/Queen builds its own window in Task 4).
  - `balancedCost(o: Option, ctx: StrategyCtx): number` exported from `strategies/balanced.ts` (reused by Tasks 3–4).
- `decide` rules: `force` → run `balanced`. Fewer than 4 players in the window → `{ hold: "not_enough_players", needed: 4 − window.length }`. Dispatch: `balanced`, `social_mixer`, `fifo`; `mixed_doubles` and `club_wars` → `social_mixer`. Unmapped styles temporarily → `balanced` (Tasks 3–4 fill them in).
- `fifo`: cheapest by `skips` (tie → line order), which with split order gives #1+#2 vs #3+#4.

- [ ] **Step 1: Write failing tests** (`decide.test.ts`; helper `input(style, line, history = [])` with `court: "c1"`, `courts: ["c1"]`, `skillSpread: 0.75`, `random: seededRandom("t")`):

```ts
it("holds with fewer than four waiting", () =>
  expect(decide(input("balanced", ids(3)))).toEqual({ hold: "not_enough_players", needed: 1 }));

it("balanced pairs strongest+weakest vs middle with no history", () => {
  const line = [e("a", 4.5), e("b", 4), e("c", 3.5), e("d", 3), e("x", 3), e("y", 3)];
  expect(sorted(decide(input("balanced", line)))).toEqual(sorted({ teamA: ["a", "d"], teamB: ["b", "c"] }));
});

it("balanced reaches #5 to split up last game's partners", () => {
  const line = ["1", "2", "3", "4", "5", "6"].map((i) => e(i, 3));
  const h = [game(["1", "2"], ["3", "4"]), game(["1", "3"], ["2", "4"]), game(["1", "4"], ["2", "3"])];
  const d = decide(input("balanced", line, h)) as Teams;
  expect([...d.teamA, ...d.teamB]).toContain("5");
  expect([...d.teamA, ...d.teamB]).toContain("1");
});

it("balanced won't pull in much stronger players to avoid repeats", () => {
  const line = [e("1", 3), e("2", 3), e("3", 3), e("4", 3), e("5", 5), e("6", 5)];
  const d = decide(input("balanced", line, [game(["1", "2"], ["3", "4"])])) as Teams;
  expect([...d.teamA, ...d.teamB].sort()).toEqual(["1", "2", "3", "4"]);
});

it("social mix ignores ratings and avoids repeat partners", () => {
  const line = [e("1", 5), e("2", 2), e("3", 5), e("4", 2)];
  const d = decide(input("social_mixer", line, [game(["1", "2"], ["3", "4"])])) as Teams;
  expect(d.teamA.includes("1") && d.teamA.includes("2")).toBe(false);
  expect(d.teamB.includes("1") && d.teamB.includes("2")).toBe(false);
});

it("first in line is always called", () => {
  for (const style of ["balanced", "social_mixer", "fifo"] as const) {
    const d = decide(input(style, ids(6), [game(["p1", "p2"], ["p3", "p4"])])) as Teams;
    expect([...d.teamA, ...d.teamB]).toContain("p1");
  }
});

it("never looks past six", () => {
  const line = [...ids(6).map((x) => ({ ...x, rating: 3 })), e("p7", 3)];
  const h = Array.from({ length: 5 }, () => game(["p1", "p2"], ["p3", "p4"]));
  const d = decide(input("balanced", line, h)) as Teams;
  expect([...d.teamA, ...d.teamB]).not.toContain("p7");
});

it("a locked pair plays together", () => {
  const line = [e("1"), e("2", 3, "g"), e("3"), e("4", 3, "g"), e("5"), e("6")];
  for (const style of ["balanced", "social_mixer", "fifo"] as const) {
    const d = decide(input(style, line)) as Teams;
    const team = d.teamA.includes("2") ? d.teamA : d.teamB;
    if ([...d.teamA, ...d.teamB].includes("2")) expect(team).toContain("4");
  }
});

it("fifo is #1+#2 vs #3+#4", () =>
  expect(decide(input("fifo", ids(6)))).toEqual({ teamA: ["p1", "p2"], teamB: ["p3", "p4"] }));

it("force uses balanced", () => {
  const line = [e("a", 4.5), e("b", 4), e("c", 3.5), e("d", 3)];
  expect(sorted(decide({ ...input("fifo", line), force: true }))).toEqual(sorted({ teamA: ["a", "d"], teamB: ["b", "c"] }));
});
```
(`sorted` normalises team and member order; `ids(n)` makes `p1..pn` at rating 3; `game(a, b, winner = "A", courtId = "c1")` with increasing `endedAt`.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/queue/matchmaking/decide.test.ts`
Expected: FAIL, `decide` not found.

- [ ] **Step 3: Implement `index.ts` and the three strategies** with the constraint formulas.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/queue/matchmaking`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/queue/matchmaking
git commit -m "feat(queue): decide() with repeat-aware Balanced and Social Mix"
```

---

### Task 3: Winners / Losers and Skill Separated

**Files:**
- Create: `strategies/winnersLosers.ts`, `strategies/skillSeparated.ts`
- Modify: `src/features/queue/matchmaking/index.ts` (dispatch `winners_losers`, `skill_separated`, `skill_courts` → skill separated)
- Test: `src/features/queue/matchmaking/winnersSkill.test.ts`

**Interfaces:**
- Consumes: `decide`, `balancedCost`, `enumerateOptions`, `lastResults`, `pickCheapest`.
- Winners / Losers: `mixedResults(four)` = 4 − max over `r ∈ {won, lost}` of (players whose last result is `r` or who are new). Cost `10·mixedResults + balancedCost`, tie → line.
- Skill Separated: valid when `max − min` of the four ratings `≤ settings.skillSpread + 1e-9`. Try `enumerateOptions(window, true)` valid options, then `enumerateOptions(window, false)` valid options; cost `balancedCost`; none → `{ hold: "no_skill_match" }`.

- [ ] **Step 1: Write failing tests**

```ts
it("winners/losers reaches down the line for a fourth winner", () => {
  // w1,w2,w3 won; l1 lost; w4 won and is #5
  const h = [game(["w1", "w2"], ["l1", "lx"], "A"), game(["w3", "w4"], ["ly", "lz"], "A")];
  const line = [e("w1"), e("w2"), e("w3"), e("l1"), e("w4"), e("n1")];
  const d = decide(input("winners_losers", line, h)) as Teams;
  expect([...d.teamA, ...d.teamB].sort()).toEqual(["w1", "w2", "w3", "w4"]);
});

it("winners/losers splits a winning team that stays together in the four", () => {
  const h = [game(["w1", "w2"], ["l1", "l2"], "A"), game(["w3", "w4"], ["l3", "l4"], "A")];
  const d = decide(input("winners_losers", [e("w1"), e("w2"), e("w3"), e("w4")], h)) as Teams;
  expect(d.teamA.includes("w1") && d.teamA.includes("w2")).toBe(false);
  expect(d.teamB.includes("w1") && d.teamB.includes("w2")).toBe(false);
});

it("winners/losers lets newcomers fill either side", () => {
  const h = [game(["w1", "w2"], ["l1", "l2"], "A")];
  const d = decide(input("winners_losers", [e("w1"), e("w2"), e("n1"), e("n2"), e("l1")], h)) as Teams;
  expect([...d.teamA, ...d.teamB].sort()).toEqual(["n1", "n2", "w1", "w2"]);
});

it("winners/losers never places players who are not in line (web bug)", () => {
  const h = [game(["gone1", "gone2"], ["x", "y"], "A")];
  const d = decide(input("winners_losers", ids(4), h)) as Teams;
  expect([...d.teamA, ...d.teamB].sort()).toEqual(["p1", "p2", "p3", "p4"]);
});

it("skill separated keeps the four within the spread", () => {
  const line = [e("1", 3), e("2", 4.5), e("3", 3.5), e("4", 3.25), e("5", 3), e("6", 5)];
  const d = decide(input("skill_separated", line)) as Teams;
  expect([...d.teamA, ...d.teamB].sort()).toEqual(["1", "3", "4", "5"]);
});

it("skill separated lets others play when #1 has no match", () => {
  const line = [e("out", 2), e("2", 4), e("3", 4), e("4", 4.5), e("5", 4.25)];
  const d = decide(input("skill_separated", line)) as Teams;
  expect([...d.teamA, ...d.teamB]).not.toContain("out");
});

it("skill separated holds when no group fits, and force overrides", () => {
  const line = [e("1", 2), e("2", 3), e("3", 4), e("4", 5)];
  expect(decide(input("skill_separated", line))).toEqual({ hold: "no_skill_match" });
  expect("teamA" in decide({ ...input("skill_separated", line), force: true })).toBe(true);
});

it("skill courts behaves like skill separated for now", () =>
  expect(decide(input("skill_courts", [e("1", 2), e("2", 3), e("3", 4), e("4", 5)]))).toEqual({ hold: "no_skill_match" }));
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/queue/matchmaking/winnersSkill.test.ts`
Expected: FAIL (styles still dispatch to balanced).

- [ ] **Step 3: Implement both strategies and the dispatch.**

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/queue/matchmaking`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/queue/matchmaking
git commit -m "feat(queue): Winners/Losers grouping and Skill Separated holds"
```

---

### Task 4: King/Queen and legacy Winners Stay

**Files:**
- Modify: `src/features/queue/matchmaking/history.ts`, `index.ts`
- Create: `strategies/kingQueen.ts`, `strategies/winnersStay.ts`
- Test: `src/features/queue/matchmaking/kingQueen.test.ts`

**Interfaces:**
- Produces (`history.ts`):
  ```ts
  /** For each open court: the pair placed on it before the line is used. */
  export function kingQueenPlacements(history: PastGame[], line: LineEntry[], courts: string[]):
    Map<string, { staying?: [string, string]; promoted?: [string, string] }>;
  ```
  For each court in `courts` at rank `i`: its latest game (by `endedAt`) with a non-null winner. The winning pair qualifies if both are in `line` and neither appears in any game with a later `endedAt`. Rank 0 → `staying` on `courts[0]`; rank `i > 0` → `promoted` on `courts[i − 1]`. Courts not in `courts` contribute nothing.
- `kingQueen` strategy (in `decide`, before the shared window):
  1. Remove every placed player (all courts) from `line`, then `buildWindow`.
  2. Placed sides for `input.court`: Court 1 → `staying` vs `promoted`; other courts → `promoted` only.
  3. Two placed sides → `{ teamA: staying, teamB: promoted }`.
  4. One placed side `P` → opponent = `window[0]` + best partner from `window[1..5]` by `balancedCost` of `{ teamA: P, teamB: [first, partner] }`. Respect `pairId` (if `window[0]` has a partner in the window, that partner is the only candidate). Window < 2 → `{ hold: "not_enough_players", needed: 2 − window.length }`.
  5. No placed side → Balanced on the window.
- `winnersStay` strategy (legacy, today's behaviour): the court's latest game with a winner; if both winners are in `line`, they stay, and the two challengers are the first two of the line without them. The stronger winner gets the weaker challenger (equal → first winner gets the second challenger). Otherwise `fifo` with a Balanced split, i.e. the first four (by `skips`) split as strongest + weakest vs middle two, ignoring history.

- [ ] **Step 1: Write failing tests** (`courts: ["c1", "c2", "c3"]` unless stated):

```ts
const kq = (line: LineEntry[], history: PastGame[]) => ({ ...input("king_queen", line, history), courts: ["c1", "c2", "c3"] });

it("Court 2 winners are reserved for Court 1 and skipped by other courts", () => {
  const h = [game(["a", "b"], ["x", "y"], "A", "c2")];
  const line = [e("a"), e("b"), ...ids(6)];
  const c1 = decide({ ...kq(line, h), court: "c1" }) as Teams;
  expect(c1.teamA).toEqual(["a", "b"]);
  const c3 = decide({ ...kq(line, h), court: "c3" }) as Teams;
  expect([...c3.teamA, ...c3.teamB]).not.toContain("a");
});

it("Court 1 champions stay and face the promoted pair", () => {
  const h = [game(["k1", "k2"], ["x", "y"], "A", "c1"), game(["a", "b"], ["z", "w"], "A", "c2")];
  expect(decide({ ...kq([e("a"), e("b"), e("k1"), e("k2"), ...ids(2)], h), court: "c1" }))
    .toEqual({ teamA: ["k1", "k2"], teamB: ["a", "b"] });
});

it("a pair that has played since is no longer promoted", () => {
  const h = [game(["a", "b"], ["x", "y"], "A", "c2"), game(["a", "q"], ["r", "s"], "B", "c3")];
  const d = decide({ ...kq([e("b"), ...ids(5), e("a")], h), court: "c1" }) as Teams;
  expect(d.teamA).not.toEqual(["a", "b"]);
});

it("promotion cancels when a partner is not in line (on break)", () => {
  const h = [game(["a", "b"], ["x", "y"], "A", "c2")];
  const d = decide({ ...kq([e("a"), ...ids(5)], h), court: "c1" }) as Teams;
  expect([...d.teamA, ...d.teamB]).toContain("a");
  expect(d.teamA).not.toEqual(["a", "b"]);
});

it("a closed court promotes nobody, and targets shift", () => {
  const h = [game(["a", "b"], ["x", "y"], "A", "c3")];
  const line = [e("a"), e("b"), ...ids(6)];
  expect((decide({ ...kq(line, h), courts: ["c1", "c3"], court: "c1" }) as Teams).teamA).toEqual(["a", "b"]);
  expect((decide({ ...kq(line, h), courts: ["c1", "c2"], court: "c1" }) as Teams).teamA).not.toEqual(["a", "b"]);
});

it("a game without a winner promotes nobody", () => {
  const h = [game(["a", "b"], ["x", "y"], null, "c2")];
  expect((decide({ ...kq([e("a"), e("b"), ...ids(4)], h), court: "c1" }) as Teams).teamA).not.toEqual(["a", "b"]);
});

it("winners_stay keeps the court's winners and splits them", () => {
  const h = [game(["A", "B"], ["x", "y"], "A", "c1")];
  const d = decide(input("winners_stay", [e("c1p", 3), e("c2p", 4), e("A", 4), e("B", 3.5)], h)) as Teams;
  const winners = new Set(["A", "B"]);
  expect(d.teamA.filter((id) => winners.has(id))).toHaveLength(1);
  expect(d.teamB.filter((id) => winners.has(id))).toHaveLength(1);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/queue/matchmaking/kingQueen.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `kingQueenPlacements`, both strategies, and dispatch `king_queen` / `winners_stay`.** After this, every `MatchingStyle` has an explicit dispatch and the temporary Balanced fallback is removed (make the dispatch an exhaustive `switch`).

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/queue/matchmaking`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/queue/matchmaking
git commit -m "feat(queue): King/Queen court promotion and legacy Winners Stay"
```

---

### Task 5: Web call-up uses `decide`, with Call anyway

**Files:**
- Create: `src/features/queue/api/matchmakingData.ts`
- Modify: `src/features/queue/api/queueActions.ts:508-637` (`callNextUp`), `src/features/courts/components/CourtCard.tsx:195-210`
- Test: `src/features/queue/api/matchmakingData.test.ts`

**Interfaces:**
- Produces (`matchmakingData.ts`, no `"use server"`):
  ```ts
  export interface MatchRowForHistory {
    court_id: string; status: string; winning_team: "team_a" | "team_b" | "tie" | null; ended_at: string | null;
    players?: { team: "team_a" | "team_b"; player_id?: string; player?: { id: string } | null }[] | null;
  }
  export function pastGamesFromMatches(rows: MatchRowForHistory[]): PastGame[]; // completed + ended_at only, sorted by ended_at; tie/null → winner null
  export async function loadSessionHistory(supabase: SupabaseClient, sessionId: string): Promise<PastGame[]>;
  export async function loadOpenCourtIds(supabase: SupabaseClient): Promise<string[]>; // status <> 'maintenance', order sort_order
  export function holdMessage(d: Exclude<Decision, Teams>, skillSpread: number): string;
  ```
  `holdMessage`: `not_enough_players` → `` `Need ${needed} more waiting player${needed === 1 ? "" : "s"} to start a game.` ``; `no_skill_match` → `` `No group of four within ${skillSpread} rating of each other yet.` ``.
- Produces: `callNextUp(sessionId: string, courtId: string, count = 4, options: { force?: boolean } = {})` returning, on hold, `{ error: string; hold: "not_enough_players" | "no_skill_match" }`. Success shape unchanged.
- Consumes: `parseSessionMetadata(description).skillSpread` from Task 6. Until Task 6 lands, read `DEFAULT_SKILL_SPREAD`. Task 6 switches it.

- [ ] **Step 1: Write failing tests** for the pure parts:

```ts
it("keeps completed games only, maps teams and winners, sorts by end time", () => {
  const rows = [
    { court_id: "c1", status: "completed", winning_team: "team_b", ended_at: "2",
      players: [{ team: "team_a", player_id: "a" }, { team: "team_a", player_id: "b" }, { team: "team_b", player_id: "c" }, { team: "team_b", player_id: "d" }] },
    { court_id: "c2", status: "abandoned", winning_team: null, ended_at: "3", players: [] },
    { court_id: "c1", status: "completed", winning_team: "tie", ended_at: "1",
      players: [{ team: "team_a", player: { id: "a" } }, { team: "team_b", player: { id: "c" } }] },
  ];
  expect(pastGamesFromMatches(rows)).toEqual([
    { courtId: "c1", teamA: ["a"], teamB: ["c"], winner: null, endedAt: "1" },
    { courtId: "c1", teamA: ["a", "b"], teamB: ["c", "d"], winner: "B", endedAt: "2" },
  ]);
});

it("hold messages", () => {
  expect(holdMessage({ hold: "not_enough_players", needed: 1 }, 0.75)).toBe("Need 1 more waiting player to start a game.");
  expect(holdMessage({ hold: "no_skill_match" }, 0.75)).toBe("No group of four within 0.75 rating of each other yet.");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/queue/api/matchmakingData.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `matchmakingData.ts`, then rewrite `callNextUp` steps 1–4.**
  - Delete the last-match query and `previousWinners`.
  - Load `history`, open courts, and the waiting entries (keep the existing query; drop the profile columns not needed beyond `id, skill_rating`).
  - Map entries to `LineEntry { playerId: player_id, rating: player.skill_rating, pairId: group_id }`.
  - Call `decide` with `random: Math.random` and `force: options.force`. On hold, return `{ error: holdMessage(...), hold }`.
  - Mark `playing` exactly the waiting entries whose `player_id` is in the decided teams, and pass `teamA`/`teamB` to the existing match-insert code.
  - Remove the `selectPod`/`buildTeams` imports.

- [ ] **Step 4: Add Call anyway to `CourtCard.tsx`.** Store `res.hold` in state next to `errorMessage`. When it is `"no_skill_match"`, render a secondary button **Call anyway** under the message that runs `callNextUp(sessionId, court.id, 4, { force: true })` with the same success/error handling. Clear the hold state on any new call.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/features/queue && npx tsc --noEmit`
Expected: tests PASS; typecheck shows no errors in `queueActions.ts`, `matchmakingData.ts` or `CourtCard.tsx`. Errors elsewhere from old-module imports are expected until Task 9.

- [ ] **Step 6: Commit**

```bash
git add src/features/queue/api src/features/courts/components/CourtCard.tsx
git commit -m "feat(queue): web call-up uses session history; Call anyway for skill holds"
```

---

### Task 6: Skill spread session setting (web)

**Files:**
- Modify: `src/lib/utils.ts:19-73`, `src/lib/utils.test.ts`, `src/features/admin/api/adminActions.ts:355-382`, `src/features/sessions/api/sessionActions.ts:185-203`, `src/features/admin/components/AdminDashboard.tsx` (create form ~line 919, edit form ~1340-1412), `src/features/queue/api/queueActions.ts` (callNextUp reads it)

**Interfaces:**
- Produces (`utils.ts`):
  - `parseSkillSpread(raw: string | null | undefined): number`. Parse a float and clamp to `[0.25, 2]`, rounded to 2 decimals. Invalid or missing → `DEFAULT_SKILL_SPREAD`.
  - `parseSessionMetadata(...)` gains `skillSpread: number` from `[skill_spread:x]`.
  - `cleanSessionDescription` also strips `[skill_spread:…]`.
- Both create and update actions read `formData.get("skillSpread")`. They append ` [skill_spread:${parseSkillSpread(raw)}]` to `tags` only when `matchingStyle` is `skill_separated` or `skill_courts`.

- [ ] **Step 1: Write failing tests** in `src/lib/utils.test.ts`:

```ts
it("parses skill spread with default and clamp", () => {
  expect(parseSessionMetadata("[matching_mode:skill_separated] [skill_spread:1.25]").skillSpread).toBe(1.25);
  expect(parseSessionMetadata("[matching_mode:balanced]").skillSpread).toBe(0.75);
  expect(parseSkillSpread("9")).toBe(2);
  expect(parseSkillSpread("abc")).toBe(0.75);
});
it("strips the skill spread tag", () =>
  expect(cleanSessionDescription("Fun night [skill_spread:0.5]")).toBe("Fun night"));
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the parsing, and the tag writing in both actions.** In `callNextUp`, use `parseSessionMetadata(sessionData?.description).skillSpread` and `.matchingMode` instead of the inline regex.

- [ ] **Step 4: Add the input to both admin forms.** When the selected mode is `skill_separated` or `skill_courts`, show a number input labelled **Max rating spread** (`name="skillSpread"`, step 0.25, min 0.25, max 2, default 0.75 on create, the session's parsed value on edit). Below it, the helper text "Players more than this apart in rating won't share a court." On the edit form, replace the inline tag-stripping `defaultValue` at ~line 1412 with `cleanSessionDescription(isEditingSession.description)`.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/lib src/features/queue`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib src/features/admin src/features/sessions/api src/features/queue/api
git commit -m "feat(sessions): per-session max rating spread for Skill Separated"
```

---

### Task 7: Web Up next preview uses the same decision

**Files:**
- Modify: `src/features/queue/api/matchmakingData.ts` (add `previewCourtId`), `src/features/sessions/components/SessionQueueLiveBoard.tsx:16-117,365-400`, `src/features/sessions/components/SessionDetailView.tsx:1152`, `src/features/home/components/HomeView.tsx:110`, `src/app/(app)/sessions/[id]/page.tsx`, `src/app/page.tsx`
- Test: `src/features/queue/api/matchmakingData.test.ts`

**Interfaces:**
- Produces: `previewCourtId(courts: { id: string; status: string; sort_order: number; current_match_id: string | null }[]): { court: string; courts: string[] } | null`. `courts` is the non-maintenance courts by `sort_order`. `court` is the first one with no `current_match_id`, else the first open court. `null` when there are no open courts.
- `SessionQueueLiveBoard` gains props `history?: PastGame[]` and `skillSpread?: number`.
- The session page passes `pastGamesFromMatches(matches)` (it already loads `getSessionMatches`). The home page loads `getSessionMatches(activeSession.id)` alongside the queue and passes it through `HomeView`. Both pass `meta.skillSpread`.

- [ ] **Step 1: Write failing test**

```ts
it("previews the first free open court", () => {
  const courts = [
    { id: "c2", status: "available", sort_order: 2, current_match_id: null },
    { id: "c1", status: "occupied", sort_order: 1, current_match_id: "m" },
    { id: "c0", status: "maintenance", sort_order: 0, current_match_id: null },
  ];
  expect(previewCourtId(courts)).toEqual({ court: "c2", courts: ["c1", "c2"] });
  expect(previewCourtId([courts[2]])).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/queue/api/matchmakingData.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `previewCourtId` and rewire the preview.**
  - In the live board, replace `previewMatchupFromPod` with `decide`, passing:
    - `line` from `queue` (already excludes `on_break`) in order
    - `history`, plus `previewCourtId(courts)`
    - `settings: { skillSpread }`
    - `random: seededRandom(queue.map((q) => q.id).join("|"))`
  - When the decision has teams, `nextMatchup` = profiles looked up from `queue` by id, plus `teamStats(...)`. `removeFor` looks entries up in `queue` instead of `nextPod`.
  - On a hold, or with no open court, fall back to the existing first-four list. For `no_skill_match`, add the line "Waiting for a skill match" above it.
  - Keep `SHUFFLED_STYLES` and the "Preview ·" label.

- [ ] **Step 4: Verify**

Run: `npx vitest run src/features && npx tsc --noEmit`
Expected: tests PASS; no type errors in the touched files.

- [ ] **Step 5: Commit**

```bash
git add src/features src/app
git commit -m "feat(queue): Up next preview matches the real call-up"
```

---

### Task 8: Tablet engine and screens

**Files:**
- Modify: `tablet/src/engine/types.ts`, `tablet/src/engine/game.ts:1-120,215-235`, `tablet/src/engine/fixtures.ts`, `tablet/src/io/backup.ts:16-39`, `tablet/src/lib/courtStatus.ts`, `tablet/src/components/CourtCard.tsx`, `tablet/src/screens/LiveBoard.tsx:90-110,185-215,270-275`, `tablet/src/screens/NewSession.tsx`, `tablet/src/lib/ctx.ts`, `tablet/src/shared-imports.test.ts`
- Test: `tablet/src/engine/game.test.ts`, `tablet/src/io/backup.test.ts`, `tablet/src/lib/courtStatus.test.ts`

**Interfaces:**
- Consumes: `decide`, `seededRandom`, `MatchingStyle`, `DEFAULT_SKILL_SPREAD` from `@/features/queue/matchmaking`.
- Produces:
  - `DeskSession.skillSpread?: number`; backup schema `skillSpread: z.number().optional()`.
  - `export type Suggestion = Teams | { waitingFor: number } | { hold: "no_skill_match" }` in `game.ts`.
  - `suggestGame(state, courtId, random?, force = false): Suggestion`. Input built from:
    - `state.games` with `endedAt`, mapped to `PastGame`
    - `waitingLine(state)` mapped to `{ playerId, rating: players[id].skill, pairId: null }`
    - open courts in session order
    - `skillSpread ?? DEFAULT_SKILL_SPREAD`
    - `random ?? Math.random`

    A `not_enough_players` hold becomes `{ waitingFor: needed }`.
  - `suggestAll(state, random?, forced: ReadonlySet<string> = new Set()): Record<string, Suggestion>`.
  - `refillCourts`: `if (!("teamA" in suggestion)) break;`.
  - `courtPill(..., suggestion: Suggestion | undefined, ...)`: hold → `{ label: "Waiting for a skill match", tone: "warn" }`.
  - Tablet `CourtCard` prop `onStartAnyway?: () => void`. When there are no teams and it's set, render **Start anyway** in place of the disabled "Waiting for players" button.

- [ ] **Step 1: Write failing tests**

`game.test.ts` (existing helpers `makeState`, `makeCtx`, `checkIn`, `ok`, `ids`; add `withSkills`):
```ts
const withSkills = (s: SessionState, skills: number[]): SessionState => ({
  ...s,
  players: Object.fromEntries(Object.values(s.players).map((p, i) => [p.id, { ...p, skill: skills[i] ?? p.skill }])),
});
const oneCourt = { courts: [{ id: "c1", name: "Court 1", closed: false }] };

it("suggestGame uses session history to avoid repeat partners", () => {
  const ctx = makeCtx();
  let s = checkIn(withSkills(makeState(4, { matchingStyle: "social_mixer", ...oneCourt }), [3, 3, 3, 3]), ids(4), ctx);
  s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
  s = ok(finishGame(s, activeGameOnCourt(s, "c1")!.id, { scoreA: 11, scoreB: 5 }, ctx));
  const next = activeGameOnCourt(s, "c1")!; // finishGame refills the court
  const team = next.teamA.includes("p1") ? next.teamA : next.teamB;
  expect(team).not.toContain("p2");
});

it("skill separated suggestion holds and force overrides", () => {
  const s = checkIn(withSkills(makeState(4, { matchingStyle: "skill_separated", ...oneCourt }), [2, 3, 4, 5]), ids(4), makeCtx());
  expect(suggestGame(s, "c1")).toEqual({ hold: "no_skill_match" });
  expect("teamA" in suggestGame(s, "c1", undefined, true)).toBe(true);
});

it("refillCourts leaves a held court empty", () => {
  const s = checkIn(withSkills(makeState(4, { matchingStyle: "skill_separated", ...oneCourt }), [2, 3, 4, 5]), ids(4), makeCtx());
  expect(activeGameOnCourt(refillCourts(s, makeCtx()), "c1")).toBeUndefined();
});
```
In the existing `suggestAll gives each free court different players` test, change the guard to `if (!("teamA" in c1) || !("teamA" in c2))` so it typechecks against `Suggestion`.
`backup.test.ts`: a backup whose session has no `skillSpread` still imports; one with `skillSpread: 1` round-trips.
`courtStatus.test.ts`: `courtPill(openCourt, undefined, { hold: "no_skill_match" }, 0)` → `{ label: "Waiting for a skill match", tone: "warn" }`.

The existing `winners_losers splits the last winners…` test (around `game.test.ts:104`) must keep passing unchanged. With only those four waiting, the repeat-partner cost now splits p1 and p4.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tablet/src`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement the engine changes** (`types.ts`, `game.ts`, `backup.ts`, `courtStatus.ts`, `fixtures.ts`, import paths in `ctx.ts`, `LiveBoard.tsx`, `shared-imports.test.ts` → import `decide`).

- [ ] **Step 4: Wire the screens.**
  - **LiveBoard:**
    - Keep `forced` as a `useState<Set<string>>` and pass it to `suggestAll`.
    - `onStartAnyway` adds the court id. `start(courtId)` removes it.
    - Replace the `"waitingFor" in` checks at ~105 and ~272 with `!("teamA" in …)`.
  - **NewSession:** when the style is `skill_separated` or `skill_courts`, show a "Max rating spread" chip row (`0.5`, `0.75`, `1.0`, `1.5`, default `0.75`) and save it as `skillSpread`.

- [ ] **Step 5: Verify**

Run: `npx vitest run tablet/src && npm --prefix tablet run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add tablet/src
git commit -m "feat(tablet): matchmaking via decide(); skill holds with Start anyway"
```

---

### Task 9: Copy, removal of old modules, full verification

**Files:**
- Modify: `src/features/admin/components/AdminDashboard.tsx` (picker ~922-1130, edit select ~1396-1403, reference cards ~2081-2165, Step 3 ~2180), `src/features/guide/components/GuideView.tsx` (~200-260), `tablet/src/lib/ctx.ts:26-37`, `src/lib/utils.ts`, `src/lib/security/validation.ts` (import paths only)
- Delete: `src/features/queue/utils/matchingEngine.ts`, `src/features/queue/utils/podSelection.ts`, `src/features/queue/matchingEngine.test.ts`, `src/features/queue/podSelection.test.ts`, `src/features/queue/matchupPreview.test.ts`

**Copy (exact strings):**

| Mode | Web picker description | Tablet hint |
|---|---|---|
| Balanced | Balances teams by rating. Avoids repeat partners and opponents when possible. | Even teams by rating, avoiding repeat partners and opponents. |
| Social Mix | Avoids repeat partners and opponents. Doesn't use ratings. | Avoids repeat partners and opponents. Ignores ratings. |
| Skill Separated | Keeps similar skill levels together. May leave a court waiting. | Similar ratings share a court. May hold a court. |
| Winners / Losers | Winners play winners. Losers play losers. | Winners play winners, losers play losers. |
| King/Queen of the Court | Winners move up a court. Losers rejoin the line. | Winners move up a court; losers rejoin the line. |
| Skill Courts | Works like Skill Separated for now. Courts by skill level coming soon. | Like skill separated for now. |
| Mixed Doubles | Shuffled teams for now. One man and one woman per team coming soon. | Shuffled teams for now. |
| Club Wars | Shuffled teams for now. Group vs group coming soon. | Shuffled teams for now. |

The dashboard reference cards and `GuideView` get one or two sentences per mode saying the same thing at more length. For example, Balanced: "Picks four from near the front of the line and splits them into the most even teams, preferring people who haven't partnered or played each other yet this session." Step 3 becomes: "The engine applies your session's mode: *Balanced* weighs even teams against repeats, *Social Mix* avoids repeats, and *Skill Separated* keeps the four within the session's rating spread." `fifo` and `winners_stay` tablet hints are unchanged.

- [ ] **Step 1: Apply the copy.**

- [ ] **Step 2: Repoint remaining imports and delete the old modules.** `grep -rn "queue/utils/matchingEngine\|queue/utils/podSelection" src tablet/src` must return nothing. Delete the five files listed above. Move any still-relevant case from the deleted tests into the Task 2–4 tests first, e.g. the seeded-preview determinism case → `scoring.test.ts`: `seededRandom("x")()` equals itself across two calls.

- [ ] **Step 3: Full verification**

Run: `npm test && npx tsc --noEmit && npm --prefix tablet run typecheck && npm run lint`
Expected: all tests pass, no type errors, no new lint errors.

- [ ] **Step 4: Check it in the browser.** Start the web dev server with `preview_start`. On a session's create form, check that:
  - each mode shows the new description
  - the spread input appears only for Skill Separated and Skill Courts
  - the Up next preview renders

  Take a screenshot as proof.

- [ ] **Step 5: Commit**

```bash
git add -A src tablet/src
git commit -m "chore(queue): truthful mode descriptions; remove old matching engine"
```
