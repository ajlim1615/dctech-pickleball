import { formatMatchScore, isResultOnlyScore } from "@/features/matches/utils/scoring";
import type { SessionEvent } from "@/types";

type Details = Record<string, unknown>;

export interface MatchTeams {
  teamA: string[];
  teamB: string[];
  gameNumber?: number;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Builds a match_id -> { teamA, teamB, gameNumber } lookup from events that carry team rosters. */
export function buildMatchTeams(
  events: SessionEvent[],
  initial?: Record<string, MatchTeams>
): Record<string, MatchTeams> {
  const map: Record<string, MatchTeams> = { ...(initial ?? {}) };
  const hasInitial = Boolean(initial && Object.keys(initial).length > 0);
  // Assign fallback game numbers from oldest to newest when no authoritative match list was passed.
  let nextNumber = 1;
  const chronological = events.toReversed();
  for (const e of chronological) {
    if (!e.match_id) continue;
    const d = (e.details ?? {}) as Details;
    if (e.type === "game_started" && !map[e.match_id]) {
      map[e.match_id] = {
        teamA: Array.isArray(d.teamA) ? d.teamA.filter((id): id is string => typeof id === "string") : [],
        teamB: Array.isArray(d.teamB) ? d.teamB.filter((id): id is string => typeof id === "string") : [],
        gameNumber: hasInitial ? undefined : nextNumber++,
      };
    } else if (!map[e.match_id] && Array.isArray(d.teamA) && Array.isArray(d.teamB)) {
      map[e.match_id] = {
        teamA: d.teamA.filter((id): id is string => typeof id === "string"),
        teamB: d.teamB.filter((id): id is string => typeof id === "string"),
      };
    }
  }
  return map;
}

function formatGameLocation(court: string | null, gameNumber?: number): string | null {
  if (gameNumber && court) return `Game ${gameNumber} @ ${court}`;
  if (gameNumber) return `Game ${gameNumber}`;
  return court;
}

function resolveTeams(
  d: Details,
  matchId: string | null | undefined,
  matchTeams?: Record<string, MatchTeams>
): MatchTeams | null {
  if (Array.isArray(d.teamA) && Array.isArray(d.teamB) && d.teamA.length > 0 && d.teamB.length > 0) {
    return {
      teamA: d.teamA.filter((id): id is string => typeof id === "string"),
      teamB: d.teamB.filter((id): id is string => typeof id === "string"),
    };
  }
  if (matchId && matchTeams?.[matchId]) {
    const found = matchTeams[matchId];
    if (found.teamA.length > 0 && found.teamB.length > 0) return found;
  }
  return null;
}

function formatNameList(ids: string[], who: (id: unknown) => string): string {
  if (ids.length === 0) return "";
  if (ids.length === 1) return who(ids[0]);
  if (ids.length === 2) return `${who(ids[0])} & ${who(ids[1])}`;
  if (ids.length === 3) return `${who(ids[0])}, ${who(ids[1])} & ${who(ids[2])}`;
  return `${who(ids[0])}, ${who(ids[1])} & ${ids.length - 2} others`;
}

/**
 * One line of feed text for an event. Players see "An admin" for admin actions;
 * pass `actor_name` (admin audit) to name them. The viewer is called "you".
 */
export function describeEvent(
  event: SessionEvent & { actor_name?: string | null },
  names: Record<string, string>,
  viewerId?: string,
  matchTeams?: Record<string, MatchTeams>,
  courtNames?: Record<string, string>
): string {
  const d = (event.details ?? {}) as Details;
  const who = (id: unknown) =>
    typeof id === "string" && id === viewerId ? "you" : (typeof id === "string" && names[id]) || "A player";
  const subject = who(event.subject_ids[0]);
  const actor = event.actor_role === "admin" ? event.actor_name || "An admin" : subject;
  const court =
    (event.court_id && courtNames?.[event.court_id]) ||
    (typeof d.courtName === "string" && d.courtName ? d.courtName : null);
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
        const ids = event.subject_ids.filter((id): id is string => typeof id === "string" && id.length > 0);
        if (ids.length > 0) {
          return `${actor} added ${formatNameList(ids, who)} to the queue`;
        }
        const count = Number(d.count ?? 0);
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
      case "game_started": {
        const gameLoc = formatGameLocation(court, event.match_id ? matchTeams?.[event.match_id]?.gameNumber : undefined);
        return `${gameLoc ?? "A court"} started: ${team(d.teamA)} vs ${team(d.teamB)}`;
      }
      case "game_result": {
        const a = Number(d.scoreA ?? 0);
        const b = Number(d.scoreB ?? 0);
        const resultOnly = isResultOnlyScore(a, b);
        const teams = resolveTeams(d, event.match_id, matchTeams);
        const gameLoc = formatGameLocation(court, event.match_id ? matchTeams?.[event.match_id]?.gameNumber : undefined);
        const aWon = d.winner === "team_a" || a > b;
        const bWon = d.winner === "team_b" || b > a;

        if (teams && (aWon || bWon)) {
          const winners = team(aWon ? teams.teamA : teams.teamB);
          const losers = team(aWon ? teams.teamB : teams.teamA);
          const scoreSuffix = resultOnly ? "" : ` (${aWon ? `${a}-${b}` : `${b}-${a}`})`;
          return `${gameLoc ?? "Match"}: ${winners} beat ${losers}${scoreSuffix}`;
        }
        if (teams) {
          return `${gameLoc ?? "Match"}: ${team(teams.teamA)} vs ${team(teams.teamB)} finished ${a}-${b}`;
        }
        return resultOnly
          ? `${gameLoc ?? "A game"} finished`
          : `${gameLoc ?? "A game"} finished ${score({ a: d.scoreA, b: d.scoreB })}`;
      }
      case "result_corrected": {
        const from = (d.from ?? {}) as { a?: number; b?: number };
        const to = (d.to ?? {}) as { a?: number; b?: number };
        const resultOnly = isResultOnlyScore(from.a, from.b) || isResultOnlyScore(to.a, to.b);
        const gameLoc = formatGameLocation(court, event.match_id ? matchTeams?.[event.match_id]?.gameNumber : undefined);
        if (resultOnly) {
          const teams = resolveTeams(d, event.match_id, matchTeams);
          const toA = Number(to.a ?? 0);
          const toB = Number(to.b ?? 0);
          if (teams && toA !== toB) {
            const winners = team(toA > toB ? teams.teamA : teams.teamB);
            return `${actor} corrected the result${gameLoc ? ` on ${gameLoc}` : ""}: ${winners} won`;
          }
          return `${actor} corrected the winner${gameLoc ? ` on ${gameLoc}` : ""}`;
        }
        return `${actor} corrected a result${gameLoc ? ` on ${gameLoc}` : ""} from ${score(d.from)} to ${score(d.to)}`;
      }
      case "no_show_swapped":
        return `${capitalize(who(d.out))} didn't show${court ? ` on ${court}` : ""}; ${who(d.in)} took the spot`;
      case "court_closed":
        return `${actor} closed ${court ?? "a court"}`;
      case "court_reopened":
        return `${actor} reopened ${court ?? "a court"}`;
      case "court_player_replaced":
        return `${actor} put ${who(d.in)} in for ${who(d.out)} on ${court ?? "a court"}`;
      case "court_player_removed":
        return `${actor} took ${who(d.out)} off ${court ?? "a court"}`;
      case "court_teams_switched":
        return `${actor} switched ${who(event.subject_ids[0])} and ${who(event.subject_ids[1])} on ${court ?? "a court"}`;
      case "court_slot_filled":
        return `${actor} added ${who(d.in)} to ${court ?? "a court"}`;
      case "court_change_undone":
        return `${actor} undid a change on ${court ?? "a court"}`;
      case "up_next_edited":
        return `${actor} changed Up Next`;
      default:
        return "Something changed";
    }
  })();

  return capitalize(text);
}
