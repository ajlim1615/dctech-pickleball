# Fair Queue Matchmaking, Live Wait Timers, Player Explainer & Match Durations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rotation-style matchmaking gently balance session games played since each player arrived, display session game counts and live ticking `MM:SS` / `H:MM:SS` wait timers in the Queue and admin pickers, add a plain-English "How matching works" explainer for players, and show completed match durations across all four Match History views — with zero database migrations.

**Architecture:** Extend the pure matchmaking engine (`src/features/queue/matchmaking/`) with arrival-fair `gamesAhead` deficit scoring (`FAIRNESS_WEIGHT = 1.2`) and an 8-player rotation window (`ROTATION_WINDOW_SIZE = 8`) while leaving non-rotation styles untouched (`WINDOW_SIZE = 6`). Add pure duration formatters (`src/lib/duration.ts`) and a module-level `useSyncExternalStore` 1-second `<WaitTimer />` leaf component (`src/components/ui/wait-timer.tsx`) so ticking timers never re-render parent boards or trigger hydration/ESLint issues. Wire existing Supabase columns (`session_checkins.checkin_time`, `queue_entries.joined_at`, `matches.started_at`, `matches.ended_at`) into all three matchmaking call sites, the Queue board, admin pickers, and all four Match History views.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + Realtime), Vitest (`npx vitest run`), Lucide icons.

**Spec:** `docs/superpowers/specs/2026-11-18-fair-queue-matchmaking-design.md`

**Global Constraints:**
- Zero database migrations — derive everything from existing tables/columns (`queue_entries.joined_at`, `session_checkins.checkin_time`, `matches.started_at`, `matches.ended_at`, `match_players`).
- Do NOT alter non-rotation matching styles (`fifo`, `winners_stay`, `winners_losers`, `king_queen`).
- Do NOT reorder the visual Queue list away from longest-waiting (`joined_at`) order.
- Do NOT touch `tablet/` or add new Realtime subscriptions for `matches`.
- All new/modified files must pass `npx tsc --noEmit` and `npx eslint` with 0 errors (specifically zero `react-hooks/set-state-in-effect` violations).
- All interactive controls must maintain `>= 44 px` touch targets (`min-h-11`) and avoid horizontal overflow on `375 px` mobile viewports.
- Never modify real Supabase sessions or player data during verification; any local browser check must use `"ZZ Test ..."` casual sessions/guests and clean them up afterwards.

**Review Focus:**
- **Overwritten `checkin_time` on re-add (Task 2):** A player who played 4 games from `20:02`–`21:28` and got re-added at `21:43` has `checkin_time > earliestGameEnd`; `gamesAheadByPlayer` must recover `effectiveArrivedAt = earliest(checkin_time, earliestGameEnd)` via numeric epoch parsing (`Date.parse`) and clamp `eligible = Math.max(eligibleRaw, played)` so `playShare` never exceeds `1` and ISO format variants (`Z` vs `+00:00` vs fractional seconds) compare accurately.
- **Latecomer neutrality & voluntary-break cap (Tasks 2 & 3):** A late arrival with `0` eligible games must score `gamesAhead = 0` (excluded from `avgShare`) and never jump ahead of on-time peers; a player returning from a long break must be clamped to `[-1.5, +1.5]` so fairness nudges gently without overriding `#1` guarantee, locked pairs, or large rating gaps.
- **Synthetic `joined_at` & inactive session guards (Tasks 1, 5 & 6):** `<WaitTimer />` must render `null` on SSR (`getServerSnapshot = () => null`), clamp future clock skew to `00:00`, never render on `scheduled` / `completed` sessions or `on_break` pills, and never render on `CourtCard`'s `Switch teams` picker (`showWait={false}`).
- **Invalid/legacy match timestamps (Tasks 1 & 7):** `formatMatchDuration` must return `null` when `startedAt` or `endedAt` is missing, malformed, or `endedAt <= startedAt`, and all four Match History views must omit the separator cleanly when `null`.
- **Window boundary regression (Tasks 2 & 3):** `buildWindow(line)` default size stays `WINDOW_SIZE = 6` for backwards compatibility and non-rotation styles, while rotation styles (and `input.force`) pass `ROTATION_WINDOW_SIZE = 8`; existing tests asserting a 6-player window on `balanced` must be updated intentionally while keeping a non-rotation 6-player boundary test.

---

### Task 1: Shared Duration Formatters & Leaf `<WaitTimer />` Component

**Files:**
- Create: `src/lib/duration.ts`
- Create: `src/lib/duration.test.ts`
- Create: `src/components/ui/wait-timer.tsx`

**Interfaces:**
- Consumes: ISO timestamp strings (`startedAt`, `endedAt`, `since`), numeric `nowMs`.
- Produces:
  - `formatClockDuration(startIso: string, nowMs: number): string` (`"MM:SS"` under 1 hr, `"H:MM:SS"` at 1 hr+, `"00:00"` on negative skew or invalid input)
  - `formatMatchDuration(startedAt?: string | null, endedAt?: string | null): string | null` (`"45s"`, `"12m 34s"`, `"6m"`, `"1h 5m"`, `"1h"`, or `null`)
  - `<WaitTimer since={string} prefix?: string className?: string />` backed by one shared module-level `useSyncExternalStore` 1-second timer.

- [ ] **Step 1: Write failing unit tests in `src/lib/duration.test.ts`**

Create `src/lib/duration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatClockDuration, formatMatchDuration } from "./duration";

describe("formatClockDuration", () => {
  const base = Date.parse("2026-11-18T12:00:00.000Z");

  it("formats durations under 1 minute as 00:SS", () => {
    expect(formatClockDuration("2026-11-18T12:00:00.000Z", base)).toBe("00:00");
    expect(formatClockDuration("2026-11-18T12:00:00.000Z", base + 42_000)).toBe("00:42");
  });

  it("formats durations under 1 hour as MM:SS", () => {
    expect(formatClockDuration("2026-11-18T12:00:00.000Z", base + (6 * 60 + 15) * 1000)).toBe("06:15");
    expect(formatClockDuration("2026-11-18T12:00:00.000Z", base + (59 * 60 + 59) * 1000)).toBe("59:59");
  });

  it("formats durations at 1 hour or more as H:MM:SS", () => {
    expect(formatClockDuration("2026-11-18T12:00:00.000Z", base + (3600 + 5 * 60 + 12) * 1000)).toBe("1:05:12");
    expect(formatClockDuration("2026-11-18T12:00:00.000Z", base + (2 * 3600) * 1000)).toBe("2:00:00");
  });

  it("clamps negative clock skew and invalid timestamps to 00:00", () => {
    expect(formatClockDuration("2026-11-18T12:05:00.000Z", base)).toBe("00:00");
    expect(formatClockDuration("not-a-date", base)).toBe("00:00");
  });
});

describe("formatMatchDuration", () => {
  const start = "2026-11-18T12:00:00.000Z";

  it("formats sub-minute durations as Xs", () => {
    expect(formatMatchDuration(start, "2026-11-18T12:00:45.000Z")).toBe("45s");
    expect(formatMatchDuration(start, "2026-11-18T12:00:01.000Z")).toBe("1s");
  });

  it("formats under-1-hour durations as Xm Ys or Xm when seconds are 0", () => {
    expect(formatMatchDuration(start, "2026-11-18T12:12:34.000Z")).toBe("12m 34s");
    expect(formatMatchDuration(start, "2026-11-18T12:06:00.000Z")).toBe("6m");
  });

  it("formats 1-hour+ durations as Xh Ym or Xh when minutes are 0", () => {
    expect(formatMatchDuration(start, "2026-11-18T13:05:40.000Z")).toBe("1h 5m");
    expect(formatMatchDuration(start, "2026-11-18T13:00:15.000Z")).toBe("1h");
  });

  it("returns null for missing, invalid, zero-length, or reversed timestamps", () => {
    expect(formatMatchDuration(null, "2026-11-18T12:10:00.000Z")).toBeNull();
    expect(formatMatchDuration(start, null)).toBeNull();
    expect(formatMatchDuration(undefined, undefined)).toBeNull();
    expect(formatMatchDuration("invalid", "2026-11-18T12:10:00.000Z")).toBeNull();
    expect(formatMatchDuration(start, start)).toBeNull();
    expect(formatMatchDuration("2026-11-18T12:10:00.000Z", start)).toBeNull();
  });

  it("handles Supabase timezone offsets (+00:00 vs Z)", () => {
    expect(formatMatchDuration("2026-11-18T12:00:00+00:00", "2026-11-18T12:11:05.500Z")).toBe("11m 5s");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/duration.test.ts`
