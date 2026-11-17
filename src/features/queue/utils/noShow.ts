/** How long after a game starts a no-show can still be swapped out. Passed to swap_match_player. */
export const NO_SHOW_WINDOW_MINUTES = 5;

/**
 * A called player can only be swapped out before anyone has scored, and only in the
 * first few minutes (court cards don't always save points as they happen). The court
 * card uses this to show the swap button; swap_match_player enforces the same rule.
 */
export function canSwapNoShow(
  scoreA: number,
  scoreB: number,
  startedAt?: string | null,
  now: Date = new Date()
): boolean {
  if (scoreA !== 0 || scoreB !== 0) return false;
  if (!startedAt) return true;
  return now.getTime() - new Date(startedAt).getTime() < NO_SHOW_WINDOW_MINUTES * 60_000;
}
