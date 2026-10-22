import { Minus, Plus } from "lucide-react";
import { IconButton } from "./IconButton";

export function Stepper({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <IconButton label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="border border-line bg-surface">
        <Minus size={18} />
      </IconButton>
      <span className="w-10 text-center font-serif text-3xl font-semibold tabular-nums">{value}</span>
      <IconButton label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="border border-line bg-surface">
        <Plus size={18} />
      </IconButton>
    </div>
  );
}
