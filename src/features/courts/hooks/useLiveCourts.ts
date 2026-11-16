"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ActiveCourtView } from "@/types";

// Stable default so the sync effect below doesn't re-fire on every render.
const EMPTY_COURTS: ActiveCourtView[] = [];

/** Same shape as getCourts(): each court with its in-progress game and players (no photos). */
async function fetchCourtViews(supabase: ReturnType<typeof createClient>): Promise<Map<string, ActiveCourtView> | null> {
  const [courtsRes, matchesRes] = await Promise.all([
    supabase
      .from("courts")
      .select(
        "id, name, surface_type, status, current_match_id, sort_order, assigned_staff_id, assigned_staff:profiles!assigned_staff_id (id, full_name, display_name, skill_rating)"
      ),
    supabase
      .from("matches")
      .select(
        "id, session_id, court_id, format, match_type, status, team_a_score, team_b_score, winning_team, started_at, ended_at, players:match_players (id, team, player:profiles (id, full_name, display_name, skill_rating))"
      )
      .eq("status", "in_progress"),
  ]);
  if (courtsRes.error || !courtsRes.data) return null;
  const matchByCourt = new Map((matchesRes.data ?? []).map((m) => [m.court_id, m]));
  return new Map(
    courtsRes.data.map((c) => [c.id, { ...c, current_match: matchByCourt.get(c.id) ?? null } as unknown as ActiveCourtView])
  );
}

/**
 * Court cards that update on their own: when a court or a game on it changes
 * (someone called up, a score, a result), the cards re-read the courts, about
 * half a second later so a burst of changes becomes one small read. Keeps the
 * same courts it was given (a session shows only its own courts).
 */
export function useLiveCourts(initialCourts: ActiveCourtView[] = EMPTY_COURTS) {
  const [courts, setCourts] = useState<ActiveCourtView[]>(initialCourts);
  const idsRef = useRef<string[]>(initialCourts.map((c) => c.id));

  useEffect(() => {
    setCourts(initialCourts);
    idsRef.current = initialCourts.map((c) => c.id);
  }, [initialCourts]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function scheduleRefresh() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const fresh = await fetchCourtViews(supabase);
        if (cancelled || !fresh) return;
        setCourts((prev) => {
          const ids = idsRef.current.length ? idsRef.current : prev.map((c) => c.id);
          return ids.map((id) => fresh.get(id) ?? prev.find((c) => c.id === id)).filter(Boolean) as ActiveCourtView[];
        });
      }, 500);
    }

    // The browser client is a singleton and removeChannel is async, so a shared
    // name collides when the effect re-runs or two consumers mount at once.
    const channel = supabase
      .channel(`courts:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "courts" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, scheduleRefresh)
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  return { courts, setCourts };
}
