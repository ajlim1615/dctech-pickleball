import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";

/**
 * A bottom sheet over a scrim. Escape or a scrim tap closes it; nothing inside
 * saves on close.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[#0d1210]/45"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-t-[20px] border border-b-0 border-line bg-bg shadow-card"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-baseline gap-2 px-6 pb-2 pt-3">
          <h2 className="font-serif text-xl font-semibold">{title}</h2>
          {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">{footer}</div>}
      </motion.div>
    </div>
  );
}
