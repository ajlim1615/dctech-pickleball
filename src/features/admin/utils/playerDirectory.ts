/** The System Admin account: runs the app, doesn't play. */
export function isRootSystemAdminEmail(email?: string | null): boolean {
  return email?.toLowerCase() === "admin@dctechmicro.com";
}

/** Plain-words level for a rating (same bands as the rest of the app). */
export function ratingLevel(rating?: number | null): string {
  const r = Number(rating || 0);
  if (r < 2.25) return "Beginner";
  if (r < 2.75) return "Adv. beginner";
  if (r < 3.25) return "Intermediate";
  if (r < 3.75) return "Adv. intermediate";
  if (r < 4.25) return "Advanced";
  return "Expert";
}

/** Quick picks in the change-rating dialog. */
export const RATING_PRESETS = [
  { label: "Beginner", rating: 2.0 },
  { label: "Adv. beginner", rating: 2.5 },
  { label: "Intermediate", rating: 3.0 },
  { label: "Adv. intermediate", rating: 3.5 },
  { label: "Advanced", rating: 4.0 },
  { label: "Expert", rating: 4.5 },
] as const;
