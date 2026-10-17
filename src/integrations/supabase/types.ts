export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          data_mode: string
          id: string
          location_name: string | null
          media_urls: Json
          pinned: boolean
          pinned_at: string | null
          published_at: string | null
          status: string
          team_id: string | null
          title: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          data_mode?: string
          id?: string
          location_name?: string | null
          media_urls?: Json
          pinned?: boolean
          pinned_at?: string | null
          published_at?: string | null
          status?: string
          team_id?: string | null
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          data_mode?: string
          id?: string
          location_name?: string | null
          media_urls?: Json
          pinned?: boolean
          pinned_at?: string | null
          published_at?: string | null
          status?: string
          team_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_requests: {
        Row: {
          certification_number: string | null
          coach_name: string | null
          contact_email: string | null
          created_at: string
          id: string
          status: string
          team_id: string
          team_name: string | null
          user_id: string
        }
        Insert: {
          certification_number?: string | null
          coach_name?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          status?: string
          team_id: string
          team_name?: string | null
          user_id: string
        }
        Update: {
          certification_number?: string | null
          coach_name?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          status?: string
          team_id?: string
          team_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          data_mode: string
          discipline: string
          id: string
          name: string
          season: string
        }
        Insert: {
          data_mode: string
          discipline: string
          id: string
          name: string
          season: string
        }
        Update: {
          data_mode?: string
          discipline?: string
          id?: string
          name?: string
          season?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          data_mode: string
          division_id: string | null
          end_date: string | null
          id: string
          name: string
          source_url: string | null
          start_date: string | null
        }
        Insert: {
          data_mode: string
          division_id?: string | null
          end_date?: string | null
          id: string
          name: string
          source_url?: string | null
          start_date?: string | null
        }
        Update: {
          data_mode?: string
          division_id?: string | null
          end_date?: string | null
          id?: string
          name?: string
          source_url?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      family_links: {
        Row: {
          created_at: string
          family_user_id: string
          id: string
          player_id: string
          relationship: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          family_user_id: string
          id?: string
          player_id: string
          relationship?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          family_user_id?: string
          id?: string
          player_id?: string
          relationship?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_links_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          issuer_user_id: string
          max_uses: number | null
          player_id: string | null
          purpose: string
          status: string
          team_id: string | null
          uses: number
        }
        Insert: {
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          issuer_user_id: string
          max_uses?: number | null
          player_id?: string | null
          purpose: string
          status?: string
          team_id?: string | null
          uses?: number
        }
        Update: {
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          issuer_user_id?: string
          max_uses?: number | null
          player_id?: string | null
          purpose?: string
          status?: string
          team_id?: string | null
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      managed_teams: {
        Row: {
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "managed_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          court: string | null
          data_mode: string
          division_id: string
          event_id: string
          id: string
          score_a: number | null
          score_b: number | null
          sets: Json | null
          source_date: string | null
          starts_at: string | null
          status: string
          team_a_id: string
          team_b_id: string | null
          venue_id: string | null
        }
        Insert: {
          court?: string | null
          data_mode: string
          division_id: string
          event_id: string
          id: string
          score_a?: number | null
          score_b?: number | null
          sets?: Json | null
          source_date?: string | null
          starts_at?: string | null
          status: string
          team_a_id: string
          team_b_id?: string | null
          venue_id?: string | null
        }
        Update: {
          court?: string | null
          data_mode?: string
          division_id?: string
          event_id?: string
          id?: string
          score_a?: number | null
          score_b?: number | null
          sets?: Json | null
          source_date?: string | null
          starts_at?: string | null
          status?: string
          team_a_id?: string
          team_b_id?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      parking: {
        Row: {
          address: string | null
          coordinates_verified: boolean
          data_mode: string
          id: string
          name: string
          notes: string | null
          source_url: string | null
          venue_id: string
        }
        Insert: {
          address?: string | null
          coordinates_verified?: boolean
          data_mode: string
          id: string
          name: string
          notes?: string | null
          source_url?: string | null
          venue_id: string
        }
        Update: {
          address?: string | null
          coordinates_verified?: boolean
          data_mode?: string
          id?: string
          name?: string
          notes?: string | null
          source_url?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parking_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          data_mode: string
          display_name: string
          id: string
          jersey_number: string | null
          review_note: string | null
          status: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data_mode?: string
          display_name: string
          id?: string
          jersey_number?: string | null
          review_note?: string | null
          status?: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data_mode?: string
          display_name?: string
          id?: string
          jersey_number?: string | null
          review_note?: string | null
          status?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      rankings: {
        Row: {
          data_mode: string
          division_id: string
          event_id: string
          field_size: number | null
          final_confirmed: boolean
          id: string
          rank: number
          team_id: string
        }
        Insert: {
          data_mode: string
          division_id: string
          event_id: string
          field_size?: number | null
          final_confirmed?: boolean
          id: string
          rank: number
          team_id: string
        }
        Update: {
          data_mode?: string
          division_id?: string
          event_id?: string
          field_size?: number | null
          final_confirmed?: boolean
          id?: string
          rank?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rankings_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_allowlist: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          data_mode: string
          division_id: string | null
          id: string
          name: string
          organization: string | null
          season: string
        }
        Insert: {
          data_mode: string
          division_id?: string | null
          id: string
          name: string
          organization?: string | null
          season: string
        }
        Update: {
          data_mode?: string
          division_id?: string | null
          id?: string
          name?: string
          organization?: string | null
          season?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string
          coordinates_verified: boolean
          data_mode: string
          id: string
          image_note: string | null
          latitude: number | null
          longitude: number | null
          name: string
          source_url: string | null
        }
        Insert: {
          address: string
          coordinates_verified?: boolean
          data_mode: string
          id: string
          image_note?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          source_url?: string | null
        }
        Update: {
          address?: string
          coordinates_verified?: boolean
          data_mode?: string
          id?: string
          image_note?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          source_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_player: {
        Args: { _player: string; _user: string }
        Returns: boolean
      }
      can_view_team: {
        Args: { _team: string; _user: string }
        Returns: boolean
      }
      code_hash: { Args: { _code: string }; Returns: string }
      create_family_code: { Args: { _player: string }; Returns: Json }
      create_team_code: { Args: { _team: string }; Returns: Json }
      family_approval_requests: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          id: string
          relationship: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      join_synthetic_demo: { Args: never; Returns: Json }
      new_code: { Args: never; Returns: string }
      preview_pairing_code: { Args: { _code: string }; Returns: Json }
      redeem_code: {
        Args: { _code: string; _display_name?: string; _relationship?: string }
        Returns: Json
      }
      request_coach_access: { Args: { _team: string }; Returns: undefined }
      request_player_changes: {
        Args: { _note: string; _player: string }
        Returns: undefined
      }
      review_coach_request: {
        Args: { _approve: boolean; _request: string }
        Returns: undefined
      }
      review_family_request: {
        Args: { _approve: boolean; _link: string }
        Returns: undefined
      }
      set_announcement_pin: {
        Args: { _announcement: string; _pinned: boolean }
        Returns: undefined
      }
      submit_coach_application: {
        Args: {
          _certification_number: string
          _coach_name: string
          _team: string
        }
        Returns: undefined
      }
      update_player_registration: {
        Args: { _jersey: string; _name: string }
        Returns: undefined
      }
      verify_player: {
        Args: { _player: string; _status: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "coach" | "player" | "family"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "coach", "player", "family"],
    },
  },
} as const
