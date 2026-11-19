"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useClientUserProfile } from "@/hooks/useClientUserProfile";
import { formatPHTTime } from "@/lib/timezone";
import {
  canUnsendMessage,
  CHAT_COOLDOWN_MS,
  CHAT_HISTORY_LIMIT,
  CHAT_IDLE_DISCONNECT_MS,
  countActiveChatMessages,
  countUnreadChatMessages,
  DEFAULT_CHAT_ROOM,
  findFirstUnreadMessageId,
  friendlyChatError,
  isSuperAdminChatEmail,
  MAX_CHAT_LENGTH,
  mergeChatMessages,
  UNSENT_MESSAGE_TEXT,
  validateChatMessageBody,
} from "../utils/chatUtils";
import type { ClubMessage } from "@/types";

function getLastSeenStorageKey(userId: string): string {
  return `dctech_chat_last_seen_${userId}`;
}

function readStoredLastSeenAt(userId: string | null): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(getLastSeenStorageKey(userId));
  } catch {
    return null;
  }
}

function writeStoredLastSeenAt(userId: string | null, isoTimestamp: string) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getLastSeenStorageKey(userId), isoTimestamp);
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function FloatingChatbox() {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/set-password";
  const userProfile = useClientUserProfile(!isAuthPage);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isIdlePaused, setIsIdlePaused] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    mode: "unsend" | "delete";
  } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Frozen snapshot of `lastSeenAt` at the moment the user opened the chat drawer,
  // so the "New messages" divider stays visible while they read what they missed.
  const [openedUnreadBoundaryAt, setOpenedUnreadBoundaryAt] = useState<
    string | null
  >(null);
  const [hasPriorSeenHistory, setHasPriorSeenHistory] = useState(false);

  const userId = userProfile?.id ?? null;
  const listEndRef = useRef<HTMLDivElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);

  const latestMessageTimestamp =
    messages.length > 0 ? messages[messages.length - 1].created_at : null;

  // Scroll to the "New messages" divider when opening with unread messages,
  // or to the bottom when new messages arrive while open.
  useEffect(() => {
    if (!isOpen) return;
    if (unreadDividerRef.current) {
      unreadDividerRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } else {
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages.length]);

  // While the chat drawer is open, persist the latest message timestamp as seen
  // in localStorage so the floating button badge clears once read.
  useEffect(() => {
    if (!isOpen || !userId || !latestMessageTimestamp) return;
    writeStoredLastSeenAt(userId, latestMessageTimestamp);
  }, [isOpen, userId, latestMessageTimestamp]);

  // Auto-dismiss transient error notices (like the 2-second cooldown)
  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(() => setErrorMsg(null), 2500);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  // Refresh `nowMs` every 15s while open so the 5-minute unsend button expires automatically
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Escape key closes active confirmation first, then the popup
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmAction) setConfirmAction(null);
        else setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, confirmAction]);

  // Debounced 60-second idle tab disconnect so Alt-Tabbing doesn't churn connections
  useEffect(() => {
    if (isAuthPage || !userId) return;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          setIsIdlePaused(true);
        }, CHAT_IDLE_DISCONNECT_MS);
      } else {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        setIsIdlePaused(false);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAuthPage, userId]);

  // Connect & fetch while signed in on non-auth pages and not idle-paused,
  // keeping the floating button badge and chat drawer live in realtime.
  useEffect(() => {
    if (isAuthPage || isIdlePaused || !userId) return;

    const supabase = createClient();
    let cancelled = false;

    async function syncMessages() {
      const { data, error } = await supabase
        .from("club_messages")
        .select("id, room, sender_id, sender_name, body, is_unsent, created_at")
        .eq("room", DEFAULT_CHAT_ROOM)
        .order("created_at", { ascending: false })
        .limit(CHAT_HISTORY_LIMIT);

      if (cancelled || error || !data) return;

      const rows = data as ClubMessage[];
      setMessages(mergeChatMessages([], rows));
    }

    void syncMessages();

    const channel = supabase
      .channel(`club_messages:${DEFAULT_CHAT_ROOM}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "club_messages",
          filter: `room=eq.${DEFAULT_CHAT_ROOM}`,
        },
        (payload) => {
          const row = payload.new as ClubMessage;
          setMessages((prev) => mergeChatMessages(prev, [row]));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "club_messages",
          filter: `room=eq.${DEFAULT_CHAT_ROOM}`,
        },
        (payload) => {
          const row = payload.new as ClubMessage;
          setMessages((prev) => mergeChatMessages(prev, [row]));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "club_messages",
        },
        (payload) => {
          const deletedId = (payload.old as { id?: string } | null)?.id;
          if (!deletedId) return;
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [isAuthPage, isIdlePaused, userId]);

  if (isAuthPage || !userProfile) return null;

  const isSuperAdmin = isSuperAdminChatEmail(userProfile.email);
  const storedLastSeenAt = readStoredLastSeenAt(userProfile.id);
  const activeMessageCount = countActiveChatMessages(messages);
  const unreadMessageCount = isOpen
    ? 0
    : countUnreadChatMessages(messages, userProfile.id, storedLastSeenAt);

  // Inside the open drawer, find the first message that arrived after the user's
  // previous visit so we can display a "New messages" divider line right above it.
  const firstUnreadMessageId =
    isOpen && hasPriorSeenHistory
      ? findFirstUnreadMessageId(
          messages,
          userProfile.id,
          openedUnreadBoundaryAt
        )
      : null;
  const unreadDividerCount =
    isOpen && hasPriorSeenHistory
      ? countUnreadChatMessages(
          messages,
          userProfile.id,
          openedUnreadBoundaryAt
        )
      : 0;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!userProfile || isSending) return;

    const now = Date.now();
    if (now < cooldownUntil) {
      setErrorMsg("Please wait 2 seconds between messages.");
      return;
    }

    const validated = validateChatMessageBody(draft);
    if (!validated.ok) {
      setErrorMsg(validated.error);
      return;
    }

    setErrorMsg(null);
    setIsSending(true);
    const senderName =
      userProfile.display_name || userProfile.full_name || "Player";

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("club_messages")
        .insert({
          room: DEFAULT_CHAT_ROOM,
          sender_id: userProfile.id,
          sender_name: senderName,
          body: validated.body,
        })
        .select("id, room, sender_id, sender_name, body, is_unsent, created_at")
        .single();

      if (error) {
        setErrorMsg(friendlyChatError(error.message));
      } else if (data) {
        const created = data as ClubMessage;
        setDraft("");
        setNowMs(Date.now());
        setCooldownUntil(Date.now() + CHAT_COOLDOWN_MS);
        // Once the player sends a reply, clear the old "New messages" divider
        setOpenedUnreadBoundaryAt(created.created_at);
        writeStoredLastSeenAt(userProfile.id, created.created_at);
        setMessages((prev) => mergeChatMessages(prev, [created]));
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleUnsend(messageId: string) {
    const previous = messages;
    setConfirmAction(null);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, is_unsent: true, body: UNSENT_MESSAGE_TEXT } : m
      )
    );

    const supabase = createClient();
    const { data, error } = await supabase
      .from("club_messages")
      .update({ is_unsent: true, body: UNSENT_MESSAGE_TEXT })
      .eq("id", messageId)
      .select("id, room, sender_id, sender_name, body, is_unsent, created_at")
      .maybeSingle();

    if (error || !data) {
      setMessages(previous);
      setErrorMsg(
        error
          ? friendlyChatError(error.message)
          : "Messages can only be unsent within 5 minutes of sending."
      );
    } else {
      setMessages((prev) => mergeChatMessages(prev, [data as ClubMessage]));
    }
  }

  async function handleDelete(messageId: string) {
    const previous = messages;
    setConfirmAction(null);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    const supabase = createClient();
    const { error } = await supabase
      .from("club_messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      setMessages(previous);
      setErrorMsg("Could not delete message.");
    }
  }

  return (
    <div
      data-chatbox="true"
      className="fixed bottom-20 lg:bottom-5 right-4 z-40 flex flex-col items-end"
    >
      {isOpen ? (
        <section
          aria-label="DCTECH Chat"
          className="w-[calc(100vw-2rem)] sm:w-88 h-96 sm:h-[26rem] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <h2 className="text-xs font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Chat
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                if (latestMessageTimestamp) {
                  writeStoredLastSeenAt(userProfile.id, latestMessageTimestamp);
                }
                setConfirmAction(null);
                setIsOpen(false);
              }}
              aria-label="Close chatbox"
              className="rounded-lg p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 text-xs text-slate-600 dark:text-slate-400 font-mono">
                <MessageCircle className="h-6 w-6 text-emerald-500/70 mb-1.5" />
                <p className="font-semibold text-slate-800 dark:text-slate-200">No messages yet</p>
                <p className="text-[11px]">Say hi to start the conversation!</p>
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.sender_id === userProfile.id;
                const canPlayerUnsend = canUnsendMessage(m, userProfile.id, nowMs);
                const actionMode: "delete" | "unsend" | null = isSuperAdmin
                  ? "delete"
                  : canPlayerUnsend
                    ? "unsend"
                    : null;
                const isConfirming = confirmAction?.id === m.id;
                const isFirstUnread = firstUnreadMessageId === m.id;

                return (
                  <div key={m.id} className="space-y-2">
                    {isFirstUnread && (
                      <div
                        ref={unreadDividerRef}
                        role="separator"
                        aria-label="New unread messages"
                        className="flex items-center gap-2 py-1"
                      >
                        <div className="h-px flex-1 bg-emerald-500/40" />
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-mono font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          {unreadDividerCount === 1
                            ? "1 new message"
                            : `${unreadDividerCount} new messages`}
                        </span>
                        <div className="h-px flex-1 bg-emerald-500/40" />
                      </div>
                    )}

                    <div
                      className={`group flex flex-col ${isMine ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5 px-1">
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                          {isMine ? "You" : m.sender_name}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400">
                          {formatPHTTime(m.created_at)}
                        </span>
                        {actionMode && !isConfirming && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({ id: m.id, mode: actionMode })
                            }
                            title={
                              actionMode === "delete"
                                ? "Delete message"
                                : "Unsend message (within 5 minutes)"
                            }
                            aria-label={
                              actionMode === "delete"
                                ? "Delete message"
                                : "Unsend message"
                            }
                            className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {isConfirming && confirmAction && (
                        <div className="mb-1 flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/90 dark:bg-rose-950/60 px-2.5 py-1 text-[10px] font-mono">
                          <span className="text-rose-700 dark:text-rose-300 font-semibold">
                            {confirmAction.mode === "delete"
                              ? "Delete message?"
                              : "Unsend message?"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              confirmAction.mode === "delete"
                                ? void handleDelete(m.id)
                                : void handleUnsend(m.id)
                            }
                            className="rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold px-2 py-0.5 cursor-pointer"
                          >
                            {confirmAction.mode === "delete" ? "Delete" : "Unsend"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmAction(null)}
                            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {m.is_unsent ? (
                        <div className="max-w-[82%] rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 px-3 py-1.5 text-xs italic text-slate-500 dark:text-slate-400">
                          {UNSENT_MESSAGE_TEXT}
                        </div>
                      ) : (
                        <div
                          className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed break-words shadow-2xs ${
                            isMine
                              ? "bg-emerald-600 text-white rounded-br-xs"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-xs"
                          }`}
                        >
                          {m.body}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={listEndRef} />
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div
              role="status"
              aria-live="polite"
              className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 border-t border-rose-200 dark:border-rose-900/50 text-[11px] font-mono text-rose-700 dark:text-rose-300"
            >
              {errorMsg}
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => void handleSend(e)}
            className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center gap-2"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHAT_LENGTH))}
              maxLength={MAX_CHAT_LENGTH}
              placeholder="Type a message..."
              aria-label="Chat message"
              className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
            />
            <span
              aria-live="polite"
              className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0"
            >
              {draft.length}/{MAX_CHAT_LENGTH}
            </span>
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              aria-label="Send message"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => {
            const priorSeen = readStoredLastSeenAt(userProfile.id);
            setHasPriorSeenHistory(true);
            setOpenedUnreadBoundaryAt(priorSeen);
            if (latestMessageTimestamp) {
              writeStoredLastSeenAt(userProfile.id, latestMessageTimestamp);
            }
            setNowMs(Date.now());
            setIsIdlePaused(false);
            setIsOpen(true);
          }}
          aria-label={
            unreadMessageCount > 0
              ? `Open chat (${unreadMessageCount} unread ${
                  unreadMessageCount === 1 ? "message" : "messages"
                })`
              : activeMessageCount > 0
                ? `Open chat (${activeMessageCount} ${
                    activeMessageCount === 1 ? "message" : "messages"
                  })`
                : "Open chat"
          }
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-slate-900/95 dark:bg-emerald-600 text-white px-4 py-2.5 text-xs font-extrabold shadow-lg backdrop-blur-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
        >
          <MessageCircle className="h-4 w-4 text-[#d4e938] dark:text-white" />
          <span>Chat</span>
          {unreadMessageCount > 0 ? (
            <span
              title={`${unreadMessageCount} unread ${
                unreadMessageCount === 1 ? "message" : "messages"
              }`}
              className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-[#d4e938] dark:bg-slate-950 text-slate-950 dark:text-[#d4e938] px-1.5 text-[10px] font-mono font-black tabular-nums shadow-2xs"
            >
              {unreadMessageCount}
            </span>
          ) : (
            activeMessageCount > 0 && (
              <span
                title={`${activeMessageCount} ${
                  activeMessageCount === 1 ? "message" : "messages"
                } in chat`}
                className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-white/15 dark:bg-slate-950/40 text-white px-1.5 text-[10px] font-mono font-bold tabular-nums"
              >
                {activeMessageCount}
              </span>
            )
          )}
        </button>
      )}
    </div>
  );
}
