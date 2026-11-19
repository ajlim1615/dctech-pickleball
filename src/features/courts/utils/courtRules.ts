import type { UpNextCard } from "@/features/queue/upNext/types";

type Team = "team_a" | "team_b";

/**
 * Which Up Next card a free court shows. A card bound to this court comes first.
 * Otherwise unbound cards go to free courts in order, skipping courts that have
 * their own bound card.
 */
export function cardForFreeCourt(courtId: string, freeCourtIds: string[], cards: UpNextCard[]): UpNextCard | null {
  const ordered = cards.toSorted((a, b) => a.position - b.position);
  const bound = ordered.find((c) => c.targetCourtId === courtId);
  if (bound) return bound;

  // An incomplete card (an admin is still filling it) never holds up the full ones.
  const unbound = ordered.filter((c) => c.targetCourtId === null && isFull(c));
  const courtsUsingUnbound = freeCourtIds.filter((id) => !ordered.some((c) => c.targetCourtId === id));
  const k = courtsUsingUnbound.indexOf(courtId);
  return k >= 0 ? unbound[k] ?? null : null;
}

/** A result can only be saved with both teams full. */
export function canSaveResult(teamA: string[], teamB: string[], perSide: 1 | 2): boolean {
  return teamA.length === perSide && teamB.length === perSide;
}

function isFull(card: UpNextCard) {
  return card.teamA.length === card.perSide && card.teamB.length === card.perSide;
}

/** Send to Court is possible when the card is full and its court (or any court, if unbound) is free. */
export function canSendCard(card: UpNextCard, freeCourtIds: string[]): boolean {
  if (!isFull(card)) return false;
  return card.targetCourtId ? freeCourtIds.includes(card.targetCourtId) : freeCourtIds.length > 0;
}

export type ChooseSlotsState = { teamA: string[]; teamB: string[]; active: Team; perSide: 1 | 2 };
export type ChooseSlotsAction = { type: "pick" | "clear"; playerId: string };

/**
 * Choose Players: a pick fills the active team's next slot, then moves to the other
 * team if it has room. Clearing a player makes their team active again.
 */
export function chooseSlotsReducer(state: ChooseSlotsState, action: ChooseSlotsAction): ChooseSlotsState {
  const key = (team: Team) => (team === "team_a" ? "teamA" : "teamB");
  const other = (team: Team): Team => (team === "team_a" ? "team_b" : "team_a");

  if (action.type === "clear") {
    const team: Team | null = state.teamA.includes(action.playerId)
      ? "team_a"
      : state.teamB.includes(action.playerId)
        ? "team_b"
        : null;
    if (!team) return state;
    return { ...state, [key(team)]: state[key(team)].filter((id) => id !== action.playerId), active: team };
  }

  if (state.teamA.includes(action.playerId) || state.teamB.includes(action.playerId)) return state;
  const target: Team | null =
    state[key(state.active)].length < state.perSide
      ? state.active
      : state[key(other(state.active))].length < state.perSide
        ? other(state.active)
        : null;
  if (!target) return state;

  const next = { ...state, [key(target)]: [...state[key(target)], action.playerId] };
  const nextActive = next[key(target)].length < state.perSide ? target : other(target);
  return { ...next, active: next[key(nextActive)].length < state.perSide ? nextActive : target };
}
