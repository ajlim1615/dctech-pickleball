import { describe, expect, it } from "vitest";
import {
  canUnsendMessage,
  CHAT_UNSEND_WINDOW_MS,
  countActiveChatMessages,
  countUnreadChatMessages,
  findFirstUnreadMessageId,
  friendlyChatError,
  isSuperAdminChatEmail,
  MAX_CHAT_LENGTH,
  mergeChatMessages,
  validateChatMessageBody,
} from "./utils/chatUtils";
import type { ClubMessage } from "@/types";

function makeMsg(
  id: string,
  created_at: string,
  body = "hello",
  is_unsent = false
): ClubMessage {
  return {
    id,
    room: "club",
    sender_id: "user-1",
    sender_name: "Alex",
    body,
    is_unsent,
    created_at,
  };
}

describe("chatUtils", () => {
  it("validates chat message length and trims whitespace", () => {
    expect(validateChatMessageBody("   ").ok).toBe(false);
    expect(validateChatMessageBody("  Let's play!  ")).toEqual({
      ok: true,
      body: "Let's play!",
      error: null,
    });
    expect(validateChatMessageBody("a".repeat(MAX_CHAT_LENGTH + 1)).ok).toBe(
      false
    );
  });

  it("merges, deduplicates, sorts chronologically, and caps messages", () => {
    const m1 = makeMsg("1", "2026-11-19T01:00:00.000Z", "first");
    const m2 = makeMsg("2", "2026-11-19T01:02:00.000Z", "second");
    const m3 = makeMsg("3", "2026-11-19T01:01:00.000Z", "middle");
    const m2Updated = makeMsg(
      "2",
      "2026-11-19T01:02:00.000Z",
      "Unsent message",
      true
    );

    const merged = mergeChatMessages([m2, m1], [m3, m2Updated], 2);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("3");
    expect(merged[1].id).toBe("2");
    expect(merged[1].body).toBe("Unsent message");
    expect(merged[1].is_unsent).toBe(true);
  });

  it("enforces the 5-minute unsend window for players", () => {
    const baseTime = new Date("2026-11-19T02:00:00.000Z").getTime();
    const msg = makeMsg("1", "2026-11-19T02:00:00.000Z");

    // Own message within 5 minutes
    expect(canUnsendMessage(msg, "user-1", baseTime + 60_000)).toBe(true);
    // Own message after 5 minutes expired
    expect(
      canUnsendMessage(msg, "user-1", baseTime + CHAT_UNSEND_WINDOW_MS + 1000)
    ).toBe(false);
    // Someone else's message
    expect(canUnsendMessage(msg, "user-2", baseTime + 10_000)).toBe(false);
    // Already unsent message cannot be unsent again
    const unsentMsg = makeMsg(
      "1",
      "2026-11-19T02:00:00.000Z",
      "Unsent message",
      true
    );
    expect(canUnsendMessage(unsentMsg, "user-1", baseTime + 10_000)).toBe(false);
  });

  it("recognizes only admin@dctechmicro.com for full message deletion", () => {
    expect(isSuperAdminChatEmail("admin@dctechmicro.com")).toBe(true);
    expect(isSuperAdminChatEmail("  ADMIN@dctechmicro.com ")).toBe(true);
    expect(isSuperAdminChatEmail("ajlim@dctechmicro.com")).toBe(false);
    expect(isSuperAdminChatEmail(null)).toBe(false);
  });

  it("counts only active (non-unsent) messages for the floating chat button badge", () => {
    const m1 = makeMsg("1", "2026-11-19T01:00:00.000Z", "hi", false);
    const m2 = makeMsg("2", "2026-11-19T01:01:00.000Z", "Unsent message", true);
    const m3 = makeMsg("3", "2026-11-19T01:02:00.000Z", "anyone playing?", false);

    expect(countActiveChatMessages([])).toBe(0);
    expect(countActiveChatMessages([m2])).toBe(0);
    expect(countActiveChatMessages([m1, m2, m3])).toBe(2);
  });

  it("identifies unread messages and the first unread message divider after lastSeenAt", () => {
    const seenMsg: ClubMessage = {
      ...makeMsg("1", "2026-11-19T01:00:00.000Z", "old message"),
      sender_id: "user-2",
    };
    const ownMsg: ClubMessage = {
      ...makeMsg("2", "2026-11-19T01:01:00.000Z", "my own message"),
      sender_id: "user-1",
    };
    const unsentNewMsg: ClubMessage = {
      ...makeMsg("3", "2026-11-19T01:02:00.000Z", "Unsent message", true),
      sender_id: "user-2",
    };
    const firstNewMsg: ClubMessage = {
      ...makeMsg("4", "2026-11-19T01:03:00.000Z", "first unseen message"),
      sender_id: "user-2",
    };
    const secondNewMsg: ClubMessage = {
      ...makeMsg("5", "2026-11-19T01:04:00.000Z", "second unseen message"),
      sender_id: "user-3",
    };

    const list = [seenMsg, ownMsg, unsentNewMsg, firstNewMsg, secondNewMsg];
    const lastSeenAt = "2026-11-19T01:00:00.000Z";

    expect(countUnreadChatMessages(list, "user-1", lastSeenAt)).toBe(2);
    expect(findFirstUnreadMessageId(list, "user-1", lastSeenAt)).toBe("4");
  });

  it("compares real times, not strings, when REST (+08:00) and realtime (UTC) offsets mix", () => {
    // Read while open: last message arrived over realtime, stored in UTC.
    const lastSeenAt = "2026-11-19T02:39:20.13253+00:00";
    // After logging back in, the same history is refetched over REST in Manila time.
    const alreadyRead: ClubMessage = {
      ...makeMsg("1", "2026-11-19T10:39:20.13253+08:00", "already read"),
      sender_id: "user-2",
    };
    const older: ClubMessage = {
      ...makeMsg("0", "2026-11-19T10:30:00+08:00", "older"),
      sender_id: "user-3",
    };
    const reallyNew: ClubMessage = {
      ...makeMsg("2", "2026-11-19T02:41:00.5+00:00", "really new"),
      sender_id: "user-2",
    };

    expect(countUnreadChatMessages([older, alreadyRead], "user-1", lastSeenAt)).toBe(0);
    expect(findFirstUnreadMessageId([older, alreadyRead], "user-1", lastSeenAt)).toBeNull();
    expect(countUnreadChatMessages([older, alreadyRead, reallyNew], "user-1", lastSeenAt)).toBe(1);

    // A live UTC message must sort after earlier Manila-offset history, not before it.
    const merged = mergeChatMessages([older, alreadyRead], [reallyNew]);
    expect(merged.map((m) => m.id)).toEqual(["0", "1", "2"]);
  });

  it("maps PostgreSQL rate limit and unsend triggers to friendly messages", () => {
    expect(friendlyChatError("ERROR: rate_limit_exceeded")).toBe(
      "Please wait 2 seconds between messages."
    );
    expect(friendlyChatError("ERROR: unsend_expired")).toBe(
      "Messages can only be unsent within 5 minutes of sending."
    );
  });
});
