import { useState } from "react";
import { Button, ChipGroup, Label, Sheet, TextField } from "./ui";
import { DEFAULT_SKILL, SKILL_LEVELS, type DeskPlayer } from "../engine/types";

const FORM_ID = "player-form";

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
    <Sheet
      title={title ?? (player ? "Edit player" : "Add player")}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={!trimmed}>
            {saveLabel}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="space-y-5 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField label="Name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <Label>Skill</Label>
          <ChipGroup options={SKILL_LEVELS} value={skill} onChange={setSkill} format={(v) => v.toFixed(1)} mono />
        </div>
        <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </form>
    </Sheet>
  );
}
