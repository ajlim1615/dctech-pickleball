"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ClientUserProfile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  skill_rating: number;
}

type Listener = () => void;

let cachedProfile: ClientUserProfile | null = null;
let hasFetched = false;
let inflight: Promise<ClientUserProfile | null> | null = null;
let authSubscriptionAttached = false;
const listeners = new Set<Listener>();

function notify(profile: ClientUserProfile | null) {
  cachedProfile = profile;
  hasFetched = true;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ClientUserProfile | null {
  return cachedProfile;
}

function getServerSnapshot(): ClientUserProfile | null {
  return null;
}

async function fetchSharedProfile(force = false): Promise<ClientUserProfile | null> {
  if (hasFetched && !force) return cachedProfile;
  if (inflight && !force) return inflight;

  const supabase = createClient();
  inflight = (async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        notify(null);
        return null;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name, display_name, avatar_url, role, skill_rating")
        .eq("id", user.id)
        .single();

      const next = (profile as ClientUserProfile | null) ?? null;
      notify(next);
      return next;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Forces a refresh of the shared client user profile cache (e.g. after avatar or name updates).
 */
export function refreshClientUserProfile(): Promise<ClientUserProfile | null> {
  return fetchSharedProfile(true);
}

/**
 * Shares a single Supabase auth + profile fetch and subscription across
 * layout navigation components (Navbar and MobileBottomNav).
 */
export function useClientUserProfile(enabled = true): ClientUserProfile | null {
  const profile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!enabled) return;

    if (!hasFetched) {
      void fetchSharedProfile();
    }

    if (!authSubscriptionAttached) {
      authSubscriptionAttached = true;
      const supabase = createClient();
      supabase.auth.onAuthStateChange(() => {
        void fetchSharedProfile(true);
      });
    }
  }, [enabled]);

  return enabled ? profile : null;
}

/**
 * Returns true if the browser is not on Save-Data or a very slow 2G connection.
 */
export function shouldPrefetchOnIntent(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  return conn.effectiveType !== "slow-2g" && conn.effectiveType !== "2g";
}
