import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import clsx from "clsx";
import type { DeskPlayer } from "../engine/types";
import { Avatar, Button, SearchField, Sheet } from "./ui";

/**
 * Pick players from a list. `multiple` is for checking several in at once;
 * otherwise tapping one picks it straight away (for swaps).
 */
export function PlayerPicker({
  title,
  players,
  multiple = false,
  confirmLabel = (n: number) => `Check in ${n}`,
  onPick,
  onAddWalkIn,
  onCancel,
  emptyText = "Nobody to pick.",
}: {
  title: string;
  players: DeskPlayer[];
  multiple?: boolean;
  confirmLabel?: (count: number) => string;
  onPick: (ids: string[]) => void;
  onAddWalkIn?: () => void;
  onCancel: () => void;
  emptyText?: string;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const visible = players.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  function tap(id: string) {
    if (!multiple) return onPick([id]);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <Sheet
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {multiple && (
            <Button variant="primary" disabled={selected.length === 0} onClick={() => onPick(selected)}>
              {confirmLabel(selected.length)}
            </Button>
          )}
        </>
      }
    >
      <div className="mb-3 flex gap-2 pt-1">
        <SearchField value={search} onChange={setSearch} className="flex-1" />
        {onAddWalkIn && (
          <Button onClick={onAddWalkIn} className="shrink-0">
            <UserPlus size={18} /> Add walk-in
          </Button>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{players.length ? "No players match." : emptyText}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {visible.map((p) => {
            const isSelected = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={multiple ? isSelected : undefined}
                onClick={() => tap(p.id)}
                className={clsx(
                  "flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left transition active:scale-[0.98]",
                  isSelected ? "border-primary bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]" : "border-line bg-surface hover:bg-sunken"
                )}
              >
                <Avatar name={p.name} />
                <span className="min-w-0 flex-1 truncate text-[15px]">{p.name}</span>
                <span className="font-mono text-xs tabular-nums text-muted">{p.skill.toFixed(1)}</span>
                {isSelected && <Check size={18} className="text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
