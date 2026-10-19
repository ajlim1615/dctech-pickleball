"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ActiveCourtView } from "@/types";

// Stable default so the sync effect below doesn't re-fire on every render.
const EMPTY_COURTS: ActiveCourtView[] = [];

export function useLiveCourts(initialCourts: ActiveCourtView[] = EMPTY_COURTS) {
  const [courts, setCourts] = useState<ActiveCourtView[]>(initialCourts);

  useEffect(() => {
    setCourts(initialCourts);
  }, [initialCourts]);

  useEffect(() => {
    const supabase = createClient();
    // The browser client is a singleton and removeChannel is async, so a shared
    // name collides when the effect re-runs or two consumers mount at once.
    const channelName = `courts:${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "courts" },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setCourts((prev) =>
              prev.map((court) =>
                court.id === payload.new.id
                  ? { ...court, ...payload.new }
                  : court
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { courts, setCourts };
}
