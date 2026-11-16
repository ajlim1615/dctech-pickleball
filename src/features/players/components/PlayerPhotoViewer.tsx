"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, Trash2, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { removePlayerPhoto } from "@/features/admin/api/adminActions";

export interface PhotoTarget {
  id: string;
  name: string;
  avatarUrl: string;
}

/**
 * Full-size view of a player's profile photo. Admins also get "Remove photo",
 * behind a second confirm, which clears the photo (not the account).
 */
export function PlayerPhotoViewer({
  target,
  canRemove,
  onClose,
  onRemoved,
}: {
  target: PhotoTarget | null;
  canRemove: boolean;
  onClose: () => void;
  onRemoved?: (playerId: string) => void;
}) {
  const [removing, setRemoving] = useState(false);
  return (
    <Modal isOpen={Boolean(target)} onClose={() => !removing && onClose()}>
      {/* Keyed by player so each photo opens with a fresh confirm/error state. */}
      {target && (
        <PhotoBody
          key={target.id}
          target={target}
          canRemove={canRemove}
          onClose={onClose}
          onRemoved={onRemoved}
          removing={removing}
          setRemoving={setRemoving}
        />
      )}
    </Modal>
  );
}

function PhotoBody({
  target,
  canRemove,
  onClose,
  onRemoved,
  removing,
  setRemoving,
}: {
  target: PhotoTarget;
  canRemove: boolean;
  onClose: () => void;
  onRemoved?: (playerId: string) => void;
  removing: boolean;
  setRemoving: (v: boolean) => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    const res = await removePlayerPhoto(target.id);
    setRemoving(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    onRemoved?.(target.id);
    onClose();
    router.refresh();
  }

  return (
        <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl cursor-default">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">{target.name}</h3>
            <button
              type="button"
              onClick={onClose}
              disabled={removing}
              aria-label="Close photo"
              className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={target.avatarUrl}
            alt={`Profile photo of ${target.name}`}
            className="w-full aspect-square object-cover rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950"
          />

          {error && (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          {canRemove &&
            (confirming ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/30 p-3 space-y-3">
                <p className="text-sm text-rose-800 dark:text-rose-200">
                  Remove {target.name}&apos;s photo? They&apos;ll show their initials until they add a new one.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirming(false)}
                    disabled={removing}
                    className="h-10 text-xs font-semibold cursor-pointer"
                  >
                    Keep it
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleRemove}
                    disabled={removing}
                    className="h-10 text-xs font-bold cursor-pointer"
                  >
                    <ImageOff className="h-4 w-4 mr-1.5" />
                    {removing ? "Removing…" : "Yes, remove photo"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirming(true)}
                  className="h-10 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Remove photo
                </Button>
              </div>
            ))}
        </div>
  );
}
