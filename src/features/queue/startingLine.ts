/**
 * The starting line for a session that is going live.
 *
 * Everyone who said "I'm going" (plus anyone already pre-queued) is shuffled
 * into the line, so nobody gets a head start by tapping first. Players who
 * joined as a pair (same group_id) stay together as one unit. After this the
 * session's matching mode decides who plays from the line as usual, and
 * players who join later go to the back.
 */

export interface ExistingEntry {
  id: string;
  player_id: string;
  group_id: string | null;
}

export interface StartingLinePlan {
  /** Existing queue entries, with their new place in line. */
  reorder: { id: string; joinedAt: string }[];
  /** "I'm going" players not in the queue yet, with their place in line. */
  add: { playerId: string; joinedAt: string }[];
}

type Unit = { kind: "existing"; entries: ExistingEntry[] } | { kind: "new"; playerId: string };

/** Fisher-Yates shuffle; `random` returns [0, 1). */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function planStartingLine(params: {
  goingPlayerIds: string[];
  existing: ExistingEntry[];
  now: Date;
  random?: () => number;
}): StartingLinePlan {
  const { goingPlayerIds, existing, now, random = Math.random } = params;

  // Group existing entries: a pair (shared group_id) moves as one unit.
  const units: Unit[] = [];
  const byGroup = new Map<string, ExistingEntry[]>();
  const queued = new Set<string>();
  for (const entry of existing) {
    queued.add(entry.player_id);
    if (entry.group_id) {
      const group = byGroup.get(entry.group_id);
      if (group) {
        group.push(entry);
        continue;
      }
      const fresh = [entry];
      byGroup.set(entry.group_id, fresh);
      units.push({ kind: "existing", entries: fresh });
    } else {
      units.push({ kind: "existing", entries: [entry] });
    }
  }

  for (const playerId of new Set(goingPlayerIds)) {
    if (!queued.has(playerId)) units.push({ kind: "new", playerId });
  }

  // Place everyone just before `now`, one second apart, so anyone joining
  // after the start lands behind the shuffled line.
  const shuffled = shuffle(units, random);
  const base = now.getTime() - (shuffled.length + 1) * 1000;
  const plan: StartingLinePlan = { reorder: [], add: [] };
  shuffled.forEach((unit, i) => {
    const slot = base + i * 1000;
    if (unit.kind === "new") {
      plan.add.push({ playerId: unit.playerId, joinedAt: new Date(slot).toISOString() });
    } else {
      // Partners keep their own order, a few milliseconds apart.
      unit.entries.forEach((entry, k) => {
        plan.reorder.push({ id: entry.id, joinedAt: new Date(slot + k).toISOString() });
      });
    }
  });
  return plan;
}
