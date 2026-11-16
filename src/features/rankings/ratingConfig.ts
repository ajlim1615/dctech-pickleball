/**
 * The single source of truth for rating rules. No other TypeScript file should
 * hard-code these numbers; database functions receive this object as a parameter.
 */
export const RATING_RULES = {
  version: 2,
  start: 2.0,
  min: 1.5,
  max: 6.0,
  /** Base change for a single game between evenly matched teams. */
  baseK: 0.1,
  /** Rating gap that makes the stronger team ~91% favourite (Elo's 400 points, rescaled). */
  scale: 1.0,
  /** A blowout adds at most this much on top of the base change. */
  maxMarginBonus: 0.5,
  /** Players with fewer games than `beforeGames` move by `multiplier` (first match wins). */
  newPlayerSchedule: [
    { beforeGames: 5, multiplier: 2 },
    { beforeGames: 15, multiplier: 1.5 },
  ],
  /** Games needed to appear on the rankings. */
  qualifyGames: 5,
};

export type RatingRules = typeof RATING_RULES;
