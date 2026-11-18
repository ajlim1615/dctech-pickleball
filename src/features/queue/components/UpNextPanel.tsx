"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, RefreshCw, Send, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useFlashMessage } from "@/hooks/useFlashMessage";
import { createClient } from "@/lib/supabase/client";
import {
  deleteUpNextCard,
  rebuildUpNext,
  refreshUpNext,
  saveUpNextCard,
  sendUpNextToCourt,
} from "@/features/queue/api/upNextActions";
import { canSendCard } from "@/features/courts/utils/courtRules";
import { PlayerPickerSheet } from "./PlayerPickerSheet";
import type { UpNextCard } from "@/features/queue/upNext/types";
import type { ActiveCourtView, QueueEntryWithPlayer } from "@/types";

type Team = "teamA" | "teamB";

/**
 * The next matches, as cards. Admins edit them (remove a player, fill a slot, add or
 * delete a card, rebuild) and send them to a court; everyone else sees them read-only.
 */
export function UpNextPanel({
  sessionId,
  courts,
  queue,
  cards,
  isAdmin,
}: {
  sessionId: string;
  courts: ActiveCourtView[];
  queue: QueueEntryWithPlayer[];
  cards: UpNextCard[];
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const { message, flash, clear } = useFlashMessage();
  const [filling, setFilling] = useState<{ card: UpNextCard | null; team: Team } | null>(null);

  const waiting = queue.filter((q) => q.status === "waiting");
  const courtName = (id: string) => courts.find((c) => c.id === id)?.name ?? "court";
  const freeCourtIds = courts.filter((c) => c.status === "available" && !c.current_match_id).map((c) => c.id);
  const carded = new Set(cards.flatMap((c) => [...c.teamA, ...c.teamB]));

  // Admin screens rebuild the auto cards when the line changes (players joining or
  // leaving from their own phones don't trigger it themselves).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isAdmin) return;
    void refreshUpNext(sessionId);
    const supabase = createClient();
    const channel = supabase
      .channel(`up_next_line:${sessionId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `session_id=eq.${sessionId}` }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void refreshUpNext(sessionId), 1500);
      })
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, sessionId]);

  function run(action: () => Promise<{ success: true } | { error: string }>, done?: string) {
    clear();
    startTransition(async () => {
      const res = await action();
      if ("error" in res) flash("error", res.error);
      else if (done) flash("success", done);
    });
  }

  function save(card: UpNextCard | null, teamA: string[], teamB: string[]) {
    run(async () => {
      const res = await saveUpNextCard(sessionId, card?.id ?? null, teamA, teamB, card?.targetCourtId ?? null);
      if ("success" in res && res.unpaired.length > 0) flash("success", "That split a pair; they are no longer paired.");
      return res;
    });
  }

  function send(card: UpNextCard) {
    const courtId = card.targetCourtId ?? freeCourtIds[0];
    if (!courtId) return;
    run(() => sendUpNextToCourt(sessionId, card.id, courtId), `Started on ${courtName(courtId)}.`);
  }

  const teamList = (card: UpNextCard, team: Team, label: string, tone: string) => (
    <div className={`min-w-0 rounded-lg border-t-2 ${tone} bg-slate-50 dark:bg-slate-900/60 p-2`}>
      <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <ul className="min-w-0 space-y-1">
        {Array.from({ length: card.perSide }, (_, i) => card[team][i]).map((id, i) =>
          id ? (
            <li key={id} className="flex min-h-11 min-w-0 items-center justify-between gap-1 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">{card.names[id] ?? "Player"}</span>
              {isAdmin && (
                <IconButton
                  label={`Take ${card.names[id] ?? "Player"} out of this match`}
                  disabled={pending}
                  onClick={() =>
                    save(card, card.teamA.filter((p) => p !== id), card.teamB.filter((p) => p !== id))
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              )}
            </li>
          ) : (
            <li key={`empty-${i}`} className="min-w-0">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setFilling({ card, team })}
                  className="min-h-11 w-full truncate rounded-md border border-dashed border-slate-400 dark:border-slate-600 text-left px-2 text-sm text-slate-500 hover:border-emerald-500 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
                >
                  + Add player
                </button>
              ) : (
                <span className="flex min-h-11 items-center text-sm text-slate-400">Open spot</span>
              )}
            </li>
          )
        )}
      </ul>
    </div>
  );

  return (
    <section aria-labelledby="up-next-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="up-next-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
          Up Next <span className="text-slate-400">({cards.length})</span>
        </h2>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => run(() => rebuildUpNext(sessionId), "Rebuilt the auto matches.")}
              disabled={pending}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
            >
              <RefreshCw className="h-4 w-4" /> Rebuild
            </button>
            <button
              type="button"
              onClick={() => setFilling({ card: null, team: "teamA" })}
              disabled={pending || waiting.length === 0}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-emerald-500"
            >
              <Plus className="h-4 w-4" /> Add match
            </button>
          </div>
        )}
      </div>

      {message && (
        <div
          role={message.kind === "error" ? "alert" : "status"}
          className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
            message.kind === "error"
              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          <span>{message.text}</span>
          {message.kind === "error" && (
            <IconButton label="Dismiss message" onClick={clear} tone="danger">
              <X className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      )}

      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Not enough players waiting for the next match yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {cards.map((card) => (
            <article key={card.id} className="space-y-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-3">
              <header className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Up Next {card.position}
                  {card.isAuto && (
                    <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-500">Auto</span>
                  )}
                  {card.targetCourtId && <span className="ml-2 text-xs font-medium text-slate-500">for {courtName(card.targetCourtId)}</span>}
                </p>
                {isAdmin && (
                  <IconButton
                    label={`Delete Up Next ${card.position}`}
                    onClick={() => run(() => deleteUpNextCard(sessionId, card.id))}
                    disabled={pending}
                  >
                    <X className="h-4 w-4" />
                  </IconButton>
                )}
              </header>
              <div className="grid grid-cols-2 gap-2">
                {teamList(card, "teamA", "Team 1", "border-emerald-500")}
                {teamList(card, "teamB", "Team 2", "border-sky-500")}
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => send(card)}
                  disabled={pending || !canSendCard(card, freeCourtIds)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                  {canSendCard(card, freeCourtIds)
                    ? `Send to ${courtName(card.targetCourtId ?? freeCourtIds[0])}`
                    : card.teamA.length + card.teamB.length < card.perSide * 2
                      ? "Fill every slot to send"
                      : "No free court"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {filling && (
        <PlayerPickerSheet
          title={filling.card ? `Add to Up Next ${filling.card.position}` : "New match: pick the first player"}
          candidates={waiting.filter((q) => !carded.has(q.player_id))}
          onPick={(id) => {
            const card = filling.card;
            const teamA = card ? [...card.teamA] : [];
            const teamB = card ? [...card.teamB] : [];
            (filling.team === "teamA" ? teamA : teamB).push(id);
            save(card, teamA, teamB);
            setFilling(null);
          }}
          onClose={() => setFilling(null)}
        />
      )}
    </section>
  );
}
