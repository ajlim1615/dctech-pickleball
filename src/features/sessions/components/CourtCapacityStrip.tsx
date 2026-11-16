import { courtCapacity } from "@/features/sessions/utils/courtCapacity";

/** Player spots on a doubles court, as x/y in the court drawing (two per side of the net). */
const SPOTS = [
  { x: 14, y: 11 },
  { x: 14, y: 29 },
  { x: 58, y: 11 },
  { x: 58, y: 29 },
];

/** One court seen from above: outline, net, kitchen lines, and four player spots. */
function MiniCourt({ filled, label }: { filled: number; label: string }) {
  return (
    <svg
      viewBox="0 0 72 40"
      className="h-10 w-[72px] shrink-0"
      role="img"
      aria-label={label}
    >
      <rect
        x="1"
        y="1"
        width="70"
        height="38"
        rx="4"
        className="fill-emerald-50 stroke-emerald-600/40 dark:fill-emerald-950/40 dark:stroke-emerald-400/40"
        strokeWidth="1"
      />
      {/* Kitchen lines either side of the net */}
      <line x1="26" y1="1" x2="26" y2="39" className="stroke-emerald-600/25 dark:stroke-emerald-400/25" strokeWidth="1" />
      <line x1="46" y1="1" x2="46" y2="39" className="stroke-emerald-600/25 dark:stroke-emerald-400/25" strokeWidth="1" />
      {/* Net */}
      <line x1="36" y1="1" x2="36" y2="39" className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1.5" />
      {SPOTS.map((s, i) =>
        i < filled ? (
          <circle key={i} cx={s.x} cy={s.y} r="5" className="fill-emerald-500 dark:fill-[#d4e938]" />
        ) : (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r="4.5"
            className="fill-none stroke-slate-400 dark:stroke-slate-600"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        )
      )}
    </svg>
  );
}

/**
 * The session's courts filling up with the people going, so you can tell at a
 * glance how busy it will be: who plays at once and who waits each round.
 */
export function CourtCapacityStrip({ courts, going }: { courts: number; going: number }) {
  const cap = courtCapacity(courts, going);
  const summary =
    going === 0
      ? `${courts * 4} spots on ${courts} ${courts === 1 ? "court" : "courts"}`
      : cap.waiting > 0
        ? `${cap.playing} play at once, ${cap.waiting} wait each round`
        : `${cap.openSpots} ${cap.openSpots === 1 ? "spot" : "spots"} left before anyone waits`;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex flex-wrap gap-2">
        {cap.perCourt.map((filled, i) => (
          <MiniCourt key={i} filled={filled} label={`Court ${i + 1}: ${filled} of 4 spots taken`} />
        ))}
      </div>
      <p className="text-sm leading-snug">
        <span className="block font-bold text-slate-900 dark:text-slate-100">
          {going} going on {courts} {courts === 1 ? "court" : "courts"}
        </span>
        <span className="text-slate-500 dark:text-slate-400">{summary}</span>
      </p>
    </div>
  );
}
