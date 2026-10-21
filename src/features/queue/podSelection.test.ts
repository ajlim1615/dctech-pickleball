import { describe, it, expect } from "vitest";
import { selectPod, buildTeams, type PodEntry } from "./utils/podSelection";
import type { MatchPlayer } from "./utils/matchingEngine";

function entry(id: string, skill = 3.0, group: string | null = null): PodEntry<MatchPlayer> {
  return { id: `e-${id}`, player_id: id, group_id: group, player: { id, skill_rating: skill } };
}

function ids(entries: PodEntry<MatchPlayer>[]) {
  return entries.map((e) => e.player_id);
}

describe("selectPod", () => {
  it("fifo takes first four", () => {
    const waiting = ["w1", "w2", "w3", "w4", "w5", "w6"].map((id) => entry(id));
    const pod = selectPod(waiting, "fifo", []);
    if ("error" in pod) throw new Error(pod.error);
    expect(ids(pod.challengers)).toEqual(["w1", "w2", "w3", "w4"]);
    expect(pod.stayingWinners).toEqual([]);
  });

  it("winners_stay keeps both previous winners and calls two challengers", () => {
    const waiting = ["w1", "w2", "A", "B", "w3"].map((id) => entry(id));
    const pod = selectPod(waiting, "winners_stay", ["A", "B"]);
    if ("error" in pod) throw new Error(pod.error);
    expect(ids(pod.challengers)).toEqual(["w1", "w2"]);
    expect(ids(pod.stayingWinners)).toEqual(["A", "B"]);
  });

  it("winners_stay falls back to four when a winner left", () => {
    const waiting = ["w1", "w2", "A", "w3", "w4"].map((id) => entry(id));
    const pod = selectPod(waiting, "winners_stay", ["A", "B"]);
    if ("error" in pod) throw new Error(pod.error);
    expect(pod.challengers).toHaveLength(4);
    expect(pod.stayingWinners).toEqual([]);
  });

  it("skill_separated anchors first in line and picks closest skill", () => {
    const waiting = [
      entry("anchor", 4.0),
      entry("a", 2.0),
      entry("b", 3.9),
      entry("c", 4.1),
      entry("d", 2.5),
      entry("e", 4.0),
    ];
    const pod = selectPod(waiting, "skill_separated", []);
    if ("error" in pod) throw new Error(pod.error);
    expect(ids(pod.challengers)[0]).toBe("anchor");
    expect(ids(pod.challengers).slice(1).sort()).toEqual(["b", "c", "e"]);
  });

  it("keeps a bonded pair together", () => {
    const waiting = [entry("s1"), entry("s2"), entry("s3"), entry("p1", 3, "g"), entry("s4"), entry("p2", 3, "g")];
    const pod = selectPod(waiting, "fifo", []);
    if ("error" in pod) throw new Error(pod.error);
    expect(ids(pod.challengers)).toEqual(["p2", "s2", "s3", "p1"]);
  });

  it("reports shortage", () => {
    const pod = selectPod(["a", "b", "c"].map((id) => entry(id)), "balanced", []);
    expect(pod).toMatchObject({ needed: 4, available: 3 });
    expect("error" in pod).toBe(true);
  });
});

describe("buildTeams", () => {
  it("puts a bonded pair on one team", () => {
    const pod = [entry("a", 4.5), entry("p1", 3, "g"), entry("b", 2.5), entry("p2", 3, "g")];
    const teams = buildTeams(pod, [], "balanced");
    expect(teams.teamA.sort()).toEqual(["p1", "p2"]);
    expect(teams.teamB.sort()).toEqual(["a", "b"]);
  });

  it("splits staying winners", () => {
    const teams = buildTeams([entry("c1", 3), entry("c2", 4)], [entry("A", 4), entry("B", 3.5)], "winners_stay");
    const winners = new Set(["A", "B"]);
    expect(teams.teamA.filter((id) => winners.has(id))).toHaveLength(1);
    expect(teams.teamB.filter((id) => winners.has(id))).toHaveLength(1);
  });
});
