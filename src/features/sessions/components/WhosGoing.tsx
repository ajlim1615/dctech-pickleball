"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Search, UserPlus, X } from "lucide-react";
import { addRsvps, removeRsvp } from "@/features/sessions/api/rsvpActions";
import { createWalkInPlayer } from "@/features/admin/api/adminActions";

export interface GoingPlayer {
  playerId: string;
  name: string;
  avatarUrl: string | null;
}

const PREVIEW = 11;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "P";
}

/** Who said they're going: photo or initials, you first, the rest in sign-up order. */
export function WhosGoing({
  rsvps,
  currentUserId,
  sessionId,
  isAdmin = false,
  isRanked = true,
  availablePlayers = [],
}: {
  rsvps: GoingPlayer[];
  currentUserId?: string;
  sessionId?: string;
  isAdmin?: boolean;
  isRanked?: boolean;
  availablePlayers?: GoingPlayer[];
}) {
  const [showAll, setShowAll] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addTab, setAddTab] = useState<"roster" | "walkin">("roster");
  const [addSearch, setAddSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [walkInName, setWalkInName] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInRating, setWalkInRating] = useState(3.0);
  const [walkInIsGuest, setWalkInIsGuest] = useState(!isRanked);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, startAddTransition] = useTransition();
  const [, startTransition] = useTransition();

  const canManage = Boolean(isAdmin && sessionId);
  const canRemove = canManage;
  const me = rsvps.find((r) => r.playerId === currentUserId);
  const ordered = me ? [me, ...rsvps.filter((r) => r !== me)] : rsvps;
  const visible = showAll ? ordered : ordered.slice(0, PREVIEW);
  const hidden = ordered.length - visible.length;

  const filteredAvailable = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    if (!q) return availablePlayers;
    return availablePlayers.filter((p) => p.name.toLowerCase().includes(q));
  }, [availablePlayers, addSearch]);

  function toggleSelected(playerId: string) {
    setSelectedIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  }

  function handleAddSelected() {
    if (!sessionId || selectedIds.length === 0) return;
    setError(null);
    startAddTransition(async () => {
      const res = await addRsvps(sessionId, selectedIds);
      if (res?.error) {
        setError(res.error);
      } else {
        setSelectedIds([]);
        setAddSearch("");
        setShowAdd(false);
      }
    });
  }

  function handleAddWalkIn(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !walkInName.trim()) return;
    setError(null);
    const isGuestWalkIn = !isRanked && walkInIsGuest;
    startAddTransition(async () => {
      const created = await createWalkInPlayer({
        fullName: walkInName.trim(),
        email: !isGuestWalkIn && walkInEmail.trim() ? walkInEmail.trim() : undefined,
        isGuest: isGuestWalkIn,
        skillRating: walkInRating,
        sessionId,
      });
      if (created?.error || !created?.player) {
        setError(created?.error || "Could not create walk-in player.");
        return;
      }
      const rsvpRes = await addRsvps(sessionId, [created.player.id]);
      if (rsvpRes?.error) {
        setError(rsvpRes.error);
        return;
      }
      setWalkInName("");
      setWalkInEmail("");
      setShowAdd(false);
    });
  }

  function handleRemove(playerId: string) {
    if (!sessionId) return;
    setError(null);
    setRemovingId(playerId);
    setConfirmingId(null);
    startTransition(async () => {
      const res = await removeRsvp(sessionId, playerId);
      setRemovingId(null);
      if (res?.error) {
        setError(res.error);
      } else {
      }
    });
  }

  return (
    <section aria-labelledby="rsvp-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="rsvp-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
          Who&apos;s going <span className="font-mono text-slate-500 dark:text-slate-400">{rsvps.length}</span>
        </h2>
        <div className="flex items-center gap-3">
          {error && (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setWalkInIsGuest(!isRanked);
                setAddTab(availablePlayers.length === 0 ? "walkin" : "roster");
                setShowAdd((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              {showAdd ? "Close" : "Add player"}
            </button>
          )}
        </div>
      </div>

      {canManage && showAdd && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setAddTab("roster")}
              className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
                addTab === "roster"
                  ? "bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              From roster
            </button>
            <button
              type="button"
              onClick={() => {
                setWalkInIsGuest(!isRanked);
                setAddTab("walkin");
              }}
              className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
                addTab === "walkin"
                  ? "bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              + Walk-in {!isRanked ? "/ Guest" : ""}
            </button>
          </div>

          {addTab === "roster" ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Search players to add…"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
              {filteredAvailable.length === 0 ? (
                <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  No matching players left to add.
                </p>
              ) : (
                <ul className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                  {filteredAvailable.map((p) => {
                    const selected = selectedIds.includes(p.playerId);
                    return (
                      <li key={p.playerId}>
                        <button
                          type="button"
                          onClick={() => toggleSelected(p.playerId)}
                          className={`w-full flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-sm transition-colors cursor-pointer ${
                            selected
                              ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-semibold"
                              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                          }`}
                        >
                          <span
                            className={`h-4 w-4 shrink-0 rounded flex items-center justify-center border ${
                              selected
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-slate-300 dark:border-slate-600"
                            }`}
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                          <span className="truncate">{p.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds([]);
                    setAddSearch("");
                    setShowAdd(false);
                  }}
                  disabled={isAdding}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={isAdding || selectedIds.length === 0}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {isAdding
                    ? "Adding…"
                    : selectedIds.length > 0
                      ? `Add ${selectedIds.length} ${selectedIds.length === 1 ? "player" : "players"}`
                      : "Add selected"}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleAddWalkIn} className="space-y-3">
              {!isRanked ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setWalkInIsGuest(true)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                      walkInIsGuest
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-semibold"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div>Guest / Non-Employee</div>
                    <div className="text-[10px] font-normal opacity-75">No login · Casual only</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalkInIsGuest(false)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                      !walkInIsGuest
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-semibold"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div>DCTECH Employee</div>
                    <div className="text-[10px] font-normal opacity-75">Unregistered coworker</div>
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ranked session: only DCTECH employees can be added.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="Full name (e.g. Michael Chen)"
                  disabled={isAdding}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                <select
                  value={walkInRating}
                  onChange={(e) => setWalkInRating(parseFloat(e.target.value))}
                  disabled={isAdding}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                >
                  <option value="2.0">Beginner (2.0)</option>
                  <option value="2.5">Adv. Beginner (2.5)</option>
                  <option value="3.0">Intermediate (3.0)</option>
                  <option value="3.5">Adv. Intermediate (3.5)</option>
                  <option value="4.0">Advanced (4.0)</option>
                  <option value="4.5">Expert (4.5+)</option>
                </select>
              </div>

              {(isRanked || !walkInIsGuest) && (
                <input
                  type="email"
                  value={walkInEmail}
                  onChange={(e) => setWalkInEmail(e.target.value)}
                  placeholder="DCTECH work email (optional)"
                  disabled={isAdding}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                />
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  disabled={isAdding}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding || !walkInName.trim()}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {isAdding ? "Adding…" : "Add to Who's going"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {rsvps.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Be the first: tap I&apos;m going and you&apos;ll be shuffled into the line when it starts.
        </p>
      ) : (
        <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2.5">
          {visible.map((r) => {
            const isMe = r.playerId === currentUserId;
            const isConfirming = confirmingId === r.playerId;
            const isRemoving = removingId === r.playerId;
            const labelName = isMe ? "yourself" : r.name;

            return (
              <li key={r.playerId} className="group flex items-center gap-2.5 min-w-0">
                <span
                  className={`h-8 w-8 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-bold font-mono ${
                    isMe
                      ? "ring-2 ring-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(r.name)
                  )}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    isMe ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {isMe ? "You" : r.name}
                </span>
                {canRemove && (
                  isConfirming ? (
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleRemove(r.playerId)}
                        disabled={isRemoving}
                        aria-label={`Confirm removing ${labelName}`}
                        className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={isRemoving}
                        aria-label="Cancel removal"
                        className="rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(r.playerId)}
                      disabled={isRemoving}
                      aria-label={`Remove ${labelName} from Who's going`}
                      title={`Remove ${r.name}`}
                      className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-slate-400 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 disabled:opacity-50 cursor-pointer transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )
                )}
              </li>
            );
          })}
          {hidden > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="h-8 rounded-full px-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
              >
                Show all {ordered.length}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
