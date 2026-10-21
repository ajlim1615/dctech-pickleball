import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  // Volt: one primary action per area.
  primary: "bg-volt text-slate-950 hover:brightness-95 font-semibold",
  secondary: "bg-muted text-foreground hover:bg-slate-700",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-red-500/15 text-red-300 hover:bg-red-500/25",
};

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm transition disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        className
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-xl border border-border bg-card", className)}>{children}</div>;
}

export function ScreenHeader({ title, onBack, actions }: { title: string; onBack?: () => void; actions?: ReactNode }) {
  return (
    <header className="flex min-h-16 items-center gap-3 border-b border-border px-4">
      {onBack && (
        <Button variant="ghost" onClick={onBack} aria-label="Back" className="px-3">
          ←
        </Button>
      )}
      <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
      {actions}
    </header>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus:border-volt",
        props.className
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-sm font-medium text-muted-foreground">{children}</span>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 text-left"
    >
      <span className="text-sm">{label}</span>
      <span className={clsx("relative h-7 w-12 rounded-full transition", checked ? "bg-volt" : "bg-muted")}>
        <span
          className={clsx(
            "absolute top-1 h-5 w-5 rounded-full bg-slate-950 transition",
            checked ? "left-6" : "left-1 bg-slate-400"
          )}
        />
      </span>
    </button>
  );
}

/** Choice chips, e.g. skill levels or target scores. */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  format = String,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onChange(o)}
          className={clsx(
            "min-h-11 min-w-14 rounded-lg border px-3 font-mono text-sm tabular-nums",
            o === value ? "border-volt bg-volt/15 text-volt" : "border-border text-muted-foreground"
          )}
        >
          {format(o)}
        </button>
      ))}
    </div>
  );
}

let pushToast: (message: string) => void = () => {};

/** Shows a short message at the bottom of the screen. */
export function toast(message: string) {
  pushToast(message);
}

export function Toaster() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    pushToast = (m) => {
      setMessage(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 4000);
    };
    return () => clearTimeout(timer);
  }, []);
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div role="status" className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-950 shadow-lg">
        {message}
      </div>
    </div>
  );
}
