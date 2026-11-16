import type { ActiveCourtView } from "@/types";

/**
 * The courts a session page shows before the session is live: the session's own
 * court count, not whatever the shared arena has right now. Real arena courts are
 * reused (shown free) where they exist; any extra are placeholders, since the
 * arena only switches to this count when the session starts.
 */
export function previewCourts(arena: ActiveCourtView[], count: number): ActiveCourtView[] {
  const sorted = [...arena].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const now = new Date(0).toISOString();
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const real = sorted[i];
    if (real) {
      return { ...real, status: "available", current_match_id: null, current_match: null };
    }
    return {
      id: `preview-court-${i + 1}`,
      name: `Court ${i + 1}`,
      surface_type: "Standard Court",
      status: "available",
      sort_order: i + 1,
      current_match_id: null,
      assigned_staff_id: null,
      created_at: now,
      updated_at: now,
    } as ActiveCourtView;
  });
}
