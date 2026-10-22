import type { ReactNode } from "react";
import clsx from "clsx";
import type { PillTone } from "../../lib/courtStatus";

const tones: Record<PillTone | "info", string> = {
  neutral: "bg-sunken text-muted",
  live: "bg-t1-bg text-t1",
  warn: "bg-clay-bg text-clay",
  info: "bg-t2-bg text-t2",
};

export function Pill({ tone = "neutral", children }: { tone?: PillTone | "info"; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {tone === "live" && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-t1" />}
      {children}
    </span>
  );
}
