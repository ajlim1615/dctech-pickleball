"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SessionEvent } from "@/types";

const EMPTY: SessionEvent[] = [];

/** The session's activity feed, with new events added as they happen. */
export function useLiveFeed(sessionId: string, initial: SessionEvent[] = EMPTY): SessionEvent[] {
  const [events, setEvents] = useState<SessionEvent[]>(initial);
  const [seenInitial, setSeenInitial] = useState(initial);

  // A server refresh brings a fresh list; take it.
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    setEvents(initial);
  }

  useEffect(() => {
    const supabase = createClient();
    // Random suffix: the browser client is shared and removeChannel is async.
    const channel = supabase
      .channel(`session_events:${sessionId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_events", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = { ...(payload.new as SessionEvent & { actor_id?: string }) };
          delete row.actor_id; // never keep who acted in the browser
          setEvents((prev) => (prev.some((e) => e.id === row.id) ? prev : [row as SessionEvent, ...prev]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return events;
}
