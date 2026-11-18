"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toUpNextCards, type UpNextCard, type UpNextCardRow, type UpNextPlayerRow } from "@/features/queue/upNext/types";

export type UpNextTable = "up_next_matches" | "up_next_players";

export type UpNextSubscription = {
  event: "INSERT" | "UPDATE" | "DELETE";
  table: UpNextTable;
  filter?: string;
};

/**
 * Supabase Realtime ignores column filters on DELETE unless REPLICA IDENTITY FULL
 * is enabled, so INSERT/UPDATE filter by session_id and DELETE listens unfiltered
 * (narrowed client-side by `deletionConcernsUs`).
 */
export function upNextSubscriptions(sessionId: string): UpNextSubscription[] {
  const filter = `session_id=eq.${sessionId}`;
  return [
    { event: "INSERT", table: "up_next_matches", filter },
    { event: "UPDATE", table: "up_next_matches", filter },
    { event: "DELETE", table: "up_next_matches" },
    { event: "INSERT", table: "up_next_players", filter },
    { event: "UPDATE", table: "up_next_players", filter },
    { event: "DELETE", table: "up_next_players" },
  ];
}

/** True when a realtime DELETE event belongs to one of the cards currently on screen. */
export function deletionConcernsUs(
  table: UpNextTable,
  oldRow: { id?: string; card_id?: string },
  cardIds: Set<string>
): boolean {
  const key = table === "up_next_matches" ? oldRow.id : oldRow.card_id;
  return Boolean(key && cardIds.has(key));
}

/**
 * Resolves a live Up Next fetch into cards, or `null` when stale, cancelled, or
 * failed so transient errors and out-of-order loads never wipe visible cards.
 */
export function resolveUpNextLoad(input: {
  seq: number;
  latestSeq: number;
  cancelled: boolean;
  rowsError: unknown;
  playersError: unknown;
  rows: UpNextCardRow[] | null;
  players: UpNextPlayerRow[] | null;
}): UpNextCard[] | null {
  if (input.cancelled || input.seq !== input.latestSeq) return null;
  if (input.rowsError || input.playersError) return null;
  return toUpNextCards(input.rows ?? [], input.players ?? []);
}

/**
 * One session's Up Next cards, kept live. Call once per page and pass `cards` down.
 */
export function useLiveUpNext(sessionId?: string, initial: UpNextCard[] = []): UpNextCard[] {
  const [cards, setCards] = useState<UpNextCard[]>(initial);
  const cardIdsRef = useRef<Set<string>>(new Set(initial.map((c) => c.id)));

  useEffect(() => {
    if (!sessionId) {
      cardIdsRef.current = new Set();
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    let loadSeq = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      const seq = ++loadSeq;
      const [{ data: rows, error: rowsError }, { data: players, error: playersError }] = await Promise.all([
        supabase.from("up_next_matches").select("id, position, per_side, target_court_id, is_auto").eq("session_id", sessionId!),
        supabase.from("up_next_players").select("card_id, player_id, team, slot, player:profiles ( full_name, display_name )").eq("session_id", sessionId!),
      ]);
      if (rowsError || playersError) {
        console.error("useLiveUpNext load failed:", rowsError?.message ?? playersError?.message);
      }
      const next = resolveUpNextLoad({
        seq,
        latestSeq: loadSeq,
        cancelled,
        rowsError,
        playersError,
        rows: rows as UpNextCardRow[] | null,
        players: players as unknown as UpNextPlayerRow[] | null,
      });
      if (!next) return;
      cardIdsRef.current = new Set(next.map((c) => c.id));
      setCards(next);
    }
    // A rebuild writes several rows at once; reload once they've all landed.
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 150);
    };

    void load();
    let channel = supabase.channel(`up_next:${sessionId}:${Math.random().toString(36).slice(2)}`);
    for (const sub of upNextSubscriptions(sessionId)) {
      const config = sub.filter
        ? { event: sub.event, schema: "public" as const, table: sub.table, filter: sub.filter }
        : { event: sub.event, schema: "public" as const, table: sub.table };
      channel = channel.on("postgres_changes", config, (payload) => {
        if (sub.event !== "DELETE") {
          reload();
          return;
        }
        const old = (payload.old ?? {}) as { id?: string; card_id?: string };
        const hasKey = sub.table === "up_next_matches" ? Boolean(old.id) : Boolean(old.card_id);
        if (!hasKey || deletionConcernsUs(sub.table, old, cardIdsRef.current)) {
          reload();
        }
      });
    }
    channel.subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return sessionId ? cards : [];
}
