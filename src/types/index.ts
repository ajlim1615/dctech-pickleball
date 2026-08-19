import type { Database } from "./database.types";

export * from "./database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Court = Database["public"]["Tables"]["courts"]["Row"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
export type SessionCheckin = Database["public"]["Tables"]["session_checkins"]["Row"];
export type QueueEntry = Database["public"]["Tables"]["queue_entries"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type MatchPlayer = Database["public"]["Tables"]["match_players"]["Row"];
export type PlayerRatingHistory = Database["public"]["Tables"]["player_ratings_history"]["Row"];

export interface ActiveCourtView extends Court {
  assigned_staff?: Profile | null;
  current_match?: (Match & {
    referee?: Profile | null;
    players: (MatchPlayer & { profile: Profile })[];
  }) | null;
}

export interface QueueEntryWithPlayer extends QueueEntry {
  player: Profile;
}

