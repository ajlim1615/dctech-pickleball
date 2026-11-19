export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "player" | "admin";
export type CourtStatus = "available" | "occupied" | "maintenance" | "reserved";
export type SessionStatus = "scheduled" | "active" | "completed" | "cancelled";
export type CheckinStatus = "checked_in" | "checked_out";
export type QueueStatus = "waiting" | "called" | "playing" | "left" | "on_break";
export type MatchFormat = "singles" | "doubles";
export type MatchType = "open_play" | "challenge" | "tournament";
export type MatchStatus = "pending" | "in_progress" | "completed" | "abandoned";
export type WinningTeam = "team_a" | "team_b" | "tie";
export type RatingHistoryReason = "game" | "correction" | "admin";

export type SessionEventType =
  | "session_started"
  | "session_ended"
  | "checked_in"
  | "checked_out"
  | "joined_queue"
  | "left_queue"
  | "players_added"
  | "break_started"
  | "break_ended"
  | "moved_in_queue"
  | "removed_from_queue"
  | "players_swapped"
  | "game_started"
  | "game_result"
  | "result_corrected"
  | "no_show_swapped"
  | "court_closed"
  | "court_reopened"
  | "court_player_replaced"
  | "court_player_removed"
  | "court_teams_switched"
  | "court_slot_filled"
  | "court_change_undone"
  | "up_next_edited";
export type SessionEventActorRole = "self" | "admin" | "system";
export type MatchTeam = "team_a" | "team_b";

