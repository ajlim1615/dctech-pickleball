import { useEffect, useRef, useState } from "react";
import type { Navigate } from "../App";
import { Button, Card, ScreenHeader, toast, ConfirmSheet } from "../components/ui";

import { getMeta, setMeta } from "../db/repo";
import { backupFileName, parseBackup, restoreBackup, serializeBackup, type BackupData } from "../io/backup";
import { shareFile } from "../io/native";

export function Backup({ navigate }: { navigate: Navigate }) {
  const [lastBackupAt, setLastBackupAt] = useState<string | undefined>();
  const [pending, setPending] = useState<BackupData | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMeta("lastBackupAt").then(setLastBackupAt);
  }, []);

  async function save() {
    setBusy(true);
    try {
      const text = await serializeBackup();
      await shareFile(backupFileName(new Date()), text, "application/json");
      const now = new Date().toISOString();
      await setMeta("lastBackupAt", now);
      setLastBackupAt(now);
    } catch {
      toast("The backup couldn't be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    const result = parseBackup(await file.text());
    if (fileInput.current) fileInput.current.value = "";
    if (!result.ok) {
      toast(result.reason);
      return;
    }
    setPending(result.data);
  }

  async function restore(data: BackupData) {
    setPending(null);
    try {
      await restoreBackup(data);
      toast(`Restored ${data.players.length} players and ${data.sessions.length} sessions.`);
      navigate({ name: "home" });
    } catch {
      toast("The restore failed, so nothing was changed.");
    }
  }

  return (
    <>
      <ScreenHeader title="Backup" onBack={() => navigate({ name: "home" })} />
      <main className="mx-auto grid w-full max-w-4xl flex-1 grid-cols-2 content-start gap-6 overflow-y-auto p-6">
        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">Save a backup</h2>
          <p className="text-sm text-muted-foreground">
            One file with every player, session and game. Save it to Drive or send it to yourself, so a lost or reset
            tablet doesn't lose your history.
          </p>
          <p className="text-sm">
            Last backup:{" "}
            <span className="text-muted-foreground">
              {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : "never"}
            </span>
          </p>
          <Button variant="primary" onClick={save} disabled={busy}>
            Save backup
          </Button>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">Restore</h2>
          <p className="text-sm text-muted-foreground">
            Load a backup file, for example on a new tablet. It replaces everything on this tablet.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <Button onClick={() => fileInput.current?.click()}>Choose backup file</Button>
        </Card>
      </main>

      {pending && (
        <ConfirmSheet
          title="Replace everything on this tablet?"
          body={`This backup has ${pending.players.length} players and ${pending.sessions.length} sessions. Everything on this tablet now will be replaced.`}
          confirmLabel="Restore"
          danger
          onConfirm={() => restore(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}
