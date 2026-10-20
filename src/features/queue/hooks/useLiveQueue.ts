"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntryWithPlayer } from "@/types";

export function useLiveQueue(initialQueue: QueueEntryWithPlayer[] = [], currentUserId?: string) {
  const [queue, setQueue] = useState<QueueEntryWithPlayer[]>(initialQueue);
  const [calledAlert, setCalledAlert] = useState<{ courtId?: string | null } | null>(null);

  useEffect(() => {
    setQueue(initialQueue);
  }, [initialQueue]);

  useEffect(() => {
    const supabase = createClient();
    // The browser client is a singleton and removeChannel is async, so a shared
    // name collides when the effect re-runs or two boards mount at once.
    const channelName = `queue_entries:${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // When new entry arrives, fetch fresh or append
            setQueue((prev) => [...prev, payload.new as unknown as QueueEntryWithPlayer]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as QueueEntryWithPlayer;
            if (updated.status === "left" || updated.status === "playing") {
              setQueue((prev) => prev.filter((item) => item.id !== updated.id));
            } else {
              setQueue((prev) =>
                prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
              );
            }

            // The current player was just put on a court ("called" is kept for older data).
            if (
              currentUserId &&
              updated.player_id === currentUserId &&
              (updated.status === "playing" || updated.status === "called")
            ) {
              setCalledAlert({ courtId: updated.target_court_id });
              if (typeof window !== "undefined" && "vibrate" in navigator) {
                try {
                  navigator.vibrate([200, 100, 200, 100, 400]);
                } catch {
                  // Ignore vibration error
                }
              }
            }
          } else if (payload.eventType === "DELETE") {
            setQueue((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

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
