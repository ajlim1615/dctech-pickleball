import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
