export type UserRole = 'super_admin' | 'admin' | 'trip_admin' | 'member';
export type TripStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type TripRole = 'captain' | 'kitty_man' | 'organiser' | 'member';
export type KeyDateType = 'departure' | 'arrival' | 'payment_due' | 'deadline' | 'event' | 'other';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'waived';
export type BadgeType = 'trip' | 'role' | 'achievement';
export type TagType = 'trip' | 'year' | 'location' | 'person';
export type MediaType = 'image' | 'video';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  surname: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  phone: string | null;
  phone_country_code: string | null;
  emergency_contact: string | null;
  emergency_contact_number: string | null;
  password_changed: boolean | null;
  date_of_birth: string | null;
  address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postcode: string | null;
  address_country: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  shirt_size: string | null;
  shorts_size: string | null;
  nickname: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface Trip {
  id: string;
  slug: string;
  name: string;
  destination: string;
  country: string;
  /** ISO 3166-1 alpha-3 country code, e.g. 'MAR'. Used for map country highlighting. */
  country_code?: string | null;
  /** Decimal latitude for the trip's map pin (e.g. 31.7917 for Morocco). */
  latitude?: number | null;
  /** Decimal longitude for the trip's map pin (e.g. -7.0926 for Morocco). */
  longitude?: number | null;
  /** Controls whether this trip is eligible for the trip-page countdown timer. */
  countdown_enabled?: boolean | null;
  /** Optional countdown target timestamp. Falls back to `start_date` when null. */
  countdown_target_at?: string | null;
  start_date: string;
  end_date: string;
  description: string | null;
  itinerary: string | null;
  cover_image_url: string | null;
  status: TripStatus;
  max_members: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  trip_role: TripRole;
  joined_at: string | null;
}

export interface TripUpdate {
  id: string;
  trip_id: string;
  title: string;
  content: string;
  author_id: string | null;
  published_at: string | null;
  created_at: string | null;
}