Expected: FAIL (`Cannot find module './duration'`).

- [ ] **Step 3: Implement `src/lib/duration.ts` and `src/components/ui/wait-timer.tsx`**

Create `src/lib/duration.ts`:

```ts
/** Live ticking elapsed clock: "MM:SS" under 1 hour, "H:MM:SS" at 1 hour+. */
export function formatClockDuration(startIso: string, nowMs: number): string {
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) return "00:00";
  const totalSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Completed match duration: "45s", "12m 34s", "6m", "1h 5m", or "1h".
 * Returns null if either timestamp is missing, invalid, or endedAt <= startedAt.
 */
export function formatMatchDuration(
  startedAt?: string | null,
  endedAt?: string | null
): string | null {
  if (!startedAt || !endedAt) return null;
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;

  const totalSeconds = Math.floor((endMs - startMs) / 1000);
  if (totalSeconds <= 0) return null;

  if (totalSeconds < 60) return `${totalSeconds}s`;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
```

Create `src/components/ui/wait-timer.tsx`:

```tsx
"use client";

import { useSyncExternalStore } from "react";
import { formatClockDuration } from "@/lib/duration";

let currentNow = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    currentNow = Date.now();
    intervalId = setInterval(() => {
      currentNow = Date.now();
      listeners.forEach((cb) => cb());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return currentNow;
}

function getServerSnapshot(): null {
  return null;
}

/**
 * Leaf 1-second ticking elapsed timer backed by a single shared clock.
 * Renders null on SSR so hydration never mismatches and parent lists don't re-render.
 */
export function WaitTimer({
  since,
  prefix = "",
  className = "",
}: {
  since: string;
  prefix?: string;
  className?: string;
}) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (now === null) return null;

  return (
    <span className={`font-mono tabular-nums ${className}`.trim()}>
      {prefix}
      {formatClockDuration(since, now)}
    </span>
  );
}
```

- [ ] **Step 4: Run tests, typecheck, and lint**

Run: `npx vitest run src/lib/duration.test.ts && npx tsc --noEmit && npx eslint src/lib/duration.ts src/lib/duration.test.ts src/components/ui/wait-timer.tsx`
Expected: All tests PASS, 0 TypeScript errors, 0 ESLint errors.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/duration.ts src/lib/duration.test.ts src/components/ui/wait-timer.tsx
git commit -m "feat: add duration formatters and shared 1-second WaitTimer"
```

---

### Task 2: Matchmaking Fairness Helpers & Window Size Extension

**Files:**
- Modify: `src/features/queue/matchmaking/types.ts`
- Modify: `src/features/queue/matchmaking/history.ts`
- Modify: `src/features/queue/matchmaking/scoring.ts`
- Modify: `src/features/queue/matchmaking/index.ts` (export `gamesPlayedCounts` & `isRotationStyle`, add `gamesAhead` to `StrategyCtx`)
- Modify: `src/features/queue/matchmaking/history.test.ts`
- Modify: `src/features/queue/matchmaking/scoring.test.ts`

**Interfaces:**
- Consumes: `LineEntry` (gains optional `arrivedAt?: string | null`), `PastGame[]`.
- Produces:
  - `ROTATION_WINDOW_SIZE = 8` in `types.ts`
  - `isRotationStyle(style: MatchingStyle): boolean` in `types.ts`
  - `gamesPlayedCounts(history: PastGame[]): Map<string, number>` in `history.ts`
  - `gamesAheadByPlayer(window: LineEntry[], history: PastGame[]): Map<string, number>` in `history.ts`
  - `buildWindow(line: LineEntry[], size: number = WINDOW_SIZE): LineEntry[]` in `scoring.ts`
  - `StrategyCtx.gamesAhead: Map<string, number>` populated by `buildCtx` in `scoring.ts`.

- [ ] **Step 1: Write failing unit tests in `history.test.ts` and `scoring.test.ts`**

Append to `src/features/queue/matchmaking/history.test.ts`:

```ts
import { gamesAheadByPlayer, gamesPlayedCounts } from "./history";
import type { LineEntry } from "./types";

const entry = (playerId: string, arrivedAt?: string | null): LineEntry => ({
  playerId,
  rating: 3,
  arrivedAt,
});

it("counts completed games per player across both teams", () => {
  expect(gamesPlayedCounts([]).size).toBe(0);
  const counts = gamesPlayedCounts([
    g(["a", "b"], ["c", "d"], "A", "2026-11-18T12:10:00Z"),
    g(["a", "c"], ["e", "f"], "B", "2026-11-18T12:20:00Z"),
  ]);
  expect(counts.get("a")).toBe(2);
  expect(counts.get("b")).toBe(1);
  expect(counts.get("c")).toBe(2);
  expect(counts.get("e")).toBe(1);
  expect(counts.get("z")).toBeUndefined();
});

it("computes gamesAhead for equal arrival times with 1-game and 2-game gaps", () => {
  const arrived = "2026-11-18T12:00:00Z";
  const history = [
    g(["a", "b"], ["c", "d"], "A", "2026-11-18T12:10:00Z"),
    g(["a", "b"], ["x", "y"], "A", "2026-11-18T12:20:00Z"),
    g(["a", "x"], ["y", "z"], "A", "2026-11-18T12:30:00Z"),
  ];
  // a: 3/3 = 1.0, c: 1/3 = 0.333, e: 0/3 = 0 -> avgShare = (1 + 1/3 + 0)/3 = 4/9
  // expected = 4/3 = 1.333 -> a: +1.667 clamped to +1.5, c: -0.333, e: -1.333
  const ahead = gamesAheadByPlayer(
    [entry("a", arrived), entry("c", arrived), entry("e", arrived)],
    history
  );
  expect(ahead.get("a")).toBe(1.5);
  expect(ahead.get("c")).toBeCloseTo(-1 / 3, 5);
  expect(ahead.get("e")).toBeCloseTo(-4 / 3, 5);
});

