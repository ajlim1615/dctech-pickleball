import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { refreshUpNext } from "@/features/queue/api/upNextActions";

/**
 * Call after anything that changes a session's line or courts: refreshes the pages
 * that show the line, and rebuilds the auto Up Next cards (admins only; for players'
 * own changes the admin screen's live update does it).
 *
 * The rebuild runs after the response is sent, so the button that changed the line
 * isn't kept waiting on it; the session page's live Up Next picks up the new cards.
 */
export async function afterLineChange(sessionId: string, extraPaths: string[] = []): Promise<void> {
  after(async () => {
    try {
      await refreshUpNext(sessionId);
    } catch (err) {
      // Cards are a convenience; never fail the action that changed the line.
      console.error("refreshUpNext failed:", err);
    }
  });
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  for (const path of extraPaths) revalidatePath(path);
}
