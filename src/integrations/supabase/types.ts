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
      calendar_connections: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          calendar_id: string
          color_hex: string
          connected_at: string
          google_email: string | null
          id: string
          provider: string
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          calendar_id?: string
          color_hex?: string
          connected_at?: string
          google_email?: string | null
          id?: string
          provider?: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          calendar_id?: string
          color_hex?: string
          connected_at?: string
          google_email?: string | null
          id?: string
          provider?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      eods: {
        Row: {
          blockers: string | null
          calls_booked: number
          calls_scheduled: number
          convos_started: number
          created_at: string
          dms_sent: number
          id: string
          no_shows: number
          report_date: string
          shows: number
          summary: string | null
          tomorrow_focus: string | null
          updated_at: string
          user_id: string
          wins: string | null
        }
        Insert: {
          blockers?: string | null
          calls_booked?: number
          calls_scheduled?: number
          convos_started?: number
          created_at?: string
          dms_sent?: number
          id?: string
          no_shows?: number
          report_date?: string
          shows?: number
          summary?: string | null
          tomorrow_focus?: string | null
          updated_at?: string
          user_id: string
          wins?: string | null
        }
        Update: {
          blockers?: string | null
          calls_booked?: number
          calls_scheduled?: number
          convos_started?: number
          created_at?: string
          dms_sent?: number
          id?: string
          no_shows?: number
          report_date?: string
          shows?: number
          summary?: string | null
          tomorrow_focus?: string | null
          updated_at?: string
          user_id?: string
          wins?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_calls: {
        Row: {
          action_items: string | null
          call_date: string
          coach_id: string | null
          coach_notes: string | null
          created_at: string
          fathom_url: string | null
          id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          action_items?: string | null
          call_date: string
          coach_id?: string | null
          coach_notes?: string | null
          created_at?: string
          fathom_url?: string | null
          id?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          action_items?: string | null
          call_date?: string
          coach_id?: string | null
          coach_notes?: string | null
          created_at?: string
          fathom_url?: string | null
          id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_calls_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_eods: {
        Row: {
          applications_submitted: number
          blockers: string | null
          created_at: string
          id: string
          interviews: number
          outreach_sent: number
          replies: number
          report_date: string
          student_id: string
          summary: string | null
          tomorrow_focus: string | null
          updated_at: string
          wins: string | null
        }
        Insert: {
          applications_submitted?: number
          blockers?: string | null
          created_at?: string
          id?: string
          interviews?: number
          outreach_sent?: number
          replies?: number
          report_date: string
          student_id: string
          summary?: string | null
          tomorrow_focus?: string | null
          updated_at?: string
          wins?: string | null
        }
        Update: {
          applications_submitted?: number
          blockers?: string | null
          created_at?: string
          id?: string
          interviews?: number
          outreach_sent?: number
          replies?: number
          report_date?: string
          student_id?: string
          summary?: string | null
          tomorrow_focus?: string | null
          updated_at?: string
          wins?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_eods_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          calls_included: number
          coach_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          join_date: string
          notes: string | null
          phase: Database["public"]["Enums"]["student_phase"]
          status: Database["public"]["Enums"]["student_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          calls_included?: number
          coach_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          join_date?: string
          notes?: string | null
          phase?: Database["public"]["Enums"]["student_phase"]
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          calls_included?: number
          coach_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          join_date?: string
          notes?: string | null
          phase?: Database["public"]["Enums"]["student_phase"]
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      app_role: "admin" | "closer" | "setter" | "coach" | "student"
      student_phase:
        | "uncategorized"
        | "onboarding"
        | "coaching_1on1"
        | "training"
        | "graduated"
        | "paused"
      student_status: "active" | "inactive" | "ghosting"
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
      app_role: ["admin", "closer", "setter", "coach", "student"],
      student_phase: [
        "uncategorized",
        "onboarding",
        "coaching_1on1",
        "training",
        "graduated",
        "paused",
      ],
      student_status: ["active", "inactive", "ghosting"],
    },
  },
} as const
