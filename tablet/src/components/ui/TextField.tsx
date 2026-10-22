import type { InputHTMLAttributes, ReactNode } from "react";
import { Search } from "lucide-react";
import clsx from "clsx";

export function Label({ children }: { children: ReactNode }) {
  return <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">{children}</span>;
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none transition",
        "placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_20%,transparent)]",
        className
      )}
    />
  );
}

export function TextField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <TextInput {...props} />
    </label>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={clsx("relative", className)}>
      <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <TextInput
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10"
      />
    </div>
  );
}