it("keeps brand-new late arrivals with 0 eligible games neutral (0) and excluded from avgShare", () => {
  const early = "2026-11-18T12:00:00Z";
  const late = "2026-11-18T12:45:00Z";
  const history = [
    g(["a", "b"], ["c", "d"], "A", "2026-11-18T12:10:00Z"),
    g(["a", "b"], ["c", "d"], "A", "2026-11-18T12:25:00Z"),
  ];
  const ahead = gamesAheadByPlayer(
    [entry("a", early), entry("c", early), entry("late", late)],
    history
  );
  expect(ahead.get("late")).toBe(0);
  // a and c both played 2/2 so both should be 0 (late didn't drag avgShare down)
  expect(ahead.get("a")).toBeCloseTo(0, 5);
  expect(ahead.get("c")).toBeCloseTo(0, 5);
});

it("evaluates late arrivals fairly once eligible games have finished after they arrived", () => {
  const early = "2026-11-18T12:00:00Z";
  const mid = "2026-11-18T12:25:00Z";
  const history = [
    g(["a", "x"], ["y", "z"], "A", "2026-11-18T12:10:00Z"),
    g(["a", "x"], ["y", "z"], "A", "2026-11-18T12:20:00Z"),
    g(["a", "late"], ["y", "z"], "A", "2026-11-18T12:35:00Z"),
    g(["x", "y"], ["z", "w"], "A", "2026-11-18T12:45:00Z"),
  ];
  // a: 3/4 = 0.75, late: 1/2 = 0.5 -> avgShare = 0.625
  // a: 3 - 2.5 = +0.5, late: 1 - 1.25 = -0.25
  const ahead = gamesAheadByPlayer([entry("a", early), entry("late", mid)], history);
  expect(ahead.get("a")).toBeCloseTo(0.5, 5);
  expect(ahead.get("late")).toBeCloseTo(-0.25, 5);
});

it("recovers original arrival when checkin_time was overwritten after re-adding a player", () => {
  // Player 'readded' played at 12:10 & 12:20, then was re-added with checkin_time = 12:45
  const history = [
    g(["readded", "a"], ["c", "d"], "A", "2026-11-18T12:10:00+00:00"),
    g(["readded", "a"], ["c", "d"], "A", "2026-11-18T12:20:00.000Z"),
    g(["a", "c"], ["d", "e"], "A", "2026-11-18T12:30:00Z"),
  ];
  const ahead = gamesAheadByPlayer(
    [entry("readded", "2026-11-18T12:45:00Z"), entry("a", "2026-11-18T12:00:00Z")],
    history
  );
  // readded effectiveArrivedAt = 12:10 -> eligible = 3, played = 2 (share = 2/3)
  // a effectiveArrivedAt = 12:00 -> eligible = 3, played = 3 (share = 1)
  // avgShare = 5/6 -> readded = 2 - 2.5 = -0.5, a = 3 - 2.5 = +0.5
  expect(ahead.get("readded")).toBeCloseTo(-0.5, 5);
  expect(ahead.get("a")).toBeCloseTo(0.5, 5);
});

