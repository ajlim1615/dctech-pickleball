import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DEFAULT_SKILL_SPREAD } from "@/features/queue/matchmaking";
import type { MatchingStyle } from "@/features/queue/matchmaking";
import { ALL_MATCHING_STYLES } from "@/features/queue/constants/matchingStyles";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRating(rating: number | string | null | undefined): string {
  if (rating === null || rating === undefined) return "3.00";
  const num = typeof rating === "string" ? parseFloat(rating) : rating;
  return isNaN(num) ? "3.00" : num.toFixed(2);
}

export function formatScore(teamAScore: number, teamBScore: number): string {
  return `${teamAScore} - ${teamBScore}`;
}

const SESSION_META_TAG_REGEX =
  /\s*\[(?:matching_mode|ranked|target_points|win_by|scoring|skill_spread|courts|partners|court_names):[^\]]+\]/gi;

export function cleanSessionDescription(description?: string | null): string {
  if (!description) return "";
  return description.replace(SESSION_META_TAG_REGEX, "").trim();
}

/** Preserves existing `[tag:...]` metadata when updating the user-facing session description. */
export function mergeSessionDescription(
  existingDescription: string | null | undefined,
  newUserDescription: string
): string {
  const clean = newUserDescription.trim();
  const tags = (existingDescription?.match(SESSION_META_TAG_REGEX) || [])
    .map((t) => t.trim())
    .join(" ");
  if (clean && tags) return `${clean} ${tags}`;
  return clean || tags;
}

/** Courts a session uses: 1–12, or null when the session never set one (older sessions). */
export function parseCourtCount(raw: string | null | undefined): number | null {
  const n = parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(12, Math.max(1, n));
}

/** Max rating gap allowed on one court, clamped to [0.25, 2] and rounded to 2 decimals. */
export function parseSkillSpread(raw: string | null | undefined): number {
  const n = parseFloat(raw ?? "");
  if (!Number.isFinite(n)) return DEFAULT_SKILL_SPREAD;
  return Math.round(Math.min(2, Math.max(0.25, n)) * 100) / 100;
}

export function parseCourtNames(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === "string" && val.trim()) {
        out[key] = val.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function extractCourtNamesTag(description?: string | null): string {
  const match = description?.match(/\[court_names:[^\]]+\]/i);
  return match ? match[0] : "";
}

export function setSessionCourtNames(
  existingDescription: string | null | undefined,
  courtNames: Record<string, string>
): string {
  const cleaned = Object.fromEntries(
    Object.entries(courtNames)
      .map(([k, v]) => [k, v.trim()])
      .filter(([, v]) => v.length > 0)
  );
  const withoutCourtNames = (existingDescription || "")
    .replace(/\s*\[court_names:[^\]]+\]/gi, "")
    .trim();
  const keys = Object.keys(cleaned);
  if (keys.length === 0) return withoutCourtNames;
  const tag = `[court_names:${encodeURIComponent(JSON.stringify(cleaned))}]`;
  return withoutCourtNames ? `${withoutCourtNames} ${tag}` : tag;
}

export function setSessionCourtCount(
  existingDescription: string | null | undefined,
  count: number
): string {
  const clamped = Math.min(12, Math.max(1, Math.round(count)));
  const withoutCourts = (existingDescription || "")
    .replace(/\s*\[courts:[^\]]+\]/gi, "")
    .trim();
  const tag = `[courts:${clamped}]`;
  return withoutCourts ? `${withoutCourts} ${tag}` : tag;
}

export function applySessionCourtNames<T extends { name: string; sort_order?: number | null }>(
  courts: T[],
  courtNames?: Record<string, string>
): T[] {
  if (!courtNames || Object.keys(courtNames).length === 0) return courts;
  return courts.map((court, index) => {
    const slot = String(court.sort_order ?? index + 1);
    const customName = courtNames[slot];
    return customName ? { ...court, name: customName } : court;
  });
}

export function parseSessionMetadata(description?: string | null): {
  matchingMode: MatchingStyle;
  isRanked: boolean;
  targetPoints: number;
  winByTwo: boolean;
  /** false = win/loss only: admins just pick the winning team. */
  trackScores: boolean;
  skillSpread: number;
  /** Courts this session runs on; null for older sessions that never set one. */
  courtCount: number | null;
  /** Players may join with a partner (coworker or guest). Off unless the admin turns it on. */
  allowPartners: boolean;
  /** Per-session custom court names keyed by court slot ("1", "2", ...). */
  courtNames: Record<string, string>;
  cleanDescription: string;
} {
  const desc = description || "";
  const matchingModeMatch = desc.match(/\[matching_mode:([^\]]+)\]/i);
  const rankedMatch = desc.match(/\[ranked:([^\]]+)\]/i);
  const targetPointsMatch = desc.match(/\[target_points:([^\]]+)\]/i);
  const winByMatch = desc.match(/\[win_by:([12])\]/i);
  const scoringMatch = desc.match(/\[scoring:(points|result)\]/i);
  const skillSpreadMatch = desc.match(/\[skill_spread:([^\]]+)\]/i);
  const courtsMatch = desc.match(/\[courts:(\d+)\]/i);
  const partnersMatch = desc.match(/\[partners:(true|false)\]/i);
  const courtNamesMatch = desc.match(/\[court_names:([^\]]+)\]/i);

  const rawMode = matchingModeMatch ? matchingModeMatch[1].toLowerCase() : "balanced";
  const matchingMode: MatchingStyle = ALL_MATCHING_STYLES.includes(rawMode as MatchingStyle)
    ? (rawMode as MatchingStyle)
    : "balanced";
  const targetPoints = targetPointsMatch && targetPointsMatch[1] === "6" ? 6 : 11;

  return {
    matchingMode,
    isRanked: rankedMatch ? rankedMatch[1] !== "false" : true,
    targetPoints,
    // Older sessions have no tag: 11 pts was always win by 2, 6 pts first to 6.
    winByTwo: winByMatch ? winByMatch[1] === "2" : targetPoints !== 6,
    trackScores: scoringMatch ? scoringMatch[1].toLowerCase() !== "result" : true,
    skillSpread: parseSkillSpread(skillSpreadMatch ? skillSpreadMatch[1] : null),
    courtCount: parseCourtCount(courtsMatch ? courtsMatch[1] : null),
    allowPartners: partnersMatch ? partnersMatch[1].toLowerCase() === "true" : false,
    courtNames: parseCourtNames(courtNamesMatch ? courtNamesMatch[1] : null),
    cleanDescription: cleanSessionDescription(desc),
  };
}
