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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          target_level: Database["public"]["Enums"]["student_level"] | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          target_level?: Database["public"]["Enums"]["student_level"] | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          target_level?: Database["public"]["Enums"]["student_level"] | null
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          adsense_publisher_id: string | null
          app_tagline: string | null
          id: number
          key: string | null
          maintenance_mode: boolean
          updated_at: string
          value: string | null
        }
        Insert: {
          adsense_publisher_id?: string | null
          app_tagline?: string | null
          id?: number
          key?: string | null
          maintenance_mode?: boolean
          updated_at?: string
          value?: string | null
        }
        Update: {
          adsense_publisher_id?: string | null
          app_tagline?: string | null
          id?: number
          key?: string | null
          maintenance_mode?: boolean
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          pdf_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pdf_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pdf_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          chapter_number: number
          created_at: string
          file_size_mb: number | null
          id: string
          pdf_id: string
          storage_path: string
          title: string
        }
        Insert: {
          chapter_number: number
          created_at?: string
          file_size_mb?: number | null
          id?: string
          pdf_id: string
          storage_path: string
          title: string
        }
        Update: {
          chapter_number?: number
          created_at?: string
          file_size_mb?: number | null
          id?: string
          pdf_id?: string
          storage_path?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
      downloads: {
        Row: {
          chapter_id: string
          downloaded_at: string
          id: string
          pdf_id: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          downloaded_at?: string
          id?: string
          pdf_id: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          downloaded_at?: string
          id?: string
          pdf_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "downloads_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downloads_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdfs: {
        Row: {
          course_code: string
          cover_url: string | null
          created_at: string
          department: string | null
          description: string | null
          download_count: number
          faculty: string | null
          file_size_mb: number | null
          id: string
          is_general: boolean
          is_past_question: boolean
          is_verified: boolean
          level: Database["public"]["Enums"]["student_level"]
          tags: string[] | null
          title: string
          total_chapters: number
          updated_at: string
          uploader_id: string | null
          year: number | null
        }
        Insert: {
          course_code: string
          cover_url?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          download_count?: number
          faculty?: string | null
          file_size_mb?: number | null
          id?: string
          is_general?: boolean
          is_past_question?: boolean
          is_verified?: boolean
          level: Database["public"]["Enums"]["student_level"]
          tags?: string[] | null
          title: string
          total_chapters?: number
          updated_at?: string
          uploader_id?: string | null
          year?: number | null
        }
        Update: {
          course_code?: string
          cover_url?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          download_count?: number
          faculty?: string | null
          file_size_mb?: number | null
          id?: string
          is_general?: boolean
          is_past_question?: boolean
          is_verified?: boolean
          level?: Database["public"]["Enums"]["student_level"]
          tags?: string[] | null
          title?: string
          total_chapters?: number
          updated_at?: string
          uploader_id?: string | null
          year?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          faculty: string | null
          full_name: string
          id: string
          is_banned: boolean
          last_active: string | null
          level: Database["public"]["Enums"]["student_level"] | null
          matric_no: string | null
          streak: number
          updated_at: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          faculty?: string | null
          full_name?: string
          id: string
          is_banned?: boolean
          last_active?: string | null
          level?: Database["public"]["Enums"]["student_level"] | null
          matric_no?: string | null
          streak?: number
          updated_at?: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          faculty?: string | null
          full_name?: string
          id?: string
          is_banned?: boolean
          last_active?: string | null
          level?: Database["public"]["Enums"]["student_level"] | null
          matric_no?: string | null
          streak?: number
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          id: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          id: string
          pdf_id: string
          review_text: string | null
          stars: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pdf_id: string
          review_text?: string | null
          stars: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pdf_id?: string
          review_text?: string | null
          stars?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          pdf_id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pdf_id: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pdf_id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      youtube_channels: {
        Row: {
          channel_name: string
          channel_url: string
          course_tags: string[] | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          level: Database["public"]["Enums"]["student_level"] | null
          thumbnail_url: string | null
        }
        Insert: {
          channel_name: string
          channel_url: string
          course_tags?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level?: Database["public"]["Enums"]["student_level"] | null
          thumbnail_url?: string | null
        }
        Update: {
          channel_name?: string
          channel_url?: string
          course_tags?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level?: Database["public"]["Enums"]["student_level"] | null
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      youtube_videos: {
        Row: {
          course_tag: string | null
          created_at: string
          id: string
          is_featured: boolean
          level: Database["public"]["Enums"]["student_level"] | null
          thumbnail_url: string | null
          video_title: string
          video_url: string
        }
        Insert: {
          course_tag?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean
          level?: Database["public"]["Enums"]["student_level"] | null
          thumbnail_url?: string | null
          video_title: string
          video_url: string
        }
        Update: {
          course_tag?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean
          level?: Database["public"]["Enums"]["student_level"] | null
          thumbnail_url?: string | null
          video_title?: string
          video_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "rep" | "admin"
      student_level: "100L" | "200L" | "300L" | "400L" | "500L"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["student", "rep", "admin"],
      student_level: ["100L", "200L", "300L", "400L", "500L"],
    },
  },
} as const