export interface NewsPost {
  id: string;
  title: string;
  content: string;
  author_id: string | null;
  is_published: boolean;
  is_archived: boolean;
  archived_at: string | null;
  is_global: boolean;
  tag_all_members: boolean;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface NewsPostTripTag {
  news_post_id: string;
  trip_id: string;
  created_at: string | null;
}

export interface NewsPostMemberTag {
  news_post_id: string;
  member_id: string;
  created_at: string | null;
}

export interface NewsAsset {
  id: string;
  name: string;
  file_url: string;
  storage_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string | null;
}

export interface TripKeyDate {
  id: string;
  trip_id: string;
  title: string;
  date: string;
  description: string | null;
  type: KeyDateType;
}

export interface TripDocument {
  id: string;
  trip_id: string;
  user_id: string | null;
  name: string;
  file_url: string;
  file_type: string;
  is_admin_upload: boolean;
  uploaded_by: string;
  created_at: string;
}

export interface Payment {
  id: string;
  trip_id: string;
  user_id: string;
  description: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: PaymentStatus;
  notes: string | null;
  created_at: string;
}

export interface Award {
  id: string;
  trip_id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  is_active: boolean;
}

export interface Vote {
  id: string;
  award_id: string;
  voter_id: string;
  nominee_id: string;
  created_at: string;
}

export interface Gallery {
  id: string;
  trip_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Photo {
  id: string;
  trip_id: string;
  gallery_id: string | null;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  media_type: MediaType;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface PhotoTag {
  id: string;
  photo_id: string;
  tag_type: TagType;
  tag_value: string;
}

export interface PhotoLike {
  id: string;
  photo_id: string;
  user_id: string;
  created_at: string;
}

export interface PhotoComment {
  id: string;
  photo_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  trip_id: string | null;
  badge_type: BadgeType;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  trip_id: string;
  awarded_at: string;
  awarded_by: string | null;
}

// ── Budget Tool ───────────────────────────────────────────────────────────────

export interface TripBudgetSettings {
  id: string;
  trip_id: string;
  total_budget_aud: number;
  show_group_budget_to_members: boolean;
  show_individual_breakdown_to_members: boolean;
  exchange_rate_mad_aud: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripBudgetCategory {
  id: string;
  trip_id: string;
  name: string;
  planned_aud: number;
  color: string;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseCurrency = 'AUD' | 'MAD' | 'USD' | 'EUR';
export type ExpenseSource = 'manual' | 'import';
export type ExpensePaidByType = 'group_kitty' | 'member' | 'external';

export interface TripExpense {
  id: string;
  trip_id: string;
  category_id: string | null;
  description: string;
  amount: number;
  currency: ExpenseCurrency;
  amount_aud: number;
  amount_aud_overridden: boolean;
  exchange_rate: number;
  expense_date: string;
  paid_by: string | null;
  paid_by_type: ExpensePaidByType;
  paid_by_label: string | null;
  source: ExpenseSource;
  reconciled: boolean;
  reconciled_at: string | null;
  reconcile_notes: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripIncomeEntry {
  id: string;
  trip_id: string;
  description: string;
  amount_aud: number;
  income_date: string;
  source: ExpenseSource;
  reconciled: boolean;
  reconciled_at: string | null;
  reconcile_notes: string | null;
  category: string | null;
  member_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface SiteSettings {
  id: string;
  logo_url: string;
  background_image_url: string;
  background_media_type: MediaType;
  background_video_url: string | null;
  background_position_x: number;
  background_position_y: number;
  background_zoom: number;
  background_opacity: number;
  updated_by: string;
  updated_at: string;
}

export type ActivityAction = 
  | 'create' | 'update' | 'delete' | 'view' 
  | 'upload' | 'download' | 'login' | 'logout'
  | 'vote' | 'comment' | 'like' | 'bulkupload'
  | 'interact';

export interface ActivityLog {
  id: string;
  user_id: string;
  action: ActivityAction;
  entity_type: string; // 'trip', 'payment', 'award', 'member', etc
  entity_id: string;
  entity_name: string | null;
  changes: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  slug: string; // 'welcome', 'payment_reminder', 'trip_update', etc
  subject: string;
  body: string;
  variables: string[]; // ['name', 'tripName', 'amount', etc]
  is_default: boolean;
  updated_by: string;
  updated_at: string;
}

export type NotificationChannel = 'email' | 'in_app' | 'both';

export interface NotificationPreference {
  id: string;
  user_id: string;
  trip_updates: NotificationChannel;
  payment_reminders: NotificationChannel;
  award_voting: NotificationChannel;
  new_gallery_photos: NotificationChannel;
  new_comments: NotificationChannel;
  system_announcements: NotificationChannel;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'trip_update' | 'payment' | 'award' | 'gallery' | 'comment' | 'system';
  link: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface Database {
  // Required by @supabase/supabase-js >=2.48 for correct type inference.
  // Without this, all table .insert()/.update() argument types resolve to `never`.
  __InternalSupabase: {
    PostgrestVersion: '14.4';
  };
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at' | 'id' | 'user_id'> &
          Partial<Pick<Profile, 'id' | 'user_id'>>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      trips: {
        Row: Trip;
        Insert: Omit<Trip, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Trip, 'id' | 'created_at' | 'created_by'>>;
      };
      trip_members: {
        Row: TripMember;
        Insert: Omit<TripMember, 'id' | 'joined_at'>;
        Update: Partial<Omit<TripMember, 'id' | 'joined_at'>>;
      };
      trip_updates: {
        Row: TripUpdate;
        Insert: Omit<TripUpdate, 'id' | 'created_at'>;
        Update: Partial<Omit<TripUpdate, 'id' | 'created_at'>>;
      };
      news_posts: {
        Row: NewsPost;
        Insert: Omit<NewsPost, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<NewsPost, 'id' | 'created_at'>>;
      };
      news_post_trips: {
        Row: NewsPostTripTag;
        Insert: Omit<NewsPostTripTag, 'created_at'>;
        Update: Partial<Omit<NewsPostTripTag, 'created_at'>>;
      };
      news_post_members: {
        Row: NewsPostMemberTag;
        Insert: Omit<NewsPostMemberTag, 'created_at'>;
        Update: Partial<Omit<NewsPostMemberTag, 'created_at'>>;
      };
      news_assets: {
        Row: NewsAsset;
        Insert: Omit<NewsAsset, 'id' | 'created_at'>;
        Update: Partial<Omit<NewsAsset, 'id' | 'created_at'>>;
      };
      trip_key_dates: {
        Row: TripKeyDate;
        Insert: Omit<TripKeyDate, 'id'>;
        Update: Partial<Omit<TripKeyDate, 'id'>>;
      };
      trip_documents: {
        Row: TripDocument;
        Insert: Omit<TripDocument, 'id' | 'created_at'>;
        Update: Partial<Omit<TripDocument, 'id' | 'created_at'>>;
      };
      galleries: {
        Row: Gallery;
        Insert: Omit<Gallery, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Gallery, 'id' | 'created_at' | 'created_by'>>;
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, 'id' | 'created_at'>;
        Update: Partial<Omit<Payment, 'id' | 'created_at'>>;
      };
      awards: {
        Row: Award;
        Insert: Omit<Award, 'id'>;
        Update: Partial<Omit<Award, 'id'>>;
      };
      site_settings: {
        Row: SiteSettings;
        Insert: Omit<SiteSettings, 'id' | 'updated_at'>;
        Update: Partial<Omit<SiteSettings, 'id'>>;
      };
      votes: {
        Row: Vote;
        Insert: Omit<Vote, 'id' | 'created_at'>;
        Update: Partial<Omit<Vote, 'id' | 'created_at'>>;
      };
      photos: {
        Row: Photo;
        Insert: Omit<Photo, 'id' | 'created_at'>;
        Update: Partial<Omit<Photo, 'id' | 'created_at'>>;
      };
      photo_tags: {
        Row: PhotoTag;
        Insert: Omit<PhotoTag, 'id'>;
        Update: Partial<Omit<PhotoTag, 'id'>>;
      };
      photo_likes: {
        Row: PhotoLike;
        Insert: Omit<PhotoLike, 'id' | 'created_at'>;
        Update: Partial<Omit<PhotoLike, 'id' | 'created_at'>>;
      };
      photo_comments: {
        Row: PhotoComment;
        Insert: Omit<PhotoComment, 'id' | 'created_at'>;
        Update: Partial<Omit<PhotoComment, 'id' | 'created_at'>>;
      };
      badges: {
        Row: Badge;
        Insert: Omit<Badge, 'id'>;
        Update: Partial<Omit<Badge, 'id'>>;
      };
      user_badges: {
        Row: UserBadge;
        Insert: Omit<UserBadge, 'id'>;
        Update: Partial<Omit<UserBadge, 'id'>>;
      };
      trip_budget_settings: {
        Row: TripBudgetSettings;
        Insert: Omit<TripBudgetSettings, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TripBudgetSettings, 'id' | 'created_at' | 'trip_id'>>;
      };
      trip_budget_categories: {
        Row: TripBudgetCategory;
        Insert: Omit<TripBudgetCategory, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TripBudgetCategory, 'id' | 'created_at' | 'trip_id'>>;
      };
      trip_expenses: {
        Row: TripExpense;
        Insert: Omit<TripExpense, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TripExpense, 'id' | 'created_at' | 'trip_id'>>;
      };
      trip_income_entries: {
        Row: TripIncomeEntry;
        Insert: Omit<TripIncomeEntry, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TripIncomeEntry, 'id' | 'created_at' | 'trip_id'>>;
      };
      activity_logs: {
        Row: ActivityLog;
        Insert: Omit<ActivityLog, 'id' | 'created_at'>;
        Update: never;
      };
      email_templates: {
        Row: EmailTemplate;
        Insert: Omit<EmailTemplate, 'id' | 'updated_at'>;
        Update: Partial<Omit<EmailTemplate, 'id'>>;
      };
      notification_preferences: {
        Row: NotificationPreference;
        Insert: Omit<NotificationPreference, 'id'>;
        Update: Partial<Omit<NotificationPreference, 'id' | 'user_id'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at' | 'read_at' | 'is_read'>;
        Update: Partial<Omit<Notification, 'id' | 'created_at' | 'user_id'>>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}
