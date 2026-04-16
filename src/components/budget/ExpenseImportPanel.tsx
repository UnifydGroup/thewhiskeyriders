'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet, Loader2, FileCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  currency?: string;
  amount_aud?: number;
  exchange_rate?: number;
  category?: string;
  paid_by?: string;
  notes?: string;
}

interface PreviewRow extends ParsedRow {
  index: number;
  status: 'valid' | 'invalid';
  issues: string[];
  amount_aud: number;
  currency: string;
  exchange_rate: number;
}

interface Props {
  tripId: string;
  defaultExchangeRate: number;
  onClose: () => void;
  onImportComplete: () => void;
}

function fmtAud(n: number) {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseDate(raw: unknown): string {
  if (raw instanceof Date) {
    return raw.toISOString().split('T')[0];
  }
  const s = String(raw ?? '').trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

export default function ExpenseImportPanel({ tripId, defaultExchangeRate, onClose, onImportComplete }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'upload' | 'preview' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<{ valid: number; invalid: number; total_aud: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inserted, setInserted] = useState(0);

  const getAuthHeader = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setError(null);
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Detect header row
      const headerIdx = raw.findIndex((row) =>
        row.some((cell) => /date|amount|description|expense/i.test(String(cell)))
      );
      const dataRows = raw.slice(headerIdx + 1).filter((r) => r.some((c) => c !== ''));
      const headers: string[] = (raw[headerIdx] ?? []).map((h: any) => String(h).toLowerCase().trim());

      const col = (name: string) => {
        const aliases: Record<string, string[]> = {
          date: ['date', 'expense date', 'payment date', 'transaction date'],
          description: ['description', 'desc', 'details', 'memo', 'narration', 'name'],
          amount: ['amount', 'cost', 'total', 'value', 'debit'],
          currency: ['currency', 'ccy'],
          amount_aud: ['amount aud', 'aud amount', 'aud'],
          exchange_rate: ['rate', 'exchange rate', 'fx rate'],
          category: ['category', 'cat', 'type'],
          paid_by: ['paid by', 'payer', 'paid_by'],
          notes: ['notes', 'note', 'comments', 'remarks'],
        };
        for (const alias of aliases[name] ?? []) {
          const idx = headers.indexOf(alias);
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const parsed: ParsedRow[] = dataRows.map((row) => {
        const get = (name: string) => {
          const idx = col(name);
          return idx >= 0 ? row[idx] : undefined;
        };
        const amountRaw = parseFloat(String(get('amount') ?? '').replace(/[^0-9.\-]/g, ''));
        const currency = String(get('currency') ?? 'AUD').toUpperCase() || 'AUD';
        const exchangeRate = parseFloat(String(get('exchange_rate') ?? '')) || (currency === 'MAD' ? defaultExchangeRate : 1);
        const amountAudRaw = get('amount_aud');
        const amount_aud = amountAudRaw != null && !isNaN(parseFloat(String(amountAudRaw)))
          ? parseFloat(String(amountAudRaw))
          : (currency === 'AUD' ? amountRaw : amountRaw * exchangeRate);

        return {
          date: parseDate(get('date')),
          description: String(get('description') ?? '').trim(),
          amount: amountRaw,
          currency,
          exchange_rate: exchangeRate,
          amount_aud,
          category: String(get('category') ?? '').trim() || undefined,
          paid_by: String(get('paid_by') ?? '').trim() || undefined,
          notes: String(get('notes') ?? '').trim() || undefined,
        };
      }).filter((r) => r.description || r.amount);

      // Send to API for preview
      const headers_auth = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/trips/${tripId}/budget/import`, {
        method: 'PUT',
        headers: headers_auth,
        body: JSON.stringify({ rows: parsed }),
      });
      if (!res.ok) throw new Error('Preview failed');
      const json = await res.json();
      setPreview(json.preview ?? []);
      setSummary(json.summary ?? null);
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    const validRows = preview.filter((r) => r.status === 'valid');
    if (!validRows.length) return;
    setLoading(true);
    try {
      const headers = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/trips/${tripId}/budget/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rows: validRows }),
      });
      if (!res.ok) throw new Error('Import failed');
      const json = await res.json();
      setInserted(json.inserted ?? 0);
      setStage('done');
      onImportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-brand-dark-grey border border-brand-tan/30 rounded-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-brand-cream flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-brand-tan" />
          Import Expenses from Excel / CSV
        </h3>
        <button onClick={onClose} className="text-brand-cream/50 hover:text-brand-cream">
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-red-900/20 border border-red-600/40 rounded-lg text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Upload stage */}
      {stage === 'upload' && (
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-brand-tan/30 hover:border-brand-tan/60 rounded-lg p-10 text-center cursor-pointer transition-colors group"
          >
            <Upload className="w-8 h-8 text-brand-tan/50 group-hover:text-brand-tan mx-auto mb-3 transition-colors" />
            <p className="text-brand-cream font-medium mb-1">Drop your file here or click to browse</p>
            <p className="text-sm text-brand-cream/40">.xlsx, .xls, or .csv — auto-detects columns</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
          <div className="mt-4 p-3 bg-brand-black/50 rounded-lg text-xs text-brand-cream/50">
            <p className="font-medium text-brand-cream/70 mb-1">Expected columns (any order, auto-mapped):</p>
            <p>Date · Description · Amount · Currency (optional) · AUD Amount (optional) · Exchange Rate (optional) · Category · Paid By · Notes</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-3 text-brand-cream/60">
          <Loader2 className="w-5 h-5 animate-spin" />
          Processing…
        </div>
      )}

      {/* Preview stage */}
      {stage === 'preview' && !loading && (
        <div className="space-y-4">
          {summary && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-400">{summary.valid}</p>
                <p className="text-xs text-green-400/70">Valid rows</p>
              </div>
              <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-red-400">{summary.invalid}</p>
                <p className="text-xs text-red-400/70">Invalid rows</p>
              </div>
              <div className="bg-brand-black/50 border border-brand-tan/20 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-brand-tan">{fmtAud(summary.total_aud)}</p>
                <p className="text-xs text-brand-cream/50">Total AUD</p>
              </div>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto rounded-lg border border-brand-tan/20">
            <table className="w-full text-sm">
              <thead className="bg-brand-black sticky top-0">
                <tr>
                  {['Date', 'Description', 'Amount', 'AUD', 'Category', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs text-brand-cream/50 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-tan/10">
                {preview.map((row) => (
                  <tr key={row.index} className={row.status === 'invalid' ? 'bg-red-900/10' : 'hover:bg-brand-tan/5'}>
                    <td className="px-3 py-2 text-brand-cream/70">{row.date}</td>
                    <td className="px-3 py-2 text-brand-cream max-w-[200px] truncate">{row.description}</td>
                    <td className="px-3 py-2 text-brand-cream/70">{row.amount} {row.currency}</td>
                    <td className="px-3 py-2 font-semibold text-brand-tan">{fmtAud(row.amount_aud)}</td>
                    <td className="px-3 py-2 text-brand-cream/50">{row.category || '—'}</td>
                    <td className="px-3 py-2">
                      {row.status === 'valid'
                        ? <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> OK</span>
                        : <span className="text-red-400 text-xs">{row.issues.join(', ')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button onClick={() => { setStage('upload'); setPreview([]); }} className="text-sm text-brand-cream/50 hover:text-brand-cream">
              ← Choose different file
            </button>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={!summary?.valid}
                className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-40 flex items-center gap-2"
              >
                <FileCheck className="w-4 h-4" />
                Import {summary?.valid} rows
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Done stage */}
      {stage === 'done' && (
        <div className="text-center py-6">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-lg font-semibold text-brand-cream mb-1">{inserted} expenses imported</p>
          <p className="text-sm text-brand-cream/50 mb-4">All imported rows are marked as reconciled</p>
          <button onClick={onClose} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90">
            Done
          </button>
        </div>
      )}
    </div>
  );
}
