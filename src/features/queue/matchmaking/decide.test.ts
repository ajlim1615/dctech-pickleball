import { describe, it, expect } from "vitest";
import { decide, gamesPlayedCounts } from "./index";
import { e, game, ids, input, sorted } from "./testHelpers";
import type { LineEntry, PastGame, Teams } from "./types";

describe("decide: balanced, social mix and fifo", () => {
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
    const h = [game(["1", "2"], ["3", "4"]), game(["5", "x1"], ["x2", "x3"]), game(["6", "y1"], ["y2", "y3"])];
    const d = decide(input("balanced", line, h)) as Teams;
    expect([...d.teamA, ...d.teamB].sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("social mix ignores ratings and avoids repeat partners", () => {
    const line = [e("1", 5), e("2", 5), e("3", 2), e("4", 2)];
    const h = [game(["1", "3"], ["2", "4"]), game(["1", "4"], ["2", "3"])];
    // 1+2 vs 3+4 is the only split with no repeat partners, but it is the most lopsided on rating.
    expect(sorted(decide(input("social_mixer", line, h)))).toEqual(sorted({ teamA: ["1", "2"], teamB: ["3", "4"] }));
    // Balanced weighs the 3.0 rating gap more heavily and picks a repeat-partner split instead.
    expect(sorted(decide(input("balanced", line, h)))).not.toEqual(sorted({ teamA: ["1", "2"], teamB: ["3", "4"] }));
  });

  it("first in line is always called", () => {
    for (const style of ["balanced", "social_mixer", "fifo"] as const) {
      const d = decide(input(style, ids(6), [game(["p1", "p2"], ["p3", "p4"])])) as Teams;
      expect([...d.teamA, ...d.teamB]).toContain("p1");
    }
  });

  it("rotation styles inspect up to 8 players and never look past 8, while non-rotation styles stay within 6", () => {
    const line9 = ids(9);
    const repeatHistory = [
      ...Array.from({ length: 5 }, () => game(["p1", "p2"], ["p3", "p4"])),
      ...Array.from({ length: 5 }, () => game(["p1", "p5"], ["p3", "p6"])),
    ];
    const balancedReach78 = decide(input("balanced", line9, repeatHistory)) as Teams;
    const picked78 = [...balancedReach78.teamA, ...balancedReach78.teamB];
    expect(picked78).toContain("p7");
    expect(picked78).toContain("p8");
    expect(picked78).not.toContain("p9");

    const all8Repeated = [
      ...repeatHistory,
      ...Array.from({ length: 5 }, () => game(["p1", "p7"], ["p2", "p8"])),
    ];
    const balancedNever9 = decide(input("balanced", line9, all8Repeated)) as Teams;
    expect([...balancedNever9.teamA, ...balancedNever9.teamB]).not.toContain("p9");

    // Non-rotation: winners_losers stays within 6 even when a matching winner sits at #7
    const wlHistory = [
      game(["p1", "p2"], ["p3", "p4"], "A"),
      game(["p7", "x1"], ["p5", "p6"], "A"),
    ];
    const wlDecision = decide(input("winners_losers", ids(8), wlHistory)) as Teams;
    expect([...wlDecision.teamA, ...wlDecision.teamB]).not.toContain("p7");

    // Non-rotation: fifo stays strictly within 6
    const fifoDecision = decide(input("fifo", line9, all8Repeated)) as Teams;
    expect(fifoDecision).toEqual({ teamA: ["p1", "p2"], teamB: ["p3", "p4"] });
  });

  it("a locked pair plays together", () => {
    const lines = {
      partnerAtFour: [e("1", 3, "g"), e("2"), e("3"), e("4", 3, "g"), e("5"), e("6")],
      partnerBeyondSix: [e("1", 3, "g"), ...["2", "3", "4", "5", "6", "7", "8"].map((i) => e(i)), e("9", 3, "g")],
    };
    for (const line of Object.values(lines)) {
      const partner = line[line.length - 1].pairId === "g" ? line[line.length - 1].playerId : "4";
      for (const style of ["balanced", "social_mixer", "fifo"] as const) {
        const d = decide(input(style, line)) as Teams;
        const team = d.teamA.includes("1") ? d.teamA : d.teamB;
        expect(team).toContain("1");
        expect(team).toContain(partner);
      }
    }
  });

  it("fifo is #1+#2 vs #3+#4", () =>
    expect(decide(input("fifo", ids(6)))).toEqual({ teamA: ["p1", "p2"], teamB: ["p3", "p4"] }));

  it("force uses balanced", () => {
    const line = [e("a", 4.5), e("b", 4), e("c", 3.5), e("d", 3)];
    expect(sorted(decide({ ...input("fifo", line), force: true }))).toEqual(sorted({ teamA: ["a", "d"], teamB: ["b", "c"] }));
  });
});

describe("decide: arrival-fair pace & 8-player window", () => {
  const t0 = "2026-11-18T12:00:00Z";
  const tLate = "2026-11-18T12:50:00Z";
  let soloSeq = 0;

  const entryAt = (id: string, rating = 3, arrivedAt: string | null = t0, pairId?: string): LineEntry => ({
    playerId: id,
    rating,
    arrivedAt,
    pairId,
  });

  function soloGames(playerId: string, count: number, winner: "A" | "B" = "A"): PastGame[] {
    return Array.from({ length: count }, () => {
      soloSeq += 1;
      return {
        courtId: "c1",
        teamA: [playerId, `x${soloSeq}a`],
        teamB: [`x${soloSeq}b`, `x${soloSeq}c`],
        winner,
        endedAt: new Date(Date.UTC(2026, 10, 18, 12, 10, soloSeq)).toISOString(),
      };
    });
  }

  it("balanced gently pulls an under-played peer (#5-#8) ahead of #4 while keeping #1 guaranteed", () => {
    const line = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].map((id) => entryAt(id, 3, t0));
    const h = [
      ...soloGames("p1", 2),
      ...soloGames("p2", 2),
      ...soloGames("p3", 2),
      ...soloGames("p4", 3),
      ...soloGames("p5", 2),
      ...soloGames("p6", 2),
      ...soloGames("p8", 2),
    ];
    const d = decide(input("balanced", line, h)) as Teams;
    const picked = [...d.teamA, ...d.teamB].sort();
    expect(picked).toContain("p1");
    expect(picked).toEqual(["p1", "p2", "p3", "p7"]);
  });

  it("balanced does NOT let a brand-new late arrival jump ahead of on-time peers", () => {
    const line = [
      entryAt("p1", 3, t0),
      entryAt("p2", 3, t0),
      entryAt("p3", 3, t0),
      entryAt("p4", 3, t0),
      entryAt("late", 3, tLate),
    ];
    const h = [
      ...soloGames("p1", 2),
      ...soloGames("p2", 2),
      ...soloGames("p3", 2),
      ...soloGames("p4", 2),
    ];
    const d = decide(input("balanced", line, h)) as Teams;
    expect([...d.teamA, ...d.teamB].sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("balanced still respects a large rating gap (>= 0.5) and locked pairs over a fairness deficit", () => {
    // Rating gap >= 0.5 (team gap 0.5 when p5 = 4.0 vs 3.0 peers; also 0.5 player gap at 3.5 for 1-game deficit)
    const lineWithStronger = [
      entryAt("p1", 3, t0),
      entryAt("p2", 3, t0),
      entryAt("p3", 3, t0),
      entryAt("p4", 3, t0),
      entryAt("p5", 4, t0),
      entryAt("p6", 3, t0),
      entryAt("p7", 3, t0),
      entryAt("p8", 3, t0),
    ];
    const hGap = [
      ...soloGames("p1", 2),
      ...soloGames("p2", 2),
      ...soloGames("p3", 2),
      ...soloGames("p4", 2),
      ...soloGames("p6", 2),
      ...soloGames("p7", 2),
      ...soloGames("p8", 2),
    ];
    const dGap = decide(input("balanced", lineWithStronger, hGap)) as Teams;
    expect([...dGap.teamA, ...dGap.teamB].sort()).toEqual(["p1", "p2", "p3", "p4"]);

    const lineHalfGap = lineWithStronger.map((x) => (x.playerId === "p5" ? entryAt("p5", 3.5, t0) : x));
    const hOneGameDeficit = [...hGap, ...soloGames("p5", 1)];
    const dHalfGap = decide(input("balanced", lineHalfGap, hOneGameDeficit)) as Teams;
    expect([...dHalfGap.teamA, ...dHalfGap.teamB].sort()).toEqual(["p1", "p2", "p3", "p4"]);

    // Locked pair: p1 + p2 share pairId "g" even though p2 played 3 games and p5 played 0
    const linePaired = [
      entryAt("p1", 3, t0, "g"),
      entryAt("p2", 3, t0, "g"),
      entryAt("p3", 3, t0),
      entryAt("p4", 3, t0),
      entryAt("p5", 3, t0),
    ];
    const hPair = [...soloGames("p1", 2), ...soloGames("p2", 3), ...soloGames("p3", 2), ...soloGames("p4", 2)];
    const dPair = decide(input("balanced", linePaired, hPair)) as Teams;
    const teamWithP1 = dPair.teamA.includes("p1") ? dPair.teamA : dPair.teamB;
    expect(teamWithP1).toContain("p2");
  });

  it("social_mixer, mixed_doubles, and club_wars also favor under-played peers within the top 8", () => {
    const line = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].map((id) => entryAt(id, 3, t0));
    const h = [
      ...soloGames("p1", 2),
      ...soloGames("p2", 2),
      ...soloGames("p3", 2),
      ...soloGames("p4", 3),
      ...soloGames("p5", 2),
      ...soloGames("p6", 2),
      ...soloGames("p8", 2),
    ];
    for (const style of ["social_mixer", "mixed_doubles", "club_wars"] as const) {
      const d = decide(input(style, line, h)) as Teams;
      expect([...d.teamA, ...d.teamB].sort()).toEqual(["p1", "p2", "p3", "p7"]);
    }
  });

  it("fifo, winners_stay, winners_losers, and king_queen remain unaffected by gamesAhead", () => {
    const line = ["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => entryAt(id, 3, t0));
    const hHeavy4 = [
      ...soloGames("p1", 1),
      ...soloGames("p2", 1),
      ...soloGames("p3", 1),
      ...soloGames("p4", 3),
      ...soloGames("p5", 1),
    ];

    expect(decide(input("fifo", line, hHeavy4))).toEqual({ teamA: ["p1", "p2"], teamB: ["p3", "p4"] });

    // winners_stay (both winners-waiting and fallback paths)
    const wsLine = [entryAt("w1", 3, t0), entryAt("w2", 3, t0), ...line.slice(2)];
    const wsHistory = [
      ...soloGames("p3", 3),
      ...soloGames("p4", 3),
      game(["w1", "w2"], ["x1", "x2"], "A", "c1"),
    ];
    const wsWinners = decide(input("winners_stay", wsLine, wsHistory)) as Teams;
    expect([...wsWinners.teamA, ...wsWinners.teamB].sort()).toEqual(["p3", "p4", "w1", "w2"]);
    const wsFallback = decide(input("winners_stay", line, hHeavy4)) as Teams;
    expect([...wsFallback.teamA, ...wsFallback.teamB].sort()).toEqual(["p1", "p2", "p3", "p4"]);

    // winners_losers: p1..p5 all won their last game, p4 played 3 vs p5 played 1
    const wlDecision = decide(input("winners_losers", line, hHeavy4)) as Teams;
    expect([...wlDecision.teamA, ...wlDecision.teamB].sort()).toEqual(["p1", "p2", "p3", "p4"]);

    // king_queen: 1 placed side (picks p2 over under-played p3) and 0 placed sides (picks p1..p4)
    const kqLine1 = [entryAt("a", 3, t0), entryAt("b", 3, t0), ...line];
    const kqHistory1 = [
      ...soloGames("p2", 3),
      game(["a", "b"], ["z1", "z2"], "A", "c2"),
    ];
    const kqOneSide = decide({ ...input("king_queen", kqLine1, kqHistory1), courts: ["c1", "c2"], court: "c1" }) as Teams;
    expect(kqOneSide.teamA).toEqual(["a", "b"]);
    expect([...kqOneSide.teamB].sort()).toEqual(["p1", "p2"]);

    const kqZeroSides = decide({ ...input("king_queen", line, hHeavy4), courts: ["c1", "c2"], court: "c1" }) as Teams;
    expect([...kqZeroSides.teamA, ...kqZeroSides.teamB].sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("2-court / 16-player / 20-game Balhai CrossCourt simulation keeps spread <= 1 with fair late arrivals and no starvation", () => {
    const startMs = Date.UTC(2026, 10, 18, 12, 0, 0);
    const tStart = new Date(startMs).toISOString();
    const ratings = [3.0, 3.25, 3.5, 3.25];
    const onTimeIds = Array.from({ length: 12 }, (_, i) => `on${i + 1}`);
    const lateIds = Array.from({ length: 4 }, (_, i) => `late${i + 1}`);

    const entries = new Map<string, LineEntry>();
    onTimeIds.forEach((id, i) => entries.set(id, entryAt(id, ratings[i % ratings.length], tStart)));

    const line: LineEntry[] = onTimeIds.map((id) => entries.get(id)!);
    const history: PastGame[] = [];

    type ActiveCourt = { courtId: string; durationMin: number; endsAtMs: number; teams: Teams };
    const courts = [
      { courtId: "c1", durationMin: 6 },
      { courtId: "c2", durationMin: 14 },
    ];
    const active = new Map<string, ActiveCourt>();
    let lateAdded = false;

    const fillCourt = (courtId: string, durationMin: number, nowMs: number) => {
      if (line.length < 4) return;
      const headId = line[0].playerId;
      const d = decide({
        style: "balanced",
        line: [...line],
        history: [...history],
        court: courtId,
        courts: ["c1", "c2"],
        settings: { skillSpread: 0.75 },
        random: () => 0.5,
      });
      expect("teamA" in d).toBe(true);
      const teams = d as Teams;
      const playing = [...teams.teamA, ...teams.teamB];
      expect(playing).toContain(headId);
      const playingSet = new Set(playing);
      for (let i = line.length - 1; i >= 0; i--) {
        if (playingSet.has(line[i].playerId)) line.splice(i, 1);
      }
      active.set(courtId, { courtId, durationMin, endsAtMs: nowMs + durationMin * 60_000, teams });
    };

    fillCourt("c1", 6, startMs);
    fillCourt("c2", 14, startMs);

    while (history.length < 20) {
      const next = [...active.values()].sort((a, b) => a.endsAtMs - b.endsAtMs)[0];
      active.delete(next.courtId);
      history.push({
        courtId: next.courtId,
        teamA: [...next.teams.teamA],
        teamB: [...next.teams.teamB],
        winner: "A",
        endedAt: new Date(next.endsAtMs).toISOString(),
      });
      for (const id of [...next.teams.teamA, ...next.teams.teamB]) {
        line.push(entries.get(id)!);
      }
      if (!lateAdded && history.length === 6) {
        lateAdded = true;
        const tJoin = new Date(next.endsAtMs).toISOString();
        lateIds.forEach((id, i) => {
          const entry = entryAt(id, ratings[i % ratings.length], tJoin);
          entries.set(id, entry);
          line.push(entry);
        });
      }
      if (history.length < 20) {
        for (const c of courts) {
          if (!active.has(c.courtId)) fillCourt(c.courtId, c.durationMin, next.endsAtMs);
        }
      }
    }

    const counts = gamesPlayedCounts(history);
    const onTimeCounts = onTimeIds.map((id) => counts.get(id) ?? 0);
    const lateCounts = lateIds.map((id) => counts.get(id) ?? 0);
    const minOnTime = Math.min(...onTimeCounts);
    const maxOnTime = Math.max(...onTimeCounts);
    expect(maxOnTime - minOnTime).toBeLessThanOrEqual(1);
    expect(Math.max(...lateCounts)).toBeLessThanOrEqual(minOnTime);
  });
});
