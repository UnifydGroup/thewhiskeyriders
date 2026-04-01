'use client';

import { useRef, useState } from 'react';
import {
  Upload, X, CheckCircle2, AlertCircle, Info,
  FileSpreadsheet, Loader2, Download, Fingerprint, User, FileCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  user_id?: string;
  name?: string;
  date: string;
  amount: string | number;
  payment_method?: string;
  notes?: string;
}

interface PreviewRow extends ParsedRow {
  index: number;
  status: 'matched' | 'unmatched' | 'kitty' | 'skipped';
  member_id: string | null;
  matched_name: string | null;
  match_method: 'member_id' | 'uuid' | 'name' | null;
}

interface ImportSummary { matched: number; unmatched: number; kitty: number; }

interface PaymentImportPanelProps {
  tripId: string;
  onClose: () => void;
  onImportComplete: () => void;
}

// ─── Column indices (A=0 … F=5) ──────────────────────────────────────────────
const COL_USER_ID = 0;
const COL_NAME    = 1;
const COL_DATE    = 2;
const COL_AMOUNT  = 3;
const COL_METHOD  = 4;
const COL_NOTES   = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return raw;
  const s = String(raw ?? '').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function formatDateCell(raw: unknown): string {
  if (raw instanceof Date) {
    const d = String(raw.getDate()).padStart(2, '0');
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${raw.getFullYear()}`;
  }
  return String(raw ?? '').trim();
}

function fmtAmount(val: string | number): string {
  const n = parseFloat(String(val));
  return isNaN(n) ? '—' : `$${n.toFixed(2)}`;
}

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaymentImportPanel({
  tripId, onClose, onImportComplete,
}: PaymentImportPanelProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Steps: idle → file-ready → parsing → preview → importing → done
  type Step = 'idle' | 'file-ready' | 'parsing' | 'preview' | 'importing' | 'done';
  const [step, setStep]                   = useState<Step>('idle');
  const [selectedFile, setSelectedFile]   = useState<File | null>(null);
  const [parsedRows, setParsedRows]       = useState<ParsedRow[]>([]);
  const [previewRows, setPreviewRows]     = useState<PreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<ImportSummary | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [result, setResult]               = useState<{ inserted: number; unmatched: string[]; kitty_skipped: number } | null>(null);
  const [parsedSheetName, setParsedSheetName] = useState<string>('');

  // ── Download template ──────────────────────────────────────────────────────

  const handleDownloadTemplate = async () => {
    setTemplateLoading(true);
    setError(null);
    try {
      const { data: members, error: err } = await supabase
        .from('trip_members')
        .select('user_id, profiles!user_id(id, member_id, full_name, nickname)')
        .eq('trip_id', tripId);
      if (err) throw err;

      const headers = ['user_id', 'name', 'date', 'amount', 'payment_method', 'notes'];
      const dataRows = (members || []).map((m: any) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return [p?.member_id || m.user_id, p?.full_name || p?.nickname || '', '', '', 'bank_transfer', ''];
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      ws['!cols'] = [{ wch: 12 }, { wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
      XLSX.writeFile(wb, 'payment-template.xlsx');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate template');
    } finally {
      setTemplateLoading(false);
    }
  };

  // ── File selection (does NOT parse yet) ──────────────────────────────────

  const handleFileSelected = (file: File) => {
    setError(null);
    setSelectedFile(file);
    setStep('file-ready');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  // ── Parse + preview (triggered by user clicking "Upload & Preview") ────────

  const handleParseAndPreview = async () => {
    if (!selectedFile) return;
    setStep('parsing');
    setError(null);

    try {
      // Read file
      const buffer = await selectedFile.arrayBuffer();
      const data   = new Uint8Array(buffer);

      // Parse with raw: true + cellDates: true → proper JS types
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheetName =
        workbook.SheetNames.find((n) => n.toLowerCase().includes('transaction')) ||
        workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      setParsedSheetName(sheetName);

      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,          // get real JS types: numbers as numbers, Dates as Date
        cellDates: true,
        defval: null,
      }) as unknown[][];

      // Detect header row
      let dataStart = 0;
      for (let i = 0; i < Math.min(5, rawRows.length); i++) {
        const c0 = String(rawRows[i][COL_USER_ID] ?? '').toLowerCase().trim();
        const c1 = String(rawRows[i][COL_NAME]    ?? '').toLowerCase().trim();
        if (c0 === 'user_id' || c0 === 'id' || c1 === 'name' || c1 === 'full name' || c1 === 'who') {
          dataStart = i + 1;
          break;
        }
      }

      const rows: ParsedRow[] = [];
      for (let i = dataStart; i < rawRows.length; i++) {
        const row = rawRows[i];
        const colA = String(row[COL_USER_ID] ?? '').trim();
        const colB = String(row[COL_NAME]    ?? '').trim();
        const dateStr  = formatDateCell(row[COL_DATE]);
        const amount   = cleanAmount(row[COL_AMOUNT]);

        if (!colA && !colB && !dateStr && row[COL_AMOUNT] == null) continue;
        if (amount === null || amount === 0) continue;

        rows.push({
          user_id: colA || undefined,
          name:    colB || undefined,
          date:    dateStr,
          amount,
          payment_method: row[COL_METHOD] ? String(row[COL_METHOD]).trim() : undefined,
          notes:          row[COL_NOTES]  ? String(row[COL_NOTES]).trim()  : undefined,
        });
      }

      if (rows.length === 0) {
        setError('No valid rows found. Make sure the file has: user_id (col A), name (col B), date (col C), amount (col D).');
        setStep('file-ready');
        return;
      }

      setParsedRows(rows);

      // Send to preview API
      const res  = await fetch('/api/payments/import', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Preview failed');

      setPreviewRows(json.preview);
      setPreviewSummary(json.summary);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
      setStep('file-ready');
    }
  };

  // ── Confirm import ─────────────────────────────────────────────────────────

  const handleConfirmImport = async () => {
    setStep('importing');
    setError(null);
    try {
      const res  = await fetch('/api/payments/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId, rows: parsedRows, replace_existing: replaceExisting }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Import failed');
      setResult(json);
      setStep('done');
      onImportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  };

  const reset = () => {
    setStep('idle');
    setSelectedFile(null);
    setParsedRows([]);
    setPreviewRows([]);
    setPreviewSummary(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Progress bar ──────────────────────────────────────────────────────────

  const stepIndex: Record<Step, number> = {
    'idle': 0, 'file-ready': 1, 'parsing': 2, 'preview': 2, 'importing': 3, 'done': 3,
  };
  const steps = ['Select file', 'Preview', 'Import'];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-brand-tan" />
          <h3 className="text-lg font-semibold text-brand-cream">Import Payments from File</h3>
        </div>
        <button onClick={onClose} className="text-brand-cream/60 hover:text-brand-cream"><X className="w-5 h-5" /></button>
      </div>

      {/* Step progress */}
      {step !== 'idle' && (
        <div className="flex items-center gap-0 mb-6">
          {steps.map((label, i) => {
            const current = stepIndex[step];
            const done    = i < current;
            const active  = i === current;
            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${done   ? 'bg-brand-tan text-brand-black' :
                      active ? 'bg-brand-tan/20 border-2 border-brand-tan text-brand-tan' :
                               'bg-brand-black/40 border border-brand-tan/20 text-brand-cream/30'}`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-xs mt-1 whitespace-nowrap ${active ? 'text-brand-tan' : done ? 'text-brand-cream/60' : 'text-brand-cream/25'}`}>
                    {label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-px flex-1 mx-2 mb-4 ${i < current ? 'bg-brand-tan' : 'bg-brand-tan/15'}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-900/20 border border-red-600/50 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* ── STEP: idle — drop zone + format guide ── */}
      {step === 'idle' && (
        <div className="space-y-5">
          <div className="bg-brand-black/40 border border-brand-tan/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-brand-tan" />
              <p className="text-sm font-semibold text-brand-cream">Expected file format</p>
            </div>
            <p className="text-xs text-brand-cream/60 mb-3">
              Column A is the <strong className="text-brand-tan">WR member ID</strong> (e.g. WR000007) — your internal permanent identifier. Name (col B) is a human-readable backup.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-brand-tan/10">
                    {['Col','Header','Format','Example','Required?'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-brand-tan font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-brand-cream/70">
                  {[
                    ['A','user_id','WR000001…','WR000007','✓ Primary'],
                    ['B','name','Full name','Andreas Gloor','Backup'],
                    ['C','date','DD/MM/YYYY','15/07/2025','✓'],
                    ['D','amount','Number','500','✓'],
                    ['E','payment_method','Text','bank_transfer','Optional'],
                    ['F','notes','Text','Instalment 2','Optional'],
                  ].map(([col,header,fmt,ex,req]) => (
                    <tr key={col} className="border-b border-brand-tan/10 last:border-0">
                      <td className="px-3 py-2 font-semibold text-brand-tan/80">{col}</td>
                      <td className="px-3 py-2 font-mono">{header}</td>
                      <td className="px-3 py-2">{fmt}</td>
                      <td className="px-3 py-2 font-mono text-brand-cream/50">{ex}</td>
                      <td className={`px-3 py-2 ${req === '✓ Primary' ? 'text-green-400 font-semibold' : req === 'Backup' ? 'text-amber-400' : 'text-brand-cream/50'}`}>{req}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-brand-cream/40 mt-3">
              For Excel files with multiple sheets, the &ldquo;Transactions&rdquo; sheet is used automatically. Rows with &ldquo;Westpac Interest&rdquo; are treated as group kitty and skipped.
            </p>
          </div>

          <div className="flex items-center gap-3 p-4 bg-brand-tan/5 border border-brand-tan/20 rounded-lg">
            <Download className="w-5 h-5 text-brand-tan flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-brand-cream">Download pre-filled template</p>
              <p className="text-xs text-brand-cream/50 mt-0.5">All trip members&apos; WR IDs and names pre-filled — just add dates and amounts.</p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              disabled={templateLoading}
              className="flex items-center gap-2 px-4 py-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {templateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Get template
            </button>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-brand-tan/30 rounded-lg p-10 text-center cursor-pointer hover:border-brand-tan/60 hover:bg-brand-tan/5 transition-colors"
          >
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-8 h-8 text-brand-tan/60" />
              <p className="text-brand-cream font-semibold">Drop your file here</p>
              <p className="text-brand-cream/50 text-sm">or click to browse — .xlsx, .xls, .csv</p>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="hidden" />
        </div>
      )}

      {/* ── STEP: file-ready — show file info, prompt to upload ── */}
      {step === 'file-ready' && selectedFile && (
        <div className="space-y-5">
          <div className="flex items-center gap-4 p-4 bg-brand-tan/5 border border-brand-tan/30 rounded-lg">
            <FileCheck className="w-8 h-8 text-brand-tan flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-brand-cream font-semibold truncate">{selectedFile.name}</p>
              <p className="text-brand-cream/50 text-xs mt-0.5">{fmtFileSize(selectedFile.size)}</p>
            </div>
            <button onClick={reset} className="text-brand-cream/40 hover:text-brand-cream">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="replace-existing-ready"
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="w-4 h-4 rounded border-brand-tan/30 accent-brand-tan"
            />
            <label htmlFor="replace-existing-ready" className="text-sm text-brand-cream/80">
              Replace all existing payments for this trip
              <span className="ml-1 text-brand-cream/40">(uncheck to append only)</span>
            </label>
          </div>

          {replaceExisting && (
            <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-amber-300 text-xs">All existing payment records for this trip will be deleted before importing.</p>
            </div>
          )}

          <div className="flex gap-3 justify-between">
            <button onClick={reset} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream font-semibold hover:bg-brand-dark-grey/50 transition-colors text-sm">
              ← Choose different file
            </button>
            <button
              onClick={handleParseAndPreview}
              className="flex items-center gap-2 px-5 py-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black font-semibold rounded-lg transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              Upload &amp; Preview
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: parsing — spinner ── */}
      {step === 'parsing' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-10 h-10 text-brand-tan animate-spin" />
          <p className="text-brand-cream font-semibold">Reading file &amp; matching members…</p>
          <p className="text-brand-cream/50 text-sm">{selectedFile?.name}</p>
        </div>
      )}

      {/* ── STEP: preview ── */}
      {step === 'preview' && (
        <div className="space-y-5">
          <p className="text-xs text-brand-cream/40 font-mono truncate">
            {selectedFile?.name}{parsedSheetName ? `  →  ${parsedSheetName}` : ''}
          </p>

          {previewSummary && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-900/20 border border-green-600/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{previewSummary.matched}</p>
                <p className="text-xs text-green-400/70 mt-1">Will import</p>
              </div>
              <div className="bg-red-900/20 border border-red-600/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{previewSummary.unmatched}</p>
                <p className="text-xs text-red-400/70 mt-1">No match</p>
              </div>
              <div className="bg-blue-900/20 border border-blue-600/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{previewSummary.kitty}</p>
                <p className="text-xs text-blue-400/70 mt-1">Group kitty</p>
              </div>
            </div>
          )}

          <div className="overflow-y-auto max-h-72 border border-brand-tan/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-brand-black sticky top-0">
                <tr className="border-b border-brand-tan/20">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-brand-cream">Identifier</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-brand-cream">Matched to</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-brand-cream">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-brand-cream">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-brand-cream">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-brand-tan/10 last:border-0">
                    <td className="px-4 py-2">
                      {row.user_id ? (
                        <span className="flex items-center gap-1 text-xs font-mono text-brand-cream/60">
                          <Fingerprint className="w-3 h-3 text-brand-tan/60 flex-shrink-0" />
                          {row.user_id}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-brand-cream/70">
                          <User className="w-3 h-3 text-brand-cream/40 flex-shrink-0" />
                          {row.name || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-brand-cream/80">{row.matched_name || '—'}</span>
                        {(row.match_method === 'member_id') && (
                          <span className="text-xs px-1.5 py-0.5 bg-brand-tan/10 text-brand-tan rounded font-medium">WR ID</span>
                        )}
                        {row.match_method === 'name' && (
                          <span className="text-xs px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded font-medium">name</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-brand-cream/60">{row.date}</td>
                    <td className="px-4 py-2 font-semibold text-brand-tan">{fmtAmount(row.amount)}</td>
                    <td className="px-4 py-2">
                      {row.status === 'matched'   && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-green-400 bg-green-900/20"><CheckCircle2 className="w-3 h-3" /> Matched</span>}
                      {row.status === 'unmatched' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-red-400 bg-red-900/20"><AlertCircle className="w-3 h-3" /> No match</span>}
                      {row.status === 'kitty'     && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-blue-400 bg-blue-900/20">💰 Kitty</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 justify-between pt-1">
            <button onClick={reset} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream font-semibold hover:bg-brand-dark-grey/50 transition-colors text-sm">
              ← Different file
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={(previewSummary?.matched ?? 0) === 0}
              className="flex items-center gap-2 px-5 py-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Upload className="w-4 h-4" />
              Import {previewSummary?.matched ?? 0} payments
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: importing — spinner ── */}
      {step === 'importing' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-10 h-10 text-brand-tan animate-spin" />
          <p className="text-brand-cream font-semibold">Importing {previewSummary?.matched} payments…</p>
          {replaceExisting && <p className="text-amber-400/70 text-xs">Replacing existing records</p>}
        </div>
      )}

      {/* ── STEP: done ── */}
      {step === 'done' && result && (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-brand-cream">{result.inserted} payments imported</p>
              {result.kitty_skipped > 0 && <p className="text-sm text-brand-cream/50 mt-1">{result.kitty_skipped} group kitty entries skipped</p>}
              {result.unmatched.length > 0 && <p className="text-sm text-red-400 mt-2">{result.unmatched.length} skipped — no match: <span className="font-mono">{result.unmatched.join(', ')}</span></p>}
            </div>
          </div>
          <div className="flex justify-center gap-3">
            <button onClick={reset} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream font-semibold hover:bg-brand-dark-grey/50 transition-colors text-sm">Import another file</button>
            <button onClick={onClose} className="px-4 py-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black font-semibold rounded-lg transition-colors text-sm">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
