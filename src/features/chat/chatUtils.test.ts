import { describe, expect, it } from "vitest";
import {
  friendlyChatError,
  MAX_CHAT_LENGTH,
  mergeChatMessages,
  validateChatMessageBody,
} from "./utils/chatUtils";
import type { ClubMessage } from "@/types";

function msg(id: string, created_at: string, body = "hello"): ClubMessage {
  return {
    id,
    room: "club",
    sender_id: "u1",
    sender_name: "Alex",
    body,
    created_at,
  };
}

describe("chatUtils", () => {
  it("validates and trims chat message bodies", () => {
    expect(validateChatMessageBody("   ").ok).toBe(false);
    expect(validateChatMessageBody("a".repeat(MAX_CHAT_LENGTH + 1)).ok).toBe(false);

    const valid = validateChatMessageBody("  Good game on Court 1!  ");
    expect(valid).toEqual({ ok: true, body: "Good game on Court 1!" });
  });

  it("merges, deduplicates, sorts chronologically, and caps retained messages", () => {
    const a = msg("1", "2026-11-19T01:00:00.000Z", "first");
    const b = msg("2", "2026-11-19T01:01:00.000Z", "second");
    const c = msg("3", "2026-11-19T01:02:00.000Z", "third");
    const bUpdated = msg("2", "2026-11-19T01:01:00.000Z", "second-updated");

    const merged = mergeChatMessages([b, a], [bUpdated, c], 2);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("2");
    expect(merged[0].body).toBe("second-updated");
    expect(merged[1].id).toBe("3");
  });

  it("maps trigger errors to friendly messages", () => {
    expect(friendlyChatError("new row violates rate_limit")).toContain("wait 2 seconds");
    expect(friendlyChatError("inactive_profile")).toContain("active player account");
    expect(friendlyChatError("network timeout")).toContain("Couldn't send message");
  });
});
