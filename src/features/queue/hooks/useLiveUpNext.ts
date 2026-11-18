"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toUpNextCards, type UpNextCard, type UpNextCardRow, type UpNextPlayerRow } from "@/features/queue/upNext/types";

/**
 * One session's Up Next cards, kept live. Any change to the cards (or who is in
 * them) reloads the set; there are only a handful of rows per session.
 */
export function useLiveUpNext(sessionId?: string, initial: UpNextCard[] = []): UpNextCard[] {
  const [cards, setCards] = useState<UpNextCard[]>(initial);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      const [{ data: rows }, { data: players }] = await Promise.all([
        supabase.from("up_next_matches").select("id, position, per_side, target_court_id, is_auto").eq("session_id", sessionId!),
        supabase.from("up_next_players").select("card_id, player_id, team, slot").eq("session_id", sessionId!),
      ]);
      if (!cancelled) setCards(toUpNextCards((rows ?? []) as UpNextCardRow[], (players ?? []) as UpNextPlayerRow[]));
    }
    // A rebuild writes several rows at once; reload once they've all landed.
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 150);
    };

    void load();
    const channel = supabase
      .channel(`up_next:${sessionId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "up_next_matches", filter: `session_id=eq.${sessionId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "up_next_players", filter: `session_id=eq.${sessionId}` }, reload)
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return cards;
}
