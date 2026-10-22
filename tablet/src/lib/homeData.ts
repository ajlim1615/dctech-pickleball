import type { DeskSession, SessionState } from "../engine/types";
import { boardStats } from "./boardStats";
import { sessionHighlights } from "./sessionHighlights";

export interface HomeData {
  live: { session: DeskSession; stats: ReturnType<typeof boardStats> | null } | null;
  /** Every ended session, newest first. `highlights` is null when its details couldn't be read. */
  past: { session: DeskSession; highlights: ReturnType<typeof sessionHighlights> | null }[];
}

/**
 * Loads what Home shows. One session failing to load only loses that row's extras;
 * it never hides the rest of the list.
 */
export async function loadHomeData(deps: {
  listSessions: () => Promise<DeskSession[]>;
  loadSessionState: (id: string) => Promise<SessionState>;
}): Promise<HomeData> {
  const sessions = await deps.listSessions();
  const liveSession = sessions.find((s) => s.status === "live");
  const ended = sessions.filter((s) => s.status === "ended");

  const [liveState, ...endedStates] = await Promise.allSettled([
    liveSession ? deps.loadSessionState(liveSession.id) : Promise.resolve(null),
    ...ended.map((s) => deps.loadSessionState(s.id)),
  ]);

  return {
    live: liveSession
      ? {
          session: liveSession,
          stats: liveState.status === "fulfilled" && liveState.value ? boardStats(liveState.value) : null,
        }
      : null,
    past: ended.map((session, i) => {
      const result = endedStates[i];
      return { session, highlights: result.status === "fulfilled" ? sessionHighlights(result.value) : null };
    }),
  };
}
