import type { ReactNode } from "react";
import clsx from "clsx";

export function Chip({
  selected,
  onClick,
  className,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        "min-h-11 rounded-[10px] border px-3 text-sm transition duration-150 active:scale-[0.98]",
        selected
          ? "border-primary bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] font-semibold text-primary"
          : "border-line bg-surface text-ink hover:bg-sunken",
        className
      )}
    >
      {children}
    </button>
  );
}

/** A single-choice set of chips, e.g. skill levels or target scores. */
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  format = String,
  mono = false,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip
          key={String(o)}
          selected={o === value}
          onClick={() => onChange(o)}
          className={clsx("min-w-14", mono && "font-mono tabular-nums")}
        >
          {format(o)}
        </Chip>
      ))}
    </div>
  );
}
