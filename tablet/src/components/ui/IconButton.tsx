import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

/** A 44 px square button with an accessible label. */
export function IconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={clsx(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition duration-150",
        "hover:bg-sunken hover:text-ink active:scale-95 disabled:opacity-35 disabled:active:scale-100",
        className
      )}
    />
  );
}
