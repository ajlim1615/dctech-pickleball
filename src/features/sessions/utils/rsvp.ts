import type { SessionStatus } from "@/types";

/** RSVPs are open while a session is scheduled and close once it starts. */
export function canRsvp(status: SessionStatus): boolean {
  return status === "scheduled";
}
