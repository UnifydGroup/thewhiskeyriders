import { supabase } from '@/lib/api/helpers';
import type { NewsAuthorSummary, NewsItem, NewsMemberTagSummary, NewsTripTagSummary } from '@/lib/news/types';

export const NEWS_POST_SELECT = `
  id,
  title,
  content,
  author_id,
  is_published,
  is_archived,
  archived_at,
  is_global,
  tag_all_members,
  published_at,
  created_at,
  updated_at,
  author:author_id (
    id,
    full_name,
    nickname,
    avatar_url
  )
`;

export type RawNewsPostRow = {
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
  author?: NewsAuthorSummary | NewsAuthorSummary[] | null;
};

type RawNewsTripTagRow = {
  news_post_id: string;
  trips?: NewsTripTagSummary | NewsTripTagSummary[] | null;
};

type RawNewsMemberTagRow = {
  news_post_id: string;
  profiles?: NewsMemberTagSummary | NewsMemberTagSummary[] | null;
};

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export function normalizeIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    ids.add(trimmed);
  }

  return Array.from(ids);
}

export async function resolveTaggedNewsIds(
  tripId: string | null,
  memberId: string | null
): Promise<string[] | null> {
  let allowedIds: Set<string> | null = null;

  if (tripId) {
    const { data, error } = await supabase
      .from('news_post_trips')
      .select('news_post_id')
      .eq('trip_id', tripId);

    if (error) {
      throw new Error(error.message);
    }

    allowedIds = new Set((data || []).map((row) => row.news_post_id));
  }

  if (memberId) {
    const { data, error } = await supabase
      .from('news_post_members')
      .select('news_post_id')
      .eq('member_id', memberId);

    if (error) {
      throw new Error(error.message);
    }

    const memberIds = new Set((data || []).map((row) => row.news_post_id));
    if (!allowedIds) {
      allowedIds = memberIds;
    } else {
      allowedIds = new Set(Array.from(allowedIds).filter((id) => memberIds.has(id)));
    }
  }

  return allowedIds ? Array.from(allowedIds) : null;
}

export async function hydrateNewsItems(rows: RawNewsPostRow[]): Promise<NewsItem[]> {
  if (rows.length === 0) {
    return [];
  }

  const newsIds = rows.map((row) => row.id);

  const [tripTagsResult, memberTagsResult] = await Promise.all([
    supabase
      .from('news_post_trips')
      .select('news_post_id, trips:trip_id(id, name, slug)')
      .in('news_post_id', newsIds),
    supabase
      .from('news_post_members')
      .select('news_post_id, profiles:member_id(id, full_name, nickname, avatar_url)')
      .in('news_post_id', newsIds),
  ]);

  if (tripTagsResult.error) {
    throw new Error(tripTagsResult.error.message);
  }

  if (memberTagsResult.error) {
    throw new Error(memberTagsResult.error.message);
  }

  const tripTagsByPost = new Map<string, NewsTripTagSummary[]>();
  for (const row of (tripTagsResult.data || []) as RawNewsTripTagRow[]) {
    const trip = unwrapSingle(row.trips);
    if (!trip) continue;
    const existing = tripTagsByPost.get(row.news_post_id) || [];
    existing.push(trip);
    tripTagsByPost.set(row.news_post_id, existing);
  }

  const memberTagsByPost = new Map<string, NewsMemberTagSummary[]>();
  for (const row of (memberTagsResult.data || []) as RawNewsMemberTagRow[]) {
    const profile = unwrapSingle(row.profiles);
    if (!profile) continue;
    const existing = memberTagsByPost.get(row.news_post_id) || [];
    existing.push(profile);
    memberTagsByPost.set(row.news_post_id, existing);
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    author_id: row.author_id,
    is_published: row.is_published,
    is_archived: row.is_archived,
    archived_at: row.archived_at,
    is_global: row.is_global,
    tag_all_members: row.tag_all_members,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: unwrapSingle(row.author),
    trip_tags: tripTagsByPost.get(row.id) || [],
    member_tags: memberTagsByPost.get(row.id) || [],
  }));
}
