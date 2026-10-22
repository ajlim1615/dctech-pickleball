import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-[18px] border border-line bg-surface shadow-card", className)}>{children}</div>;
}
