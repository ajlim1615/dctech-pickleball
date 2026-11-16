"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntryWithPlayer } from "@/types";

/** Entries that belong in the line (on a court or gone means out of it). */
const inLine = (status: string) => status !== "left" && status !== "playing";

const byJoinTime = (a: QueueEntryWithPlayer, b: QueueEntryWithPlayer) =>
  a.joined_at < b.joined_at ? -1 : a.joined_at > b.joined_at ? 1 : 0;

/**
 * One session's line, kept live. Listens only to that session's entries; when a
 * new entry shows up (a join, or a rejoin after leaving) it fetches that one row
 * with the player's name, so new people never appear nameless.
 */
export function useLiveQueue(initialQueue: QueueEntryWithPlayer[] = [], currentUserId?: string, sessionId?: string) {
  const [queue, setQueue] = useState<QueueEntryWithPlayer[]>(initialQueue);
  const [calledAlert, setCalledAlert] = useState<{ courtId?: string | null } | null>(null);

  useEffect(() => {
    setQueue(initialQueue);
  }, [initialQueue]);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    let cancelled = false;
    // The browser client is a singleton and removeChannel is async, so a shared
    // name collides when the effect re-runs or two boards mount at once.
    const channelName = `queue_entries:${sessionId}:${Math.random().toString(36).slice(2)}`;

    async function addWithPlayer(id: string) {
      const { data } = await supabase
        .from("queue_entries")
        .select("*, player:profiles (id, full_name, display_name, skill_rating)")
        .eq("id", id)
        .maybeSingle();
      if (cancelled || !data || !inLine(data.status)) return;
      const row = data as unknown as QueueEntryWithPlayer;
      setQueue((prev) => [...prev.filter((q) => q.id !== row.id), row].sort(byJoinTime));
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setQueue((prev) => prev.filter((item) => item.id !== payload.old.id));
            return;
          }

          const row = payload.new as QueueEntryWithPlayer;
          if (!inLine(row.status)) {
            setQueue((prev) => prev.filter((item) => item.id !== row.id));
          } else {
            setQueue((prev) => {
              if (!prev.some((item) => item.id === row.id)) {
                // New to this list: fetch it with the player's name.
                void addWithPlayer(row.id);
                return prev;
              }
              return prev.map((item) => (item.id === row.id ? { ...item, ...row } : item)).sort(byJoinTime);
            });
          }

          // The current player was just put on a court ("called" is kept for older data).
          if (
            payload.eventType === "UPDATE" &&
            currentUserId &&
            row.player_id === currentUserId &&
            (row.status === "playing" || row.status === "called")
          ) {
            setCalledAlert({ courtId: row.target_court_id });
            if (typeof window !== "undefined" && "vibrate" in navigator) {
              try {
                navigator.vibrate([200, 100, 200, 100, 400]);
              } catch {
                // Ignore vibration error
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, sessionId]);

  // Players on a break keep their entry but are not in line.
  const myPosition = currentUserId
    ? queue.filter((q) => q.status !== "on_break").findIndex((q) => q.player_id === currentUserId) + 1
    : 0;

  return {
    queue,
    myPosition: myPosition > 0 ? myPosition : null,
    calledAlert,
    dismissAlert: () => setCalledAlert(null),
  };
}
