import { Trophy, Smile, LayoutGrid } from "lucide-react";
import { parseSessionMetadata } from "@/lib/utils";
import { DEFAULT_COURT_COUNT } from "@/lib/constants";

/** Courts a session runs on, from its saved settings (older sessions: the default). */
export function sessionCourtCount(description?: string | null): number {
  return parseSessionMetadata(description).courtCount ?? DEFAULT_COURT_COUNT;
}

/**
 * Number of courts a session runs on. Upcoming sessions show their own setting;
 * pass `count` for a live session to show the courts actually in use.
 */
export function CourtsBadge({
  description,
  count,
  onDark = false,
}: {
  description?: string | null;
  count?: number;
  onDark?: boolean;
}) {
  const n = count ?? sessionCourtCount(description);
  const tone = onDark
    ? "border-sky-400/40 bg-sky-950/60 text-sky-200"
    : "border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-extrabold uppercase tracking-wide ${tone}`}
      title={`${n} ${n === 1 ? "court" : "courts"}: up to ${n * 4} players at once`}
    >
      <LayoutGrid className="h-3 w-3" aria-hidden />
      {n} {n === 1 ? "court" : "courts"}
    </span>
  );
}

/**
 * Ranked (games change ratings) or Casual (they don't), at a glance.
 * Same colours as the admin toggle: emerald for Ranked, purple for Casual.
 * `onDark` is for the always-dark home hero.
 */
export function RankedBadge({ description, onDark = false }: { description?: string | null; onDark?: boolean }) {
  const ranked = parseSessionMetadata(description).isRanked;
  const tone = ranked
    ? onDark
      ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-300"
      : "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
    : onDark
      ? "border-purple-400/40 bg-purple-950/60 text-purple-200"
      : "border-purple-500/40 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300";
  const Icon = ranked ? Trophy : Smile;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-extrabold uppercase tracking-wide ${tone}`}
      title={ranked ? "Ranked: games change player ratings" : "Casual: games don't change ratings"}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {ranked ? "Ranked" : "Casual"}
    </span>
  );
}
