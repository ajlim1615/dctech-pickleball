/** Elapsed whole seconds from `startIso` to `nowMs`, clamped at 0. */
export function elapsedSeconds(startIso?: string | null, nowMs: number = Date.now()): number {
  if (!startIso) return 0;
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) return 0;
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}

export type CourtTimerTone = "green" | "amber" | "red";

/**
 * Traffic-light pace tone for an active court game:
 * - 0:00–5:59 (< 360s): green
 * - 6:00–9:59 (360s–599s): amber
 * - 10:00+ (>= 600s): red
 */
export function courtTimerTone(seconds: number): CourtTimerTone {
  if (seconds < 360) return "green";
  if (seconds < 600) return "amber";
  return "red";
}

/** Live ticking elapsed clock: "MM:SS" under 1 hour, "H:MM:SS" at 1 hour+. */
export function formatClockDuration(startIso: string, nowMs: number): string {
  const totalSeconds = elapsedSeconds(startIso, nowMs);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Completed match duration: "45s", "12m 34s", "6m", "1h 5m", or "1h".
 * Returns null if either timestamp is missing, invalid, or endedAt <= startedAt.
 */
export function formatMatchDuration(
  startedAt?: string | null,
  endedAt?: string | null
): string | null {
  if (!startedAt || !endedAt) return null;
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;

  const totalSeconds = Math.floor((endMs - startMs) / 1000);
  if (totalSeconds <= 0) return null;

  if (totalSeconds < 60) return `${totalSeconds}s`;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
