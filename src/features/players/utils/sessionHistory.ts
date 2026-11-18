import { formatMatchScore, isResultOnlyScore } from "@/features/matches/utils/scoring";
import { formatMatchDuration } from "@/lib/duration";
import { formatPHTDate } from "@/lib/timezone";

export interface SessionPlacement {
  rank: number;
  totalPlayers: number;
  tied?: boolean;
}

export interface FormattedPlayerMatch {
  id: string;
  sessionId: string | null;
  sessionTitle: string;
  sessionStatus: string;
  result: "WIN" | "LOSS" | "TIE" | "LIVE";
  court: string;
  format: string;
  partner?: string;
  opponents?: string;
  date: string;
  score: string;
  duration: string | null;
  placement?: SessionPlacement | null;
}

export interface SessionMatchGroup {
  key: string;
  sessionId: string | null;
  sessionTitle: string;
  sessionStatus: string;
  date: string;
  wins: number;
  losses: number;
  ties: number;
  liveCount: number;
  placement: SessionPlacement | null;
  matches: FormattedPlayerMatch[];
}

/**
 * Shows just "W" / "L" for Result-Only games (1-0 / 0-1), and "11 - 7" for point-scored games.
 */
export function formatPlayerMatchScore(
  teamAScore?: number | null,
  teamBScore?: number | null,
  result?: FormattedPlayerMatch["result"]
): string {
  if (isResultOnlyScore(teamAScore, teamBScore)) {
    if (result === "WIN") return "W";
    if (result === "LOSS") return "L";
    if (result === "TIE") return "TIE";
    return "LIVE";
  }
  return formatMatchScore(teamAScore, teamBScore);
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatPlacementLabel(
  placement?: SessionPlacement | null,
  sessionStatus?: string
): string | null {
  if (!placement || placement.rank <= 0 || placement.totalPlayers <= 0) return null;
  const { rank, totalPlayers, tied } = placement;
  const prefix = tied ? "T-" : "";
  const rankText =
    rank <= 3
      ? `${rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"} ${prefix}${ordinal(rank)}`
      : `${prefix}#${rank}`;
  const base = `${rankText} of ${totalPlayers}`;
  return sessionStatus === "active" ? `Live · ${base}` : base;
}

export function groupMatchesBySession(matches: FormattedPlayerMatch[]): SessionMatchGroup[] {
  const groups = new Map<string, SessionMatchGroup>();

  for (const m of matches) {
    const key = m.sessionId || `title:${m.sessionTitle}:${m.date}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        sessionId: m.sessionId,
        sessionTitle: m.sessionTitle,
        sessionStatus: m.sessionStatus,
        date: m.date,
        wins: 0,
        losses: 0,
        ties: 0,
        liveCount: 0,
        placement: m.placement ?? null,
        matches: [],
      };
      groups.set(key, group);
    }
    group.matches.push(m);
    if (m.result === "WIN") group.wins += 1;
    else if (m.result === "LOSS") group.losses += 1;
    else if (m.result === "TIE") group.ties += 1;
    else if (m.result === "LIVE") group.liveCount += 1;
    if (!group.placement && m.placement) group.placement = m.placement;
  }

  return Array.from(groups.values());
}

export interface RawPlayerMatchRow {
  id?: string;
  team?: string;
  created_at?: string;
  sessionId?: string | null;
  sessionTitle?: string;
  sessionStatus?: string;
  sessionPlacement?: SessionPlacement | null;
  partner?: string;
  opponents?: string;
  result?: FormattedPlayerMatch["result"];
  score?: string;
  court?: { name?: string } | string | null;
  format?: string;
  status?: string;
  winning_team?: string | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  session_id?: string | null;
  match?: RawPlayerMatchRow;
}

/** Normalizes raw `getPlayerMatchHistory` rows into `FormattedPlayerMatch[]`. */
export function normalizePlayerMatches(matches: RawPlayerMatchRow[]): FormattedPlayerMatch[] {
  return matches.map((item) => {
    if (item.result && item.score) return item as FormattedPlayerMatch;

    const match = item.match || item;
    const playerTeam = item.team;
    let isWon = false;
    if (match.winning_team) {
      isWon = match.winning_team === playerTeam;
    } else if (match.team_a_score !== undefined && match.team_a_score !== null && match.team_b_score !== undefined && match.team_b_score !== null) {
      const winningSide =
        match.team_a_score > match.team_b_score
          ? "team_a"
          : match.team_b_score > match.team_a_score
          ? "team_b"
          : "tie";
      isWon = winningSide === playerTeam;
    }
    const isTie = match.winning_team === "tie";
    const isInProgress = match.status === "in_progress";

    const result: FormattedPlayerMatch["result"] = isInProgress ? "LIVE" : isTie ? "TIE" : isWon ? "WIN" : "LOSS";
    const courtName =
      typeof match.court === "object" && match.court !== null
        ? match.court.name || "Court"
        : typeof match.court === "string"
        ? match.court
        : "Court";
    const formatLabel = match.format === "doubles" ? "Doubles (2v2)" : "Singles (1v1)";
    const sessionId = item.sessionId ?? match.session_id ?? null;
    const sessionTitle = item.sessionTitle || "Open Play Session";
    const sessionStatus = item.sessionStatus || "completed";
    const dateSource = match.ended_at || match.started_at || item.created_at;
    const dateLabel = dateSource ? formatPHTDate(dateSource) : "Recent";
    const scoreLabel = formatPlayerMatchScore(match.team_a_score, match.team_b_score, result);
    const duration = !isInProgress ? formatMatchDuration(match.started_at, match.ended_at) : null;

    return {
      id: item.id || match.id || `${sessionTitle}-${dateLabel}`,
      sessionId,
      sessionTitle,
      sessionStatus,
      result,
      court: courtName,
      format: formatLabel,
      partner: item.partner,
      opponents: item.opponents,
      date: dateLabel,
      score: scoreLabel,
      duration,
      placement: item.sessionPlacement ?? null,
    };
  });
}
