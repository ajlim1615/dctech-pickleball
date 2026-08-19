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
export type QueueStatus = "waiting" | "called" | "playing" | "left";
export type MatchFormat = "singles" | "doubles";
export type MatchType = "open_play" | "challenge" | "tournament";
export type MatchStatus = "pending" | "in_progress" | "completed" | "abandoned";
export type WinningTeam = "team_a" | "team_b" | "tie";
export type MatchTeam = "team_a" | "team_b";

export interface Database {
  public: {
    Tables: {
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
      matches: {
        Row: {
          id: string;
          session_id: string;
          court_id: string;
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
          court_id?: string;
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
          match_id: string;
          old_rating: number;
          new_rating: number;
          rating_change: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          match_id: string;
          old_rating: number;
          new_rating: number;
          rating_change: number;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          match_id?: string;
          old_rating?: number;
          new_rating?: number;
          rating_change?: number;
          recorded_at?: string;
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
      complete_match: {
        Args: {
          p_match_id: string;
          p_team_a_score: number;
          p_team_b_score: number;
          p_recorded_by?: string;
        };
        Returns: Json;
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
