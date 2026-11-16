/**
 * Per-session limits that stop players gaming the line. Counted from the player's own
 * actions only ("self" session events); anything an admin does never uses them up.
 */

/** Breaks a player may take themselves per session. */
export const BREAKS_PER_SESSION = 1;
/** Times a player may come back into the line after leaving it themselves. */
export const REJOINS_PER_SESSION = 1;

export const BREAK_USED_MESSAGE = "You've used your break for this session.";
export const REJOIN_USED_MESSAGE =
  "You've already left and rejoined once this session. Ask an admin to add you back.";

export interface QueueLimits {
  /** Breaks the player took themselves this session. */
  breaksTaken: number;
  /** Times the player took themselves out of the line (Leave or check out). */
  timesLeft: number;
}

export const NO_LIMITS_USED: QueueLimits = { breaksTaken: 0, timesLeft: 0 };

export function canTakeBreak(limits: QueueLimits): boolean {
  return limits.breaksTaken < BREAKS_PER_SESSION;
}

/**
 * Coming back after leaving uses a rejoin. The first leave can always be undone once;
 * after leaving more times than that, only an admin can put the player back.
 */
export function canRejoin(limits: QueueLimits): boolean {
  return limits.timesLeft <= REJOINS_PER_SESSION;
}

/** Leaving now would be for good: the player has no rejoin left after it. */
export function leaveIsFinal(limits: QueueLimits): boolean {
  return limits.timesLeft >= REJOINS_PER_SESSION;
}
