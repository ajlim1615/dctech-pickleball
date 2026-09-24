import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { MatchingStyle } from "@/features/queue/utils/matchingEngine";

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

export function cleanSessionDescription(description?: string | null): string {
  if (!description) return "";
  return description
    .replace(/\s*\[matching_mode:[^\]]+\]/gi, "")
    .replace(/\s*\[ranked:[^\]]+\]/gi, "")
    .replace(/\s*\[target_points:[^\]]+\]/gi, "")
    .trim();
}

export function parseSessionMetadata(description?: string | null): {
  matchingMode: MatchingStyle;
  isRanked: boolean;
  targetPoints: number;
  cleanDescription: string;
} {
  const desc = description || "";
  const matchingModeMatch = desc.match(/\[matching_mode:([^\]]+)\]/i);
  const rankedMatch = desc.match(/\[ranked:([^\]]+)\]/i);
  const targetPointsMatch = desc.match(/\[target_points:([^\]]+)\]/i);

  const rawMode = matchingModeMatch ? matchingModeMatch[1].toLowerCase() : "balanced";
  const validModes: MatchingStyle[] = [
    "balanced",
    "social_mixer",
    "skill_separated",
    "winners_losers",
    "skill_courts",
    "mixed_doubles",
    "king_queen",
    "club_wars",
    "fifo",
    "winners_stay",
  ];
  const matchingMode: MatchingStyle = validModes.includes(rawMode as MatchingStyle)
    ? (rawMode as MatchingStyle)
    : "balanced";

  return {
    matchingMode,
    isRanked: rankedMatch ? rankedMatch[1] !== "false" : true,
    targetPoints: targetPointsMatch && targetPointsMatch[1] === "6" ? 6 : 11,
    cleanDescription: cleanSessionDescription(desc),
  };
}
