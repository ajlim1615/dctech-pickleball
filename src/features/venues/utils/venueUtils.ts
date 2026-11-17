const MAX_MAPS_URL_LENGTH = 500;

/** Validates that a Google Maps URL is a well-formed http/https URL within length limits. */
export function isValidMapsUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_MAPS_URL_LENGTH) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** Filters venues by case-insensitive name substring (and optionally active status). */
export function filterVenues<T extends { name: string; is_active?: boolean }>(
  venues: T[],
  query: string,
  activeOnly: boolean = true
): T[] {
  const q = query.trim().toLowerCase();
  return venues.filter((v) => {
    if (activeOnly && v.is_active === false) return false;
    if (!q) return true;
    return v.name.toLowerCase().includes(q);
  });
}

/** Resolves a session's venue by `venue_id` first, falling back to case-insensitive `location` name. */
export function findVenueForSession<T extends { id: string; name: string; maps_url: string }>(
  session: { venue_id?: string | null; location?: string | null },
  venues: T[]
): T | null {
  if (session.venue_id) {
    const byId = venues.find((v) => v.id === session.venue_id);
    if (byId) return byId;
  }
  const loc = session.location?.trim().toLowerCase();
  if (!loc) return null;
  return venues.find((v) => v.name.trim().toLowerCase() === loc) ?? null;
}
