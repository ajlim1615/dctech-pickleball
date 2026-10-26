import { describe, it, expect } from "vitest";
import { decide } from "./index";
import type { LineEntry, PastGame, Teams } from "./types";
import { e, ids, game, input } from "./testHelpers";

const kq = (line: LineEntry[], history: PastGame[]) => ({ ...input("king_queen", line, history), courts: ["c1", "c2", "c3"] });
const players = (t: Teams) => [...t.teamA, ...t.teamB];

describe("king/queen", () => {
  it("Court 2 winners are reserved for Court 1 and skipped by other courts", () => {
    const h = [game(["a", "b"], ["x", "y"], "A", "c2")];
    const line = [e("a"), e("b"), ...ids(6)];
    const c1 = decide({ ...kq(line, h), court: "c1" }) as Teams;
    expect(c1.teamA).toEqual(["a", "b"]);
    const c3 = decide({ ...kq(line, h), court: "c3" }) as Teams;
    expect(c3).toHaveProperty("teamA");
    expect(players(c3)).not.toContain("a");
    expect(players(c3)).not.toContain("b");
  });

  it("Court 1 champions stay and face the promoted pair", () => {
    const h = [game(["k1", "k2"], ["x", "y"], "A", "c1"), game(["a", "b"], ["z", "w"], "A", "c2")];
    expect(decide({ ...kq([e("a"), e("b"), e("k1"), e("k2"), ...ids(2)], h), court: "c1" })).toEqual({
      teamA: ["k1", "k2"],
      teamB: ["a", "b"],
    });
  });

  it("two placed sides need no line players at all", () => {
    const h = [game(["k1", "k2"], ["x", "y"], "A", "c1"), game(["a", "b"], ["z", "w"], "A", "c2")];
    expect(decide({ ...kq([e("a"), e("b"), e("k1"), e("k2")], h), court: "c1" })).toEqual({
      teamA: ["k1", "k2"],
      teamB: ["a", "b"],
    });
  });

  it("one placed side needs only two from the line, otherwise holds", () => {
    const h = [game(["a", "b"], ["x", "y"], "A", "c2")];
    const two = decide({ ...kq([e("a"), e("b"), e("p1"), e("p2")], h), court: "c1" }) as Teams;
    expect(two.teamA).toEqual(["a", "b"]);
    expect([...two.teamB].sort()).toEqual(["p1", "p2"]);
    expect(decide({ ...kq([e("a"), e("b"), e("p1")], h), court: "c1" })).toEqual({ hold: "not_enough_players", needed: 1 });
  });

  it("a pair that has played since is no longer promoted", () => {
    const h = [game(["a", "b"], ["x", "y"], "A", "c2"), game(["a", "q"], ["r", "s"], "B", "c3")];
    const d = decide({ ...kq([e("b"), ...ids(5), e("a")], h), court: "c1" }) as Teams;
    expect(d).toHaveProperty("teamA");
    expect(d.teamA).not.toEqual(["a", "b"]);
  });

  it("promotion cancels when a partner is not in line (on break)", () => {
    const h = [game(["a", "b"], ["x", "y"], "A", "c2")];
    const d = decide({ ...kq([e("a"), ...ids(5)], h), court: "c1" }) as Teams;
    expect(d).toHaveProperty("teamA");
    expect(players(d)).toContain("a");
    expect(d.teamA).not.toEqual(["a", "b"]);
  });

  it("a closed court promotes nobody, and targets shift", () => {
    const h = [game(["a", "b"], ["x", "y"], "A", "c3")];
    const line = [e("a"), e("b"), ...ids(6)];
    expect((decide({ ...kq(line, h), courts: ["c1", "c3"], court: "c1" }) as Teams).teamA).toEqual(["a", "b"]);
    const d = decide({ ...kq(line, h), courts: ["c1", "c2"], court: "c1" }) as Teams;
    expect(d).toHaveProperty("teamA");
    expect(d.teamA).not.toEqual(["a", "b"]);
  });

  it("a game without a winner promotes nobody", () => {
    const h = [game(["a", "b"], ["x", "y"], null, "c2")];
    const d = decide({ ...kq([e("a"), e("b"), ...ids(4)], h), court: "c1" }) as Teams;
    expect(d).toHaveProperty("teamA");
    expect(d.teamA).not.toEqual(["a", "b"]);
  });

  it("a locked pair fills the opponent side together", () => {
    const h = [game(["a", "b"], ["x", "y"], "A", "c2")];
    const line = [e("a"), e("b"), e("l1", 3, "L"), e("p1"), e("p2"), e("l2", 3, "L")];
    const d = decide({ ...kq(line, h), court: "c1" }) as Teams;
    expect(d.teamB.slice().sort()).toEqual(["l1", "l2"]);
  });
});

describe("winners_stay (legacy)", () => {
  it("keeps the court's winners and splits them", () => {
    const h = [game(["A", "B"], ["x", "y"], "A", "c1")];
    const d = decide(input("winners_stay", [e("c1p", 3), e("c2p", 4), e("A", 4), e("B", 3.5)], h)) as Teams;
    const winners = new Set(["A", "B"]);
    expect(d.teamA.filter((id) => winners.has(id))).toHaveLength(1);
    expect(d.teamB.filter((id) => winners.has(id))).toHaveLength(1);
    expect(players(d).sort()).toEqual(["A", "B", "c1p", "c2p"]);
  });

  it("the stronger winner gets the weaker challenger", () => {
    const h = [game(["A", "B"], ["x", "y"], "A", "c1")];
    const d = decide(input("winners_stay", [e("c1p", 3), e("c2p", 4), e("A", 4), e("B", 3.5)], h)) as Teams;
    expect(d).toEqual({ teamA: ["A", "c1p"], teamB: ["B", "c2p"] });
  });

  it("holds when too few challengers wait", () => {
    const h = [game(["A", "B"], ["x", "y"], "A", "c1")];
    expect(decide(input("winners_stay", [e("A"), e("B"), e("p1")], h))).toEqual({ hold: "not_enough_players", needed: 1 });
  });

  it("falls back to strongest+weakest vs middle two when winners are not both waiting", () => {
    const line = [e("a", 5), e("b", 3), e("c", 3), e("d", 1)];
    const d = decide(input("winners_stay", line, [game(["z", "y"], ["x", "w"], "A", "c1")])) as Teams;
    const t = [d.teamA.slice().sort(), d.teamB.slice().sort()].map((x) => x.join()).sort();
    expect(t).toEqual(["a,d", "b,c"]);
  });
});
