import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseDatabase } from '@/lib/types/database.generated';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://placeholder.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || 'placeholder-anon-key';
  return createBrowserClient<SupabaseDatabase>(url, key);
}
