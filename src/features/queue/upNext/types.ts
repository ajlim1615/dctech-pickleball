/** A planned match ("Up Next card"), as the screens use it. */
export type UpNextCard = {
  id: string;
  position: number;
  perSide: 1 | 2;
  /** Set for court-bound styles (King/Queen): the card only starts on this court. */
  targetCourtId: string | null;
  /** true = built by matchmaking; false = edited by an admin and kept as is. */
  isAuto: boolean;
  /** Player ids in slot order. */
  teamA: string[];
  teamB: string[];
};

export type UpNextCardRow = {
  id: string;
  position: number;
  per_side: number;
  target_court_id: string | null;
  is_auto: boolean;
};

export type UpNextPlayerRow = {
  card_id: string;
  player_id: string;
  team: "team_a" | "team_b";
  slot: number;
};

/** Joins card rows and player rows into cards, in position order. */
export function toUpNextCards(cards: UpNextCardRow[], players: UpNextPlayerRow[]): UpNextCard[] {
  const bySlot = [...players].sort((a, b) => a.slot - b.slot);
  return [...cards]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      position: c.position,
      perSide: c.per_side === 1 ? 1 : 2,
      targetCourtId: c.target_court_id,
      isAuto: c.is_auto,
      teamA: bySlot.filter((p) => p.card_id === c.id && p.team === "team_a").map((p) => p.player_id),
      teamB: bySlot.filter((p) => p.card_id === c.id && p.team === "team_b").map((p) => p.player_id),
    }));
}

/** True when the built cards match the saved auto cards exactly (same teams, same courts, same order). */
export function sameAutoCards(
  saved: UpNextCard[],
  built: { teamA: string[]; teamB: string[]; targetCourtId: string | null }[]
): boolean {
  const auto = saved.filter((c) => c.isAuto);
  if (auto.length !== built.length) return false;
  return auto.every(
    (c, i) =>
      c.targetCourtId === built[i].targetCourtId &&
      c.teamA.join() === built[i].teamA.join() &&
      c.teamB.join() === built[i].teamB.join()
  );
}
