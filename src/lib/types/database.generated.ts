// AUTO-GENERATED — do not edit manually.
// Regenerate with: npx supabase gen types typescript --project-id xhapsqyyjrdwczquanxd > src/lib/types/database.generated.ts
// Last regenerated: 2026-04-16

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SupabaseDatabase = {
  // Allows @supabase/supabase-js >=2.48 to infer correct query argument types.
  __InternalSupabase: {
    PostgrestVersion: '14.4';
  };
  public: {
    Tables: {
      awards: {
        Row: {
          description: string | null;
          emoji: string | null;
          id: string;
          is_active: boolean;
          name: string;
          trip_id: string;
        };
        Insert: {
          description?: string | null;
          emoji?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          trip_id: string;
        };
        Update: {
          description?: string | null;
          emoji?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          trip_id?: string;
        };
        Relationships: [{ foreignKeyName: 'awards_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] }];
      };
      badges: {
        Row: {
          badge_type: string;
          description: string | null;
          icon: string;
          id: string;
          name: string;
          trip_id: string | null;
        };
        Insert: {
          badge_type?: string;
          description?: string | null;
          icon: string;
          id?: string;
          name: string;
          trip_id?: string | null;
        };
        Update: {
          badge_type?: string;
          description?: string | null;
          icon?: string;
          id?: string;
          name?: string;
          trip_id?: string | null;
        };
        Relationships: [{ foreignKeyName: 'badges_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] }];
      };
      galleries: {
        Row: {
          created_at: string | null;
          created_by: string;
          description: string | null;
          id: string;
          name: string;
          trip_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by: string;
          description?: string | null;
          id?: string;
          name: string;
          trip_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string;
          description?: string | null;
          id?: string;
          name?: string;
          trip_id?: string;
          updated_at?: string | null;
        };
        Relationships: [{ foreignKeyName: 'galleries_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] }];
      };
      member_payments: {
        Row: {
          amount: number;
          created_at: string | null;
          id: string;
          member_id: string;
          notes: string | null;
          payment_date: string;
          payment_method: string | null;
          trip_id: string;
          updated_at: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          id?: string;
          member_id: string;
          notes?: string | null;
          payment_date: string;
          payment_method?: string | null;
          trip_id: string;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          id?: string;
          member_id?: string;
          notes?: string | null;
          payment_date?: string;
          payment_method?: string | null;
          trip_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'member_payments_member_id_fkey'; columns: ['member_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'member_payments_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] }
        ];
      };
      payment_import_log: {
        Row: { id: string; imported_at: string; replaced: boolean | null; row_count: number; trip_id: string };
        Insert: { id?: string; imported_at?: string; replaced?: boolean | null; row_count: number; trip_id: string };
        Update: { id?: string; imported_at?: string; replaced?: boolean | null; row_count?: number; trip_id?: string };
        Relationships: [{ foreignKeyName: 'payment_import_log_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] }];
      };
      payment_schedule_milestones: {
        Row: {
          accumulated_amount: number;
          created_at: string | null;
          description: string | null;
          id: string;
          milestone_date: string;
          trip_id: string;
          updated_at: string | null;
        };
        Insert: {
          accumulated_amount: number;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          milestone_date: string;
          trip_id: string;
          updated_at?: string | null;
        };
        Update: {
          accumulated_amount?: number;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          milestone_date?: string;
          trip_id?: string;
          updated_at?: string | null;
        };
        Relationships: [{ foreignKeyName: 'payment_schedule_milestones_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] }];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string | null;
          description: string;
          due_date: string | null;
          id: string;
          notes: string | null;
          paid_date: string | null;
          status: string;
          trip_id: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          description: string;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          paid_date?: string | null;
          status?: string;
          trip_id: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          description?: string;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          paid_date?: string | null;
          status?: string;
          trip_id?: string;
          user_id?: string;
        };
        Relationships: [
          { foreignKeyName: 'payments_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] },
          { foreignKeyName: 'payments_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      photo_comments: {
        Row: { content: string; created_at: string | null; id: string; photo_id: string; user_id: string };
        Insert: { content: string; created_at?: string | null; id?: string; photo_id: string; user_id: string };
        Update: { content?: string; created_at?: string | null; id?: string; photo_id?: string; user_id?: string };
        Relationships: [
          { foreignKeyName: 'photo_comments_photo_id_fkey'; columns: ['photo_id']; isOneToOne: false; referencedRelation: 'photos'; referencedColumns: ['id'] },
          { foreignKeyName: 'photo_comments_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      photo_likes: {
        Row: { created_at: string | null; id: string; photo_id: string; user_id: string };
        Insert: { created_at?: string | null; id?: string; photo_id: string; user_id: string };
        Update: { created_at?: string | null; id?: string; photo_id?: string; user_id?: string };
        Relationships: [
          { foreignKeyName: 'photo_likes_photo_id_fkey'; columns: ['photo_id']; isOneToOne: false; referencedRelation: 'photos'; referencedColumns: ['id'] },
          { foreignKeyName: 'photo_likes_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      photo_tags: {
        Row: { id: string; photo_id: string; tag_type: string; tag_value: string };
        Insert: { id?: string; photo_id: string; tag_type: string; tag_value: string };
        Update: { id?: string; photo_id?: string; tag_type?: string; tag_value?: string };
        Relationships: [{ foreignKeyName: 'photo_tags_photo_id_fkey'; columns: ['photo_id']; isOneToOne: false; referencedRelation: 'photos'; referencedColumns: ['id'] }];
      };
      photos: {
        Row: { caption: string | null; created_at: string | null; gallery_id: string | null; height: number | null; id: string; media_type: 'image' | 'video'; mime_type: string | null; storage_path: string; trip_id: string; uploaded_by: string; width: number | null };
        Insert: { caption?: string | null; created_at?: string | null; gallery_id?: string | null; height?: number | null; id?: string; media_type?: 'image' | 'video'; mime_type?: string | null; storage_path: string; trip_id: string; uploaded_by: string; width?: number | null };
        Update: { caption?: string | null; created_at?: string | null; gallery_id?: string | null; height?: number | null; id?: string; media_type?: 'image' | 'video'; mime_type?: string | null; storage_path?: string; trip_id?: string; uploaded_by?: string; width?: number | null };
        Relationships: [
          { foreignKeyName: 'photos_gallery_id_fkey'; columns: ['gallery_id']; isOneToOne: false; referencedRelation: 'galleries'; referencedColumns: ['id'] },
          { foreignKeyName: 'photos_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] },
          { foreignKeyName: 'photos_uploaded_by_fkey'; columns: ['uploaded_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      profiles: {
        Row: {
          address: string | null;
          address_city: string | null;
          address_country: string | null;
          address_line1: string | null;
          address_line2: string | null;
          address_postcode: string | null;
          address_state: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string | null;
          date_of_birth: string | null;
          email: string;
          emergency_contact: string | null;
          emergency_contact_number: string | null;
          first_name: string | null;
          full_name: string | null;
          id: string;
          member_id: string | null;
          middle_name: string | null;
          nickname: string | null;
          passport_expiry: string | null;
          passport_number: string | null;
          password_changed: boolean | null;
          phone: string | null;
          phone_country_code: string | null;
          role: 'super_admin' | 'admin' | 'trip_admin' | 'member';
          shirt_size: string | null;
          shorts_size: string | null;
          status: string;
          surname: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          address_city?: string | null;
          address_country?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          address_postcode?: string | null;
          address_state?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string | null;
          date_of_birth?: string | null;
          email: string;
          emergency_contact?: string | null;
          emergency_contact_number?: string | null;
          first_name?: string | null;
          full_name?: string | null;
          id: string;
          member_id?: string | null;
          middle_name?: string | null;
          nickname?: string | null;
          passport_expiry?: string | null;
          passport_number?: string | null;
          password_changed?: boolean | null;
          phone?: string | null;
          phone_country_code?: string | null;
          role?: 'super_admin' | 'admin' | 'trip_admin' | 'member';
          shirt_size?: string | null;
          shorts_size?: string | null;
          status?: string;
          surname?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Update: {
          address?: string | null;
          address_city?: string | null;
          address_country?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          address_postcode?: string | null;
          address_state?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string | null;
          date_of_birth?: string | null;
          email?: string;
          emergency_contact?: string | null;
          emergency_contact_number?: string | null;
          first_name?: string | null;
          full_name?: string | null;
          id?: string;
          member_id?: string | null;
          middle_name?: string | null;
          nickname?: string | null;
          passport_expiry?: string | null;
          passport_number?: string | null;
          password_changed?: boolean | null;
          phone?: string | null;
          phone_country_code?: string | null;
          role?: 'super_admin' | 'admin' | 'trip_admin' | 'member';
          shirt_size?: string | null;
          shorts_size?: string | null;
          status?: string;
          surname?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      news_posts: {
        Row: {
          archived_at: string | null;
          author_id: string | null;
          content: string;
          created_at: string | null;
          id: string;
          is_archived: boolean;
          is_global: boolean;
          is_published: boolean;
          published_at: string | null;
          tag_all_members: boolean;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          archived_at?: string | null;
          author_id?: string | null;
          content: string;
          created_at?: string | null;
          id?: string;
          is_archived?: boolean;
          is_global?: boolean;
          is_published?: boolean;
          published_at?: string | null;
          tag_all_members?: boolean;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          archived_at?: string | null;
          author_id?: string | null;
          content?: string;
          created_at?: string | null;
          id?: string;
          is_archived?: boolean;
          is_global?: boolean;
          is_published?: boolean;
          published_at?: string | null;
          tag_all_members?: boolean;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'news_posts_author_id_fkey'; columns: ['author_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      news_post_trips: {
        Row: {
          created_at: string;
          news_post_id: string;
          trip_id: string;
        };
        Insert: {
          created_at?: string;
          news_post_id: string;
          trip_id: string;
        };
        Update: {
          created_at?: string;
          news_post_id?: string;
          trip_id?: string;
        };
        Relationships: [
          { foreignKeyName: 'news_post_trips_news_post_id_fkey'; columns: ['news_post_id']; isOneToOne: false; referencedRelation: 'news_posts'; referencedColumns: ['id'] },
          { foreignKeyName: 'news_post_trips_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] }
        ];
      };
      news_post_members: {
        Row: {
          created_at: string;
          member_id: string;
          news_post_id: string;
        };
        Insert: {
          created_at?: string;
          member_id: string;
          news_post_id: string;
        };
        Update: {
          created_at?: string;
          member_id?: string;
          news_post_id?: string;
        };
        Relationships: [
          { foreignKeyName: 'news_post_members_member_id_fkey'; columns: ['member_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'news_post_members_news_post_id_fkey'; columns: ['news_post_id']; isOneToOne: false; referencedRelation: 'news_posts'; referencedColumns: ['id'] }
        ];
      };
      news_assets: {
        Row: {
          created_at: string;
          file_size: number;
          file_type: string;
          file_url: string;
          id: string;
          name: string;
          storage_path: string;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          file_size?: number;
          file_type: string;
          file_url: string;
          id?: string;
          name: string;
          storage_path: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          file_size?: number;
          file_type?: string;
          file_url?: string;
          id?: string;
          name?: string;
          storage_path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'news_assets_uploaded_by_fkey'; columns: ['uploaded_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      news_email_deliveries: {
        Row: {
          created_at: string;
          error: string | null;
          member_id: string;
          news_post_id: string;
          provider_message_id: string | null;
          sent_at: string | null;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          member_id: string;
          news_post_id: string;
          provider_message_id?: string | null;
          sent_at?: string | null;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          member_id?: string;
          news_post_id?: string;
          provider_message_id?: string | null;
          sent_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'news_email_deliveries_member_id_fkey'; columns: ['member_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'news_email_deliveries_news_post_id_fkey'; columns: ['news_post_id']; isOneToOne: false; referencedRelation: 'news_posts'; referencedColumns: ['id'] }
        ];
      };
      trip_documents: {
        Row: { created_at: string | null; file_type: string; file_url: string; id: string; is_admin_upload: boolean; name: string; trip_id: string; uploaded_by: string | null; user_id: string | null };
        Insert: { created_at?: string | null; file_type?: string; file_url: string; id?: string; is_admin_upload?: boolean; name: string; trip_id: string; uploaded_by?: string | null; user_id?: string | null };
        Update: { created_at?: string | null; file_type?: string; file_url?: string; id?: string; is_admin_upload?: boolean; name?: string; trip_id?: string; uploaded_by?: string | null; user_id?: string | null };
        Relationships: [
          { foreignKeyName: 'trip_documents_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] },
          { foreignKeyName: 'trip_documents_uploaded_by_fkey'; columns: ['uploaded_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'trip_documents_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      trip_key_dates: {
        Row: { date: string; description: string | null; id: string; title: string; trip_id: string; type: 'departure' | 'arrival' | 'payment_due' | 'deadline' | 'event' | 'other' };
        Insert: { date: string; description?: string | null; id?: string; title: string; trip_id: string; type?: 'departure' | 'arrival' | 'payment_due' | 'deadline' | 'event' | 'other' };
        Update: { date?: string; description?: string | null; id?: string; title?: string; trip_id?: string; type?: 'departure' | 'arrival' | 'payment_due' | 'deadline' | 'event' | 'other' };
        Relationships: [{ foreignKeyName: 'trip_key_dates_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] }];
      };
      trip_members: {
        Row: { id: string; joined_at: string | null; trip_id: string; trip_role: 'captain' | 'kitty_man' | 'organiser' | 'member'; user_id: string };
        Insert: { id?: string; joined_at?: string | null; trip_id: string; trip_role?: 'captain' | 'kitty_man' | 'organiser' | 'member'; user_id: string };
        Update: { id?: string; joined_at?: string | null; trip_id?: string; trip_role?: 'captain' | 'kitty_man' | 'organiser' | 'member'; user_id?: string };
        Relationships: [
          { foreignKeyName: 'trip_members_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] },
          { foreignKeyName: 'trip_members_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      trip_updates: {
        Row: { author_id: string | null; content: string; created_at: string | null; id: string; published_at: string | null; title: string; trip_id: string };
        Insert: { author_id?: string | null; content: string; created_at?: string | null; id?: string; published_at?: string | null; title: string; trip_id: string };
        Update: { author_id?: string | null; content?: string; created_at?: string | null; id?: string; published_at?: string | null; title?: string; trip_id?: string };
        Relationships: [
          { foreignKeyName: 'trip_updates_author_id_fkey'; columns: ['author_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'trip_updates_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] }
        ];
      };
      trips: {
        Row: {
          countdown_enabled: boolean;
          countdown_target_at: string | null;
          country: string;
          country_code: string | null;
          cover_image_url: string | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          destination: string;
          end_date: string;
          id: string;
          itinerary: string | null;
          latitude: number | null;
          longitude: number | null;
          max_members: number | null;
          name: string;
          slug: string;
          start_date: string;
          status: 'upcoming' | 'active' | 'completed' | 'cancelled';
          updated_at: string | null;
        };
        Insert: {
          countdown_enabled?: boolean;
          countdown_target_at?: string | null;
          country: string;
          country_code?: string | null;
          cover_image_url?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          destination: string;
          end_date: string;
          id?: string;
          itinerary?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          max_members?: number | null;
          name: string;
          slug: string;
          start_date: string;
          status?: 'upcoming' | 'active' | 'completed' | 'cancelled';
          updated_at?: string | null;
        };
        Update: {
          countdown_enabled?: boolean;
          countdown_target_at?: string | null;
          country?: string;
          country_code?: string | null;
          cover_image_url?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          destination?: string;
          end_date?: string;
          id?: string;
          itinerary?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          max_members?: number | null;
          name?: string;
          slug?: string;
          start_date?: string;
          status?: 'upcoming' | 'active' | 'completed' | 'cancelled';
          updated_at?: string | null;
        };
        Relationships: [{ foreignKeyName: 'trips_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }];
      };
      user_badges: {
        Row: { awarded_at: string | null; awarded_by: string | null; badge_id: string; id: string; trip_id: string; user_id: string };
        Insert: { awarded_at?: string | null; awarded_by?: string | null; badge_id: string; id?: string; trip_id: string; user_id: string };
        Update: { awarded_at?: string | null; awarded_by?: string | null; badge_id?: string; id?: string; trip_id?: string; user_id?: string };
        Relationships: [
          { foreignKeyName: 'user_badges_awarded_by_fkey'; columns: ['awarded_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'user_badges_badge_id_fkey'; columns: ['badge_id']; isOneToOne: false; referencedRelation: 'badges'; referencedColumns: ['id'] },
          { foreignKeyName: 'user_badges_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] },
          { foreignKeyName: 'user_badges_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      votes: {
        Row: { award_id: string; created_at: string | null; id: string; nominee_id: string; voter_id: string };
        Insert: { award_id: string; created_at?: string | null; id?: string; nominee_id: string; voter_id: string };
        Update: { award_id?: string; created_at?: string | null; id?: string; nominee_id?: string; voter_id?: string };
        Relationships: [
          { foreignKeyName: 'votes_award_id_fkey'; columns: ['award_id']; isOneToOne: false; referencedRelation: 'awards'; referencedColumns: ['id'] },
          { foreignKeyName: 'votes_nominee_id_fkey'; columns: ['nominee_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'votes_voter_id_fkey'; columns: ['voter_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ];
      };
      site_settings: {
        Row: {
          id: string;
          logo_url: string;
          background_image_url: string;
          news_email_notifications_enabled: boolean;
          background_media_type: 'image' | 'video';
          background_video_url: string | null;
          background_position_x: number;
          background_position_y: number;
          background_zoom: number;
          background_opacity: number;
          updated_by: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          logo_url: string;
          background_image_url: string;
          news_email_notifications_enabled?: boolean;
          background_media_type?: 'image' | 'video';
          background_video_url?: string | null;
          background_position_x?: number;
          background_position_y?: number;
          background_zoom?: number;
          background_opacity?: number;
          updated_by: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          logo_url?: string;
          background_image_url?: string;
          news_email_notifications_enabled?: boolean;
          background_media_type?: 'image' | 'video';
          background_video_url?: string | null;
          background_position_x?: number;
          background_position_y?: number;
          background_zoom?: number;
          background_opacity?: number;
          updated_by?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          entity_name: string | null;
          changes: Record<string, unknown> | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          entity_name?: string | null;
          changes?: Record<string, unknown> | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          link: string | null;
          is_read: boolean;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: string;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          id: string;
          user_id: string;
          trip_updates: string;
          payment_reminders: string;
          award_voting: string;
          new_gallery_photos: string;
          new_comments: string;
          system_announcements: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          trip_updates?: string;
          payment_reminders?: string;
          award_voting?: string;
          new_gallery_photos?: string;
          new_comments?: string;
          system_announcements?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          trip_updates?: string;
          payment_reminders?: string;
          award_voting?: string;
          new_gallery_photos?: string;
          new_comments?: string;
          system_announcements?: string;
        };
        Relationships: [];
      };
      email_templates: {
        Row: {
          id: string;
          name: string;
          slug: string;
          subject: string;
          body: string;
          variables: string[];
          is_default: boolean;
          updated_by: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          subject: string;
          body: string;
          variables?: string[];
          is_default?: boolean;
          updated_by: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          subject?: string;
          body?: string;
          variables?: string[];
          is_default?: boolean;
          updated_by?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trip_budget_settings: {
        Row: {
          id: string; trip_id: string; total_budget_aud: number;
          show_group_budget_to_members: boolean; show_individual_breakdown_to_members: boolean;
          exchange_rate_mad_aud: number; notes: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; trip_id: string; total_budget_aud?: number;
          show_group_budget_to_members?: boolean; show_individual_breakdown_to_members?: boolean;
          exchange_rate_mad_aud?: number; notes?: string | null; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; trip_id?: string; total_budget_aud?: number;
          show_group_budget_to_members?: boolean; show_individual_breakdown_to_members?: boolean;
          exchange_rate_mad_aud?: number; notes?: string | null; updated_at?: string;
        };
        Relationships: [{ foreignKeyName: 'trip_budget_settings_trip_id_fkey'; columns: ['trip_id']; isOneToOne: true; referencedRelation: 'trips'; referencedColumns: ['id'] }];
      };
      trip_budget_categories: {
        Row: {
          id: string; trip_id: string; name: string; planned_aud: number;
          color: string; sort_order: number; notes: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; trip_id: string; name: string; planned_aud?: number;
          color?: string; sort_order?: number; notes?: string | null; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; trip_id?: string; name?: string; planned_aud?: number;
          color?: string; sort_order?: number; notes?: string | null; updated_at?: string;
        };
        Relationships: [{ foreignKeyName: 'trip_budget_categories_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] }];
      };
      trip_expenses: {
        Row: {
          id: string; trip_id: string; category_id: string | null; description: string;
          amount: number; currency: string; amount_aud: number; amount_aud_overridden: boolean;
          exchange_rate: number; expense_date: string; paid_by: string | null;
          paid_by_type: string; paid_by_label: string | null; source: string;
          reconciled: boolean; reconciled_at: string | null; reconcile_notes: string | null;
          receipt_url: string | null; notes: string | null; created_by: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; trip_id: string; category_id?: string | null; description: string;
          amount: number; currency?: string; amount_aud: number; amount_aud_overridden?: boolean;
          exchange_rate?: number; expense_date: string; paid_by?: string | null;
          paid_by_type?: string; paid_by_label?: string | null; source?: string;
          reconciled?: boolean; reconciled_at?: string | null; reconcile_notes?: string | null;
          receipt_url?: string | null; notes?: string | null; created_by?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; trip_id?: string; category_id?: string | null; description?: string;
          amount?: number; currency?: string; amount_aud?: number; amount_aud_overridden?: boolean;
          exchange_rate?: number; expense_date?: string; paid_by?: string | null;
          paid_by_type?: string; paid_by_label?: string | null; source?: string;
          reconciled?: boolean; reconciled_at?: string | null; reconcile_notes?: string | null;
          receipt_url?: string | null; notes?: string | null; updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'trip_expenses_category_id_fkey'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'trip_budget_categories'; referencedColumns: ['id'] },
          { foreignKeyName: 'trip_expenses_paid_by_fkey'; columns: ['paid_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'trip_expenses_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] }
        ];
      };
      trip_income_entries: {
        Row: {
          id: string; trip_id: string; description: string; amount_aud: number;
          income_date: string; source: string; reconciled: boolean;
          reconciled_at: string | null; reconcile_notes: string | null;
          category: string | null; member_id: string | null; notes: string | null;
          created_by: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; trip_id: string; description: string; amount_aud: number;
          income_date: string; source?: string; reconciled?: boolean;
          reconciled_at?: string | null; reconcile_notes?: string | null;
          category?: string | null; member_id?: string | null; notes?: string | null;
          created_by?: string | null; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; trip_id?: string; description?: string; amount_aud?: number;
          income_date?: string; source?: string; reconciled?: boolean;
          reconciled_at?: string | null; reconcile_notes?: string | null;
          category?: string | null; member_id?: string | null; notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'trip_income_entries_member_id_fkey'; columns: ['member_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'trip_income_entries_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] }
        ];
      };
      trip_payment_settings: {
        Row: {
          id: string; trip_id: string; flights_cost_aud: number;
          show_payment_options: boolean; monthly_option_title: string;
          monthly_option_amount_label: string | null; monthly_option_description: string | null;
          quarterly_option_title: string; quarterly_option_amount_label: string | null;
          quarterly_option_description: string | null; show_bank_details: boolean;
          bank_account_name: string | null; bank_bsb: string | null;
          bank_account_number: string | null; bank_payid: string | null;
          bank_notes: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; trip_id: string; flights_cost_aud?: number;
          show_payment_options?: boolean; monthly_option_title?: string;
          monthly_option_amount_label?: string | null; monthly_option_description?: string | null;
          quarterly_option_title?: string; quarterly_option_amount_label?: string | null;
          quarterly_option_description?: string | null; show_bank_details?: boolean;
          bank_account_name?: string | null; bank_bsb?: string | null;
          bank_account_number?: string | null; bank_payid?: string | null;
          bank_notes?: string | null; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; trip_id?: string; flights_cost_aud?: number;
          show_payment_options?: boolean; monthly_option_title?: string;
          monthly_option_amount_label?: string | null; monthly_option_description?: string | null;
          quarterly_option_title?: string; quarterly_option_amount_label?: string | null;
          quarterly_option_description?: string | null; show_bank_details?: boolean;
          bank_account_name?: string | null; bank_bsb?: string | null;
          bank_account_number?: string | null; bank_payid?: string | null;
          bank_notes?: string | null; updated_at?: string;
        };
        Relationships: [{ foreignKeyName: 'trip_payment_settings_trip_id_fkey'; columns: ['trip_id']; isOneToOne: true; referencedRelation: 'trips'; referencedColumns: ['id'] }];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: { user_id: string }; Returns: boolean };
      is_super_admin: { Args: { user_id: string }; Returns: boolean };
      is_trip_member: { Args: { p_trip_id: string; p_user_id: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
