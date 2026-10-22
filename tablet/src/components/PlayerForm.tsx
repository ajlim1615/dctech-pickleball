import { useState } from "react";
import { Button, ChipGroup, Label, Sheet, TextInput } from "./ui";
import { DEFAULT_SKILL, SKILL_LEVELS, type DeskPlayer } from "../engine/types";

/** Add or edit a player: a name and a skill level. Used by the roster and for walk-ins. */
export function PlayerForm({
  player,
  title,
  saveLabel = "Save",
  onSave,
  onCancel,
}: {
  player?: DeskPlayer;
  title?: string;
  saveLabel?: string;
  onSave: (player: DeskPlayer) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(player?.name ?? "");
  const [skill, setSkill] = useState(player?.skill ?? DEFAULT_SKILL);
  const [note, setNote] = useState(player?.note ?? "");
  const trimmed = name.trim();

  function submit() {
    if (!trimmed) return;
    onSave({
      id: player?.id ?? crypto.randomUUID(),
      name: trimmed,
      skill,
      note: note.trim() || undefined,
      archived: player?.archived ?? false,
      createdAt: player?.createdAt ?? new Date().toISOString(),
    });
  }

  return (
    <Sheet title={title ?? (player ? "Edit player" : "Add player")} onClose={onCancel}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="block">
          <Label>Name</Label>
          <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div>
          <Label>Skill</Label>
          <ChipGroup options={SKILL_LEVELS} value={skill} onChange={setSkill} format={(v) => v.toFixed(1)} />
        </div>
        <label className="block">
          <Label>Note (optional)</Label>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!trimmed}>
            {saveLabel}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