it("clamps extreme surplus and deficit to [-1.5, +1.5]", () => {
  const arrived = "2026-11-18T12:00:00Z";
  const history = Array.from({ length: 6 }, (_, i) =>
    g(["ironman", "x"], ["y", "z"], "A", `2026-11-18T12:${String((i + 1) * 5).padStart(2, "0")}:00Z`)
  );
  const ahead = gamesAheadByPlayer(
    [entry("ironman", arrived), entry("resting", arrived)],
    history
  );
  expect(ahead.get("ironman")).toBe(1.5);
  expect(ahead.get("resting")).toBe(-1.5);
});
```

Append to `src/features/queue/matchmaking/scoring.test.ts`:

```ts
it("buildWindow accepts a custom size (e.g. 8) while defaulting to 6", () => {
  const line = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((i) => e(i));
  expect(buildWindow(line).map((x) => x.playerId)).toEqual(["1", "2", "3", "4", "5", "6"]);
  expect(buildWindow(line, 8).map((x) => x.playerId)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/queue/matchmaking/history.test.ts src/features/queue/matchmaking/scoring.test.ts`
Expected: FAIL (`gamesPlayedCounts` and `gamesAheadByPlayer` not exported; `buildWindow` ignores second argument).

- [ ] **Step 3: Implement changes in `types.ts`, `history.ts`, `scoring.ts`, and `index.ts`**

In `src/features/queue/matchmaking/types.ts`:
- Add `arrivedAt?: string | null;` to `LineEntry`.
- Export `ROTATION_WINDOW_SIZE = 8;`.
- Export `isRotationStyle(style: MatchingStyle): boolean`:

```ts
export const ROTATION_WINDOW_SIZE = 8;

const ROTATION_STYLES = new Set<MatchingStyle>([
  "balanced",
  "social_mixer",
  "mixed_doubles",
  "club_wars",
  "skill_separated",
  "skill_courts",
]);

export function isRotationStyle(style: MatchingStyle): boolean {
  return ROTATION_STYLES.has(style);
}
```

In `src/features/queue/matchmaking/history.ts`:
- Add `MAX_GAMES_AHEAD = 1.5`, `toEpochMs`, `gamesPlayedCounts`, and `gamesAheadByPlayer`:

```ts
const MAX_GAMES_AHEAD = 1.5;

function toEpochMs(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** Number of completed games played per player in `history`. */
export function gamesPlayedCounts(history: PastGame[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const game of history) {
    for (const id of game.teamA) bump(counts, id);
    for (const id of game.teamB) bump(counts, id);
  }
  return counts;
}

/**
 * Signed game-count delta relative to window peers, normalized for arrival time.
 * Positive = ahead of peers (played more than expected); negative = behind peers.
 * Brand-new arrivals (0 eligible games) are neutral (0) and excluded from `avgShare`.
 */
export function gamesAheadByPlayer(window: LineEntry[], history: PastGame[]): Map<string, number> {
  const ahead = new Map<string, number>();
  if (window.length === 0) return ahead;

  const counts = gamesPlayedCounts(history);
  const earliestGameEndMs = new Map<string, number>();
  const gameEndTimes: (number | null)[] = [];

  for (const game of history) {
    const endMs = toEpochMs(game.endedAt);
    gameEndTimes.push(endMs);
    if (endMs === null) continue;
    for (const id of [...game.teamA, ...game.teamB]) {
      const prev = earliestGameEndMs.get(id);
      if (prev === undefined || endMs < prev) earliestGameEndMs.set(id, endMs);
    }
  }

  const stats: { playerId: string; played: number; eligible: number }[] = [];

  for (const entry of window) {
    const played = counts.get(entry.playerId) ?? 0;
    const arrivedMs = toEpochMs(entry.arrivedAt);
    const firstEndMs = earliestGameEndMs.get(entry.playerId);

    let effectiveArrivedMs: number | null;
    if (arrivedMs !== null && firstEndMs !== undefined) {
      effectiveArrivedMs = Math.min(arrivedMs, firstEndMs);
    } else if (arrivedMs !== null) {
      effectiveArrivedMs = arrivedMs;
    } else {
      effectiveArrivedMs = null;
    }

    let eligibleRaw: number;
    if (effectiveArrivedMs === null) {
      eligibleRaw = history.length;
    } else {
      eligibleRaw = 0;
      for (const endMs of gameEndTimes) {
        if (endMs !== null && endMs >= effectiveArrivedMs) eligibleRaw += 1;
      }
    }

    const eligible = Math.max(eligibleRaw, played);
    if (eligible === 0) {
      ahead.set(entry.playerId, 0);
    } else {
      stats.push({ playerId: entry.playerId, played, eligible });
    }
  }

  if (stats.length === 0) return ahead;

  const avgShare = stats.reduce((sum, s) => sum + s.played / s.eligible, 0) / stats.length;
  for (const s of stats) {
    const raw = s.played - avgShare * s.eligible;
    ahead.set(s.playerId, Math.max(-MAX_GAMES_AHEAD, Math.min(MAX_GAMES_AHEAD, raw)));
  }
  return ahead;
}
```

In `src/features/queue/matchmaking/scoring.ts`:
- Import `gamesAheadByPlayer` from `./history`.
- Update `buildWindow(line: LineEntry[], size: number = WINDOW_SIZE): LineEntry[]` to slice `line.slice(0, size)`.
- Update `buildCtx(input: MatchmakingInput, window: LineEntry[]): StrategyCtx` to include `gamesAhead: gamesAheadByPlayer(window, input.history)`.

In `src/features/queue/matchmaking/index.ts`:
- Add `gamesAhead: Map<string, number>;` to `StrategyCtx`.
- Re-export `gamesPlayedCounts` from `./history` (so `SessionDetailView` can import it from `@/features/queue/matchmaking`).

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/features/queue/matchmaking/history.test.ts src/features/queue/matchmaking/scoring.test.ts && npx tsc --noEmit`
Expected: All tests PASS, 0 TypeScript errors.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/features/queue/matchmaking/types.ts src/features/queue/matchmaking/history.ts src/features/queue/matchmaking/scoring.ts src/features/queue/matchmaking/index.ts src/features/queue/matchmaking/history.test.ts src/features/queue/matchmaking/scoring.test.ts
git commit -m "feat(matchmaking): add arrival-fair gamesAhead helpers and configurable window size"
```

---

### Task 3: Integrate Fairness Into Rotation Strategies & Run 20-Game Simulation Tests

**Files:**
- Modify: `src/features/queue/matchmaking/strategies/balanced.ts`
- Modify: `src/features/queue/matchmaking/strategies/socialMix.ts`
- Modify: `src/features/queue/matchmaking/index.ts`
- Modify: `src/features/queue/matchmaking/decide.test.ts`
- Modify: `src/features/queue/matchmaking/winnersSkill.test.ts`

**Interfaces:**
- Consumes: `StrategyCtx.gamesAhead`, `ROTATION_WINDOW_SIZE`, `isRotationStyle`.
- Produces:
  - `FAIRNESS_WEIGHT = 1.2` and `fairnessCost(four: LineEntry[], gamesAhead: Map<string, number>): number` exported from `balanced.ts`.
  - Updated `balancedCost` and `socialMix` cost functions (`+ FAIRNESS_WEIGHT * fairnessCost(o.four, ctx.gamesAhead)`).
  - Updated `decide()` using `ROTATION_WINDOW_SIZE` (8) for rotation styles / `input.force` and `WINDOW_SIZE` (6) for non-rotation styles.

- [ ] **Step 1: Write failing strategy and simulation tests in `decide.test.ts` and `winnersSkill.test.ts`**

In `src/features/queue/matchmaking/decide.test.ts`:
1. Update the `"never looks past six"` test so it explicitly verifies:
   - Rotation styles (`balanced`) inspect up to 8 players (can reach `p7` / `p8` when needed) and never look past 8 (`p9` is excluded).
   - Non-rotation styles (`winners_losers`, `fifo`) never look past 6.
2. Add targeted fairness tests:
   - `balanced` gently pulls an under-played peer (at `#5`–`#8`, equal rating, same arrival time) ahead of a more-played peer at `#4`, while keeping `#1` guaranteed.
   - `balanced` does NOT let a brand-new late arrival (`arrivedAt` after all completed games) jump ahead of on-time peers.
   - `balanced` still respects a large rating gap (`>= 0.5`) and locked pairs over a 1-game fairness deficit.
   - `social_mixer`, `mixed_doubles`, and `club_wars` also favor under-played peers within the top 8.
   - `fifo`, `winners_stay`, `winners_losers`, and `king_queen` remain unaffected by `gamesAhead`.
   - **2-court / 16-player / 20-game Balhai CrossCourt simulation:** 12 on-time players + 4 late arrivals (joining after game 6), alternating fast (6 min) and slow (14 min) courts, verifying:
     - All 12 on-time players finish with `maxGames - minGames <= 1` (tight spread).
     - No latecomer finishes with more games than the minimum on-time player.
     - No waiting player is ever starved (`#1` always plays).

In `src/features/queue/matchmaking/winnersSkill.test.ts`:
- Add test confirming `skill_separated` and `skill_courts` use the 8-player window and fairness cost within `skillSpread`, while `winners_losers` still stays strictly within 6.

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `npx vitest run src/features/queue/matchmaking/decide.test.ts src/features/queue/matchmaking/winnersSkill.test.ts`
Expected: FAIL on the new fairness/window-8 tests.

- [ ] **Step 3: Implement strategy changes in `balanced.ts`, `socialMix.ts`, and `index.ts`**

In `src/features/queue/matchmaking/strategies/balanced.ts`:

```ts
import { enumerateOptions, pickCheapest, ratingGap, repeatCounts, shortfall, type Option } from "../scoring";
import type { Decision, LineEntry } from "../types";
import type { Strategy, StrategyCtx } from "../index";

export const RATING_GAP_WEIGHT = 10;
export const PARTNER_REPEAT_WEIGHT = 3;
export const OPPONENT_REPEAT_WEIGHT = 1;
export const SKIP_WEIGHT = 0.5;
export const FAIRNESS_WEIGHT = 1.2;

/** Sum of `gamesAhead` across the 4 players (negative favors under-played players). */
export function fairnessCost(four: LineEntry[], gamesAhead: Map<string, number>): number {
  let sum = 0;
  for (const p of four) sum += gamesAhead.get(p.playerId) ?? 0;
  return sum;
}

/** 10·ratingGap + 3·partnerRepeats + 1·opponentRepeats + 0.5·skips + 1.2·fairnessCost */
export function balancedCost(o: Option, ctx: StrategyCtx): number {
  const { partnerRepeats, opponentRepeats } = repeatCounts(o.teams, ctx.counts);
  return (
    RATING_GAP_WEIGHT * ratingGap(o.teams, ctx.ratings) +
    PARTNER_REPEAT_WEIGHT * partnerRepeats +
    OPPONENT_REPEAT_WEIGHT * opponentRepeats +
    SKIP_WEIGHT * o.skips +
    FAIRNESS_WEIGHT * fairnessCost(o.four, ctx.gamesAhead)
  );
}
```

In `src/features/queue/matchmaking/strategies/socialMix.ts`:

```ts
import { enumerateOptions, pickCheapest, repeatCounts, shortfall, type Option } from "../scoring";
import type { Decision } from "../types";
import type { Strategy } from "../index";
import { FAIRNESS_WEIGHT, OPPONENT_REPEAT_WEIGHT, PARTNER_REPEAT_WEIGHT, SKIP_WEIGHT, fairnessCost } from "./balanced";

/** Ratings ignored: 3·partnerRepeats + 1·opponentRepeats + 0.5·skips + 1.2·fairnessCost, ties broken at random. */
export const socialMix: Strategy = (input, ctx) => {
  const cost = (o: Option) => {
    const { partnerRepeats, opponentRepeats } = repeatCounts(o.teams, ctx.counts);
    return (
      PARTNER_REPEAT_WEIGHT * partnerRepeats +
      OPPONENT_REPEAT_WEIGHT * opponentRepeats +
      SKIP_WEIGHT * o.skips +
      FAIRNESS_WEIGHT * fairnessCost(o.four, ctx.gamesAhead)
    );
  };
  const best = pickCheapest(enumerateOptions(ctx.window, true), cost, input.random);
  return (best ? best.teams : { hold: "not_enough_players", needed: shortfall(ctx.window.length, 4) }) as Decision;
};
```

In `src/features/queue/matchmaking/index.ts`:
- Import `isRotationStyle, ROTATION_WINDOW_SIZE, WINDOW_SIZE` from `./types`.
- In `decide(input)`:
```ts
const windowSize = input.force || isRotationStyle(input.style) ? ROTATION_WINDOW_SIZE : WINDOW_SIZE;
const window = buildWindow(input.line, windowSize);
```

- [ ] **Step 4: Run entire matchmaking test suite & typecheck**

Run: `npx vitest run src/features/queue/ && npx tsc --noEmit`
Expected: All queue & matchmaking tests PASS (including `kingQueen.test.ts`, `buildCards.test.ts`, `decide.test.ts`, `winnersSkill.test.ts`), 0 TypeScript errors.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/features/queue/matchmaking/
git commit -m "feat(matchmaking): weight rotation styles by arrival-fair game pace over 8-player window"
```

---

### Task 4: Server & Client Data Plumbing (`arrivedAt` & `gamesPlayed`)

**Files:**
- Modify: `src/features/queue/api/matchmakingData.ts`
- Modify: `src/features/queue/api/upNextActions.ts`
- Modify: `src/features/queue/api/queueActions.ts`
- Modify: `src/features/sessions/components/SessionDetailView.tsx`
- Modify: `src/features/sessions/components/SessionQueueLiveBoard.tsx` (props & `decide()` preview only — UI rendering is in Task 5)
- Modify: `src/features/queue/components/UpNextPanel.tsx` (accept & pass `gamesPlayed`)
- Modify: `src/features/courts/components/CourtMatrix.tsx` (accept & pass `gamesPlayed`)
- Modify: `src/features/courts/components/CourtCard.tsx` (accept `gamesPlayed` prop — sheet wiring is in Task 6)

**Interfaces:**
- Consumes: `session_checkins.checkin_time`, `queue_entries.joined_at`, `history: PastGame[]`.
- Produces:
  - `loadSessionArrivals(supabase, sessionId): Promise<Map<string, string>>` in `matchmakingData.ts`
  - `arrivedAt` populated on `LineEntry` in `refreshUpNext`, `callNextUp`, and `SessionQueueLiveBoard` preview
  - `gamesPlayed?: Record<string, number>` derived once in `SessionDetailView` via `gamesPlayedCounts(history ?? [])` and passed to `SessionQueueLiveBoard`, `UpNextPanel`, `CourtMatrix` → `CourtCard`.

- [ ] **Step 1: Add `loadSessionArrivals` in `src/features/queue/api/matchmakingData.ts` + unit test**

Check if `src/features/queue/api/matchmakingData.test.ts` exists (if not, create a focused unit test for `pastGamesFromMatches` + arrival map fallback helper, or add a pure `arrivalMapFromCheckins` helper and test it):

In `src/features/queue/api/matchmakingData.ts`:
```ts
/** Pure helper mapping session_checkins rows to playerId -> checkin_time. */
export function arrivalsFromCheckins(
  rows: { player_id?: string | null; checkin_time?: string | null; player?: { id?: string } | null }[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    const id = row.player_id ?? row.player?.id;
    if (id && row.checkin_time) map[id] = row.checkin_time;
  }
  return map;
}

/** Check-in timestamps for every player checked into this session. */
export async function loadSessionArrivals(
  supabase: SupabaseClient,
  sessionId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("session_checkins")
    .select("player_id, checkin_time")
    .eq("session_id", sessionId);
  if (error) console.error("loadSessionArrivals failed:", error);
  return new Map(
    Object.entries(
      arrivalsFromCheckins(
        (data ?? []) as { player_id?: string | null; checkin_time?: string | null }[]
      )
    )
  );
}
```

Create or update `src/features/queue/api/matchmakingData.test.ts` testing `arrivalsFromCheckins` (skips missing `checkin_time`, supports `player_id` and `player.id` fallback).

- [ ] **Step 2: Run test to verify RED then GREEN**

Run: `npx vitest run src/features/queue/api/matchmakingData.test.ts`

- [ ] **Step 3: Wire `loadSessionArrivals` into `upNextActions.ts` and `queueActions.ts`**

In `src/features/queue/api/upNextActions.ts` (`refreshUpNext`):
- Import `loadSessionArrivals` from `./matchmakingData`.
- Add `loadSessionArrivals(supabase, sessionId)` to the existing `Promise.all` (lines 60–70).
- Populate `arrivedAt: arrivals.get(q.player_id) ?? q.joined_at` in `line` (lines 73–77).

In `src/features/queue/api/queueActions.ts` (`callNextUp`):
- Import `loadSessionArrivals` from `./matchmakingData`.
- Add `loadSessionArrivals(supabase, sessionId)` to the existing `Promise.all` (lines 606–609).
- Populate `arrivedAt: arrivals.get(e.player_id) ?? e.joined_at` in `line` (lines 639–643).

- [ ] **Step 4: Derive `arrivedAtByPlayer` and `gamesPlayed` in `SessionDetailView.tsx` and wire props down**

In `src/features/sessions/components/SessionDetailView.tsx`:
- Import `gamesPlayedCounts` from `@/features/queue/matchmaking` and `arrivalsFromCheckins` from `@/features/queue/api/matchmakingData`.
- Derive two memoized plain records:
```ts
const arrivedAtByPlayer = useMemo(
  () => arrivalsFromCheckins(activeCheckins),
  [activeCheckins]
);

const gamesPlayed = useMemo(() => {
  const counts = gamesPlayedCounts(history ?? []);
  return Object.fromEntries(counts);
}, [history]);
```
- Pass `gamesPlayed={gamesPlayed}` to:
  - `<CourtMatrix ... gamesPlayed={gamesPlayed} />`
  - `<UpNextPanel ... gamesPlayed={gamesPlayed} />`
  - `<SessionQueueLiveBoard ... gamesPlayed={gamesPlayed} arrivedAtByPlayer={arrivedAtByPlayer} />`

In `src/features/sessions/components/SessionQueueLiveBoard.tsx`:
- Add optional props `gamesPlayed?: Record<string, number>` and `arrivedAtByPlayer?: Record<string, string>` (default `{}`).
- In `preview` (`useMemo` lines 144–171), pass `arrivedAt: arrivedAtByPlayer?.[q.player_id] ?? q.joined_at` into `decide()`'s `line` and include `arrivedAtByPlayer` in the `useMemo` dependency array.

In `src/features/queue/components/UpNextPanel.tsx`:
- Accept optional `gamesPlayed?: Record<string, number>` prop (wired to `PlayerPickerSheet` in Task 6).

In `src/features/courts/components/CourtMatrix.tsx` and `src/features/courts/components/CourtCard.tsx`:
- Accept optional `gamesPlayed?: Record<string, number>` prop and forward `CourtMatrix` → `CourtCard` (wired to sheets in Task 6).

- [ ] **Step 5: Run tests, typecheck, and lint on touched files**

Run: `npx vitest run src/features/queue/ && npx tsc --noEmit && npx eslint src/features/queue/api/matchmakingData.ts src/features/queue/api/matchmakingData.test.ts src/features/queue/api/upNextActions.ts src/features/queue/api/queueActions.ts src/features/queue/components/UpNextPanel.tsx`
Expected: PASS, 0 errors.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/features/queue/api/matchmakingData.ts src/features/queue/api/matchmakingData.test.ts src/features/queue/api/upNextActions.ts src/features/queue/api/queueActions.ts src/features/sessions/components/SessionDetailView.tsx src/features/sessions/components/SessionQueueLiveBoard.tsx src/features/queue/components/UpNextPanel.tsx src/features/courts/components/CourtMatrix.tsx src/features/courts/components/CourtCard.tsx
git commit -m "feat(queue): plumb session arrival times and completed game counts to matchmaking and UI"
```

---

### Task 5: Queue UI Metadata, Player Explainer & `/guide` Copy

**Files:**
- Modify: `src/features/sessions/components/SessionQueueLiveBoard.tsx`
- Modify: `src/features/activity/components/WaitCard.tsx`
- Modify: `src/features/queue/constants/matchingStyles.ts`
- Modify: `src/features/guide/data/guideData.ts`
- Modify: `src/features/guide/guideData.test.ts`

**Interfaces:**
- Consumes: `gamesPlayed`, `joined_at`, `isSessionActive`, `style`, `isRotationStyle`, `<WaitTimer />`.
- Produces:
  - 2-line `PlayerLine` showing `{n} game(s)` and live `<WaitTimer since={joinedAt} />` (only when `isSessionActive && joinedAt`).
  - Collapsible `"How matching works"` disclosure in Queue header (`min-h-11`, `aria-expanded`) tailored to rotation vs. non-rotation styles.
  - `WaitCard` showing `"You've played X games this session"` and `min-h-11` toggle button.
  - Updated `/guide` matching styles copy (`matchingStyles.ts`) and FAQ (`guideData.ts`).

- [ ] **Step 1: Write failing test in `src/features/guide/guideData.test.ts` for updated guide copy & fairness FAQ**

Add tests in `src/features/guide/guideData.test.ts` verifying:
- `PLAYER_FAQS` includes a player-facing FAQ explaining fair game pace / wait timers / why game counts can differ for late arrivals or breaks.
- `MATCHING_STYLE_REGISTRY.balanced.guideDescription` and `social_mixer.guideDescription` reference the 8-player window and fair game pace (no stale `"first six"` or `"first ten"` text).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/guide/guideData.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `SessionQueueLiveBoard.tsx`**

1. Import `HelpCircle`, `ChevronDown` from `lucide-react`, `WaitTimer` from `@/components/ui/wait-timer`, and `isRotationStyle` from `@/features/queue/matchmaking`.
2. Add state `const [showMatchingInfo, setShowMatchingInfo] = useState(false);`.
3. Create helper `matchingSummaryFor(style: MatchingStyle)`:
   - When `isRotationStyle(style)` is true: returns the 3 plain-English bullets from the spec:
     1. **#1 in line always plays next** — waiting longest guarantees your spot.
     2. **Fair game pace:** Among the top 8 waiting, players who have played fewer games since arriving get a gentle nudge so faster vs. slower games stay even.
     3. **Late arrivals stay fair:** Joining later starts neutral (it won't jump you ahead of players who arrived earlier), while ratings and fresh partners are still balanced.
   - When non-rotation (`fifo`, `king_queen`, `winners_stay`, `winners_losers`): returns a concise 1–2 sentence explanation of that exact style's rule (no fair-pace boost).
4. In the `<header>` area of `SessionQueueLiveBoard`, add a compact collapsible button right under the subtitle (or aligned cleanly):
   ```tsx
   <button
     type="button"
     onClick={() => setShowMatchingInfo((v) => !v)}
     aria-expanded={showMatchingInfo}
     aria-controls="how-matching-works-panel"
     className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500 rounded-md"
   >
     <HelpCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
     <span>How matching works</span>
     <ChevronDown
       className={`h-3.5 w-3.5 shrink-0 transition-transform ${showMatchingInfo ? "rotate-180" : ""}`}
       aria-hidden
     />
   </button>
   ```
   When `showMatchingInfo` is true, render `#how-matching-works-panel` as a subtle bordered callout (`mx-4 mb-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 p-3 text-xs text-slate-600 dark:text-slate-300 space-y-1.5`) showing the tailored explanation.
5. Pass `gamesPlayed={gamesPlayed[currentUserId] ?? 0}` to `<WaitCard />`.
6. Build a lookup `joinedAtByPlayerId = new Map(queue.map((q) => [q.player_id, q.joined_at]))`.
7. Update `TeamBlock`, `QueueRow`, and `PlayerLine`:
   - `PlayerLine` accepts optional `gamesCount?: number`, `joinedAt?: string | null`, `showWait?: boolean`.
   - Left column uses `<div className="min-w-0 flex-1 py-1.5">` with:
     - Line 1: player name (`block truncate text-sm font-medium`) + optional `You` pill (use `flex items-center gap-1.5 min-w-0` so the name truncates cleanly without pushing `You` off-screen).
     - Line 2 (only rendered when `showMeta` is true — i.e. `showWait && joinedAt` OR `gamesCount !== undefined && (showWait || gamesCount > 0)`):
       ```tsx
       <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
         {gamesCount !== undefined && (showWait || gamesCount > 0) && (
           <span className="tabular-nums">
             {gamesCount} {gamesCount === 1 ? "game" : "games"}
           </span>
         )}
         {showWait && joinedAt && (
           <>
             {gamesCount !== undefined && <span aria-hidden>·</span>}
             <WaitTimer since={joinedAt} />
           </>
         )}
       </div>
       ```
   - `TeamBlock` passes `gamesCount={gamesPlayed[p.id] ?? 0}`, `joinedAt={joinedAtByPlayerId.get(p.id)}`, `showWait={isSessionActive}`.
   - Both `QueueRow` loops (`nextPod` and `pods.slice(1)`) pass `gamesCount={gamesPlayed[item.player_id] ?? 0}`, `joinedAt={item.joined_at}`, `showWait={isSessionActive}`.
   - `onBreak` pills do NOT show `<WaitTimer />`.

- [ ] **Step 4: Update `WaitCard.tsx`, `matchingStyles.ts`, and `guideData.ts`**

In `src/features/activity/components/WaitCard.tsx`:
- Add optional `gamesPlayed?: number` prop.
- Bump the toggle button from `h-9` to `min-h-11 inline-flex items-center`.
- Inside the expanded panel, show a 1-line note when `gamesPlayed !== undefined`:
  ```tsx
  {gamesPlayed !== undefined && (
    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
      You&apos;ve played <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">{gamesPlayed}</span>{" "}
      {gamesPlayed === 1 ? "game" : "games"} this session.
    </p>
  )}
  ```

In `src/features/queue/constants/matchingStyles.ts`:
- Update `balanced.guideDescription` to explain picking four from the first eight in line (`#1` always included), balancing ratings, avoiding repeats, and gently evening out games played since arrival.
- Update `social_mixer.guideDescription` to explain picking four from the first eight in line (`#1` always included), avoiding repeats, ignoring ratings, and gently evening out games played since arrival.
- Update `skill_separated.guideDescription` to say "first eight waiting" (replacing stale "first ten") and note fair game pace.

In `src/features/guide/data/guideData.ts`:
- Update `PLAYER_FLOW_STEPS` step 03 (`Wait Estimate, Activity & Call-Up`) to mention live wait timers and session game counts in the queue.
- Add a clear FAQ entry to `PLAYER_FAQS`:
  - Question: `"Why do some players have slightly more games than others, and how does fair matching work?"`
  - Answer: Plain-English explanation of `#1` always playing next, the top-8 fair game-pace nudge from arrival time, why late arrivals start neutral instead of leapfrogging earlier players, and why game counts can still differ slightly because of arrival times, breaks, or faster vs. slower courts.

- [ ] **Step 5: Run tests, typecheck, and lint**

Run: `npx vitest run src/features/guide/ src/features/activity/ && npx tsc --noEmit && npx eslint src/features/sessions/components/SessionQueueLiveBoard.tsx src/features/activity/components/WaitCard.tsx src/features/queue/constants/matchingStyles.ts src/features/guide/data/guideData.ts src/features/guide/guideData.test.ts`
Expected: PASS, 0 errors.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/features/sessions/components/SessionQueueLiveBoard.tsx src/features/activity/components/WaitCard.tsx src/features/queue/constants/matchingStyles.ts src/features/guide/data/guideData.ts src/features/guide/guideData.test.ts
git commit -m "feat(queue-ui): show game counts, live wait timers, and plain-English matching explainer"
```

---

### Task 6: Admin Pickers (`PlayerPickerSheet` & `ChoosePlayersSheet`)

**Files:**
- Modify: `src/features/queue/components/PlayerPickerSheet.tsx`
- Modify: `src/features/courts/components/ChoosePlayersSheet.tsx`
- Modify: `src/features/queue/components/UpNextPanel.tsx`
- Modify: `src/features/courts/components/CourtCard.tsx`

**Interfaces:**
- Consumes: `gamesPlayed?: Record<string, number>`, `showWait?: boolean` (default `true`), `<WaitTimer />`.
- Produces:
  - `PlayerPickerSheet` shows `rating · X games · waiting MM:SS · paired` (omitting `waiting MM:SS` when `showWait={false}`).
  - `ChoosePlayersSheet` shows 2-line rows: name on top, `X games · MM:SS` (+ `· paired`) underneath.
  - `CourtCard` passes `gamesPlayed` to Replace, Fill, Switch teams, and ChoosePlayersSheet, and passes `showWait={false}` to Switch teams so synthetic `joined_at` never renders a fake `00:00`.
  - `UpNextPanel` passes `gamesPlayed` to `PlayerPickerSheet`.

- [ ] **Step 1: Update `src/features/queue/components/PlayerPickerSheet.tsx`**

- Remove the static `waitedFor` helper (replaced by live `<WaitTimer />`).
- Import `WaitTimer` from `@/components/ui/wait-timer`.
- Add optional props `gamesPlayed?: Record<string, number>` and `showWait?: boolean` (default `true`).
- Render each candidate's subtitle as:
  ```tsx
  const played = gamesPlayed?.[c.player_id] ?? 0;
  ```
  ```tsx
  <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400">
    {c.player?.skill_rating != null && (
      <span className="font-mono tabular-nums">{Number(c.player.skill_rating).toFixed(1)}</span>
    )}
    {c.player?.skill_rating != null && <span aria-hidden>·</span>}
    <span className="tabular-nums">
      {played} {played === 1 ? "game" : "games"}
    </span>
    {showWait && c.joined_at && (
      <>
        <span aria-hidden>·</span>
        <WaitTimer since={c.joined_at} prefix="waiting " />
      </>
    )}
    {c.group_id && (
      <>
        <span aria-hidden>·</span>
        <span>paired</span>
      </>
    )}
  </span>
  ```

- [ ] **Step 2: Update `src/features/courts/components/ChoosePlayersSheet.tsx`**

- Import `WaitTimer` from `@/components/ui/wait-timer`.
- Add optional prop `gamesPlayed?: Record<string, number>`.
- Update each candidate button inside `ordered.map((c) => ...)` to show name + muted 2nd line:
  ```tsx
  const played = gamesPlayed?.[c.player_id] ?? 0;
  const selected = inA || inB;
  ```
  ```tsx
  <span className="min-w-0 flex-1">
    <span className="block truncate font-semibold">{playerName(c.player)}</span>
    <span
      className={`flex items-center gap-1.5 text-xs ${
        selected ? "text-white/85" : "text-slate-500 dark:text-slate-400"
      }`}
    >
      <span className="tabular-nums">
        {played} {played === 1 ? "game" : "games"}
      </span>
      {c.joined_at && (
        <>
          <span aria-hidden>·</span>
          <WaitTimer since={c.joined_at} />
        </>
      )}
      {c.group_id && (
        <>
          <span aria-hidden>·</span>
          <span>paired</span>
        </>
      )}
    </span>
  </span>
  ```

- [ ] **Step 3: Wire props in `UpNextPanel.tsx` and `CourtCard.tsx`**

In `src/features/queue/components/UpNextPanel.tsx`:
- Pass `gamesPlayed={gamesPlayed}` to `<PlayerPickerSheet />`.

In `src/features/courts/components/CourtCard.tsx`:
- Pass `gamesPlayed={gamesPlayed}` to all three `<PlayerPickerSheet />` instances (`replace`, `switch`, `fill`) and to `<ChoosePlayersSheet />`.
- On `sheet.kind === "switch"`, explicitly pass `showWait={false}` to `<PlayerPickerSheet />`.

- [ ] **Step 4: Run typecheck, lint, and tests**

Run: `npx vitest run src/features/courts/ src/features/queue/ && npx tsc --noEmit && npx eslint src/features/queue/components/PlayerPickerSheet.tsx src/features/courts/components/ChoosePlayersSheet.tsx src/features/queue/components/UpNextPanel.tsx`
Expected: PASS, 0 TypeScript errors, 0 ESLint errors on modified files (check `CourtCard.tsx` diff lines have 0 new lint errors).

- [ ] **Step 5: Commit Task 6**

```bash
git add src/features/queue/components/PlayerPickerSheet.tsx src/features/courts/components/ChoosePlayersSheet.tsx src/features/queue/components/UpNextPanel.tsx src/features/courts/components/CourtCard.tsx
git commit -m "feat(pickers): show session games played and live wait timers in admin pickers"
```

---

### Task 7: Completed Match Durations Across All Four Match History Views

**Files:**
- Modify: `src/features/sessions/components/SessionLeaderboard.tsx`
- Modify: `src/features/matches/components/MatchHistoryList.tsx`
- Modify: `src/features/players/components/ProfileView.tsx`
- Modify: `src/features/rankings/components/PlayerStatsModal.tsx`

**Interfaces:**
- Consumes: `formatMatchDuration(startedAt, endedAt)` from `@/lib/duration`, existing `started_at` & `ended_at` fields on match records.
- Produces: Formatted match duration (`12m 34s`, `6m`, `1h 5m`, etc.) rendered cleanly in all four views whenever `formatMatchDuration` returns a non-null string; omitted cleanly when `null`.

- [ ] **Step 1: Update `src/features/sessions/components/SessionLeaderboard.tsx`**

- Import `formatMatchDuration` from `@/lib/duration`.
- Inside `visibleMatches.map((m) => ...)` (around line 551):
  ```tsx
  const duration = isCompleted ? formatMatchDuration(m.started_at, m.ended_at) : null;
  ```
  Update the timestamp footer row:
  ```tsx
  {m.started_at && (
    <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-1 flex items-center justify-between gap-2">
      <span className="tabular-nums">
        {formatPHTTime(m.started_at)}
        {duration ? ` · ${duration}` : ""}
      </span>
      {teamAWon && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Team 1 Victory</span>}
      {teamBWon && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Team 2 Victory</span>}
    </div>
  )}
  ```

- [ ] **Step 2: Update `src/features/matches/components/MatchHistoryList.tsx`**

- Import `formatMatchDuration` from `@/lib/duration`.
- In `useMemo` (around lines 51–65), compute `const duration = formatMatchDuration(m.started_at, m.ended_at) ?? undefined;` and include `duration` in the returned `MatchItem`.
- In the card metadata row (around lines 110–118), render duration when present:
  ```tsx
  {m.duration && (
    <>
      <span>•</span>
      <span className="font-mono tabular-nums">{m.duration}</span>
    </>
  )}
  ```

- [ ] **Step 3: Update `src/features/players/components/ProfileView.tsx`**

- Import `formatMatchDuration` from `@/lib/duration`.
- In `displayMatches` `useMemo` (around lines 349–365), compute `const duration = !isInProgress ? formatMatchDuration(match.started_at, match.ended_at) : null;` and include `duration` on the mapped item.
- In Recent Match History JSX (around lines 926–929):
  ```tsx
  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono tabular-nums">
    {m.date}
    {m.duration ? ` • ${m.duration}` : ""}
  </span>
  ```

- [ ] **Step 4: Update `src/features/rankings/components/PlayerStatsModal.tsx`**

- Import `formatMatchDuration` from `@/lib/duration`.
- In `formattedMatches` `useMemo` (around lines 54–69), compute `const duration = !isInProgress ? formatMatchDuration(match.started_at, match.ended_at) : null;` and include `duration` on the mapped item.
- In Recent Match History JSX (around lines 215–218):
  ```tsx
  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
    {m.date}
    {m.duration ? ` • ${m.duration}` : ""}
  </span>
  ```

- [ ] **Step 5: Run tests, typecheck, and lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/features/sessions/components/SessionLeaderboard.tsx src/features/matches/components/MatchHistoryList.tsx src/features/players/components/ProfileView.tsx src/features/rankings/components/PlayerStatsModal.tsx`
Expected: PASS, 0 TypeScript errors, 0 ESLint errors on modified lines/files.

- [ ] **Step 6: Commit Task 7**

```bash
git add src/features/sessions/components/SessionLeaderboard.tsx src/features/matches/components/MatchHistoryList.tsx src/features/players/components/ProfileView.tsx src/features/rankings/components/PlayerStatsModal.tsx
git commit -m "feat(matches): display completed match duration across all four Match History views"
```

---

### Task 8: Full Verification & Responsive Browser Check

**Files:** None (verification only; fix any issues discovered before finishing).

- [ ] **Step 1: Run complete unit test suite & TypeScript check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: Every test file passes (baseline 65 files / 385 tests + new tests), 0 TypeScript errors.

- [ ] **Step 2: Run ESLint across all newly added / modified files**

Run: `npx eslint src/lib/duration.ts src/lib/duration.test.ts src/components/ui/wait-timer.tsx src/features/queue/matchmaking/ src/features/queue/api/matchmakingData.ts src/features/queue/api/matchmakingData.test.ts src/features/queue/api/upNextActions.ts src/features/queue/api/queueActions.ts src/features/queue/components/PlayerPickerSheet.tsx src/features/queue/components/UpNextPanel.tsx src/features/courts/components/ChoosePlayersSheet.tsx src/features/sessions/components/SessionQueueLiveBoard.tsx src/features/sessions/components/SessionLeaderboard.tsx src/features/activity/components/WaitCard.tsx src/features/queue/constants/matchingStyles.ts src/features/guide/data/guideData.ts src/features/guide/guideData.test.ts src/features/matches/components/MatchHistoryList.tsx src/features/players/components/ProfileView.tsx src/features/rankings/components/PlayerStatsModal.tsx`
Expected: 0 errors (0 `react-hooks/set-state-in-effect` warnings/errors).

- [ ] **Step 3: Live responsive visual check on `http://localhost:3000`**

Verify safely via the `browser` subagent at both `375×812` (mobile) and `1280×800` (desktop):
1. Check `/matches` and `/rankings` (open a player modal) + a finished session's **Match Logs** tab (read-only) to confirm completed match durations render cleanly (e.g. `12m 34s`) with zero layout overflow or React hydration errors in console.
2. Check `/guide?tab=matchstyles` and `/guide?tab=faq` to confirm updated fair-matching copy.
3. Only if zero non-`"ZZ Test"` sessions are currently `active`, inspect a temporary `"ZZ Test Fair Queue"` casual session (or skip live session creation if a real session is live) to confirm:
   - Queue rows show 2-line sublines (`0 games · MM:SS`) ticking live every second with zero horizontal overflow at `375×812`.
   - Tapping `"How matching works"` opens and closes the 3-bullet explainer cleanly.
   - Admin `PlayerPickerSheet` (`Replace` / `Add player`) and `ChoosePlayersSheet` show games played + live ticking wait timer, while `Switch teams` does NOT show a wait timer.
   - End the `"ZZ Test"` session cleanly afterwards.

- [ ] **Step 4: Present summary and await explicit user confirmation before any merge/push**

Report verification results with exact test counts, lint/tsc status, and browser evidence. Ask user before pushing to `origin/master`.
