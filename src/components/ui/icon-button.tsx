"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  tone?: "muted" | "danger";
  className?: string;
}

/** 44×44 px icon-only button so every touch target is fingertip-sized. */
export function IconButton({
  label,
  onClick,
  disabled,
  children,
  tone = "muted",
  className,
}: IconButtonProps) {
  const colors =
    tone === "danger"
      ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
      : "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-emerald-500",
        colors,
        className
      )}
    >
      {children}
    </button>
  );
}
