import { formatPHTDate, getPHTTodayString } from "@/lib/timezone";
import type { SessionEvent } from "@/types";

/** How an event looks in the feed: games and the session itself stand out, queue moves stay quiet. */
export type EventKind = "session" | "game" | "queue" | "court" | "fix";

export function eventKind(type: SessionEvent["type"]): EventKind {
  switch (type) {
    case "session_started":
    case "session_ended":
      return "session";
    case "game_started":
    case "game_result":
      return "game";
    case "court_closed":
    case "court_reopened":
      return "court";
    case "result_corrected":
    case "no_show_swapped":
      return "fix";
    default:
      return "queue";
  }
}

/** Kinds worth reading at a glance; the rest are routine line changes. */
export function isHighlight(kind: EventKind): boolean {
  return kind === "session" || kind === "game";
}

export interface DayGroup {
  key: string;
  label: string;
  events: SessionEvent[];
}

/**
 * Splits a newest-first event list into Philippine-time days, labelled
 * "Today", "Yesterday" or a date, so a time like "3:36 PM" is never ambiguous.
 */
export function groupEventsByDay(events: SessionEvent[], now: Date = new Date()): DayGroup[] {
  const today = getPHTTodayString(now);
  const yesterday = getPHTTodayString(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const groups: DayGroup[] = [];
  for (const e of events) {
    const key = getPHTTodayString(new Date(e.created_at));
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const label = key === today ? "Today" : key === yesterday ? "Yesterday" : formatPHTDate(e.created_at);
      group = { key, label, events: [] };
      groups.push(group);
    }
    group.events.push(e);
  }
  return groups;
}
