'use client';

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  Download, X, CheckSquare, Square, Users,
  FileSpreadsheet, ChevronDown, ChevronUp,
  Bike, ClipboardList, CreditCard, AlertCircle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────
type MemberOption = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  surname: string | null;
  email: string;
  role: string;
};

interface ExportMembersPanelProps {
  members: MemberOption[];
  onClose: () => void;
}

type SheetOption = {
  id: 'trips' | 'form_responses' | 'payments';
  label: string;
  description: string;
  icon: React.ReactNode;
};

const SHEET_OPTIONS: SheetOption[] = [
  {
    id: 'trips',
    label: 'Trip History',
    description: 'Trips each member has been on, including role and dates',
    icon: <Bike size={14} />,
  },
  {
    id: 'form_responses',
    label: 'Form Responses',
    description: 'All submitted form answers per member',
    icon: <ClipboardList size={14} />,
  },
  {
    id: 'payments',
    label: 'Payment History',
    description: 'Payment records, amounts, and statuses per trip',
    icon: <CreditCard size={14} />,
  },
];

// ── Profile column definitions ───────────────────────────────
const PROFILE_COLUMNS = [
  { key: 'full_name',                  label: 'Full Name',               width: 22 },
  { key: 'first_name',                 label: 'First Name',              width: 16 },
  { key: 'middle_name',                label: 'Middle Name',             width: 16 },
  { key: 'surname',                    label: 'Surname',                 width: 16 },
  { key: 'nickname',                   label: 'Nickname',                width: 14 },
  { key: 'email',                      label: 'Email',                   width: 28 },
  { key: 'role',                       label: 'Role',                    width: 14 },
  { key: 'status',                     label: 'Status',                  width: 12 },
  { key: 'phone_display',              label: 'Phone',                   width: 18 },
  { key: 'date_of_birth',              label: 'Date of Birth',           width: 14 },
  { key: 'address_line1',              label: 'Address Line 1',          width: 24 },
  { key: 'address_line2',              label: 'Address Line 2',          width: 20 },
  { key: 'address_city',               label: 'City',                    width: 16 },
  { key: 'address_state',              label: 'State / Province',        width: 16 },
  { key: 'address_postcode',           label: 'Postcode',                width: 12 },
  { key: 'address_country',            label: 'Country',                 width: 16 },
  { key: 'passport_number',            label: 'Passport Number',         width: 16 },
  { key: 'passport_expiry',            label: 'Passport Expiry',         width: 14 },
  { key: 'shirt_size',                 label: 'Shirt Size',              width: 12 },
  { key: 'shorts_size',                label: 'Shorts Size',             width: 12 },
  { key: 'emergency_contact',          label: 'Emergency Contact',       width: 22 },
  { key: 'emergency_contact_number',   label: 'Emergency Contact Phone', width: 22 },
  { key: 'bio',                        label: 'Bio',                     width: 40 },
  { key: 'member_since',               label: 'Member Since',            width: 14 },
];

// ── Helpers ──────────────────────────────────────────────────
function formatDate(val: string | null): string {
  if (!val) return '';
  try { return new Date(val).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return val; }
}

function memberDisplayName(m: MemberOption): string {
  return [m.first_name, m.surname].filter(Boolean).join(' ') || m.full_name || m.email;
}

// ── Header style ─────────────────────────────────────────────
function applyHeaderStyle(ws: XLSX.WorkSheet, headerRow: number, colCount: number) {
  for (let c = 0; c < colCount; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRow - 1, c });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = {
      font:      { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
      fill:      { fgColor: { rgb: '1A1A1A' }, patternType: 'solid' },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
      border: {
        bottom: { style: 'medium', color: { rgb: 'B5621E' } },
      },
    };
  }
}