export interface Database {
  public: {
    Tables: {
      club_messages: {
        Row: {
          id: string;
          room: string;
          sender_id: string;
          sender_name: string;
          body: string;
          is_unsent: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          room?: string;
          sender_id: string;
          sender_name: string;
          body: string;
          is_unsent?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          room?: string;
          sender_id?: string;
          sender_name?: string;
          body?: string;
          is_unsent?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          display_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          skill_rating: number;
          games_played: number;
          games_won: number;
          is_active: boolean;
          is_guest?: boolean;
          employee_no: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          skill_rating?: number;
          games_played?: number;
          games_won?: number;
          is_active?: boolean;
          is_guest?: boolean;
          employee_no?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          skill_rating?: number;
          games_played?: number;
          games_won?: number;
          is_active?: boolean;
          is_guest?: boolean;
          employee_no?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      courts: {
        Row: {
          id: string;
          name: string;
          surface_type: string | null;
          status: CourtStatus;
          current_match_id: string | null;
          assigned_staff_id: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          surface_type?: string | null;
          status?: CourtStatus;
          current_match_id?: string | null;
          assigned_staff_id?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          surface_type?: string | null;
          status?: CourtStatus;
          current_match_id?: string | null;
          assigned_staff_id?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          location: string;
          venue_id?: string | null;
          status: SessionStatus;
          start_time: string;
          end_time: string;
          max_players: number | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          location?: string;
          venue_id?: string | null;
          status?: SessionStatus;
          start_time: string;
          end_time: string;
          max_players?: number | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          location?: string;
          venue_id?: string | null;
          status?: SessionStatus;
          start_time?: string;
          end_time?: string;
          max_players?: number | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          name: string;
          maps_url: string;
          address: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          maps_url: string;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          maps_url?: string;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_checkins: {
        Row: {
          id: string;
          session_id: string;
          player_id: string;
          status: CheckinStatus;
          checkin_time: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          player_id: string;
          status?: CheckinStatus;
          checkin_time?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          player_id?: string;
          status?: CheckinStatus;
          checkin_time?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      session_events: {
        Row: {
          id: string;
          session_id: string | null;
          type: SessionEventType;
          actor_id: string | null;
          actor_role: SessionEventActorRole;
          subject_ids: string[];
          court_id: string | null;
          match_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id?: string | null;
          type: SessionEventType;
          actor_id?: string | null;
          actor_role: SessionEventActorRole;
          subject_ids?: string[];
          court_id?: string | null;
          match_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          details?: Json;
        };
        Relationships: [];
      };
      session_rsvps: {
        Row: {
          id: string;
          session_id: string;
          player_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          player_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          player_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      queue_entries: {
        Row: {
          id: string;
          session_id: string;
          player_id: string;
          group_id: string | null;
          status: QueueStatus;
          joined_at: string;
          called_at: string | null;
          target_court_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          player_id: string;
          group_id?: string | null;
          status?: QueueStatus;
          joined_at?: string;
          called_at?: string | null;
          target_court_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          player_id?: string;
          group_id?: string | null;
          status?: QueueStatus;
          joined_at?: string;
          called_at?: string | null;
          target_court_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      /** A planned match ("Up Next card"). Written only by the up-next procedures. */
      up_next_matches: {
        Row: {
          id: string;
          session_id: string;
          position: number;
          per_side: number;
          /** Set for court-bound styles (King/Queen); null = any free court. */
          target_court_id: string | null;
          /** true = built by matchmaking; false = edited by an admin and kept as is. */
          is_auto: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          position: number;
          per_side?: number;
          target_court_id?: string | null;
          is_auto?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["up_next_matches"]["Insert"]>;
        Relationships: [];
      };
      /** Who is in an Up Next card. A player is in at most one card per session. */
      up_next_players: {
        Row: {
          card_id: string;
          session_id: string;
          player_id: string;
          team: MatchTeam;
          slot: number;
        };
        Insert: {
          card_id: string;
          session_id: string;
          player_id: string;
          team: MatchTeam;
          slot: number;
        };
        Update: Partial<Database["public"]["Tables"]["up_next_players"]["Insert"]>;
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          session_id: string;
          /** Null once the court was removed; the game itself is kept. */
          court_id: string | null;
          format: MatchFormat;
          match_type: MatchType;
          status: MatchStatus;
          team_a_score: number;
          team_b_score: number;
          winning_team: WinningTeam | null;
          referee_id: string | null;
          serving_team: MatchTeam | null;
          server_number: number | null;
          started_at: string | null;
          ended_at: string | null;
          recorded_by: string | null;
          is_verified: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          court_id: string;
          format?: MatchFormat;
          match_type?: MatchType;
          status?: MatchStatus;
          team_a_score?: number;
          team_b_score?: number;
          winning_team?: WinningTeam | null;
          referee_id?: string | null;
          serving_team?: MatchTeam | null;
          server_number?: number | null;
          started_at?: string | null;
          ended_at?: string | null;
          recorded_by?: string | null;
          is_verified?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          court_id?: string | null;
          format?: MatchFormat;
          match_type?: MatchType;
          status?: MatchStatus;
          team_a_score?: number;
          team_b_score?: number;
          winning_team?: WinningTeam | null;
          referee_id?: string | null;
          serving_team?: MatchTeam | null;
          server_number?: number | null;
          started_at?: string | null;
          ended_at?: string | null;
          recorded_by?: string | null;
          is_verified?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      match_players: {
        Row: {
          id: string;
          match_id: string;
          player_id: string;
          team: MatchTeam;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          player_id: string;
          team: MatchTeam;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          player_id?: string;
          team?: MatchTeam;
          created_at?: string;
        };
        Relationships: [];
      };
      player_ratings_history: {
        Row: {
          id: string;
          player_id: string;
          /** null for an admin's manual edit (reason 'admin'). */
          match_id: string | null;
          old_rating: number;
          new_rating: number;
          rating_change: number;
          recorded_at: string;
          /** RATING_RULES.version the row was computed with (1 = before versioning). */
          rules_version: number;
          reason: RatingHistoryReason;
        };
        Insert: {
          id?: string;
          player_id: string;
          match_id?: string | null;
          old_rating: number;
          new_rating: number;
          rating_change: number;
          recorded_at?: string;
          rules_version?: number;
          reason?: RatingHistoryReason;
        };
        Update: {
          id?: string;
          player_id?: string;
          match_id?: string | null;
          old_rating?: number;
          new_rating?: number;
          rating_change?: number;
          recorded_at?: string;
          rules_version?: number;
          reason?: RatingHistoryReason;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      /** Clears the caller's must_change_password flag once their password is no longer the default. */
      clear_password_change_flag: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_admin_audit: {
        Args: {
          p_session_id?: string | null;
          p_types?: string[] | null;
          p_limit?: number;
        };
        Returns: {
          id: string;
          session_id: string | null;
          session_title: string | null;
          type: SessionEventType;
          actor_name: string | null;
          actor_role: SessionEventActorRole;
          subject_ids: string[];
          court_id: string | null;
          match_id: string | null;
          details: Json;
          created_at: string;
        }[];
      };
      /** Fixes a saved result: score, winner, and relative rating/win moves in one locked transaction. */
      apply_result_correction: {
        Args: {
          p_match_id: string;
          p_expected_a: number;
          p_expected_b: number;
          p_new_a: number;
          p_new_b: number;
          p_winning_team: WinningTeam;
          p_rating_updates: Json;
          p_wins_moves: Json;
          p_rules_version: number;
          p_min_rating: number;
          p_max_rating: number;
        };
        Returns: Json;
      };
      /**
       * Starts a game: locks the session, checks the court and players, claims queue
       * entries, creates the match and its players, mirrors the court. Returns
       * { match_id } or { error: code } (see GAME_STATE_ERRORS). Signed-in admin client only.
       */
      start_match: {
        Args: {
          p_session_id: string;
          p_court_id: string;
          p_team_a: string[];
          p_team_b: string[];
          p_from_queue: boolean;
          /** Start this Up Next card: its teams are used and the card is removed. */
          p_up_next_id?: string | null;
        };
        Returns: Json;
      };
      /** Changes whenever the waiting line or a hand-edited card changes. */
      up_next_line_version: {
        Args: { p_session_id: string };
        Returns: string;
      };
      /** Creates (p_card_id null) or edits one card; it becomes hand-edited. Returns { card_id, unpaired } or { error }. */
      save_up_next_card: {
        Args: {
          p_session_id: string;
          p_card_id: string | null;
          p_team_a: string[];
          p_team_b: string[];
          p_per_side: number;
          p_target_court_id?: string | null;
        };
        Returns: Json;
      };
      delete_up_next_card: {
        Args: { p_card_id: string };
        Returns: Json;
      };
      /** Replaces the auto cards; { error: 'line_changed' } if the line moved since p_line_version was read. */
      replace_auto_up_next: {
        Args: { p_session_id: string; p_cards: Json; p_line_version: string };
        Returns: Json;
      };
      /**
       * No-show: the next waiting player (or p_in) comes in, the no-show goes on a break.
       * p_window_minutes is ignored (kept for older callers). Returns { replacement_id, change_id } or { error }.
       */
      swap_match_player: {
        Args: { p_match_id: string; p_out: string; p_window_minutes?: number | null; p_in?: string | null };
        Returns: Json;
      };
      /** Live-court changes. Each returns { change_id, unpaired? } or { error }; remove may return { abandoned: true }. */
      replace_match_player: {
        Args: { p_match_id: string; p_out: string; p_in: string };
        Returns: Json;
      };
      switch_match_teams: {
        Args: { p_match_id: string; p_player_1: string; p_player_2: string };
        Returns: Json;
      };
      remove_match_player: {
        Args: { p_match_id: string; p_player: string };
        Returns: Json;
      };
      fill_match_slot: {
        Args: { p_match_id: string; p_team: MatchTeam; p_player: string };
        Returns: Json;
      };
      /** Puts back a live-court change (latest on that game, within 10 s). */
      undo_court_change: {
        Args: { p_change_id: string };
        Returns: Json;
      };
      /**
       * Saves a finished game (via record_match_result) and requeues its checked-in
       * players in one transaction. Returns { success, requeued, session_id, court_id }
       * or { error: code }.
       */
      finish_match: {
        Args: {
          p_match_id: string;
          p_team_a_score: number;
          p_team_b_score: number;
          p_winning_team: WinningTeam;
          p_ranked: boolean;
          p_rating_changes: Json;
          p_rules_version: number;
          p_min_rating: number;
          p_max_rating: number;
        };
        Returns: Json;
      };
      /** Ends or cancels one session: abandons its live games, frees their courts, empties its line. */
      close_session: {
        Args: { p_session_id: string; p_status: SessionStatus };
        Returns: Json;
      };
      /** Internal since finish_match: not callable by signed-in users. Kept for finish_match. */
      record_match_result: {
        Args: {
          p_match_id: string;
          p_team_a_score: number;
          p_team_b_score: number;
          p_winning_team: WinningTeam;
          p_ranked: boolean;
          /** [{ player_id, old_rating, new_rating, change }] */
          p_rating_changes: Json;
          p_rules_version: number;
          p_min_rating: number;
          p_max_rating: number;
        };
        Returns: Json;
      };
      /** An admin's manual rating edit: clamps, saves and logs a history row. */
      admin_set_rating: {
        Args: {
          p_player_id: string;
          p_new_rating: number;
          p_rules_version: number;
          p_min_rating: number;
          p_max_rating: number;
        };
        Returns: Json;
      };
      /** Games, wins, losses and points per player from counted games, optionally since a time. */
      leaderboard_stats: {
        Args: { p_since?: string | null };
        Returns: {
          player_id: string;
          games: number;
          wins: number;
          losses: number;
          points_for: number;
          points_against: number;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      court_status: CourtStatus;
      session_status: SessionStatus;
      checkin_status: CheckinStatus;
      queue_status: QueueStatus;
      match_format: MatchFormat;
      match_type: MatchType;
      match_status: MatchStatus;
      winning_team: WinningTeam;
      match_team: MatchTeam;
    };
  };
}
