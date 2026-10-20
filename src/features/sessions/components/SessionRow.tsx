import { formatPHTTime } from "@/lib/timezone";
import { parseSessionMetadata } from "@/lib/utils";
import { describeRule } from "@/features/matches/utils/scoring";
import type { Session } from "@/types";

/** Ranked/Casual and scoring rule, as quiet chips. */
export function SessionRuleChips({ description }: { description?: string | null }) {
  const meta = parseSessionMetadata(description);
  const chip = "rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={chip}>{meta.isRanked ? "Ranked" : "Casual"}</span>
      <span className={`${chip} first-letter:uppercase`}>{describeRule(meta)}</span>
    </div>
  );
}

function phtDateParts(iso: string) {
  const d = new Date(iso);
  const part = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", ...opts }).format(d);
  return { weekday: part({ weekday: "short" }), day: part({ day: "numeric" }), month: part({ month: "short" }) };
}

/** One session in a list: date block, title, rules, time, and its actions. */
export function SessionRow({
  session,
  muted,
  rsvpCount,
  children,
}: {
  session: Session;
  muted?: boolean;
  /** People who said they're going; shown when above zero. */
  rsvpCount?: number;
  children: React.ReactNode;
}) {
  const { weekday, day, month } = phtDateParts(session.start_time);
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div
          className={`flex w-14 shrink-0 flex-col items-center rounded-lg border py-1.5 ${
            muted
              ? "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
              : "border-emerald-500/40 text-slate-900 dark:text-slate-100"
          }`}
        >
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{weekday}</span>
          <span className="text-xl font-bold leading-none tabular-nums">{day}</span>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{month}</span>
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className={`truncate text-base font-semibold ${muted ? "text-slate-600 dark:text-slate-300" : "text-slate-900 dark:text-slate-100"}`}>
            {session.title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatPHTTime(session.start_time)} – {formatPHTTime(session.end_time)}, {session.location || "DCTECH Sports Arena"}
          </p>
          {rsvpCount ? (
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <span className="tabular-nums">{rsvpCount}</span> going
            </p>
          ) : null}
          {!muted && <SessionRuleChips description={session.description} />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">{children}</div>
    </li>
  );
}
