import type { SessionStatus } from "@/types";

/**
 * The queue only opens once a session is live. Before that, players tap
 * "I'm going" and are shuffled into the starting line when it starts.
 * Returns why nobody can be added to the queue right now, or null if they can.
 */
export function queueClosedReason(status: SessionStatus | null | undefined): string | null {
  if (status === "active") return null;
  if (status === "scheduled") {
    return "The line opens when the session starts. Tap \"I'm going\" to be shuffled into it.";
  }
  return "This session is not open for queueing.";
}
