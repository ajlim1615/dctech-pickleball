import type { ClubMessage } from "@/types";

export const MAX_CHAT_LENGTH = 280;
export const CHAT_HISTORY_LIMIT = 40;
export const CHAT_COOLDOWN_MS = 2000;
export const CHAT_IDLE_DISCONNECT_MS = 60_000;
export const CHAT_UNSEND_WINDOW_MS = 5 * 60 * 1000;
export const DEFAULT_CHAT_ROOM = "club";
export const UNSENT_MESSAGE_TEXT = "Unsent message";
export const SUPERADMIN_CHAT_EMAIL = "admin@dctechmicro.com";

export function validateChatMessageBody(raw: string): {
  ok: boolean;
  body: string;
  error: string | null;
} {
  const body = raw.trim();
  if (body.length === 0) {
    return { ok: false, body: "", error: "Message cannot be empty." };
  }
  if (body.length > MAX_CHAT_LENGTH) {
    return {
      ok: false,
      body,
      error: `Message cannot exceed ${MAX_CHAT_LENGTH} characters.`,
    };
  }
  return { ok: true, body, error: null };
}

/**
 * True only for the dedicated admin@dctechmicro.com account, which can
 * permanently delete any message in the chat at any time.
 */
export function isSuperAdminChatEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === SUPERADMIN_CHAT_EMAIL;
}

/**
 * Returns true if the current player can unsend (soft-delete to "Unsent message")
 * their own message within the 5-minute window.
 */
export function canUnsendMessage(
  message: Pick<ClubMessage, "sender_id" | "created_at" | "is_unsent">,
  currentUserId: string | null,
  nowMs: number = Date.now()
): boolean {
  if (!currentUserId || message.is_unsent) return false;
  if (message.sender_id !== currentUserId) return false;

  const createdAtMs = new Date(message.created_at).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  return nowMs - createdAtMs <= CHAT_UNSEND_WINDOW_MS;
}

/**
 * Counts active (non-unsent) messages currently in the chat history.
 */
export function countActiveChatMessages(
  messages: ReadonlyArray<Pick<ClubMessage, "is_unsent">>
): number {
  let count = 0;
  for (const m of messages) {
    if (!m.is_unsent) count += 1;
  }
  return count;
}

/**
 * Parses a timestamp to epoch ms. REST rows arrive in the database's Manila
 * offset ("…10:39:20.13253+08:00") while realtime rows arrive in UTC
 * ("…02:39:20.13253+00:00"), so timestamps must never be compared as strings.
 */
export function timestampMs(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

/** True when `createdAt` is strictly later than `lastSeenAt` (or nothing has been seen yet). */
function isAfterLastSeen(createdAt: string, lastSeenAt: string | null): boolean {
  const seenMs = timestampMs(lastSeenAt);
  if (Number.isNaN(seenMs)) return true;
  return timestampMs(createdAt) > seenMs;
}

/**
 * Counts active messages from other players created after `lastSeenAt`.
 * If `lastSeenAt` is null (user has never opened chat on this device),
 * all active messages from other players count as unread.
 */
export function countUnreadChatMessages(
  messages: ReadonlyArray<
    Pick<ClubMessage, "id" | "sender_id" | "created_at" | "is_unsent">
  >,
  currentUserId: string | null,
  lastSeenAt: string | null
): number {
  if (!currentUserId) return 0;
  let count = 0;
  for (const m of messages) {
    if (m.is_unsent || m.sender_id === currentUserId) continue;
    if (isAfterLastSeen(m.created_at, lastSeenAt)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Returns the `id` of the first active message from another player
 * that arrived after `lastSeenAt`, so the chat drawer can render a
 * "New messages" divider line right above where the player left off.
 */
export function findFirstUnreadMessageId(
  messages: ReadonlyArray<
    Pick<ClubMessage, "id" | "sender_id" | "created_at" | "is_unsent">
  >,
  currentUserId: string | null,
  lastSeenAt: string | null
): string | null {
  if (!currentUserId) return null;
  for (const m of messages) {
    if (m.is_unsent || m.sender_id === currentUserId) continue;
    if (isAfterLastSeen(m.created_at, lastSeenAt)) {
      return m.id;
    }
  }
  return null;
}

/**
 * Deduplicates messages by `id`, sorts chronologically ascending (oldest first,
 * newest at bottom), and caps total stored messages at `limit`.
 */
export function mergeChatMessages(
  existing: ClubMessage[],
  incoming: ClubMessage[],
  limit: number = CHAT_HISTORY_LIMIT
): ClubMessage[] {
  const byId = new Map<string, ClubMessage>();
  for (const msg of existing) {
    if (msg?.id) byId.set(msg.id, msg);
  }
  for (const msg of incoming) {
    if (msg?.id) byId.set(msg.id, msg);
  }
  const sorted = Array.from(byId.values()).toSorted(
    (a, b) => timestampMs(a.created_at) - timestampMs(b.created_at)
  );
  if (sorted.length <= limit) return sorted;
  return sorted.slice(sorted.length - limit);
}

export function friendlyChatError(rawError: string | null | undefined): string {
  const msg = (rawError ?? "").toLowerCase();
  if (msg.includes("rate_limit_exceeded")) {
    return "Please wait 2 seconds between messages.";
  }
  if (msg.includes("unsend_expired")) {
    return "Messages can only be unsent within 5 minutes of sending.";
  }
  if (msg.includes("already_unsent")) {
    return "This message was already unsent.";
  }
  return "Could not update message right now. Please try again.";
}
