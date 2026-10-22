import clsx from "clsx";
import { initials } from "../../lib/initials";

const tones = {
  t1: "bg-t1 text-bg",
  t2: "bg-t2 text-bg",
  neutral: "bg-sunken text-ink border border-line",
};

/** A round initials badge, tinted by team. */
export function Avatar({
  name,
  tone = "neutral",
  size = 30,
}: {
  name: string;
  tone?: keyof typeof tones;
  size?: 26 | 30;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={clsx(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold",
        size === 26 ? "text-[10px]" : "text-[11px]",
        tones[tone]
      )}
    >
      {initials(name)}
    </span>
  );
}
