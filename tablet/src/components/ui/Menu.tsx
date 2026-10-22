import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import clsx from "clsx";
import { IconButton } from "./IconButton";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  tone?: "danger";
}

/** A ⋯ button that opens a small list of actions. */
export function Menu({ label, items, icon }: { label: string; items: MenuItem[]; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <IconButton label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon ?? <MoreHorizontal size={20} />}
      </IconButton>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-30 min-w-48 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-card"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={clsx(
                "flex min-h-11 w-full items-center px-4 text-left text-sm hover:bg-sunken",
                item.tone === "danger" ? "text-clay" : "text-ink"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
