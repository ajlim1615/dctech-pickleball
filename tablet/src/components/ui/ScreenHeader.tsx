import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { IconButton } from "./IconButton";

export function ScreenHeader({
  title,
  meta,
  onBack,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-line px-5 py-2">
      {onBack && (
        <IconButton label="Back" onClick={onBack}>
          <ArrowLeft size={20} />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-serif text-2xl font-semibold tracking-[-0.01em]">{title}</h1>
        {meta && <div className="truncate text-[13px] text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
