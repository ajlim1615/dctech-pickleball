import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { Navigate } from "../App";
import { Button, Card, ScreenHeader, TextInput, Toggle, toast, ConfirmSheet } from "../components/ui";

import { PlayerForm } from "../components/PlayerForm";
import { deletePlayer, listPlayers, upsertPlayer } from "../db/repo";
import type { DeskPlayer } from "../engine/types";

export function Roster({ navigate }: { navigate: Navigate }) {
  const [players, setPlayers] = useState<DeskPlayer[]>([]);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<DeskPlayer | "new" | null>(null);
  const [deleting, setDeleting] = useState<DeskPlayer | null>(null);

  const reload = useCallback(async () => {
    setPlayers(await listPlayers({ includeArchived: true }));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const visible = players.filter(
    (p) => (showArchived || !p.archived) && p.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  async function save(player: DeskPlayer) {
    await upsertPlayer(player);
    setEditing(null);
    await reload();
  }

  async function toggleArchive(player: DeskPlayer) {
    await upsertPlayer({ ...player, archived: !player.archived });
    toast(player.archived ? `${player.name} is back on the roster.` : `${player.name} archived.`);
    await reload();
  }

  async function confirmDelete(player: DeskPlayer) {
    const result = await deletePlayer(player.id);
    setDeleting(null);
    if (result?.error) toast(result.error);
    else toast(`${player.name} deleted.`);
    await reload();
  }

  return (
    <>
      <ScreenHeader
        title="Roster"
        onBack={() => navigate({ name: "home" })}
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={18} /> Add player
          </Button>
        }
      />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-center gap-4">
          <TextInput placeholder="Search players" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="w-56 shrink-0">
            <Toggle label="Show archived" checked={showArchived} onChange={setShowArchived} />
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            {players.length === 0 ? "No players yet. Add your regulars here." : "No players match."}
          </p>
        ) : (
          <Card className="divide-y divide-border">
            {visible.map((p) => (
              <div key={p.id} className="flex min-h-14 items-center gap-3 px-4">
                <button type="button" onClick={() => setEditing(p)} className="flex flex-1 items-center gap-3 text-left">
                  <span className={p.archived ? "text-muted-foreground" : ""}>{p.name}</span>
                  {p.archived && <span className="text-xs text-muted-foreground">Archived</span>}
                </button>
                <span className="w-12 text-right font-mono tabular-nums text-muted-foreground">{p.skill.toFixed(1)}</span>
                <Button variant="ghost" onClick={() => toggleArchive(p)}>
                  {p.archived ? "Unarchive" : "Archive"}
                </Button>
                <Button variant="ghost" onClick={() => setDeleting(p)}>
                  Delete
                </Button>
              </div>
            ))}
          </Card>
        )}
      </main>

      {editing && (
        <PlayerForm
          player={editing === "new" ? undefined : editing}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmSheet
          title={`Delete ${deleting.name}?`}
          body="This can't be undone. Players with games on record can only be archived."
          confirmLabel="Delete"
          danger
          onConfirm={() => confirmDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
