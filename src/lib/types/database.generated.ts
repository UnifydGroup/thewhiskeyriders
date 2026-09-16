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
      activity_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      awards: {
        Row: {
          description: string | null
          emoji: string | null
          id: string
          is_active: boolean
          name: string
          trip_id: string
        }
        Insert: {
          description?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean
          name: string
          trip_id: string
        }
        Update: {
          description?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "awards_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          badge_type: string
          description: string | null
          icon: string
          id: string
          name: string
          trip_id: string | null
        }
        Insert: {
          badge_type?: string
          description?: string | null
          icon: string
          id?: string
          name: string
          trip_id?: string | null
        }
        Update: {
          badge_type?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "badges_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_deliveries: {
        Row: {
          created_at: string
          email_campaign_id: string
          error: string | null
          member_id: string
          provider_message_id: string | null
          sent_at: string | null
        }
        Insert: {
          created_at?: string
          email_campaign_id: string
          error?: string | null
          member_id: string
          provider_message_id?: string | null
          sent_at?: string | null
        }
        Update: {
          created_at?: string
          email_campaign_id?: string
          error?: string | null
          member_id?: string
          provider_message_id?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_deliveries_email_campaign_id_fkey"
            columns: ["email_campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_deliveries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_members: {
        Row: {
          created_at: string
          email_campaign_id: string
          member_id: string
        }
        Insert: {
          created_at?: string
          email_campaign_id: string
          member_id: string
        }
        Update: {
          created_at?: string
          email_campaign_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_members_email_campaign_id_fkey"
            columns: ["email_campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_trips: {
        Row: {
          created_at: string
          email_campaign_id: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          email_campaign_id: string
          trip_id: string
        }
        Update: {
          created_at?: string
          email_campaign_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_trips_email_campaign_id_fkey"
            columns: ["email_campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_trips_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_global: boolean
          sent_at: string | null
          status: string
          subject: string
          tag_all_members: boolean
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_global?: boolean
          sent_at?: string | null
          status?: string
          subject: string
          tag_all_members?: boolean
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_global?: boolean
          sent_at?: string | null
          status?: string
          subject?: string
          tag_all_members?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          email_sent_at: string | null
          form_id: string
          id: string
          member_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          email_sent_at?: string | null
          form_id: string
          id?: string
          member_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          email_sent_at?: string | null
          form_id?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_field_library: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          field_type: string
          helper_text: string | null
          id: string
          label: string
          options: Json | null
          placeholder: string | null
          settings: Json | null
          updated_at: string
          use_count: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          field_type: string
          helper_text?: string | null
          id?: string
          label: string
          options?: Json | null
          placeholder?: string | null
          settings?: Json | null
          updated_at?: string
          use_count?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          field_type?: string
          helper_text?: string | null
          id?: string
          label?: string
          options?: Json | null
          placeholder?: string | null
          settings?: Json | null
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_field_library_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          created_at: string
          field_type: string
          form_id: string
          helper_text: string | null
          id: string
          is_required: boolean
          label: string
          library_field_id: string | null
          options: Json | null
          placeholder: string | null
          settings: Json | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          field_type: string
          form_id: string
          helper_text?: string | null
          id?: string
          is_required?: boolean
          label: string
          library_field_id?: string | null
          options?: Json | null
          placeholder?: string | null
          settings?: Json | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          field_type?: string
          form_id?: string
          helper_text?: string | null
          id?: string
          is_required?: boolean
          label?: string
          library_field_id?: string | null
          options?: Json | null
          placeholder?: string | null
          settings?: Json | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_library_field_id_fkey"
            columns: ["library_field_id"]
            isOneToOne: false
            referencedRelation: "form_field_library"
            referencedColumns: ["id"]
          },
        ]
      }
      form_response_values: {
        Row: {
          created_at: string
          field_id: string
          id: string
          response_id: string
          value_json: Json | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          response_id: string
          value_json?: Json | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          response_id?: string
          value_json?: Json | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_response_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "form_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_response_values_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "form_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          form_id: string
          id: string
          ip_address: string | null
          is_public: boolean
          member_id: string | null
          submitted_at: string
        }
        Insert: {
          form_id: string
          id?: string
          ip_address?: string | null
          is_public?: boolean
          member_id?: string | null
          submitted_at?: string
        }
        Update: {
          form_id?: string
          id?: string
          ip_address?: string | null
          is_public?: boolean
          member_id?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_verifications: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          form_id: string
          id: string
          otp_hash: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          form_id: string
          id?: string
          otp_hash: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          form_id?: string
          id?: string
          otp_hash?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_verifications_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          allow_multiple_submissions: boolean
          created_at: string
          created_by: string | null
          description: string | null
          goes_live_at: string | null
          id: string
          notify_on_submission: boolean
          require_email_verification: boolean
          show_countdown: boolean
          slug: string
          status: string
          submission_deadline: string | null
          title: string
          token: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          allow_multiple_submissions?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          goes_live_at?: string | null
          id?: string
          notify_on_submission?: boolean
          require_email_verification?: boolean
          show_countdown?: boolean
          slug: string
          status?: string
          submission_deadline?: string | null
          title: string
          token?: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_multiple_submissions?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          goes_live_at?: string | null
          id?: string
          notify_on_submission?: boolean
          require_email_verification?: boolean
          show_countdown?: boolean
          slug?: string
          status?: string
          submission_deadline?: string | null
          title?: string
          token?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      galleries: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          trip_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
          trip_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          trip_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "galleries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      member_cost_assignments: {
        Row: {
          cost_item_id: string
          id: string
          is_self_funded: boolean
          member_id: string
          notes: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          cost_item_id: string
          id?: string
          is_self_funded?: boolean
          member_id: string
          notes?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          cost_item_id?: string
          id?: string
          is_self_funded?: boolean
          member_id?: string
          notes?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_cost_assignments_cost_item_id_fkey"
            columns: ["cost_item_id"]
            isOneToOne: false
            referencedRelation: "trip_cost_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_cost_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_cost_assignments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      member_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          member_id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          trip_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          member_id: string
          notes?: string | null
          payment_date: string
          payment_method?: string | null
          trip_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          trip_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      news_assets: {
        Row: {
          created_at: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          name: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_size?: number
          file_type: string
          file_url: string
          id?: string
          name: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          name?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_email_deliveries: {
        Row: {
          created_at: string
          error: string | null
          member_id: string
          news_post_id: string
          provider_message_id: string | null
          sent_at: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          member_id: string
          news_post_id: string
          provider_message_id?: string | null
          sent_at?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          member_id?: string
          news_post_id?: string
          provider_message_id?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_email_deliveries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_email_deliveries_news_post_id_fkey"
            columns: ["news_post_id"]
            isOneToOne: false
            referencedRelation: "news_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      news_post_members: {
        Row: {
          created_at: string
          member_id: string
          news_post_id: string
        }
        Insert: {
          created_at?: string
          member_id: string
          news_post_id: string
        }
        Update: {
          created_at?: string
          member_id?: string
          news_post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_post_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_post_members_news_post_id_fkey"
            columns: ["news_post_id"]
            isOneToOne: false
            referencedRelation: "news_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      news_post_trips: {
        Row: {
          created_at: string
          news_post_id: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          news_post_id: string
          trip_id: string
        }
        Update: {
          created_at?: string
          news_post_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_post_trips_news_post_id_fkey"
            columns: ["news_post_id"]
            isOneToOne: false
            referencedRelation: "news_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_post_trips_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      news_posts: {
        Row: {
          archived_at: string | null
          author_id: string | null
          content: string
          created_at: string
          id: string
          is_archived: boolean
          is_global: boolean
          is_published: boolean
          published_at: string | null
          send_email_notification: boolean
          tag_all_members: boolean
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_global?: boolean
          is_published?: boolean
          published_at?: string | null
          send_email_notification?: boolean
          tag_all_members?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_global?: boolean
          is_published?: boolean
          published_at?: string | null
          send_email_notification?: boolean
          tag_all_members?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_import_log: {
        Row: {
          id: string
          imported_at: string
          replaced: boolean | null
          row_count: number
          trip_id: string
        }
        Insert: {
          id?: string
          imported_at?: string
          replaced?: boolean | null
          row_count: number
          trip_id: string
        }
        Update: {
          id?: string
          imported_at?: string
          replaced?: boolean | null
          row_count?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_import_log_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedule_milestones: {
        Row: {
          accumulated_amount: number
          created_at: string | null
          description: string | null
          id: string
          milestone_date: string
          trip_id: string
          updated_at: string | null
        }
        Insert: {
          accumulated_amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          milestone_date: string
          trip_id: string
          updated_at?: string | null
        }
        Update: {
          accumulated_amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          milestone_date?: string
          trip_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedule_milestones_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          description: string
          due_date: string | null
          id: string
          notes: string | null
          paid_date: string | null
          status: string
          trip_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: string
          trip_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          photo_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          photo_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          photo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_comments_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_likes: {
        Row: {
          created_at: string | null
          id: string
          photo_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          photo_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          photo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_likes_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_tags: {
        Row: {
          id: string
          photo_id: string
          tag_type: string
          tag_value: string
        }
        Insert: {
          id?: string
          photo_id: string
          tag_type: string
          tag_value: string
        }
        Update: {
          id?: string
          photo_id?: string
          tag_type?: string
          tag_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_tags_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          caption: string | null
          created_at: string | null
          gallery_id: string | null
          height: number | null
          id: string
          media_type: string
          mime_type: string | null
          storage_path: string
          trip_id: string
          uploaded_by: string
          width: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          gallery_id?: string | null
          height?: number | null
          id?: string
          media_type?: string
          mime_type?: string | null
          storage_path: string
          trip_id: string
          uploaded_by: string
          width?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          gallery_id?: string | null
          height?: number | null
          id?: string
          media_type?: string
          mime_type?: string | null
          storage_path?: string
          trip_id?: string
          uploaded_by?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          address_city: string | null
          address_country: string | null
          address_line1: string | null
          address_line2: string | null
          address_postcode: string | null
          address_state: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string
          emergency_contact: string | null
          emergency_contact_number: string | null
          first_name: string | null
          full_name: string | null
          id: string
          member_id: string | null
          middle_name: string | null
          nickname: string | null
          passport_expiry: string | null
          passport_number: string | null
          password_changed: boolean | null
          phone: string | null
          phone_country_code: string | null
          role: string
          shirt_size: string | null
          shorts_size: string | null
          status: string
          surname: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postcode?: string | null
          address_state?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email: string
          emergency_contact?: string | null
          emergency_contact_number?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          member_id?: string | null
          middle_name?: string | null
          nickname?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          password_changed?: boolean | null
          phone?: string | null
          phone_country_code?: string | null
          role?: string
          shirt_size?: string | null
          shorts_size?: string | null
          status?: string
          surname?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          address?: string | null
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postcode?: string | null
          address_state?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string
          emergency_contact?: string | null
          emergency_contact_number?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          member_id?: string | null
          middle_name?: string | null
          nickname?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          password_changed?: boolean | null
          phone?: string | null
          phone_country_code?: string | null
          role?: string
          shirt_size?: string | null
          shorts_size?: string | null
          status?: string
          surname?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          background_image_url: string
          background_media_type: string
          background_opacity: number
          background_position_x: number
          background_position_y: number
          background_video_url: string | null
          background_zoom: number
          email_footer_image_url: string | null
          email_footer_text: string
          email_greeting: string
          email_header_image_url: string | null
          email_header_tagline: string
          email_header_title: string
          id: string
          logo_url: string
          news_email_notifications_enabled: boolean
          updated_at: string
          updated_by: string
        }
        Insert: {
          background_image_url?: string
          background_media_type?: string
          background_opacity?: number
          background_position_x?: number
          background_position_y?: number
          background_video_url?: string | null
          background_zoom?: number
          email_footer_image_url?: string | null
          email_footer_text?: string
          email_greeting?: string
          email_header_image_url?: string | null
          email_header_tagline?: string
          email_header_title?: string
          id?: string
          logo_url?: string
          news_email_notifications_enabled?: boolean
          updated_at?: string
          updated_by: string
        }
        Update: {
          background_image_url?: string
          background_media_type?: string
          background_opacity?: number
          background_position_x?: number
          background_position_y?: number
          background_video_url?: string | null
          background_zoom?: number
          email_footer_image_url?: string | null
          email_footer_text?: string
          email_greeting?: string
          email_header_image_url?: string | null
          email_header_tagline?: string
          email_header_title?: string
          id?: string
          logo_url?: string
          news_email_notifications_enabled?: boolean
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      trip_budget_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          notes: string | null
          planned_aud: number
          sort_order: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          planned_aud?: number
          sort_order?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          planned_aud?: number
          sort_order?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_budget_categories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_budget_settings: {
        Row: {
          created_at: string
          enabled_currencies: string[]
          exchange_rate_mad_aud: number
          id: string
          notes: string | null
          per_person_budget_aud: number
          projected_member_count: number | null
          show_group_budget_to_members: boolean
          show_individual_breakdown_to_members: boolean
          total_budget_aud: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled_currencies?: string[]
          exchange_rate_mad_aud?: number
          id?: string
          notes?: string | null
          per_person_budget_aud?: number
          projected_member_count?: number | null
          show_group_budget_to_members?: boolean
          show_individual_breakdown_to_members?: boolean
          total_budget_aud?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled_currencies?: string[]
          exchange_rate_mad_aud?: number
          id?: string
          notes?: string | null
          per_person_budget_aud?: number
          projected_member_count?: number | null
          show_group_budget_to_members?: boolean
          show_individual_breakdown_to_members?: boolean
          total_budget_aud?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_budget_settings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_contacts: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          member_visible: boolean
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          sort_order: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          member_visible?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          sort_order?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          member_visible?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          sort_order?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_contacts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_cost_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          trip_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          trip_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_cost_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_documents: {
        Row: {
          created_at: string | null
          file_type: string
          file_url: string
          id: string
          is_admin_upload: boolean
          name: string
          trip_id: string
          uploaded_by: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_type?: string
          file_url: string
          id?: string
          is_admin_upload?: boolean
          name: string
          trip_id: string
          uploaded_by?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_type?: string
          file_url?: string
          id?: string
          is_admin_upload?: boolean
          name?: string
          trip_id?: string
          uploaded_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_documents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_expense_receipts: {
        Row: {
          created_at: string
          expense_id: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          trip_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          expense_id: string
          file_name: string
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          trip_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          expense_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          trip_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_expense_receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "trip_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expense_receipts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expense_receipts_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_expenses: {
        Row: {
          amount: number
          amount_aud: number
          amount_aud_overridden: boolean
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          exchange_rate: number
          expense_date: string
          id: string
          notes: string | null
          paid_by: string | null
          paid_by_label: string | null
          paid_by_type: string
          receipt_url: string | null
          reconcile_notes: string | null
          reconciled: boolean
          reconciled_at: string | null
          source: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_aud: number
          amount_aud_overridden?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          exchange_rate?: number
          expense_date: string
          id?: string
          notes?: string | null
          paid_by?: string | null
          paid_by_label?: string | null
          paid_by_type?: string
          receipt_url?: string | null
          reconcile_notes?: string | null
          reconciled?: boolean
          reconciled_at?: string | null
          source?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_aud?: number
          amount_aud_overridden?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          exchange_rate?: number
          expense_date?: string
          id?: string
          notes?: string | null
          paid_by?: string | null
          paid_by_label?: string | null
          paid_by_type?: string
          receipt_url?: string | null
          reconcile_notes?: string | null
          reconciled?: boolean
          reconciled_at?: string | null
          source?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_income_entries: {
        Row: {
          amount_aud: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          income_date: string
          member_id: string | null
          notes: string | null
          reconcile_notes: string | null
          reconciled: boolean
          reconciled_at: string | null
          source: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount_aud: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          income_date: string
          member_id?: string | null
          notes?: string | null
          reconcile_notes?: string | null
          reconciled?: boolean
          reconciled_at?: string | null
          source?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount_aud?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          income_date?: string
          member_id?: string | null
          notes?: string | null
          reconcile_notes?: string | null
          reconciled?: boolean
          reconciled_at?: string | null
          source?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_income_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_income_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_income_entries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_itinerary_segments: {
        Row: {
          category: string
          contacts: Json
          created_at: string
          date: string
          end_time: string | null
          id: string
          internal_notes: string | null
          location_from: string | null
          location_to: string | null
          member_description: string | null
          member_visible: boolean
          reference_number: string | null
          sort_order: number
          start_time: string | null
          status: string
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          category: string
          contacts?: Json
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          internal_notes?: string | null
          location_from?: string | null
          location_to?: string | null
          member_description?: string | null
          member_visible?: boolean
          reference_number?: string | null
          sort_order?: number
          start_time?: string | null
          status?: string
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          contacts?: Json
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          internal_notes?: string | null
          location_from?: string | null
          location_to?: string | null
          member_description?: string | null
          member_visible?: boolean
          reference_number?: string | null
          sort_order?: number
          start_time?: string | null
          status?: string
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_itinerary_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_key_dates: {
        Row: {
          date: string
          description: string | null
          id: string
          title: string
          trip_id: string
          type: string
        }
        Insert: {
          date: string
          description?: string | null
          id?: string
          title: string
          trip_id: string
          type?: string
        }
        Update: {
          date?: string
          description?: string | null
          id?: string
          title?: string
          trip_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_key_dates_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          id: string
          joined_at: string | null
          trip_id: string
          trip_role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          trip_id: string
          trip_role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          trip_id?: string
          trip_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_updates: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          id: string
          published_at: string | null
          title: string
          trip_id: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          published_at?: string | null
          title: string
          trip_id: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          published_at?: string | null
          title?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_updates_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          countdown_enabled: boolean
          countdown_target_at: string | null
          country: string
          country_code: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          destination: string
          end_date: string
          id: string
          itinerary: string | null
          latitude: number | null
          longitude: number | null
          max_members: number | null
          name: string
          slug: string
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          countdown_enabled?: boolean
          countdown_target_at?: string | null
          country: string
          country_code?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          destination: string
          end_date: string
          id?: string
          itinerary?: string | null
          latitude?: number | null
          longitude?: number | null
          max_members?: number | null
          name: string
          slug: string
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          countdown_enabled?: boolean
          countdown_target_at?: string | null
          country?: string
          country_code?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          destination?: string
          end_date?: string
          id?: string
          itinerary?: string | null
          latitude?: number | null
          longitude?: number | null
          max_members?: number | null
          name?: string
          slug?: string
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string | null
          awarded_by: string | null
          badge_id: string
          id: string
          trip_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          awarded_by?: string | null
          badge_id: string
          id?: string
          trip_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          awarded_by?: string | null
          badge_id?: string
          id?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          award_id: string
          created_at: string | null
          id: string
          nominee_id: string
          voter_id: string
        }
        Insert: {
          award_id: string
          created_at?: string | null
          id?: string
          nominee_id: string
          voter_id: string
        }
        Update: {
          award_id?: string
          created_at?: string | null
          id?: string
          nominee_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_award_id_fkey"
            columns: ["award_id"]
            isOneToOne: false
            referencedRelation: "awards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_nominee_id_fkey"
            columns: ["nominee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: { Args: never; Returns: string }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_super_admin: { Args: { user_id: string }; Returns: boolean }
      is_trip_member: {
        Args: { p_trip_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

// Alias for backward compatibility with existing imports
export type SupabaseDatabase = Database
