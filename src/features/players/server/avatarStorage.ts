import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Profile photos live in the public "avatars" Storage bucket as `<player id>.jpg`;
 * profiles.avatar_url holds only the file's public URL plus `?v=<time>`, so a new
 * upload shows straight away while browsers and the CDN cache each version.
 *
 * Server-only: uses the service key, so callers must check who is acting first.
 */
const BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 250 * 1024;

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export function avatarPath(playerId: string) {
  return `${playerId}.jpg`;
}

/** Saves a cropped photo (a data URL from the browser) and returns its public URL. */
export async function saveAvatar(playerId: string, dataUrl: string): Promise<{ url?: string; error?: string }> {
  const match = DATA_URL.exec(dataUrl);
  if (!match) return { error: "That photo couldn't be read. Try a JPG or PNG." };
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.byteLength === 0) return { error: "That photo is empty. Try another one." };
  if (bytes.byteLength > MAX_AVATAR_BYTES) return { error: "That photo is too large (250 KB max)." };

  const storage = createAdminClient().storage.from(BUCKET);
  const { error } = await storage.upload(avatarPath(playerId), bytes, {
    contentType: match[1],
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) return { error: `The photo couldn't be saved: ${error.message}` };

  const { data } = storage.getPublicUrl(avatarPath(playerId));
  return { url: `${data.publicUrl}?v=${Date.now()}` };
}

/** Deletes a player's photo file. A missing file is fine. */
export async function deleteAvatar(playerId: string): Promise<void> {
  const { error } = await createAdminClient().storage.from(BUCKET).remove([avatarPath(playerId)]);
  if (error) console.error("deleteAvatar failed:", error.message);
}
