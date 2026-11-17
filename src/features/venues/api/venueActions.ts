"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/security/authGuard";
import { sanitizeString } from "@/lib/security/validation";
import { isValidMapsUrl } from "../utils/venueUtils";
import type { Venue } from "@/types";

export const getVenues = cache(async (): Promise<Venue[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, maps_url, address, notes, is_active, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("getVenues error:", error.message);
    return [];
  }
  return (data || []) as Venue[];
});

function validateVenueFields(params: {
  name: string;
  mapsUrl: string;
  address?: string;
  notes?: string;
}) {
  const name = sanitizeString(params.name);
  const mapsUrl = params.mapsUrl.trim();
  const address = sanitizeString(params.address || "") || null;
  const notes = sanitizeString(params.notes || "") || null;

  if (!name) {
    return { error: "Venue name is required." };
  }
  if (!isValidMapsUrl(mapsUrl)) {
    return { error: "Please enter a valid Google Maps link (starting with https:// or http://)." };
  }
  return { name, mapsUrl, address, notes };
}

function revalidateVenuePaths() {
  revalidatePath("/admin");
  revalidatePath("/sessions");
  revalidatePath("/sessions/[id]", "page");
  revalidatePath("/");
}

export async function createVenue(params: {
  name: string;
  mapsUrl: string;
  address?: string;
  notes?: string;
}): Promise<{ success?: boolean; venue?: Venue; error?: string }> {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const validated = validateVenueFields(params);
  if ("error" in validated) return { error: validated.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .insert({
      name: validated.name,
      maps_url: validated.mapsUrl,
      address: validated.address,
      notes: validated.notes,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "A venue with this name already exists." };
    }
    return { error: error.message };
  }

  revalidateVenuePaths();
  return { success: true, venue: data as Venue };
}

export async function updateVenue(
  venueId: string,
  params: {
    name: string;
    mapsUrl: string;
    address?: string;
    notes?: string;
  }
): Promise<{ success?: boolean; venue?: Venue; error?: string }> {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const validated = validateVenueFields(params);
  if ("error" in validated) return { error: validated.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .update({
      name: validated.name,
      maps_url: validated.mapsUrl,
      address: validated.address,
      notes: validated.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", venueId)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "A venue with this name already exists." };
    }
    return { error: error.message };
  }

  revalidateVenuePaths();
  return { success: true, venue: data as Venue };
}

export async function setVenueActive(
  venueId: string,
  isActive: boolean
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("venues")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", venueId);

  if (error) return { error: error.message };

  revalidateVenuePaths();
  return { success: true };
}
