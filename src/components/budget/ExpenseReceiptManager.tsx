'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Paperclip, Upload, X, FileText, Loader2 } from 'lucide-react';

interface Receipt {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  access_url?: string;
  created_at: string;
}

interface Props {
  tripId: string;
  expenseId: string;
  onChange?: (receipts: Receipt[]) => void;
}

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_BYTES = 25 * 1024 * 1024;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isImage(fileType: string) {
  return fileType.toLowerCase().startsWith('image/');
}

export default function ExpenseReceiptManager({ tripId, expenseId, onChange }: Props) {
  const supabase = createClient();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');
    return session.access_token;
  }, [supabase]);

  const fetchReceipts = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      const res = await fetch(`/api/trips/${tripId}/budget/expenses/${expenseId}/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to load receipts');
      const list = payload.data?.receipts || [];
      setReceipts(list);
      onChange?.(list);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load receipts'));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, expenseId, getToken]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleUpload = async (file: File) => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only images and PDFs can be attached as receipts');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File is too large (max 25MB)');
      return;
    }

    setIsUploading(true);
    try {
      const token = await getToken();

      const signRes = await fetch(`/api/trips/${tripId}/budget/expenses/${expenseId}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create_signed_upload',
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        }),
      });
      const signPayload = await signRes.json().catch(() => ({}));
      if (!signRes.ok || !signPayload.success) throw new Error(signPayload.error || 'Failed to prepare upload');

      const { bucket, storage_path: storagePath, token: uploadToken, file_type: resolvedFileType } = signPayload.data;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(storagePath, uploadToken, file, { contentType: resolvedFileType, upsert: false });
      if (uploadError) throw new Error(uploadError.message || 'Failed to upload file');

      const registerRes = await fetch(`/api/trips/${tripId}/budget/expenses/${expenseId}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'register_upload',
          file_name: file.name,
          file_type: resolvedFileType,
          file_size: file.size,
          bucket,
          storage_path: storagePath,
        }),
      });
      const registerPayload = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok || !registerPayload.success) throw new Error(registerPayload.error || 'Failed to save receipt');

      await fetchReceipts();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to upload receipt'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (receiptId: string) => {
    if (!confirm('Remove this receipt?')) return;
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/trips/${tripId}/budget/expenses/${expenseId}/receipts/${receiptId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to delete receipt');
      await fetchReceipts();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete receipt'));
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-brand-cream/60 mb-2 flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5" /> Receipts
      </label>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-brand-cream/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading receipts…
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {receipts.length === 0 && <p className="text-xs text-brand-cream/40">No receipts attached yet</p>}
          {receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="flex items-center gap-3 px-3 py-2 bg-brand-black border border-brand-tan/20 rounded-lg"
            >
              {isImage(receipt.file_type) ? (
                <a href={receipt.access_url || receipt.file_url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receipt.access_url || receipt.file_url}
                    alt={receipt.file_name}
                    className="w-10 h-10 rounded object-cover border border-brand-tan/20"
                  />
                </a>
              ) : (
                <FileText className="w-5 h-5 text-brand-tan shrink-0" />
              )}
              <a
                href={receipt.access_url || receipt.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-sm text-brand-cream truncate hover:underline"
              >
                {receipt.file_name}
              </a>
              <button
                type="button"
                onClick={() => handleDelete(receipt.id)}
                className="p-1 hover:bg-brand-tan/10 rounded text-brand-cream/50 hover:text-red-400 transition-colors"
                title="Remove receipt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-dashed border-brand-tan/40 rounded-lg text-brand-cream/70 hover:border-brand-tan/70 hover:text-brand-cream cursor-pointer transition-colors">
        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {isUploading ? 'Uploading…' : 'Add receipt (photo or PDF)'}
        <input
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          className="hidden"
          disabled={isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) handleUpload(file);
          }}
        />
      </label>
    </div>
  );
}
