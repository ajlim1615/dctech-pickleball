"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ActiveCourtView } from "@/types";

export function useLiveCourts(initialCourts: ActiveCourtView[] = []) {
  const [courts, setCourts] = useState<ActiveCourtView[]>(initialCourts);

  useEffect(() => {
    setCourts(initialCourts);
  }, [initialCourts]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("realtime:courts")
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
