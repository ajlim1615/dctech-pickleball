import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export type ButtonVariant = "primary" | "quiet" | "ghost" | "danger";

const variants: Record<ButtonVariant, string> = {
  // One primary action per area.
  primary: "bg-primary text-on-primary font-semibold shadow-card hover:brightness-110",
  quiet: "bg-surface text-ink border border-line hover:bg-sunken",
  ghost: "text-muted hover:bg-sunken hover:text-ink",
  danger: "bg-clay-bg text-clay font-semibold hover:brightness-95",
};

export function Button({
  variant = "quiet",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "md" | "lg" }) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl transition duration-150 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
        size === "md" ? "min-h-11 px-4 text-sm" : "min-h-14 px-5 text-base",
        variants[variant],
        className
      )}
    />
  );
}
