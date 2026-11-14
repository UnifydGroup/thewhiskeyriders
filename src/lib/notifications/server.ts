import { supabase } from '@/lib/api/helpers';
import { resolveRecipientIds } from '@/lib/news/email';
import type { NewsItem } from '@/lib/news/types';
import { isCategoryEnabled } from '@/lib/notifications/types';

/**
 * Create in-app notifications for a newly published news post.
 * Badges, tags, comments, likes and trip events are handled by database triggers;
 * news is done here because its audience depends on tags saved after the post.
 */
export async function notifyNewsPublished(newsItem: NewsItem, authorId?: string | null) {
  const recipientIds = (await resolveRecipientIds(newsItem)).filter((id) => id !== authorId);
  if (recipientIds.length === 0) return 0;

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, status, notification_preferences')
    .in('id', recipientIds);

  if (error) throw new Error(error.message);

  // Skip anyone already notified about this post (e.g. unpublished then republished).
  const { data: existing } = await supabase
    .from('notifications')
    .select('user_id')
    .eq('type', 'news')
    .contains('metadata', { news_post_id: newsItem.id });
  const alreadyNotified = new Set((existing || []).map((row) => row.user_id));

  const taggedMemberIds = new Set(newsItem.member_tags.map((member) => member.id));
  const rows = (profiles || [])
    .filter((profile) => profile.status === 'active')
    .filter((profile) => isCategoryEnabled(profile.notification_preferences, 'news'))
    .filter((profile) => !alreadyNotified.has(profile.id))
    .map((profile) => ({
      user_id: profile.id,
      type: 'news',
      title: taggedMemberIds.has(profile.id) ? 'You were mentioned in the news' : 'New post: ' + newsItem.title,
      message: taggedMemberIds.has(profile.id) ? newsItem.title : 'Tap to read the latest from the crew.',
      link: `/news/${newsItem.id}`,
      metadata: { category: 'news', news_post_id: newsItem.id, actor_id: authorId ?? null },
    }));

  if (rows.length === 0) return 0;

  const { error: insertError } = await supabase.from('notifications').insert(rows);
  if (insertError) throw new Error(insertError.message);
  return rows.length;
}
