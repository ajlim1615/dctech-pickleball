import { isGuestProfile } from "@/features/admin/utils/playerDirectory";

/**
 * The one rule for guests (non-employees): they can play casual sessions only.
 * Ranked sessions are for DCTECH employees, so ratings and rankings stay fair.
 * Every way into a session (RSVP, check-in, joining the line, a partner, bulk
 * add, the starting line, switching a session to ranked) checks it here.
 */
export const GUEST_RANKED_MESSAGE = "Guests can only play in casual sessions. Ranked sessions are for DCTECH employees.";

type MaybeGuest = { is_guest?: boolean | null; email?: string | null };

export function canEnterSession(player: MaybeGuest, isRanked: boolean): boolean {
  return !isRanked || !isGuestProfile(player);
}

/** The players in a list who can't enter this session. */
export function blockedFromSession<T extends MaybeGuest>(players: T[], isRanked: boolean): T[] {
  return players.filter((p) => !canEnterSession(p, isRanked));
}
