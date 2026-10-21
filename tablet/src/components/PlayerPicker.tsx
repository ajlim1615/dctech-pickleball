import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import clsx from "clsx";
import type { DeskPlayer } from "../engine/types";
import { Button, Modal, TextInput } from "./ui";

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
    <Modal title={title} onClose={onCancel}>
      <div className="mb-3 flex gap-2">
        <TextInput placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        {onAddWalkIn && (
          <Button onClick={onAddWalkIn} className="shrink-0">
            <UserPlus size={18} /> Add walk-in
          </Button>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{players.length ? "No players match." : emptyText}</p>
      ) : (
        <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
          {visible.map((p) => {
            const isSelected = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => tap(p.id)}
                className={clsx(
                  "flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm",
                  isSelected ? "border-volt bg-volt/10" : "border-border"
                )}
              >
                <span className="truncate">{p.name}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-muted-foreground">{p.skill.toFixed(1)}</span>
                  {isSelected && <Check size={16} className="text-volt" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {multiple && (
          <Button variant="primary" disabled={selected.length === 0} onClick={() => onPick(selected)}>
            {confirmLabel(selected.length)}
          </Button>
        )}
      </div>
    </Modal>
  );
}
