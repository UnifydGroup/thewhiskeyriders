export interface NewsAuthorSummary {
  id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

export interface NewsTripTagSummary {
  id: string;
  name: string;
  slug: string;
}

export interface NewsMemberTagSummary {
  id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  author_id: string | null;
  is_published: boolean;
  is_archived: boolean;
  archived_at: string | null;
  is_global: boolean;
  tag_all_members: boolean;
  send_email_notification: boolean;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  author: NewsAuthorSummary | null;
  trip_tags: NewsTripTagSummary[];
  member_tags: NewsMemberTagSummary[];
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
