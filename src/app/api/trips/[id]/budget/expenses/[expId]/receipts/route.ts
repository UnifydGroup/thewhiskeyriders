import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, getJsonBody, supabase } from '@/lib/api/helpers';
import {
  RECEIPT_STORAGE_BUCKETS,
  MAX_RECEIPT_UPLOAD_BYTES,
  MAX_RECEIPT_UPLOAD_LIMIT,
  createSignedReceiptUpload,
  extractStorageReference,
  isValidReceiptStoragePath,
  resolveReceiptAccessUrl,
  resolveReceiptMimeType,
} from '@/lib/api/receiptStorage';

type Params = { params: Promise<{ id: string; expId: string }> };

function parseFileSize(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
}

async function assertExpenseExists(tripId: string, expenseId: string) {
  const { data, error } = await supabase
    .from('trip_expenses')
    .select('id')
    .eq('id', expenseId)
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

// GET /api/trips/[id]/budget/expenses/[expId]/receipts
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId, expId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { data, error } = await supabase
      .from('trip_expense_receipts')
      .select('*')
      .eq('expense_id', expId)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const receipts = await Promise.all(
      (data ?? []).map(async (receipt) => ({
        ...receipt,
        access_url: await resolveReceiptAccessUrl(receipt.file_url),
      }))
    );

    return successResponse({ receipts });
  } catch (err) {
    console.error('GET expense receipts error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

// POST /api/trips/[id]/budget/expenses/[expId]/receipts
// Body actions: create_signed_upload | register_upload
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId, expId } = await params;
    const { authenticated, authorized, user } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    if (!(await assertExpenseExists(tripId, expId))) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Expense not found');
    }

    const body = await getJsonBody(request);
    const action = typeof body.action === 'string' ? body.action.trim() : '';

    if (action === 'create_signed_upload') {
      const fileName = typeof body.file_name === 'string' ? body.file_name.trim() : '';
      const requestedFileType = typeof body.file_type === 'string' ? body.file_type : '';
      const requestedFileSize = parseFileSize(body.file_size);

      if (!fileName) return errorResponse(ApiErrors.BAD_REQUEST, 'file_name is required');
      if (!Number.isFinite(requestedFileSize) || requestedFileSize <= 0) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'file_size must be a positive number');
      }
      if (requestedFileSize > MAX_RECEIPT_UPLOAD_BYTES) {
        return errorResponse(ApiErrors.BAD_REQUEST, `file is too large (max ${MAX_RECEIPT_UPLOAD_LIMIT})`);
      }

      const resolvedFileType = resolveReceiptMimeType(fileName, requestedFileType);
      if (!resolvedFileType) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'Unsupported file type — only images and PDFs are allowed');
      }

      const signedUpload = await createSignedReceiptUpload(tripId, expId, fileName);
      return successResponse({
        bucket: signedUpload.bucket,
        storage_path: signedUpload.storagePath,
        token: signedUpload.token,
        signed_url: signedUpload.signedUrl,
        file_url: signedUpload.publicUrl,
        file_type: resolvedFileType,
        file_size: requestedFileSize,
      });
    }

    if (action === 'register_upload') {
      const fileName = typeof body.file_name === 'string' ? body.file_name.trim() : '';
      const requestedFileType = typeof body.file_type === 'string' ? body.file_type : '';
      const requestedFileSize = parseFileSize(body.file_size);

      let bucket = typeof body.bucket === 'string' ? body.bucket.trim() : '';
      let storagePath = typeof body.storage_path === 'string' ? body.storage_path.trim().replace(/^\/+/, '') : '';
      const providedFileUrl = String(body.file_url || '').trim();

      if ((!bucket || !storagePath) && providedFileUrl) {
        const reference = extractStorageReference(providedFileUrl);
        if (reference) {
          bucket = bucket || reference.bucket;
          storagePath = storagePath || reference.path;
        }
      }

      if (!fileName) return errorResponse(ApiErrors.BAD_REQUEST, 'file_name is required');
      if (!bucket || !storagePath) return errorResponse(ApiErrors.BAD_REQUEST, 'bucket and storage_path are required');
      if (!RECEIPT_STORAGE_BUCKETS.includes(bucket)) return errorResponse(ApiErrors.BAD_REQUEST, 'invalid bucket');
      if (!isValidReceiptStoragePath(storagePath, tripId, expId)) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'invalid storage_path');
      }
      if (!Number.isFinite(requestedFileSize) || requestedFileSize <= 0) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'file_size must be a positive number');
      }
      if (requestedFileSize > MAX_RECEIPT_UPLOAD_BYTES) {
        return errorResponse(ApiErrors.BAD_REQUEST, `file is too large (max ${MAX_RECEIPT_UPLOAD_LIMIT})`);
      }

      const resolvedFileType = resolveReceiptMimeType(fileName, requestedFileType);
      if (!resolvedFileType) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'Unsupported file type — only images and PDFs are allowed');
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      const fileUrl = providedFileUrl || publicUrl;

      const { data: receipt, error } = await supabase
        .from('trip_expense_receipts')
        .insert({
          expense_id: expId,
          trip_id: tripId,
          file_url: fileUrl,
          file_name: fileName,
          file_type: resolvedFileType,
          file_size: requestedFileSize,
          uploaded_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;

      return successResponse(
        { receipt: { ...receipt, access_url: await resolveReceiptAccessUrl(receipt.file_url) } },
        201
      );
    }

    return errorResponse(ApiErrors.BAD_REQUEST, 'Unsupported action');
  } catch (err) {
    console.error('POST expense receipts error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
