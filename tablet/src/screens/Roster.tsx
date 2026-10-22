import { useCallback, useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import type { Navigate } from "../App";
import { Avatar, Button, Card, Chip, ConfirmSheet, EmptyState, Menu, ScreenHeader, SearchField, toast } from "../components/ui";
import { PlayerForm } from "../components/PlayerForm";
import { deletePlayer, listPlayers, upsertPlayer } from "../db/repo";
import type { DeskPlayer } from "../engine/types";

type Filter = "all" | "archived";

export function Roster({ navigate }: { navigate: Navigate }) {
  const [players, setPlayers] = useState<DeskPlayer[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<DeskPlayer | "new" | null>(null);
  const [deleting, setDeleting] = useState<DeskPlayer | null>(null);

  const reload = useCallback(async () => {
    setPlayers(await listPlayers({ includeArchived: true }));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const active = players.filter((p) => !p.archived);
  const visible = players.filter(
    (p) =>
      (filter === "archived" ? p.archived : !p.archived) &&
      p.name.toLowerCase().includes(search.trim().toLowerCase())
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
    toast(result?.error ?? `${player.name} deleted.`);
    await reload();
  }

  return (
    <>
      <ScreenHeader
        title={
          <>
            Roster <span className="ml-1 align-middle font-mono text-sm font-normal text-muted">{active.length}</span>
          </>
        }
        onBack={() => navigate({ name: "home" })}
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={18} /> Add player
          </Button>
        }
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
        <div className="flex items-center gap-2">
          <SearchField value={search} onChange={setSearch} placeholder="Search players" className="flex-1" />
          <Chip selected={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          <Chip selected={filter === "archived"} onClick={() => setFilter("archived")}>
            Archived
          </Chip>
        </div>

        {visible.length === 0 ? (
          <Card>
            {players.length === 0 ? (
              <EmptyState
                icon={<Users size={28} />}
                title="No players yet"
                body="Add your regulars with a skill level so matchmaking can make fair games."
                action={
                  <Button variant="primary" onClick={() => setEditing("new")}>
                    <Plus size={18} /> Add player
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title={filter === "archived" && !search ? "No archived players" : "No players match"}
                body={filter === "archived" && !search ? "Archived players show up here." : "Try a different name."}
              />
            )}
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {visible.map((p) => (
              <div key={p.id} className="flex min-h-16 items-center gap-3 py-2 pl-4 pr-2">
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Avatar name={p.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{p.name}</span>
                    {p.note && <span className="block truncate text-[13px] text-muted">{p.note}</span>}
                  </span>
                </button>
                <span className="rounded-lg bg-sunken px-2 py-0.5 font-mono text-xs tabular-nums">{p.skill.toFixed(1)}</span>
                <Menu
                  label={`Actions for ${p.name}`}
                  items={[
                    { label: "Edit", onSelect: () => setEditing(p) },
                    { label: p.archived ? "Unarchive" : "Archive", onSelect: () => toggleArchive(p) },
                    { label: "Delete", tone: "danger", onSelect: () => setDeleting(p) },
                  ]}
                />
              </div>
            ))}
          </Card>
        )}
      </main>

      {editing && (
        <PlayerForm player={editing === "new" ? undefined : editing} onSave={save} onCancel={() => setEditing(null)} />
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
