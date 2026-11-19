"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useClientUserProfile } from "@/hooks/useClientUserProfile";
import { formatPHTTime } from "@/lib/timezone";
import {
  CHAT_COOLDOWN_MS,
  CHAT_HISTORY_LIMIT,
  CHAT_IDLE_DISCONNECT_MS,
  DEFAULT_CHAT_ROOM,
  friendlyChatError,
  MAX_CHAT_LENGTH,
  mergeChatMessages,
  validateChatMessageBody,
} from "../utils/chatUtils";
import type { ClubMessage } from "@/types";

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

  const userId = userProfile?.id ?? null;
  const listEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive while open
  useEffect(() => {
    if (!isOpen) return;
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isOpen, messages.length]);

  // Escape key closes the popup
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // Debounced 60-second idle tab disconnect so Alt-Tabbing doesn't churn connections
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  // Connect & fetch ONLY while open and not idle-paused
  useEffect(() => {
    if (!isOpen || isIdlePaused || !userId) return;

    const supabase = createClient();
    let cancelled = false;

    async function syncMessages() {
      const { data, error } = await supabase
        .from("club_messages")
        .select("id, room, sender_id, sender_name, body, created_at")
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
  }, [isOpen, isIdlePaused, userId]);

  if (isAuthPage || !userProfile) return null;

  const isAdmin =
    userProfile.role === "admin" || userProfile.email.toLowerCase() === "admin@dctechmicro.com";

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
        .select("id, room, sender_id, sender_name, body, created_at")
        .single();

      if (error) {
        setErrorMsg(friendlyChatError(error.message));
      } else if (data) {
        const created = data as ClubMessage;
        setDraft("");
        setCooldownUntil(Date.now() + CHAT_COOLDOWN_MS);
        setMessages((prev) => mergeChatMessages(prev, [created]));
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleDelete(messageId: string) {
    const supabase = createClient();
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    await supabase.from("club_messages").delete().eq("id", messageId);
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
              onClick={() => setIsOpen(false)}
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
                const canDelete = isMine || isAdmin;
                return (
                  <div
                    key={m.id}
                    className={`group flex flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5 px-1">
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {isMine ? "You" : m.sender_name}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400">
                        {formatPHTTime(m.created_at)}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(m.id)}
                          title="Delete message"
                          aria-label="Delete message"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div
                      className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed break-words shadow-2xs ${
                        isMine
                          ? "bg-emerald-600 text-white rounded-br-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-xs"
                      }`}
                    >
                      {m.body}
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
            setIsIdlePaused(false);
            setIsOpen(true);
          }}
          aria-label="Open chat"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-slate-900/95 dark:bg-emerald-600 text-white px-4 py-2.5 text-xs font-extrabold shadow-lg backdrop-blur-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
        >
          <MessageCircle className="h-4 w-4 text-[#d4e938] dark:text-white" />
          <span>Chat</span>
        </button>
      )}
    </div>
  );
}
