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
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  author: NewsAuthorSummary | null;
  trip_tags: NewsTripTagSummary[];
  member_tags: NewsMemberTagSummary[];
}
