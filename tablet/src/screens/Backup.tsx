import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
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
      <main className="mx-auto grid w-full max-w-4xl flex-1 grid-cols-1 content-start gap-5 overflow-y-auto px-6 py-6 md:grid-cols-2">
        <Card className="flex flex-col gap-3 p-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-t1-bg text-t1">
            <Download size={20} />
          </span>
          <h2 className="font-serif text-xl font-semibold">Save a backup</h2>
          <p className="text-[15px] text-muted">
            One file with every player, session and game. Save it to Drive or send it to yourself, so a lost or reset
            tablet doesn't lose your history.
          </p>
          <p className="text-sm">
            Last backup:{" "}
            <span className="text-muted">{lastBackupAt ? new Date(lastBackupAt).toLocaleString() : "never"}</span>
          </p>
          <Button variant="primary" onClick={save} disabled={busy} className="mt-auto self-start">
            Save backup
          </Button>
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-t2-bg text-t2">
            <Upload size={20} />
          </span>
          <h2 className="font-serif text-xl font-semibold">Restore</h2>
          <p className="text-[15px] text-muted">
            Load a backup file, for example on a new tablet. It replaces everything on this tablet.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <Button onClick={() => fileInput.current?.click()} className="mt-auto self-start">
            Choose backup file
          </Button>
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