// ── Main component ───────────────────────────────────────────
export default function ExportMembersPanel({ members, onClose }: ExportMembersPanelProps) {
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set(members.map(m => m.id)));
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set(['trips', 'form_responses', 'payments']));
  const [exporting, setExporting]           = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [showMembers, setShowMembers]       = useState(false);
  const [memberSearch, setMemberSearch]     = useState('');

  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === members.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(members.map(m => m.id)));
  };

  const toggleSheet = (id: string) => {
    setSelectedSheets(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredMembers = members.filter(m =>
    !memberSearch || memberDisplayName(m).toLowerCase().includes(memberSearch.toLowerCase())
      || m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const handleExport = useCallback(async () => {
    if (!selectedIds.size) { setError('Select at least one member.'); return; }
    setExporting(true);
    setError(null);

    try {
      const ids     = Array.from(selectedIds).join(',');
      const include = Array.from(selectedSheets).join(',');
      const res     = await fetch(`/api/admin/members/export?ids=${ids}&include=${include}`);
      const json    = await res.json();

      if (!json.success) throw new Error(json.error || 'Export failed');

      const { profiles, trips, form_responses, payments, generated_at } = json.data;

      // ── Build lookup: member_id → display name + email ──────
      const memberMap: Record<string, { name: string; email: string }> = {};
      for (const p of profiles) {
        memberMap[p.id] = {
          name:  [p.first_name, p.surname].filter(Boolean).join(' ') || p.full_name || p.email,
          email: p.email,
        };
      }

      const wb = XLSX.utils.book_new();

      // ══ Sheet 1: Profile Data ══════════════════════════════════
      const profileRows = profiles.map((p: any) => ({
        full_name:                 p.full_name || [p.first_name, p.middle_name, p.surname].filter(Boolean).join(' '),
        first_name:                p.first_name || '',
        middle_name:               p.middle_name || '',
        surname:                   p.surname || '',
        nickname:                  p.nickname || '',
        email:                     p.email || '',
        role:                      p.role || '',
        status:                    p.status || '',
        phone_display:             [p.phone_country_code, p.phone].filter(Boolean).join(' '),
        date_of_birth:             formatDate(p.date_of_birth),
        address_line1:             p.address_line1 || p.address || '',
        address_line2:             p.address_line2 || '',
        address_city:              p.address_city || '',
        address_state:             p.address_state || '',
        address_postcode:          p.address_postcode || '',
        address_country:           p.address_country || '',
        passport_number:           p.passport_number || '',
        passport_expiry:           formatDate(p.passport_expiry),
        shirt_size:                p.shirt_size || '',
        shorts_size:               p.shorts_size || '',
        emergency_contact:         p.emergency_contact || '',
        emergency_contact_number:  p.emergency_contact_number || '',
        bio:                       p.bio || '',
        member_since:              formatDate(p.created_at),
      }));

      const profileSheetData = [
        PROFILE_COLUMNS.map(c => c.label),
        ...profileRows.map((row: any) => PROFILE_COLUMNS.map(c => row[c.key] ?? '')),
      ];

      const wsProfiles = XLSX.utils.aoa_to_sheet(profileSheetData);
      wsProfiles['!cols'] = PROFILE_COLUMNS.map(c => ({ wch: c.width }));
      wsProfiles['!rows'] = [{ hpt: 20 }]; // header row height
      applyHeaderStyle(wsProfiles, 1, PROFILE_COLUMNS.length);
      XLSX.utils.book_append_sheet(wb, wsProfiles, 'Member Profiles');

      // ══ Sheet 2: Trip History ══════════════════════════════════
      if (selectedSheets.has('trips') && trips.length > 0) {
        const tripHeaders = ['Member Name', 'Email', 'Trip Name', 'Destination', 'Country', 'Trip Role', 'Start Date', 'End Date', 'Trip Status'];
        const tripRows = trips.map((t: any) => [
          memberMap[t.member_id]?.name  || '',
          memberMap[t.member_id]?.email || '',
          t.trip_name   || '',
          t.destination || '',
          t.country     || '',
          t.trip_role   || '',
          formatDate(t.start_date),
          formatDate(t.end_date),
          t.trip_status || '',
        ]);
        const wsTrips = XLSX.utils.aoa_to_sheet([tripHeaders, ...tripRows]);
        wsTrips['!cols'] = [22, 28, 24, 20, 16, 14, 14, 14, 14].map(wch => ({ wch }));
        applyHeaderStyle(wsTrips, 1, tripHeaders.length);
        XLSX.utils.book_append_sheet(wb, wsTrips, 'Trip History');
      }

      // ══ Sheet 3: Form Responses ════════════════════════════════
      if (selectedSheets.has('form_responses') && form_responses.length > 0) {
        const frHeaders = ['Member Name', 'Email', 'Form', 'Field', 'Field Type', 'Response', 'Library Field', 'Submitted', 'Visibility'];
        const frRows = form_responses.map((r: any) => [
          memberMap[r.member_id]?.name  || '',
          memberMap[r.member_id]?.email || '',
          r.form_title   || '',
          r.field_label  || '',
          r.field_type   || '',
          r.response     || '',
          r.library_linked ? 'Yes' : 'No',
          formatDate(r.submitted_at),
          r.is_public ? 'Public' : 'Private',
        ]);
        const wsFR = XLSX.utils.aoa_to_sheet([frHeaders, ...frRows]);
        wsFR['!cols'] = [22, 28, 24, 24, 16, 36, 14, 14, 12].map(wch => ({ wch }));
        applyHeaderStyle(wsFR, 1, frHeaders.length);
        XLSX.utils.book_append_sheet(wb, wsFR, 'Form Responses');
      }

      // ══ Sheet 4: Payments ══════════════════════════════════════
      if (selectedSheets.has('payments') && payments.length > 0) {
        const pmHeaders = ['Member Name', 'Email', 'Trip', 'Amount (AUD)', 'Payment Date', 'Payment Method', 'Notes'];
        const pmRows = payments.map((p: any) => [
          memberMap[p.member_id]?.name  || '',
          memberMap[p.member_id]?.email || '',
          p.trip_name      || '',
          p.amount != null ? Number(p.amount) : '',
          formatDate(p.payment_date),
          p.payment_method || '',
          p.notes          || '',
        ]);
        const wsPM = XLSX.utils.aoa_to_sheet([pmHeaders, ...pmRows]);
        wsPM['!cols'] = [22, 28, 24, 14, 14, 18, 36].map(wch => ({ wch }));
        applyHeaderStyle(wsPM, 1, pmHeaders.length);
        XLSX.utils.book_append_sheet(wb, wsPM, 'Payments');
      }

      // ══ Sheet 5: Export Info ════════════════════════════════════
      const infoData = [
        ['Whiskey Riders — Member Export'],
        ['Generated', new Date(generated_at).toLocaleString('en-AU')],
        ['Members exported', selectedIds.size],
        ['Sheets included', Array.from(selectedSheets).join(', ') || 'Profiles only'],
        [],
        ['This document is confidential. Do not share outside authorised personnel.'],
      ];
      const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
      wsInfo['!cols'] = [{ wch: 30 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, wsInfo, 'Export Info');

      // ── Download ─────────────────────────────────────────────
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `whiskey-riders-members-${dateStr}.xlsx`;
      XLSX.writeFile(wb, filename);

    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [selectedIds, selectedSheets]);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-[#C9B98A]" />
            <h2 className="text-white font-semibold">Export Members</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Member selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-zinc-300 text-sm font-medium flex items-center gap-1.5">
                <Users size={14} /> Members
              </label>
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 text-xs">{selectedIds.size} / {members.length} selected</span>
                <button onClick={toggleAll}
                  className="text-xs text-[#C9B98A] hover:text-[#B5621E] transition-colors flex items-center gap-1">
                  {selectedIds.size === members.length
                    ? <><Square size={11} /> Deselect all</>
                    : <><CheckSquare size={11} /> Select all</>}
                </button>
              </div>
            </div>

            {/* Collapsed summary / expandable list */}
            <button
              onClick={() => setShowMembers(p => !p)}
              className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              <span>
                {selectedIds.size === members.length
                  ? 'All active members'
                  : selectedIds.size === 0
                  ? 'No members selected'
                  : `${selectedIds.size} member${selectedIds.size !== 1 ? 's' : ''} selected`}
              </span>
              {showMembers ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
            </button>

            {showMembers && (
              <div className="mt-2 border border-zinc-700 rounded-lg overflow-hidden">
                {/* Search */}
                <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
                  <input
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Search members…"
                    className="w-full bg-transparent text-white text-sm placeholder-zinc-600 focus:outline-none"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-zinc-800/50">
                  {filteredMembers.map(m => {
                    const checked = selectedIds.has(m.id);
                    return (
                      <div key={m.id} onClick={() => toggleMember(m.id)}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                          checked ? 'bg-[#B5621E]/8' : 'hover:bg-zinc-800/40'
                        }`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          checked ? 'bg-[#B5621E] border-[#B5621E]' : 'border-zinc-600'
                        }`}>
                          {checked && <span className="text-white text-[9px] font-bold">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-white text-sm">{memberDisplayName(m)}</span>
                          <span className="text-zinc-500 text-xs ml-2">{m.email}</span>
                        </div>
                        <span className="text-zinc-600 text-xs capitalize shrink-0">{m.role}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sheet selection */}
          <div>
            <label className="text-zinc-300 text-sm font-medium block mb-2">Include sheets</label>
            <div className="space-y-2">
              {/* Always-included profiles sheet */}
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800">
                <div className="w-4 h-4 rounded border bg-[#B5621E] border-[#B5621E] flex items-center justify-center shrink-0">
                  <span className="text-white text-[9px] font-bold">✓</span>
                </div>
                <FileSpreadsheet size={14} className="text-[#C9B98A] shrink-0" />
                <div>
                  <span className="text-white text-sm">Member Profiles</span>
                  <p className="text-zinc-500 text-xs">All profile fields — always included</p>
                </div>
              </div>

              {SHEET_OPTIONS.map(sheet => {
                const checked = selectedSheets.has(sheet.id);
                return (
                  <div key={sheet.id} onClick={() => toggleSheet(sheet.id)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#B5621E]/8 border-[#B5621E]/25'
                        : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30'
                    }`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      checked ? 'bg-[#B5621E] border-[#B5621E]' : 'border-zinc-600'
                    }`}>
                      {checked && <span className="text-white text-[9px] font-bold">✓</span>}
                    </div>
                    <span className={`shrink-0 ${checked ? 'text-[#C9B98A]' : 'text-zinc-500'}`}>{sheet.icon}</span>
                    <div>
                      <span className="text-white text-sm">{sheet.label}</span>
                      <p className="text-zinc-500 text-xs">{sheet.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview summary */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-zinc-400 space-y-1">
            <p className="font-medium text-zinc-300 mb-1.5">Export preview</p>
            <p>· <span className="text-white">{selectedIds.size}</span> member row{selectedIds.size !== 1 ? 's' : ''} across <span className="text-white">{PROFILE_COLUMNS.length}</span> profile columns</p>
            {selectedSheets.has('trips')          && <p>· Trip history sheet (one row per member per trip)</p>}
            {selectedSheets.has('form_responses') && <p>· Form responses sheet (one row per field answer)</p>}
            {selectedSheets.has('payments')       && <p>· Payment history sheet</p>}
            <p>· Export Info sheet with generation timestamp</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between gap-3">
          <p className="text-zinc-600 text-xs">
            {1 + selectedSheets.size} sheet{1 + selectedSheets.size !== 1 ? 's' : ''} · xlsx format
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={exporting}>Cancel</Button>
            <Button
              onClick={handleExport}
              disabled={exporting || selectedIds.size === 0}
              className="flex items-center gap-2"
            >
              {exporting ? <><Spinner size="sm" /> Generating…</> : <><Download size={14} /> Download Excel</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
