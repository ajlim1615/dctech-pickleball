"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/ui/modal";

export interface SheetProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  size?: "sm" | "md";
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered pop-up sheet with full-viewport backdrop, scrollable body, and pinned footer. */
export function Sheet({ title, subtitle, onClose, size = "md", children, footer }: SheetProps) {
  const width = size === "sm" ? "max-w-sm" : "max-w-md";
  return (
    <Modal isOpen onClose={onClose} panelClassName={`${width} mx-auto`}>
      <div
        className={`flex max-h-[85vh] w-full ${width} flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-2xl`}
      >
        <div className="shrink-0">
          <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="shrink-0">{footer}</div>}
      </div>
    </Modal>
  );
}
