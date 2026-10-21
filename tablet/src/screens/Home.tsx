import { useEffect, useState } from "react";
import { Archive, ChevronRight, Plus, Users } from "lucide-react";
import type { Navigate } from "../App";
import { Button, Card } from "../components/ui";
import { getMeta, listPlayers, listSessions } from "../db/repo";
import type { DeskSession } from "../engine/types";
import { formatDate, styleLabel } from "../lib/ctx";
import { backupReminder } from "../lib/backupReminder";

export function Home({ navigate }: { navigate: Navigate }) {
  const [sessions, setSessions] = useState<DeskSession[]>([]);
  const [reminder, setReminder] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [all, players, lastBackupAt] = await Promise.all([listSessions(), listPlayers(), getMeta("lastBackupAt")]);
      setSessions(all);
      setPlayerCount(players.length);
      setReminder(backupReminder(lastBackupAt, players.length > 0 || all.length > 0));
    })();
  }, []);

  const live = sessions.find((s) => s.status === "live");
  const past = sessions.filter((s) => s.status === "ended");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pickleball Desk</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate({ name: "roster" })}>
            <Users size={18} /> Roster <span className="font-mono tabular-nums">{playerCount}</span>
          </Button>
          <Button variant="ghost" onClick={() => navigate({ name: "backup" })}>
            <Archive size={18} /> Backup
          </Button>
        </div>
      </header>

      {reminder && (
        <button
          type="button"
          onClick={() => navigate({ name: "backup" })}
          className="min-h-11 rounded-lg border border-amber/40 bg-amber/10 px-4 text-left text-sm text-amber"
        >
          {reminder} Tap to back up.
        </button>
      )}

      {live ? (
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-volt">Live now</p>
            <p className="text-xl font-semibold">{live.title}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(live.date)} · {live.courts.length} courts · {styleLabel(live.matchingStyle)}
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate({ name: "live", sessionId: live.id })}>
            Open live board
          </Button>
        </Card>
      ) : (
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xl font-semibold">No session running</p>
            <p className="text-sm text-muted-foreground">Set up courts and matchmaking, then check players in.</p>
          </div>
          <Button variant="primary" onClick={() => navigate({ name: "new" })}>
            <Plus size={18} /> New session
          </Button>
        </Card>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Past sessions</h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ended sessions show up here with their results.</p>
        ) : (
          <Card className="divide-y divide-border">
            {past.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate({ name: "summary", sessionId: s.id })}
                className="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-muted/50"
              >
                <span className="flex-1">
                  <span className="block font-medium">{s.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {formatDate(s.date)} · {styleLabel(s.matchingStyle)}
                  </span>
                </span>
                <ChevronRight size={18} className="text-muted-foreground" />
              </button>
            ))}
          </Card>
        )}
      </section>
    </main>
  );
}
