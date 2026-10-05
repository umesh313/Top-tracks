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
      albums: {
        Row: {
          artist_id: string
          id: string
          musicbrainz_release_group_id: string | null
          release_date: string | null
          title: string
        }
        Insert: {
          artist_id: string
          id?: string
          musicbrainz_release_group_id?: string | null
          release_date?: string | null
          title: string
        }
        Update: {
          artist_id?: string
          id?: string
          musicbrainz_release_group_id?: string | null
          release_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          bio: string | null
          country_code: string | null
          created_at: string
          genre_id: string | null
          hue: number
          id: string
          monthly_listeners: number
          musicbrainz_id: string | null
          name: string
          slug: string
        }
        Insert: {
          bio?: string | null
          country_code?: string | null
          created_at?: string
          genre_id?: string | null
          hue?: number
          id?: string
          monthly_listeners?: number
          musicbrainz_id?: string | null
          name: string
          slug: string
        }
        Update: {
          bio?: string | null
          country_code?: string | null
          created_at?: string
          genre_id?: string | null
          hue?: number
          id?: string
          monthly_listeners?: number
          musicbrainz_id?: string | null
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "artists_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "artists_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_votes: {
        Row: {
          battle_id: string
          choice: string
          created_at: string
          user_id: string
        }
        Insert: {
          battle_id: string
          choice: string
          created_at?: string
          user_id?: string
        }
        Update: {
          battle_id?: string
          choice?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_votes_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          created_at: string
          id: string
          song_a: string
          song_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          song_a: string
          song_b: string
        }
        Update: {
          created_at?: string
          id?: string
          song_a?: string
          song_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "battles_song_a_fkey"
            columns: ["song_a"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battles_song_b_fkey"
            columns: ["song_b"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_entries: {
        Row: {
          chart_score: number
          momentum_score: number
          peak_rank: number
          people_score: number
          prev_rank: number | null
          radio_score: number
          rank: number
          search_score: number
          social_score: number
          song_id: string
          songboard_score: number
          streaming_score: number
          week_id: number
          weeks_on_chart: number
        }
        Insert: {
          chart_score: number
          momentum_score: number
          peak_rank: number
          people_score: number
          prev_rank?: number | null
          radio_score: number
          rank: number
          search_score: number
          social_score: number
          song_id: string
          songboard_score: number
          streaming_score: number
          week_id: number
          weeks_on_chart?: number
        }
        Update: {
          chart_score?: number
          momentum_score?: number
          peak_rank?: number
          people_score?: number
          prev_rank?: number | null
          radio_score?: number
          rank?: number
          search_score?: number
          social_score?: number
          song_id?: string
          songboard_score?: number
          streaming_score?: number
          week_id?: number
          weeks_on_chart?: number
        }
        Relationships: [
          {
            foreignKeyName: "chart_entries_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_entries_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "chart_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_weeks: {
        Row: {
          created_at: string
          id: number
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: number
          week_start: string
        }
        Update: {
          created_at?: string
          id?: number
          week_start?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          flag: string
          name: string
        }
        Insert: {
          code: string
          flag: string
          name: string
        }
        Update: {
          code?: string
          flag?: string
          name?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          target_id: string
          target_type: string
          user_id?: string
        }
        Update: {
          created_at?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      genres: {
        Row: {
          hue: number
          id: string
          name: string
        }
        Insert: {
          hue?: number
          id: string
          name: string
        }
        Update: {
          hue?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          created_at: string
          id: string
          song_id: string
          target_week: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          song_id: string
          target_week: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          song_id?: string
          target_week?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      scoring_config: {
        Row: {
          id: number
          people: number
          radio: number
          search: number
          social: number
          streaming: number
          updated_at: string
        }
        Insert: {
          id?: number
          people?: number
          radio?: number
          search?: number
          social?: number
          streaming?: number
          updated_at?: string
        }
        Update: {
          id?: number
          people?: number
          radio?: number
          search?: number
          social?: number
          streaming?: number
          updated_at?: string
        }
        Relationships: []
      }
      song_metrics: {
        Row: {
          people_down: number
          people_up: number
          radio: number
          search: number
          social: number
          song_id: string
          streaming: number
          week_id: number
        }
        Insert: {
          people_down?: number
          people_up?: number
          radio?: number
          search?: number
          social?: number
          song_id: string
          streaming?: number
          week_id: number
        }
        Update: {
          people_down?: number
          people_up?: number
          radio?: number
          search?: number
          social?: number
          song_id?: string
          streaming?: number
          week_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "song_metrics_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_metrics_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "chart_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          album_id: string | null
          artist_id: string
          country_code: string | null
          created_at: string
          duration_sec: number
          genre_id: string | null
          hue: number
          id: string
          isrc: string | null
          musicbrainz_recording_id: string | null
          release_date: string | null
          slug: string
          title: string
        }
        Insert: {
          album_id?: string | null
          artist_id: string
          country_code?: string | null
          created_at?: string
          duration_sec?: number
          genre_id?: string | null
          hue?: number
          id?: string
          isrc?: string | null
          musicbrainz_recording_id?: string | null
          release_date?: string | null
          slug: string
          title: string
        }
        Update: {
          album_id?: string | null
          artist_id?: string
          country_code?: string | null
          created_at?: string
          duration_sec?: number
          genre_id?: string | null
          hue?: number
          id?: string
          isrc?: string | null
          musicbrainz_recording_id?: string | null
          release_date?: string | null
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "songs_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "songs_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
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
      votes: {
        Row: {
          created_at: string
          id: string
          song_id: string
          user_id: string
          value: number
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          song_id: string
          user_id?: string
          value: number
          week_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          song_id?: string
          user_id?: string
          value?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      battle_totals: {
        Args: never
        Returns: {
          battle_id: string
          choice: string
          n: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      vote_totals: {
        Args: { _week?: string }
        Returns: {
          down: number
          song_id: string
          up: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
