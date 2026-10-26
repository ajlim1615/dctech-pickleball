import type { EngineCtx, SessionState } from "../engine/types";
import type { MatchingStyle } from "@/features/queue/matchmaking";

/** The real clock, ids and randomness for engine calls made from the screens. */
export function liveCtx(): EngineCtx {
  return {
    get now() {
      return new Date().toISOString();
    },
    newId: () => crypto.randomUUID(),
    random: Math.random,
  };
}

export function todayIso(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export const MATCHING_STYLES: { value: MatchingStyle; label: string; hint: string }[] = [
  { value: "balanced", label: "Balanced", hint: "Even teams by rating, avoiding repeat partners and opponents." },
  { value: "social_mixer", label: "Social mix", hint: "Avoids repeat partners and opponents. Ignores ratings." },
  { value: "skill_separated", label: "Skill separated", hint: "Similar ratings share a court. May hold a court." },
  { value: "winners_losers", label: "Winners / losers", hint: "Winners play winners, losers play losers." },
  { value: "skill_courts", label: "Skill courts", hint: "Like skill separated for now." },
  { value: "mixed_doubles", label: "Mixed doubles", hint: "Shuffled teams for now." },
  { value: "king_queen", label: "King / queen of the court", hint: "Winners move up a court; losers rejoin the line." },
  { value: "club_wars", label: "Club wars", hint: "Shuffled teams for now." },
  { value: "fifo", label: "First in line", hint: "First two in line against the next two." },
  { value: "winners_stay", label: "Winners stay", hint: "Winners stay on and take two challengers." },
];

export function styleLabel(style: MatchingStyle): string {
  return MATCHING_STYLES.find((s) => s.value === style)?.label ?? style;
}

export function playerName(state: SessionState, id: string): string {
  return state.players[id]?.name ?? "Player";
}
