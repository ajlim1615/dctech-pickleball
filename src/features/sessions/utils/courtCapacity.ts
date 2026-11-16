/** Doubles: four players on each court. */
export const PLAYERS_PER_COURT = 4;

export interface CourtCapacity {
  /** Players on court at once. */
  playing: number;
  /** Players sitting out each round. */
  waiting: number;
  /** Empty spots left before anyone has to wait. */
  openSpots: number;
  /** Filled spots per court, in court order (0–4 each). */
  perCourt: number[];
}

/** How a session's courts fill up with the people going. */
export function courtCapacity(courts: number, going: number): CourtCapacity {
  const spots = Math.max(0, courts) * PLAYERS_PER_COURT;
  const people = Math.max(0, going);
  const playing = Math.min(people, spots);
  const perCourt = Array.from({ length: Math.max(0, courts) }, (_, i) =>
    Math.max(0, Math.min(PLAYERS_PER_COURT, playing - i * PLAYERS_PER_COURT))
  );
  return { playing, waiting: Math.max(0, people - spots), openSpots: spots - playing, perCourt };
}
