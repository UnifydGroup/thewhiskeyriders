import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  ApiErrors,
  errorResponse,
  getIpAddress,
  logActivity,
  successResponse,
  supabase,
  verifyRole,
} from '@/lib/api/helpers';
import type { SupabaseDatabase } from '@/lib/types/database.generated';

const NEWS_ASSETS_BUCKET = 'news-assets';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createSupabaseClient<SupabaseDatabase>(supabaseUrl, serviceRoleKey);
}

// DELETE /api/news/assets/[id] - Delete an uploaded news asset
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const assetId = params.id;

    const { authenticated, authorized, user } = await verifyRole(request, [
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated || !user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const { data: asset, error: assetError } = await supabase
      .from('news_assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (assetError || !asset) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Asset not found');
    }

    const serviceClient = getServiceClient();

    if (asset.storage_path) {
      const { error: removeError } = await serviceClient.storage
        .from(NEWS_ASSETS_BUCKET)
        .remove([asset.storage_path]);

      if (removeError) {
        return errorResponse(ApiErrors.INTERNAL_ERROR, removeError.message);
      }
    }

    const { error: deleteError } = await supabase
      .from('news_assets')
      .delete()
      .eq('id', assetId);

    if (deleteError) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, deleteError.message);
    }

    await logActivity(
      user.id,
      'delete',
      'news_asset',
      asset.id,
      asset.name,
      null,
      getIpAddress(request)
    );

    return successResponse({ id: assetId });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}
