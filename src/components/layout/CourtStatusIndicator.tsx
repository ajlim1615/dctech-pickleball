import { cn } from "@/lib/utils";
import type { CourtStatus } from "@/types/database.types";

interface CourtStatusIndicatorProps {
  status: CourtStatus;
  className?: string;
}

export function CourtStatusIndicator({ status, className }: CourtStatusIndicatorProps) {
  const configs: Record<
    CourtStatus,
    { label: string; dotClass: string; textClass: string; bgClass: string }
  > = {
    available: {
      label: "AVAILABLE",
      dotClass: "bg-emerald-500 dark:bg-emerald-400",
      textClass: "text-emerald-700 dark:text-emerald-400 font-semibold",
      bgClass: "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40",
    },
    occupied: {
      label: "IN PLAY",
      dotClass: "bg-sky-500 dark:bg-sky-400 animate-pulse",
      textClass: "text-sky-700 dark:text-sky-400 font-semibold",
      bgClass: "border-sky-500/30 bg-sky-50 dark:bg-sky-950/40",
    },
    maintenance: {
      label: "MAINTENANCE",
      dotClass: "bg-red-500 dark:bg-red-400",
      textClass: "text-red-700 dark:text-red-400 font-semibold",
      bgClass: "border-red-500/30 bg-red-50 dark:bg-red-950/40",
    },
    reserved: {
      label: "RESERVED",
      dotClass: "bg-amber-500 dark:bg-amber-400",
      textClass: "text-amber-700 dark:text-amber-400 font-semibold",
      bgClass: "border-amber-500/30 bg-amber-50 dark:bg-amber-950/40",
    },
  };

  const config = configs[status] || configs.available;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-medium",
        config.bgClass,
        config.textClass,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
      <span>{config.label}</span>
    </div>
  );
}
