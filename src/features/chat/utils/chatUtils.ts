import type { ClubMessage } from "@/types";

export const DEFAULT_CHAT_ROOM = "club";
export const MAX_CHAT_LENGTH = 300;
export const CHAT_COOLDOWN_MS = 2000;
export const CHAT_HISTORY_LIMIT = 40;
export const CHAT_IDLE_DISCONNECT_MS = 60_000;

/**
 * Validates and trims a chat message body before sending.
 */
export function validateChatMessageBody(raw: string): { ok: true; body: string } | { ok: false; error: string } {
  const body = raw.replace(/\0/g, "").trim();
  if (!body) {
    return { ok: false, error: "Type a message first." };
  }
  if (body.length > MAX_CHAT_LENGTH) {
    return { ok: false, error: `Keep messages under ${MAX_CHAT_LENGTH} characters.` };
  }
  return { ok: true, body };
}

/**
 * Deduplicates and merges existing + incoming chat messages in chronological order,
 * capping the in-memory list to `maxKeep` most recent messages.
 */
export function mergeChatMessages(
  existing: ClubMessage[],
  incoming: ClubMessage[],
  maxKeep: number = 50
): ClubMessage[] {
  const byId = new Map<string, ClubMessage>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);

  const sorted = Array.from(byId.values()).toSorted((a, b) =>
    a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at)
  );
  return sorted.length > maxKeep ? sorted.slice(sorted.length - maxKeep) : sorted;
}

/**
 * Maps Postgres / RLS trigger error messages to user-friendly feedback.
 */
export function friendlyChatError(rawError?: string | null): string {
  const msg = (rawError || "").toLowerCase();
  if (msg.includes("rate_limit")) {
    return "Please wait 2 seconds between messages.";
  }
  if (msg.includes("inactive_profile") || msg.includes("not_authenticated")) {
    return "Please sign in with an active player account to chat.";
  }
  return "Couldn't send message right now. Please try again.";
}
