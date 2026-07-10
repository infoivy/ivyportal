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
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
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
      commission_rates: {
        Row: {
          active: boolean
          id: string
          key: string
          label: string
          notes: string | null
          rate: number
          top_setter_bonus_pct: number
          updated_at: string
          weekly_cash_bonus_pct: number
          weekly_cash_bonus_threshold: number
        }
        Insert: {
          active?: boolean
          id?: string
          key: string
          label: string
          notes?: string | null
          rate?: number
          top_setter_bonus_pct?: number
          updated_at?: string
          weekly_cash_bonus_pct?: number
          weekly_cash_bonus_threshold?: number
        }
        Update: {
          active?: boolean
          id?: string
          key?: string
          label?: string
          notes?: string | null
          rate?: number
          top_setter_bonus_pct?: number
          updated_at?: string
          weekly_cash_bonus_pct?: number
          weekly_cash_bonus_threshold?: number
        }
        Relationships: []
      }
      content_hooks: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          example: string | null
          favorite: boolean
          funnel_stage: string | null
          id: string
          text: string
          times_used: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          example?: string | null
          favorite?: boolean
          funnel_stage?: string | null
          id?: string
          text: string
          times_used?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          example?: string | null
          favorite?: boolean
          funnel_stage?: string | null
          id?: string
          text?: string
          times_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      content_ideas: {
        Row: {
          created_at: string
          created_by: string
          explanation: string | null
          funnel_guess: string | null
          harvested: boolean
          id: string
          link: string | null
          promoted_item_id: string | null
          text: string
          trigger_type: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          explanation?: string | null
          funnel_guess?: string | null
          harvested?: boolean
          id?: string
          link?: string | null
          promoted_item_id?: string | null
          text: string
          trigger_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          explanation?: string | null
          funnel_guess?: string | null
          harvested?: boolean
          id?: string
          link?: string | null
          promoted_item_id?: string | null
          text?: string
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_ideas_promoted_item_id_fkey"
            columns: ["promoted_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string
          duration_sec: number | null
          edited_at: string | null
          edited_reel_url: string | null
          format: string | null
          funnel_stage: string | null
          hook: string
          hook_diagnosis: string | null
          id: string
          link_when_posted: string | null
          platform: Database["public"]["Enums"]["content_platform"]
          platforms: string[]
          post_avg_watch_sec: number | null
          post_new_follows: number | null
          post_views: number | null
          posted_at: string | null
          raw_video_url: string | null
          recorded_at: string | null
          reedit_flag: boolean
          scheduled_date: string | null
          script: string | null
          source: string | null
          status: Database["public"]["Enums"]["content_status"]
          tags: string[]
          title: string | null
          updated_at: string
          week_start: string | null
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by: string
          duration_sec?: number | null
          edited_at?: string | null
          edited_reel_url?: string | null
          format?: string | null
          funnel_stage?: string | null
          hook: string
          hook_diagnosis?: string | null
          id?: string
          link_when_posted?: string | null
          platform?: Database["public"]["Enums"]["content_platform"]
          platforms?: string[]
          post_avg_watch_sec?: number | null
          post_new_follows?: number | null
          post_views?: number | null
          posted_at?: string | null
          raw_video_url?: string | null
          recorded_at?: string | null
          reedit_flag?: boolean
          scheduled_date?: string | null
          script?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title?: string | null
          updated_at?: string
          week_start?: string | null
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string
          duration_sec?: number | null
          edited_at?: string | null
          edited_reel_url?: string | null
          format?: string | null
          funnel_stage?: string | null
          hook?: string
          hook_diagnosis?: string | null
          id?: string
          link_when_posted?: string | null
          platform?: Database["public"]["Enums"]["content_platform"]
          platforms?: string[]
          post_avg_watch_sec?: number | null
          post_new_follows?: number | null
          post_views?: number | null
          posted_at?: string | null
          raw_video_url?: string | null
          recorded_at?: string | null
          reedit_flag?: boolean
          scheduled_date?: string | null
          script?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title?: string | null
          updated_at?: string
          week_start?: string | null
        }
        Relationships: []
      }
      content_week_ideas: {
        Row: {
          created_at: string
          created_by: string
          id: string
          matched_creative_type: string | null
          position: number
          promoted_item_id: string | null
          stage: string
          text: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          matched_creative_type?: string | null
          position: number
          promoted_item_id?: string | null
          stage: string
          text?: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          matched_creative_type?: string | null
          position?: number
          promoted_item_id?: string | null
          stage?: string
          text?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_week_ideas_promoted_item_id_fkey"
            columns: ["promoted_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_week_plans: {
        Row: {
          auto_provisioned: boolean
          created_at: string
          created_by: string
          notes: string | null
          updated_at: string
          week_start: string
        }
        Insert: {
          auto_provisioned?: boolean
          created_at?: string
          created_by: string
          notes?: string | null
          updated_at?: string
          week_start: string
        }
        Update: {
          auto_provisioned?: boolean
          created_at?: string
          created_by?: string
          notes?: string | null
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      crm_lead_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          lead_id: string
          lead_name: string | null
          pinned: boolean
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          lead_name?: string | null
          pinned?: boolean
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          lead_name?: string | null
          pinned?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      csm_student_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          student_id: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          student_id: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          student_id?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "csm_student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      csm_tally: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["csm_tally_kind"]
          note: string | null
          student_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["csm_tally_kind"]
          note?: string | null
          student_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["csm_tally_kind"]
          note?: string | null
          student_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "csm_tally_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          cash_collected_upfront: number
          closer_id: string
          contract_url: string | null
          created_at: string
          created_by: string | null
          deal_date: string
          fathom_url: string | null
          id: string
          is_demo: boolean
          notes: string | null
          payment_type: Database["public"]["Enums"]["deal_payment_type"]
          program_type: string
          setter_id: string | null
          source: string | null
          student_id: string | null
          student_name: string
          total_value: number
          updated_at: string
        }
        Insert: {
          cash_collected_upfront?: number
          closer_id: string
          contract_url?: string | null
          created_at?: string
          created_by?: string | null
          deal_date?: string
          fathom_url?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          payment_type?: Database["public"]["Enums"]["deal_payment_type"]
          program_type?: string
          setter_id?: string | null
          source?: string | null
          student_id?: string | null
          student_name: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          cash_collected_upfront?: number
          closer_id?: string
          contract_url?: string | null
          created_at?: string
          created_by?: string | null
          deal_date?: string
          fathom_url?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          payment_type?: Database["public"]["Enums"]["deal_payment_type"]
          program_type?: string
          setter_id?: string | null
          source?: string | null
          student_id?: string | null
          student_name?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      docs: {
        Row: {
          category: Database["public"]["Enums"]["doc_category"]
          content: string
          created_at: string
          external_links: Json
          id: string
          is_founder_only: boolean
          last_reviewed_at: string | null
          pinned: boolean
          role_visibility: string[]
          slug: string
          sort_order: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["doc_category"]
          content?: string
          created_at?: string
          external_links?: Json
          id?: string
          is_founder_only?: boolean
          last_reviewed_at?: string | null
          pinned?: boolean
          role_visibility?: string[]
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["doc_category"]
          content?: string
          created_at?: string
          external_links?: Json
          id?: string
          is_founder_only?: boolean
          last_reviewed_at?: string | null
          pinned?: boolean
          role_visibility?: string[]
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      eods: {
        Row: {
          blockers: string | null
          calls_booked: number
          calls_scheduled: number
          calls_taken: number
          cash_collected: number
          closes: number
          convos_started: number
          created_at: string
          deferred_cash: number
          deposits: number
          dials: number
          dms_sent: number
          escalations_resolved: number
          follow_ups_done: number
          id: string
          is_demo: boolean
          leads_contacted: number
          looms_reviewed: number
          no_shows: number
          report_date: string
          roleplays_reviewed: number
          shows: number
          student_checkins: number
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
          calls_taken?: number
          cash_collected?: number
          closes?: number
          convos_started?: number
          created_at?: string
          deferred_cash?: number
          deposits?: number
          dials?: number
          dms_sent?: number
          escalations_resolved?: number
          follow_ups_done?: number
          id?: string
          is_demo?: boolean
          leads_contacted?: number
          looms_reviewed?: number
          no_shows?: number
          report_date?: string
          roleplays_reviewed?: number
          shows?: number
          student_checkins?: number
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
          calls_taken?: number
          cash_collected?: number
          closes?: number
          convos_started?: number
          created_at?: string
          deferred_cash?: number
          deposits?: number
          dials?: number
          dms_sent?: number
          escalations_resolved?: number
          follow_ups_done?: number
          id?: string
          is_demo?: boolean
          leads_contacted?: number
          looms_reviewed?: number
          no_shows?: number
          report_date?: string
          roleplays_reviewed?: number
          shows?: number
          student_checkins?: number
          summary?: string | null
          tomorrow_focus?: string | null
          updated_at?: string
          user_id?: string
          wins?: string | null
        }
        Relationships: []
      }
      founder_settings: {
        Row: {
          created_at: string
          crm_enabled: boolean
          id: string
          monthly_cash_goal: number | null
          quarterly_goals: Json | null
          recording_day_of_week: number
          top_setter_bonus_pct: number
          updated_at: string
          updated_by: string | null
          weekly_cash_bonus_pct: number
          weekly_cash_bonus_threshold: number
        }
        Insert: {
          created_at?: string
          crm_enabled?: boolean
          id?: string
          monthly_cash_goal?: number | null
          quarterly_goals?: Json | null
          recording_day_of_week?: number
          top_setter_bonus_pct?: number
          updated_at?: string
          updated_by?: string | null
          weekly_cash_bonus_pct?: number
          weekly_cash_bonus_threshold?: number
        }
        Update: {
          created_at?: string
          crm_enabled?: boolean
          id?: string
          monthly_cash_goal?: number | null
          quarterly_goals?: Json | null
          recording_day_of_week?: number
          top_setter_bonus_pct?: number
          updated_at?: string
          updated_by?: string | null
          weekly_cash_bonus_pct?: number
          weekly_cash_bonus_threshold?: number
        }
        Relationships: []
      }
      ig_connections: {
        Row: {
          access_token: string | null
          connected_at: string | null
          created_at: string
          display_name: string | null
          expires_at: string | null
          id: string
          ig_user_id: string | null
          last_synced_at: string | null
          page_id: string | null
          status: string
          subtitle: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          expires_at?: string | null
          id?: string
          ig_user_id?: string | null
          last_synced_at?: string | null
          page_id?: string | null
          status?: string
          subtitle?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          expires_at?: string | null
          id?: string
          ig_user_id?: string | null
          last_synced_at?: string | null
          page_id?: string | null
          status?: string
          subtitle?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      ig_dashboards: {
        Row: {
          created_at: string
          data: Json
          id: string
          month_label: string
          period_label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          month_label?: string
          period_label?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          month_label?: string
          period_label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ig_monthly_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          dms: number
          followers: number
          id: string
          interactions: number
          is_demo: boolean
          link_clicks: number
          month: string
          new_followers: number
          notes: string | null
          posts: number
          profile_visits: number
          reach: number
          updated_at: string
          views: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dms?: number
          followers?: number
          id?: string
          interactions?: number
          is_demo?: boolean
          link_clicks?: number
          month: string
          new_followers?: number
          notes?: string | null
          posts?: number
          profile_visits?: number
          reach?: number
          updated_at?: string
          views?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dms?: number
          followers?: number
          id?: string
          interactions?: number
          is_demo?: boolean
          link_clicks?: number
          month?: string
          new_followers?: number
          notes?: string | null
          posts?: number
          profile_visits?: number
          reach?: number
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      ig_top_reels: {
        Row: {
          avg_watch_sec: number | null
          comments: number
          content_item_id: string | null
          created_at: string
          created_by: string | null
          id: string
          month: string
          new_follows: number | null
          pillar: string | null
          saves: number
          shares: number
          topic: string
          updated_at: string
          views: number
        }
        Insert: {
          avg_watch_sec?: number | null
          comments?: number
          content_item_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          new_follows?: number | null
          pillar?: string | null
          saves?: number
          shares?: number
          topic: string
          updated_at?: string
          views?: number
        }
        Update: {
          avg_watch_sec?: number | null
          comments?: number
          content_item_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          new_follows?: number | null
          pillar?: string | null
          saves?: number
          shares?: number
          topic?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "ig_top_reels_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          due_date: string
          id: string
          installment_id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          reminded_1d_at: string | null
          reminded_3d_at: string | null
          sequence: number
          status: Database["public"]["Enums"]["installment_payment_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          installment_id: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reminded_1d_at?: string | null
          reminded_3d_at?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["installment_payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          installment_id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reminded_1d_at?: string | null
          reminded_3d_at?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["installment_payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          closer_id: string | null
          coach_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          setter_id: string | null
          student_id: string | null
          student_name: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          closer_id?: string | null
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          setter_id?: string | null
          student_id?: string | null
          student_name: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          closer_id?: string | null
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          setter_id?: string | null
          student_id?: string | null
          student_name?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          roles: string[]
          setter_type: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          roles?: string[]
          setter_type?: string | null
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          roles?: string[]
          setter_type?: string | null
          token?: string
          used_at?: string | null
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
      onboarding_progress: {
        Row: {
          done_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          step_id: string
          user_id: string
        }
        Insert: {
          done_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          step_id: string
          user_id: string
        }
        Update: {
          done_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          step_id?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          steps: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          steps?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          steps?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          active: boolean
          amount: number | null
          created_at: string
          currency: string
          id: string
          label: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          sort_order: number
          updated_at: string
          url: string | null
        }
        Insert: {
          active?: boolean
          amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          label: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Update: {
          active?: boolean
          amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          label?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_path: string | null
          avatar_url: string | null
          commission_cap_pct: number | null
          created_at: string
          dashboard_prefs: Json
          display_name: string | null
          id: string
          phone: string | null
          setter_type: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_path?: string | null
          avatar_url?: string | null
          commission_cap_pct?: number | null
          created_at?: string
          dashboard_prefs?: Json
          display_name?: string | null
          id: string
          phone?: string | null
          setter_type?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_path?: string | null
          avatar_url?: string | null
          commission_cap_pct?: number | null
          created_at?: string
          dashboard_prefs?: Json
          display_name?: string | null
          id?: string
          phone?: string | null
          setter_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_credentials: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string | null
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      set_reminders: {
        Row: {
          calendly_event_uri: string | null
          created_at: string
          duration_min: number
          event_start: string
          gcal_event_id: string | null
          gcal_html_link: string | null
          id: string
          notes: string | null
          owner_id: string | null
          prospect: string
          source: string
        }
        Insert: {
          calendly_event_uri?: string | null
          created_at?: string
          duration_min?: number
          event_start: string
          gcal_event_id?: string | null
          gcal_html_link?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          prospect: string
          source?: string
        }
        Update: {
          calendly_event_uri?: string | null
          created_at?: string
          duration_min?: number
          event_start?: string
          gcal_event_id?: string | null
          gcal_html_link?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          prospect?: string
          source?: string
        }
        Relationships: []
      }
      student_action_items: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string
          done: boolean
          done_at: string | null
          due_date: string | null
          id: string
          is_demo: boolean
          notes: string | null
          source_call_id: string | null
          student_id: string | null
          text: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by: string
          done?: boolean
          done_at?: string | null
          due_date?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          source_call_id?: string | null
          student_id?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          done?: boolean
          done_at?: string | null
          due_date?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          source_call_id?: string | null
          student_id?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_action_items_source_call_id_fkey"
            columns: ["source_call_id"]
            isOneToOne: false
            referencedRelation: "student_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_action_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_calls: {
        Row: {
          action_items: string | null
          action_items_json: Json
          call_date: string
          coach_id: string | null
          coach_notes: string | null
          created_at: string
          duration_min: number | null
          fathom_url: string | null
          id: string
          next_call_date: string | null
          next_step: string | null
          outcome: string | null
          progress_rating: number | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          action_items?: string | null
          action_items_json?: Json
          call_date: string
          coach_id?: string | null
          coach_notes?: string | null
          created_at?: string
          duration_min?: number | null
          fathom_url?: string | null
          id?: string
          next_call_date?: string | null
          next_step?: string | null
          outcome?: string | null
          progress_rating?: number | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          action_items?: string | null
          action_items_json?: Json
          call_date?: string
          coach_id?: string | null
          coach_notes?: string | null
          created_at?: string
          duration_min?: number | null
          fathom_url?: string | null
          id?: string
          next_call_date?: string | null
          next_step?: string | null
          outcome?: string | null
          progress_rating?: number | null
          status?: string
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
          looms_sent: number
          outreach_sent: number
          replies: number
          report_date: string
          roleplays: number
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
          looms_sent?: number
          outreach_sent?: number
          replies?: number
          report_date: string
          roleplays?: number
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
          looms_sent?: number
          outreach_sent?: number
          replies?: number
          report_date?: string
          roleplays?: number
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
      student_milestone_progress: {
        Row: {
          achieved_at: string
          achieved_by: string | null
          milestone_id: string
          student_id: string
        }
        Insert: {
          achieved_at?: string
          achieved_by?: string | null
          milestone_id: string
          student_id: string
        }
        Update: {
          achieved_at?: string
          achieved_by?: string | null
          milestone_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_milestone_progress_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "student_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_milestone_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_milestones: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      students: {
        Row: {
          calls_allotted: number
          calls_included: number
          coach_id: string | null
          created_at: string
          email: string | null
          first_win_at: string | null
          full_name: string
          general_notes: string | null
          id: string
          is_demo: boolean
          join_date: string
          next_action: string | null
          notes: string | null
          offer_landed_at: string | null
          offers_landed_count: number
          payment_state: Database["public"]["Enums"]["payment_state"] | null
          phase: Database["public"]["Enums"]["student_phase"]
          source: string | null
          status: Database["public"]["Enums"]["student_status"]
          student_grade: string | null
          testimonial_collected: boolean
          testimonial_requested: boolean
          trustpilot_collected: boolean
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          calls_allotted?: number
          calls_included?: number
          coach_id?: string | null
          created_at?: string
          email?: string | null
          first_win_at?: string | null
          full_name: string
          general_notes?: string | null
          id?: string
          is_demo?: boolean
          join_date?: string
          next_action?: string | null
          notes?: string | null
          offer_landed_at?: string | null
          offers_landed_count?: number
          payment_state?: Database["public"]["Enums"]["payment_state"] | null
          phase?: Database["public"]["Enums"]["student_phase"]
          source?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          student_grade?: string | null
          testimonial_collected?: boolean
          testimonial_requested?: boolean
          trustpilot_collected?: boolean
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          calls_allotted?: number
          calls_included?: number
          coach_id?: string | null
          created_at?: string
          email?: string | null
          first_win_at?: string | null
          full_name?: string
          general_notes?: string | null
          id?: string
          is_demo?: boolean
          join_date?: string
          next_action?: string | null
          notes?: string | null
          offer_landed_at?: string | null
          offers_landed_count?: number
          payment_state?: Database["public"]["Enums"]["payment_state"] | null
          phase?: Database["public"]["Enums"]["student_phase"]
          source?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          student_grade?: string | null
          testimonial_collected?: boolean
          testimonial_requested?: boolean
          trustpilot_collected?: boolean
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          collected_at: string | null
          collected_by: string | null
          content_text: string | null
          created_at: string
          file_path: string | null
          id: string
          source_url: string | null
          status: Database["public"]["Enums"]["testimonial_status"]
          student_id: string | null
          tags: string[]
          title: string | null
          type: Database["public"]["Enums"]["testimonial_type"]
          updated_at: string
        }
        Insert: {
          collected_at?: string | null
          collected_by?: string | null
          content_text?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["testimonial_status"]
          student_id?: string | null
          tags?: string[]
          title?: string | null
          type: Database["public"]["Enums"]["testimonial_type"]
          updated_at?: string
        }
        Update: {
          collected_at?: string | null
          collected_by?: string | null
          content_text?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["testimonial_status"]
          student_id?: string | null
          tags?: string[]
          title?: string | null
          type?: Database["public"]["Enums"]["testimonial_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      training_videos: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string
          id: string
          sort_order: number
          thumbnail_color: string
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          thumbnail_color?: string
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          thumbnail_color?: string
          title?: string
          updated_at?: string
          video_url?: string | null
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
      student_toggle_action_item: {
        Args: { _call_id: string; _done: boolean; _index: number }
        Returns: Json
      }
      verify_security_schema: {
        Args: never
        Returns: {
          policy_count: number
          rls_enabled: boolean
          table_name: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "closer"
        | "setter"
        | "coach"
        | "student"
        | "csm"
        | "founder"
      content_platform:
        | "instagram"
        | "tiktok"
        | "youtube"
        | "twitter"
        | "linkedin"
        | "threads"
        | "other"
      content_status:
        | "idea"
        | "scripted"
        | "approved"
        | "recorded"
        | "filmed"
        | "edited"
        | "scheduled"
        | "posted"
      csm_tally_kind: "loom" | "roleplay" | "checkin" | "escalation"
      deal_payment_type: "pif" | "deposit" | "split"
      doc_category:
        | "setting"
        | "closing"
        | "csm"
        | "coaching"
        | "team_ops"
        | "onboarding"
        | "content"
      installment_payment_status:
        | "upcoming"
        | "paid"
        | "late"
        | "missed"
        | "waived"
      payment_method: "whop" | "stripe" | "wise" | "paypal" | "bank" | "other"
      payment_state: "paid_in_full" | "installments" | "behind"
      student_phase:
        | "uncategorized"
        | "onboarding"
        | "coaching_1on1"
        | "training"
        | "graduated"
        | "paused"
      student_status: "active" | "inactive" | "ghosting"
      testimonial_status: "requested" | "received" | "approved" | "published"
      testimonial_type: "video" | "image" | "text" | "trustpilot"
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
      app_role: [
        "admin",
        "closer",
        "setter",
        "coach",
        "student",
        "csm",
        "founder",
      ],
      content_platform: [
        "instagram",
        "tiktok",
        "youtube",
        "twitter",
        "linkedin",
        "threads",
        "other",
      ],
      content_status: [
        "idea",
        "scripted",
        "approved",
        "recorded",
        "filmed",
        "edited",
        "scheduled",
        "posted",
      ],
      csm_tally_kind: ["loom", "roleplay", "checkin", "escalation"],
      deal_payment_type: ["pif", "deposit", "split"],
      doc_category: [
        "setting",
        "closing",
        "csm",
        "coaching",
        "team_ops",
        "onboarding",
        "content",
      ],
      installment_payment_status: [
        "upcoming",
        "paid",
        "late",
        "missed",
        "waived",
      ],
      payment_method: ["whop", "stripe", "wise", "paypal", "bank", "other"],
      payment_state: ["paid_in_full", "installments", "behind"],
      student_phase: [
        "uncategorized",
        "onboarding",
        "coaching_1on1",
        "training",
        "graduated",
        "paused",
      ],
      student_status: ["active", "inactive", "ghosting"],
      testimonial_status: ["requested", "received", "approved", "published"],
      testimonial_type: ["video", "image", "text", "trustpilot"],
    },
  },
} as const

