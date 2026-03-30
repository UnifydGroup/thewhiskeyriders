export type UserRole = 'super_admin' | 'admin' | 'trip_admin' | 'member';
export type TripStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type TripRole = 'captain' | 'kitty_man' | 'organiser' | 'member';
export type KeyDateType = 'departure' | 'arrival' | 'payment_due' | 'deadline' | 'event' | 'other';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'waived';
export type BadgeType = 'trip' | 'role' | 'achievement';
export type TagType = 'trip' | 'year' | 'location' | 'person';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  phone: string | null;
  emergency_contact: string | null;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  slug: string;
  name: string;
  destination: string;
  country: string;
  start_date: string;
  end_date: string;
  description: string | null;
  cover_image_url: string | null;
  status: TripStatus;
  max_members: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  trip_role: TripRole;
  joined_at: string;
}

export interface TripUpdate {
  id: string;
  trip_id: string;
  title: string;
  content: string;
  author_id: string;
  published_at: string;
  created_at: string;
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

export interface Photo {
  id: string;
  trip_id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
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
  awarded_at: string;
  awarded_by: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
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
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}
