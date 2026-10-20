import { formatMatchScore } from "@/features/matches/utils/scoring";
import type { SessionEvent } from "@/types";

type Details = Record<string, unknown>;

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * One line of feed text for an event. Players see "An admin" for admin actions;
 * pass `actor_name` (admin audit) to name them. The viewer is called "you".
 */
export function describeEvent(
  event: SessionEvent & { actor_name?: string | null },
  names: Record<string, string>,
  viewerId?: string
): string {
  const d = (event.details ?? {}) as Details;
  const who = (id: unknown) =>
    typeof id === "string" && id === viewerId ? "you" : (typeof id === "string" && names[id]) || "A player";
  const subject = who(event.subject_ids[0]);
  const actor = event.actor_role === "admin" ? event.actor_name || "An admin" : subject;
  const court = typeof d.courtName === "string" && d.courtName ? d.courtName : null;
  const team = (ids: unknown) => (Array.isArray(ids) ? ids.map(who).join(" & ") : "");
  const score = (s: unknown) => {
    const v = (s ?? {}) as { a?: number; b?: number };
    return formatMatchScore(v.a, v.b).replace(/ /g, "");
  };
  const byAdmin = event.actor_role === "admin";

  const text = ((): string => {
    switch (event.type) {
      case "session_started":
        return "The session started";
      case "session_ended":
        return "The session ended";
      case "checked_in":
        return byAdmin ? `${actor} checked in ${subject}` : `${subject} checked in`;
      case "checked_out":
        return byAdmin ? `${actor} checked out ${subject}` : `${subject} checked out`;
      case "joined_queue": {
        const partner = typeof d.partnerId === "string" ? who(d.partnerId) : null;
        const guest = typeof d.guestName === "string" && d.guestName ? `guest ${d.guestName}` : null;
        const withWhom = partner || guest;
        return `${subject} joined the queue${withWhom ? ` with ${withWhom}` : ""}`;
      }
      case "left_queue":
        return `${subject} left the queue`;
      case "players_added": {
        const count = Number(d.count ?? event.subject_ids.length);
        return `${actor} added ${count} ${count === 1 ? "player" : "players"} to the queue`;
      }
      case "break_started":
        return byAdmin ? `${actor} put ${subject} on a break` : `${subject} took a break`;
      case "break_ended":
        return `${subject} ${subject === "you" ? "are" : "is"} back from a break`;
      case "moved_in_queue": {
        const positions = Number(d.positions ?? 0);
        const n = Math.abs(positions);
        return `${actor} moved ${subject} ${positions < 0 ? "back" : "up"} ${n} ${n === 1 ? "place" : "places"}`;
      }
      case "removed_from_queue":
        return `${actor} removed ${subject} from the queue${d.checkedOut ? " and checked them out" : ""}`;
      case "players_swapped":
        return d.kind === "substitute"
          ? `${actor} put ${who(d.in)} in place of ${who(d.out)}`
          : `${actor} swapped ${who(event.subject_ids[0])} and ${who(event.subject_ids[1])} in line`;
      case "game_started":
        return `${court ?? "A court"}: ${team(d.teamA)} vs ${team(d.teamB)}`;
      case "game_result":
        return `${court ?? "A game"} finished ${score({ a: d.scoreA, b: d.scoreB })}`;
      case "result_corrected":
        return `${actor} corrected a result${court ? ` on ${court}` : ""} from ${score(d.from)} to ${score(d.to)}`;
      case "no_show_swapped":
        return `${capitalize(who(d.out))} didn't show${court ? ` on ${court}` : ""}; ${who(d.in)} took the spot`;
      case "court_closed":
        return `${actor} closed ${court ?? "a court"}`;
      case "court_reopened":
        return `${actor} reopened ${court ?? "a court"}`;
      default:
        return "Something changed";
    }
  })();

  return capitalize(text);
}
