import clsx from "clsx";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl text-left"
    >
      <span className="text-[15px]">{label}</span>
      <span className={clsx("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200", checked ? "bg-primary" : "bg-line")}>
        <span
          className={clsx(
            "absolute top-1 h-5 w-5 rounded-full bg-surface shadow-card transition-[left] duration-200",
            checked ? "left-6" : "left-1"
          )}
        />
      </span>
    </button>
  );
}
