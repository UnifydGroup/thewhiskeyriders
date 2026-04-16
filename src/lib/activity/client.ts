import type { ActivityAction } from '@/lib/types/database';

export interface ClientActivityPayload {
  action: ActivityAction;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  changes?: Record<string, unknown> | null;
  accessToken?: string;
}

export async function trackClientActivity(payload: ClientActivityPayload): Promise<void> {
  const { accessToken, ...activity } = payload;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    await fetch('/api/activity-logs', {
      method: 'POST',
      headers,
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify(activity),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Activity tracking failed:', error);
    }
  }
}
