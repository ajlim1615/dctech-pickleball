import { revalidatePath } from "next/cache";
import { refreshUpNext } from "@/features/queue/api/upNextActions";

/**
 * Call after anything that changes a session's line or courts: rebuilds the auto Up
 * Next cards (admins only; for players' own changes the admin screen's live update
 * does it) and refreshes the pages that show the line.
 */
export async function afterLineChange(sessionId: string, extraPaths: string[] = []): Promise<void> {
  try {
    await refreshUpNext(sessionId);
  } catch (err) {
    // Cards are a convenience; never fail the action that changed the line.
    console.error("refreshUpNext failed:", err);
  }
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  for (const path of extraPaths) revalidatePath(path);
}
