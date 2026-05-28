'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { RichTextEditor, type RichTextEditorHandle } from '@/components/news/RichTextEditor';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookTemplate,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Hash,
  ImagePlus,
  Layout,
  Mail,
  MessageSquare,
  Paintbrush,
  Plus,
  Search,
  Send,
  Trash2,
  Type,
  Users,
  X,
} from 'lucide-react';
import { getMemberDisplayName } from '@/lib/member-display';
import { sanitizeLinkUrl, toEditorHtml } from '@/lib/news/content';

// ─── Types ───────────────────────────────────────────────────────────────────

type Trip = { id: string; name: string; slug: string; status: string };
type Member = {
  id: string;
  email: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  status: string;
};
type Campaign = {
  id: string;
  subject: string;
  body: string;
  status: 'draft' | 'sent';
  is_global: boolean;
  tag_all_members: boolean;
  sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  creator: { id: string; full_name: string | null; nickname: string | null } | null;
  trip_tags: { id: string; name: string; slug: string }[];
  member_tags: { id: string; full_name: string | null; nickname: string | null }[];
};
type Template = {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  created_at: string | null;
  updated_at: string | null;
  creator: { id: string; full_name: string | null; nickname: string | null } | null;
};
type HeaderSettings = {
  email_header_title: string;
  email_header_tagline: string;
  email_header_image_url: string | null;
  email_footer_text: string;
  email_footer_image_url: string | null;
  email_greeting: string;
};
type EditorMode = 'rich' | 'html';
type EmailAsset = {
  path: string;
  name: string;
  file_url: string;
  file_size: number | null;
  updated_at: string | null;
  content_type: string | null;
};
type RichTemplateBlock = { id: string; label: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const RICH_EMAIL_ALLOWED_TAGS = new Set([
  'div','p','br','strong','b','em','i','u','s','blockquote','ul','ol','li',
  'h1','h2','h3','h4','h5','h6','a','img','hr','span','table','thead','tbody',
  'tr','td','th',
]);

const RICH_EMAIL_ALLOWED_STYLE_PROPS = new Set([
  'background','background-color','color','padding','padding-top','padding-right',
  'padding-bottom','padding-left','margin','margin-top','margin-right','margin-bottom',
  'margin-left','border','border-top','border-right','border-bottom','border-left',
  'border-radius','text-align','font-size','font-weight','line-height',
  'letter-spacing','text-transform','text-decoration','display','width','max-width',
  'min-width','height','max-height','min-height',
]);

const emptyCampaignForm = {
  subject: '',
  body: '',
  is_global: false,
  tag_all_members: false,
  trip_ids: [] as string[],
  member_ids: [] as string[],
};

const emptyTemplateForm = { name: '', description: '', subject: '', body: '' };

const defaultHeader: HeaderSettings = {
  email_header_title: 'The Whiskey Riders',
  email_header_tagline: 'Until We Ride',
  email_header_image_url: null,
  email_footer_text: "You're receiving this because you're a member of The Whiskey Riders.",
  email_footer_image_url: null,
  email_greeting: 'Hi',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function detectEditorMode(body: string): EditorMode {
  const lower = (body || '').toLowerCase();
  return (
    lower.includes('<!doctype') || lower.includes('<html') || lower.includes('<body') ||
    lower.includes('<style') || lower.includes('<table') || lower.includes('class=') ||
    lower.includes('email-wrapper')
  ) ? 'html' : 'rich';
}

function sanitizeRichInlineStyle(styleValue: string): string {
  const sanitized: string[] = [];
  for (const declaration of styleValue.split(';')) {
    const sep = declaration.indexOf(':');
    if (sep <= 0) continue;
    const prop = declaration.slice(0, sep).trim().toLowerCase();
    const value = declaration.slice(sep + 1).trim();
    if (!prop || !value || !RICH_EMAIL_ALLOWED_STYLE_PROPS.has(prop)) continue;
    const lower = value.toLowerCase();
    if (lower.includes('javascript:') || lower.includes('expression(') || lower.includes('url(')) continue;
    sanitized.push(`${prop}: ${value}`);
  }
  return sanitized.join('; ');
}

function sanitizeRichEmailHtml(content: string): string {
  const raw = (content || '').trim();
  if (!raw || typeof window === 'undefined') return raw;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${raw}</div>`, 'text/html');
  const wrapper = doc.body.firstElementChild as HTMLElement | null;
  if (!wrapper) return '';
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) { node.removeChild(child); continue; }
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (!RICH_EMAIL_ALLOWED_TAGS.has(tag)) {
        const frag = doc.createDocumentFragment();
        while (el.firstChild) frag.appendChild(el.firstChild);
        el.replaceWith(frag);
        continue;
      }
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) { el.removeAttribute(attr.name); continue; }
        if (name === 'style') {
          const s = sanitizeRichInlineStyle(attr.value || '');
          s ? el.setAttribute('style', s) : el.removeAttribute('style');
          continue;
        }
        if (name === 'href' || name === 'src') {
          const safe = sanitizeLinkUrl(attr.value || '');
          safe ? el.setAttribute(attr.name, safe) : el.removeAttribute(attr.name);
          continue;
        }
        if (['target','rel','alt','title','colspan','rowspan'].includes(name) || name.startsWith('data-email-')) continue;
        el.removeAttribute(attr.name);
      }
      if (tag === 'a' && el.getAttribute('href')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
      walk(el);
    }
  };
  walk(wrapper);
  return wrapper.innerHTML.trim();
}

function hasRenderableRichEmailContent(content: string): boolean {
  const s = sanitizeRichEmailHtml(content);
  if (!s) return false;
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length > 0 ||
    /<(img|table|hr)\b/i.test(s);
}

function applyRichEmailCanvasBackground(content: string, color: string): string {
  const sanitized = sanitizeRichEmailHtml(content);
  const initial = sanitized || '<p></p>';
  if (typeof window === 'undefined') return initial;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${initial}</div>`, 'text/html');
  const wrapper = doc.body.firstElementChild as HTMLElement | null;
  if (!wrapper) return initial;
  let canvas = wrapper.querySelector('[data-email-canvas="true"]') as HTMLElement | null;
  if (!canvas) {
    canvas = doc.createElement('div');
    canvas.setAttribute('data-email-canvas', 'true');
    while (wrapper.firstChild) canvas.appendChild(wrapper.firstChild);
    wrapper.appendChild(canvas);
  }
  canvas.style.setProperty('background-color', color);
  if (!canvas.style.getPropertyValue('padding')) canvas.style.setProperty('padding', '24px');
  if (!canvas.style.getPropertyValue('border-radius')) canvas.style.setProperty('border-radius', '10px');
  return wrapper.innerHTML.trim();
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function createRichNodeId(): string {
  return `blk-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36).slice(-5)}`;
}

function ensureRichEmailNodeIds(content: string): string {
  const sanitized = sanitizeRichEmailHtml(content);
  const initial = sanitized || '<p></p>';
  if (typeof window === 'undefined') return initial;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${initial}</div>`, 'text/html');
  const wrapper = doc.body.firstElementChild as HTMLElement | null;
  if (!wrapper) return initial;
  const canvas = (wrapper.querySelector('[data-email-canvas="true"]') as HTMLElement | null) || wrapper;
  for (const child of Array.from(canvas.children) as HTMLElement[]) {
    const tag = child.tagName.toLowerCase();
    const isReorderable =
      child.getAttribute('data-email-section') === 'true' ||
      child.getAttribute('data-email-block') === 'true' ||
      child.getAttribute('data-email-canvas') === 'true' ||
      tag === 'table';
    if (!isReorderable) continue;
    if (!child.getAttribute('data-email-node-id')) child.setAttribute('data-email-node-id', createRichNodeId());
  }
  return wrapper.innerHTML.trim();
}

function getRichTemplateBlocks(content: string): RichTemplateBlock[] {
  const normalized = ensureRichEmailNodeIds(content);
  if (typeof window === 'undefined') return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${normalized}</div>`, 'text/html');
  const wrapper = doc.body.firstElementChild as HTMLElement | null;
  if (!wrapper) return [];
  const canvas = (wrapper.querySelector('[data-email-canvas="true"]') as HTMLElement | null) || wrapper;
  const blocks: RichTemplateBlock[] = [];
  (Array.from(canvas.children) as HTMLElement[]).forEach((child, index) => {
    const id = child.getAttribute('data-email-node-id');
    if (!id) return;
    const tag = child.tagName.toLowerCase();
    let label = `Block ${index + 1}`;
    if (child.getAttribute('data-email-section') === 'true') label = `Section ${index + 1}`;
    else if (child.querySelector('[data-email-button="true"]')) label = `Button Block ${index + 1}`;
    else if (tag === 'table') label = `Columns Block ${index + 1}`;
    else if (child.querySelector('img') && !child.textContent?.trim()) label = `Image Block ${index + 1}`;
    else if (child.querySelector('h1,h2,h3,h4')) label = `Heading Block ${index + 1}`;
    blocks.push({ id, label });
  });
  return blocks;
}

function reorderRichTemplateBlocks(content: string, sourceId: string, targetId: string): string {
  if (!sourceId || !targetId || sourceId === targetId) return ensureRichEmailNodeIds(content);
  const normalized = ensureRichEmailNodeIds(content);
  if (typeof window === 'undefined') return normalized;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${normalized}</div>`, 'text/html');
  const wrapper = doc.body.firstElementChild as HTMLElement | null;
  if (!wrapper) return normalized;
  const canvas = (wrapper.querySelector('[data-email-canvas="true"]') as HTMLElement | null) || wrapper;
  const children = Array.from(canvas.children) as HTMLElement[];
  const source = children.find(el => el.getAttribute('data-email-node-id') === sourceId);
  const target = children.find(el => el.getAttribute('data-email-node-id') === targetId);
  if (!source || !target || source === target) return wrapper.innerHTML.trim();
  const sourceIndex = children.indexOf(source);
  const targetIndex = children.indexOf(target);
  source.remove();
  sourceIndex < targetIndex ? target.after(source) : target.before(source);
  return wrapper.innerHTML.trim();
}

function formatBytes(value: number | null): string {
  if (!value || value <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value, index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index++; }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function isImageAsset(asset: EmailAsset): boolean {
  return (asset.content_type || '').toLowerCase().startsWith('image/');
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

/** Collapsible panel */
function CollapsibleSection({
  title, icon: Icon, defaultOpen = false, children,
}: { title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-brand-brown/20 bg-brand-dark-grey/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-brand-cream/80 hover:text-brand-cream hover:bg-brand-dark-grey/30 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-brand-brown" />
          {title}
        </span>
        {open ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-3">{children}</div>}
    </div>
  );
}

/** Mode toggle: Rich / HTML */
function EditorModeToggle({
  mode, onSwitch,
}: { mode: EditorMode; onSwitch: (m: EditorMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-brand-brown/25 overflow-hidden">
      <button
        type="button"
        onClick={() => onSwitch('rich')}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'rich'
            ? 'bg-brand-brown text-white'
            : 'bg-brand-dark-grey/40 text-brand-cream/60 hover:text-brand-cream hover:bg-brand-dark-grey/70'
        }`}
      >
        <Type className="w-3.5 h-3.5" />
        Visual
      </button>
      <button
        type="button"
        onClick={() => onSwitch('html')}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'html'
            ? 'bg-brand-brown text-white'
            : 'bg-brand-dark-grey/40 text-brand-cream/60 hover:text-brand-cream hover:bg-brand-dark-grey/70'
        }`}
      >
        <Code2 className="w-3.5 h-3.5" />
        HTML
      </button>
    </div>
  );
}

/** Block insertion toolbar */
function BlockInsertBar({
  onHero, onText, onButton, onColumns, onDivider, onLogo,
}: {
  onHero: () => void; onText: () => void; onButton: () => void;
  onColumns: () => void; onDivider: () => void; onLogo: () => void;
}) {
  const blocks = [
    { label: 'Hero Section', fn: onHero },
    { label: 'Text Block', fn: onText },
    { label: 'Button CTA', fn: onButton },
    { label: 'Two Columns', fn: onColumns },
    { label: 'Divider', fn: onDivider },
    { label: 'Add Logo', fn: onLogo },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {blocks.map(({ label, fn }) => (
        <button
          key={label}
          type="button"
          onClick={fn}
          className="px-2.5 py-1 rounded border border-brand-brown/30 bg-brand-dark-grey/40 text-xs text-brand-cream/80 hover:bg-brand-brown/20 hover:text-brand-cream hover:border-brand-brown/60 transition-colors"
        >
          + {label}
        </button>
      ))}
    </div>
  );
}

/** Color styling controls */
function ColorControls({
  emailBg, sectionBg, blockBg, buttonBg, buttonTextColor, buttonLink,
  onEmailBg, onSectionBg, onBlockBg, onButtonBg, onButtonTextColor, onButtonLink,
  onApplyEmail, onApplySection, onApplyBlock, onApplyButton, onApplyButtonText, onApplyButtonLink,
}: {
  emailBg: string; sectionBg: string; blockBg: string; buttonBg: string; buttonTextColor: string; buttonLink: string;
  onEmailBg: (v: string) => void; onSectionBg: (v: string) => void;
  onBlockBg: (v: string) => void; onButtonBg: (v: string) => void; onButtonTextColor: (v: string) => void;
  onButtonLink: (v: string) => void;
  onApplyEmail: () => void; onApplySection: () => void;
  onApplyBlock: () => void; onApplyButton: () => void; onApplyButtonText: () => void; onApplyButtonLink: () => void;
}) {
  const colorRow = (label: string, color: string, onChange: (v: string) => void, onApply: () => void) => (
    <div className="flex items-center gap-2">
      <input
        type="color" value={color} onChange={e => onChange(e.target.value)}
        className="h-7 w-9 rounded border border-brand-brown/20 bg-transparent cursor-pointer"
      />
      <span className="text-xs text-brand-cream/70 flex-1">{label}</span>
      <button
        type="button" onClick={onApply}
        className="px-2 py-0.5 rounded text-[11px] border border-brand-brown/30 text-brand-cream/70 hover:text-brand-cream hover:border-brand-brown/50 transition-colors"
      >
        Apply
      </button>
    </div>
  );
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {colorRow('Email Background', emailBg, onEmailBg, onApplyEmail)}
        {colorRow('Section Background', sectionBg, onSectionBg, onApplySection)}
        {colorRow('Block Background', blockBg, onBlockBg, onApplyBlock)}
        {colorRow('Button Background', buttonBg, onButtonBg, onApplyButton)}
      </div>
      <div className="border-t border-brand-brown/10 pt-2 space-y-2">
        {colorRow('Button Text Color', buttonTextColor, onButtonTextColor, onApplyButtonText)}
        {/* Button link URL */}
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={buttonLink}
            onChange={e => onButtonLink(e.target.value)}
            placeholder="https://..."
            className="flex-1 min-w-0 h-7 rounded border border-brand-brown/20 bg-brand-dark-grey/50 px-2 text-xs text-brand-cream/80 placeholder:text-brand-cream/30 focus:border-brand-brown focus:outline-none"
          />
          <span className="text-xs text-brand-cream/50 shrink-0">Button URL</span>
          <button
            type="button" onClick={onApplyButtonLink}
            className="px-2 py-0.5 rounded text-[11px] border border-brand-brown/30 text-brand-cream/70 hover:text-brand-cream hover:border-brand-brown/50 transition-colors shrink-0"
          >
            Apply
          </button>
        </div>
        <p className="text-[11px] text-brand-cream/35">Click inside the button to target it, then Apply — or Apply will update the first button found.</p>
      </div>
    </div>
  );
}

/** Personalisation / merge-tag insert panel */
const MERGE_TAGS = [
  { label: 'First name', tag: '{{member.first_name}}' },
  { label: 'Full name',  tag: '{{member.full_name}}' },
  { label: 'Nickname',   tag: '{{member.nickname}}' },
  { label: 'Email',      tag: '{{member.email}}' },
] as const;

function MergeTagsPanel({ onInsert }: { onInsert: (tag: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-brand-cream/50">
        Click a tag to insert it at the cursor. Each tag is replaced with the recipient&apos;s real value when the email is sent.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MERGE_TAGS.map(({ label, tag }) => (
          <button
            key={tag}
            type="button"
            onClick={() => onInsert(tag)}
            title={label}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-amber-700/40 bg-amber-900/20 text-xs text-amber-300/80 hover:bg-amber-800/30 hover:text-amber-200 hover:border-amber-600/60 font-mono transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>
      <p className="text-xs text-brand-cream/35">
        Falls back gracefully: <span className="font-mono text-amber-400/60">first_name</span> uses the first word of full name, then email prefix if no name is set.
      </p>
    </div>
  );
}

/** Drag-and-drop block reorder list */
function BlockOrderPanel({
  blocks, draggingId, dropTargetId,
  onDragStart, onDragEnter, onDragLeave, onDrop, onDragEnd, onMoveUp, onMoveDown,
}: {
  blocks: RichTemplateBlock[];
  draggingId: string | null;
  dropTargetId: string | null;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDragLeave: () => void;
  onDrop: (targetId: string) => void;
  onDragEnd: () => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}) {
  if (blocks.length === 0) {
    return (
      <p className="text-xs text-brand-cream/50 py-1">
        Insert blocks above to enable drag-and-drop ordering.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {blocks.map((block, index) => {
        const isDragging = draggingId === block.id;
        const isTarget = dropTargetId === block.id && !isDragging;
        return (
          <div
            key={block.id}
            draggable
            onDragStart={() => onDragStart(block.id)}
            onDragEnter={e => { e.preventDefault(); onDragEnter(block.id); }}
            onDragLeave={onDragLeave}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onDrop(block.id); }}
            onDragEnd={onDragEnd}
            className={`
              flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-grab active:cursor-grabbing transition-all
              ${isDragging ? 'opacity-40 border-brand-brown/40 bg-brand-dark-grey/20' : ''}
              ${isTarget ? 'border-brand-brown bg-brand-brown/15 shadow-[0_0_0_1px_rgba(181,98,30,0.4)]' : ''}
              ${!isDragging && !isTarget ? 'border-brand-brown/20 bg-brand-dark-grey/30 hover:border-brand-brown/40' : ''}
            `}
          >
            <GripVertical className="w-3.5 h-3.5 text-brand-cream/40 shrink-0" />
            <span className="flex-1 truncate text-brand-cream/80">
              <span className="text-brand-cream/40 mr-1">{index + 1}.</span>
              {block.label}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onMoveUp(index); }}
                disabled={index === 0}
                title="Move up"
                className={`inline-flex h-5 w-5 items-center justify-center rounded transition-colors ${
                  index === 0 ? 'text-brand-cream/20 cursor-not-allowed' : 'text-brand-cream/60 hover:text-brand-cream'
                }`}
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onMoveDown(index); }}
                disabled={index === blocks.length - 1}
                title="Move down"
                className={`inline-flex h-5 w-5 items-center justify-center rounded transition-colors ${
                  index === blocks.length - 1 ? 'text-brand-cream/20 cursor-not-allowed' : 'text-brand-cream/60 hover:text-brand-cream'
                }`}
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Live email preview */
function LiveEmailPreview({
  body, mode, header,
}: { body: string; mode: EditorMode; header: HeaderSettings }) {
  if (!body.trim()) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-brand-cream/40 text-sm border border-brand-brown/20 rounded-lg">
        Email preview will appear here
      </div>
    );
  }
  if (mode === 'html') {
    return (
      <iframe
        title="HTML Email Preview"
        srcDoc={body}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        className="w-full min-h-[500px] rounded-lg border border-brand-brown/30 bg-white"
      />
    );
  }
  return (
    <div className="rounded-lg overflow-hidden border border-brand-brown/30 text-sm">
      <div className="bg-brand-brown px-5 py-4 text-center">
        {header.email_header_image_url && (
          <img src={header.email_header_image_url} alt="" className="mx-auto mb-2 max-h-[52px] max-w-[180px] w-auto h-auto object-contain" />
        )}
        {header.email_header_title && (
          <p className="text-white font-semibold tracking-widest text-xs uppercase">{header.email_header_title}</p>
        )}
        {header.email_header_tagline && (
          <p className="text-white/70 text-xs tracking-wide mt-0.5">{header.email_header_tagline}</p>
        )}
      </div>
      <div className="bg-[#111] px-5 py-5">
        <p className="text-[#C9B98A] mb-3 text-xs">{header.email_greeting || 'Hi'} Rider,</p>
        <div
          className="text-[#d4c9a8] text-xs leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-[#f2e8d1] [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[#f2e8d1] [&_h3]:text-sm [&_h3]:font-semibold [&_a]:text-brand-brown [&_a]:underline [&_img]:max-w-full [&_img]:rounded [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>
      <div className="bg-[#111] border-t border-brand-brown/20 px-5 py-3 text-center">
        {header.email_footer_image_url && (
          <img src={header.email_footer_image_url} alt="" className="mx-auto mb-1.5 max-h-[36px] max-w-[120px] w-auto h-auto object-contain" />
        )}
        <p className="text-[#555] text-[11px]">{header.email_footer_text}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminEmailsPage() {
  const supabase = useMemo(() => createClient(), []);
  const campaignEditorRef = useRef<RichTextEditorHandle>(null);
  const templateEditorRef = useRef<RichTextEditorHandle>(null);
  const templateHtmlRef = useRef<HTMLTextAreaElement>(null);
  const campaignHtmlRef = useRef<HTMLTextAreaElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const headerImgRef = useRef<HTMLInputElement>(null);
  const footerImgRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'campaigns' | 'templates' | 'header'>('campaigns');

  // Campaign state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [campaignForm, setCampaignForm] = useState(emptyCampaignForm);
  const [campaignEditorMode, setCampaignEditorMode] = useState<EditorMode>('rich');
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState<Campaign | null>(null);

  // Test send state
  const [testSendModal, setTestSendModal] = useState<Campaign | null>(null);
  const [testMemberIds, setTestMemberIds] = useState<string[]>([]);
  const [testMemberSearch, setTestMemberSearch] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [templateEditorMode, setTemplateEditorMode] = useState<EditorMode>('rich');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templatePickerSearch, setTemplatePickerSearch] = useState('');
  const [showLivePreview, setShowLivePreview] = useState(true);

  // Builder drag state
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dropTargetBlockId, setDropTargetBlockId] = useState<string | null>(null);

  // Color state (shared between campaign & template builders)
  const [richEmailBgColor, setRichEmailBgColor] = useState('#111111');
  const [richSectionBgColor, setRichSectionBgColor] = useState('#1f1f1f');
  const [richBlockBgColor, setRichBlockBgColor] = useState('#171717');
  const [richButtonBgColor, setRichButtonBgColor] = useState('#B5621E');
  const [richButtonTextColor, setRichButtonTextColor] = useState('#ffffff');
  const [richButtonLink, setRichButtonLink] = useState('https://www.thewhiskeyriders.com');

  // Assets
  const [emailAssets, setEmailAssets] = useState<EmailAsset[]>([]);
  const [emailAssetSearch, setEmailAssetSearch] = useState('');
  const [uploadingAsset, setUploadingAsset] = useState(false);

  // Header/footer
  const [header, setHeader] = useState<HeaderSettings>(defaultHeader);
  const [headerOriginal, setHeaderOriginal] = useState<HeaderSettings>(defaultHeader);
  const [headerSaving, setHeaderSaving] = useState(false);
  const [siteSettingsId, setSiteSettingsId] = useState<string | null>(null);
  const [uploadingHeaderImage, setUploadingHeaderImage] = useState(false);
  const [uploadingFooterImage, setUploadingFooterImage] = useState(false);

  // Shared
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ─── Auth ──────────────────────────────────────────────────────────────────

  const getAccessToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');
    return session.access_token;
  }, [supabase]);

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);
      const token = await getAccessToken();
      const [cRes, oRes, tRes, aRes] = await Promise.all([
        fetch('/api/emails?limit=200', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/news/options', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/email-templates', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/email-assets?limit=400', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [cData, oData, tData, aData] = await Promise.all([
        cRes.json().catch(() => ({})),
        oRes.json().catch(() => ({})),
        tRes.json().catch(() => ({})),
        aRes.json().catch(() => ({})),
      ]);
      if (!cRes.ok || !cData.success) throw new Error(cData.error || 'Failed to load campaigns');
      setCampaigns(cData.data?.campaigns || []);
      setTrips(oData.data?.trips || []);
      setMembers(oData.data?.members || []);
      setTemplates(tData.data?.templates || []);
      setEmailAssets(aData.data?.assets || []);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: settingsRow } = await (supabase as any)
        .from('site_settings')
        .select('id, email_header_title, email_header_tagline, email_header_image_url, email_footer_text, email_footer_image_url, email_greeting')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (settingsRow) {
        const loaded: HeaderSettings = {
          email_header_title: settingsRow.email_header_title?.trim() || defaultHeader.email_header_title,
          email_header_tagline: settingsRow.email_header_tagline?.trim() || defaultHeader.email_header_tagline,
          email_header_image_url: settingsRow.email_header_image_url?.trim() || null,
          email_footer_text: settingsRow.email_footer_text?.trim() || defaultHeader.email_footer_text,
          email_footer_image_url: settingsRow.email_footer_image_url?.trim() || null,
          email_greeting: settingsRow.email_greeting?.trim() || defaultHeader.email_greeting,
        };
        setSiteSettingsId(settingsRow.id);
        setHeader(loaded);
        setHeaderOriginal(loaded);
      }
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  // ─── Mode switching ────────────────────────────────────────────────────────

  const switchCampaignMode = useCallback((mode: EditorMode) => {
    if (mode === campaignEditorMode) return;
    // When switching to rich: ensure node IDs are set
    if (mode === 'rich') {
      setCampaignForm(prev => ({ ...prev, body: ensureRichEmailNodeIds(prev.body) }));
    }
    // When switching to html: body already contains the HTML from rich editor (shared state)
    setCampaignEditorMode(mode);
  }, [campaignEditorMode]);

  const switchTemplateMode = useCallback((mode: EditorMode) => {
    if (mode === templateEditorMode) return;
    if (mode === 'rich') {
      setTemplateForm(prev => ({ ...prev, body: ensureRichEmailNodeIds(prev.body) }));
    }
    setTemplateEditorMode(mode);
  }, [templateEditorMode]);

  // ─── Campaign handlers ─────────────────────────────────────────────────────

  const resetCampaignForm = () => {
    setEditingCampaignId(null);
    setCampaignForm(emptyCampaignForm);
    setCampaignEditorMode('rich');
    setMessage(null);
  };

  const toggleId = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter(v => v !== id) : [...ids, id];

  const handleLoadTemplate = (template: Template) => {
    const mode = detectEditorMode(template.body);
    setCampaignForm(prev => ({
      ...prev,
      subject: template.subject,
      body: mode === 'rich' ? ensureRichEmailNodeIds(toEditorHtml(template.body)) : template.body,
    }));
    setCampaignEditorMode(mode);
    setShowTemplatePicker(false);
    setTemplatePickerSearch('');
  };

  const handleCampaignSave = async () => {
    const subject = campaignForm.subject.trim();
    const body = campaignEditorMode === 'html'
      ? campaignForm.body.trim()
      : ensureRichEmailNodeIds(campaignForm.body);
    if (!subject) { setMessage({ type: 'error', text: 'Subject line is required.' }); return; }
    if (campaignEditorMode === 'html' && !body) { setMessage({ type: 'error', text: 'Email body HTML is required.' }); return; }
    if (campaignEditorMode === 'rich' && !hasRenderableRichEmailContent(body)) { setMessage({ type: 'error', text: 'Email body is required.' }); return; }
    try {
      setCampaignSaving(true);
      setMessage(null);
      const token = await getAccessToken();
      const endpoint = editingCampaignId ? `/api/emails/${editingCampaignId}` : '/api/emails';
      const res = await fetch(endpoint, {
        method: editingCampaignId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject, body,
          is_global: campaignForm.is_global,
          tag_all_members: campaignForm.tag_all_members,
          trip_ids: campaignForm.is_global ? [] : campaignForm.trip_ids,
          member_ids: campaignForm.tag_all_members ? [] : campaignForm.member_ids,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to save campaign');
      setMessage({ type: 'success', text: editingCampaignId ? 'Campaign updated.' : 'Campaign saved as draft.' });
      resetCampaignForm();
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save campaign' });
    } finally {
      setCampaignSaving(false);
    }
  };

  const handleCampaignEdit = (campaign: Campaign) => {
    const mode = detectEditorMode(campaign.body);
    setEditingCampaignId(campaign.id);
    setCampaignForm({
      subject: campaign.subject,
      body: mode === 'rich' ? ensureRichEmailNodeIds(toEditorHtml(campaign.body)) : campaign.body,
      is_global: campaign.is_global,
      tag_all_members: campaign.tag_all_members,
      trip_ids: campaign.trip_tags.map(t => t.id),
      member_ids: campaign.member_tags.map(m => m.id),
    });
    setCampaignEditorMode(mode);
    setMessage(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSendCampaign = async (campaign: Campaign) => {
    setConfirmSend(null);
    try {
      setSendingId(campaign.id);
      setMessage(null);
      const token = await getAccessToken();
      const res = await fetch(`/api/emails/${campaign.id}/send`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to send campaign');
      const { sent, failed, attempted } = payload.data || { sent: 0, failed: 0, attempted: 0 };
      setMessage({
        type: failed > 0 && sent === 0 ? 'error' : 'success',
        text: `Sent to ${sent} of ${attempted} members.${failed > 0 ? ` ${failed} failed.` : ''}`,
      });
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send campaign' });
    } finally {
      setSendingId(null);
    }
  };

  const openTestSendModal = (campaign: Campaign) => {
    setTestSendModal(campaign);
    setTestMemberIds([]);
    setTestMemberSearch('');
  };

  const handleTestSend = async () => {
    if (!testSendModal || testMemberIds.length === 0) return;
    try {
      setSendingTest(true);
      const token = await getAccessToken();
      const res = await fetch(`/api/emails/${testSendModal.id}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: testMemberIds }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to send test');
      const { sent, failed, attempted } = payload.data || { sent: 0, failed: 0, attempted: 0 };
      setMessage({
        type: failed > 0 && sent === 0 ? 'error' : 'success',
        text: `Test sent to ${sent} of ${attempted} member${attempted !== 1 ? 's' : ''}.${failed > 0 ? ` ${failed} failed.` : ''}`,
      });
      setTestSendModal(null);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send test email' });
    } finally {
      setSendingTest(false);
    }
  };

  const handleCampaignDelete = async (campaign: Campaign) => {
    if (!window.confirm(`Delete "${campaign.subject}"?`)) return;
    try {
      setDeletingCampaignId(campaign.id);
      const token = await getAccessToken();
      const res = await fetch(`/api/emails/${campaign.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to delete');
      setMessage({ type: 'success', text: 'Campaign deleted.' });
      if (editingCampaignId === campaign.id) resetCampaignForm();
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete campaign' });
    } finally {
      setDeletingCampaignId(null);
    }
  };

  // ─── Template handlers ─────────────────────────────────────────────────────

  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateForm(emptyTemplateForm);
    setTemplateEditorMode('rich');
  };

  const handleTemplateSave = async () => {
    const name = templateForm.name.trim();
    const subject = templateForm.subject.trim();
    const body = templateEditorMode === 'html'
      ? templateForm.body.trim()
      : ensureRichEmailNodeIds(templateForm.body);
    if (!name) { setMessage({ type: 'error', text: 'Template name is required.' }); return; }
    if (!subject) { setMessage({ type: 'error', text: 'Subject line is required.' }); return; }
    if (templateEditorMode === 'html' && !body) { setMessage({ type: 'error', text: 'Body HTML is required.' }); return; }
    if (templateEditorMode === 'rich' && !hasRenderableRichEmailContent(body)) { setMessage({ type: 'error', text: 'Body is required.' }); return; }
    try {
      setTemplateSaving(true);
      setMessage(null);
      const token = await getAccessToken();
      const endpoint = editingTemplateId ? `/api/email-templates/${editingTemplateId}` : '/api/email-templates';
      const res = await fetch(endpoint, {
        method: editingTemplateId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, description: templateForm.description.trim(), subject, body }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to save template');
      setMessage({ type: 'success', text: editingTemplateId ? 'Template updated.' : 'Template saved.' });
      resetTemplateForm();
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save template' });
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleTemplateEdit = (template: Template) => {
    const mode = detectEditorMode(template.body);
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      description: template.description,
      subject: template.subject,
      body: mode === 'rich' ? ensureRichEmailNodeIds(toEditorHtml(template.body)) : template.body,
    });
    setTemplateEditorMode(mode);
    setPreviewTemplate(null);
    setMessage(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTemplateDelete = async (template: Template) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    try {
      setDeletingTemplateId(template.id);
      const token = await getAccessToken();
      const res = await fetch(`/api/email-templates/${template.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to delete');
      setMessage({ type: 'success', text: 'Template deleted.' });
      if (editingTemplateId === template.id) resetTemplateForm();
      if (previewTemplate?.id === template.id) setPreviewTemplate(null);
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete template' });
    } finally {
      setDeletingTemplateId(null);
    }
  };

  // ─── Block builder – Campaign ──────────────────────────────────────────────

  const insertCampaignSnippet = useCallback((snippet: string) => {
    if (campaignEditorMode !== 'rich') {
      // In HTML mode, insert at cursor in textarea
      const el = campaignHtmlRef.current;
      if (!el) { setCampaignForm(p => ({ ...p, body: p.body + snippet })); return; }
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? start;
      setCampaignForm(p => ({
        ...p,
        body: `${p.body.slice(0, start)}${snippet}${p.body.slice(end)}`,
      }));
      const next = start + snippet.length;
      requestAnimationFrame(() => {
        if (!campaignHtmlRef.current) return;
        campaignHtmlRef.current.focus();
        campaignHtmlRef.current.selectionStart = next;
        campaignHtmlRef.current.selectionEnd = next;
      });
      return;
    }
    // Rich mode: append block to state directly instead of using execCommand('insertHTML').
    // execCommand inserts at the cursor position, which can inject the new block INSIDE an
    // existing block if the cursor is nested there. Updating state directly always appends
    // after all existing content, regardless of where the cursor happens to be.
    const processed = ensureRichEmailNodeIds(snippet);
    setCampaignForm(prev => {
      const body = prev.body;
      if (!body) return { ...prev, body: processed };
      if (typeof window !== 'undefined' && body.includes('data-email-canvas="true"')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${body}</div>`, 'text/html');
        const wrapper = doc.body.firstElementChild as HTMLElement | null;
        const canvas = wrapper?.querySelector('[data-email-canvas="true"]') as HTMLElement | null;
        if (canvas) {
          canvas.insertAdjacentHTML('beforeend', processed);
          return { ...prev, body: wrapper!.innerHTML };
        }
      }
      return { ...prev, body: body + processed };
    });
  }, [campaignEditorMode]);

  // ─── Block builder – Template ──────────────────────────────────────────────

  const insertTemplateSnippet = useCallback((snippet: string) => {
    if (templateEditorMode !== 'rich') {
      const el = templateHtmlRef.current;
      if (!el) { setTemplateForm(p => ({ ...p, body: p.body + snippet })); return; }
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? start;
      setTemplateForm(p => ({
        ...p,
        body: `${p.body.slice(0, start)}${snippet}${p.body.slice(end)}`,
      }));
      const next = start + snippet.length;
      requestAnimationFrame(() => {
        if (!templateHtmlRef.current) return;
        templateHtmlRef.current.focus();
        templateHtmlRef.current.selectionStart = next;
        templateHtmlRef.current.selectionEnd = next;
      });
      return;
    }
    // Rich mode: append block to state directly instead of using execCommand('insertHTML').
    // execCommand inserts at the cursor position, which can inject the new block INSIDE an
    // existing block if the cursor is nested there. Updating state directly always appends
    // after all existing content, regardless of where the cursor happens to be.
    const processed = ensureRichEmailNodeIds(snippet);
    setTemplateForm(prev => {
      const body = prev.body;
      if (!body) return { ...prev, body: processed };
      if (typeof window !== 'undefined' && body.includes('data-email-canvas="true"')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${body}</div>`, 'text/html');
        const wrapper = doc.body.firstElementChild as HTMLElement | null;
        const canvas = wrapper?.querySelector('[data-email-canvas="true"]') as HTMLElement | null;
        if (canvas) {
          canvas.insertAdjacentHTML('beforeend', processed);
          return { ...prev, body: wrapper!.innerHTML };
        }
      }
      return { ...prev, body: body + processed };
    });
  }, [templateEditorMode]);

  // ─── Merge-tag insertion ───────────────────────────────────────────────────
  // Unlike block insertion, merge tags are inserted inline at the cursor
  // position. In rich mode we delegate to the editor's insertHtmlSnippet so
  // the tag lands exactly where the cursor is. In HTML mode we use the same
  // textarea cursor logic as the block inserters.

  const insertCampaignMergeTag = useCallback((tag: string) => {
    if (campaignEditorMode === 'rich') {
      // Insert inline at cursor via the editor's execCommand path
      campaignEditorRef.current?.insertHtmlSnippet(tag);
      return;
    }
    // HTML textarea: insert at cursor
    const el = campaignHtmlRef.current;
    if (!el) { setCampaignForm(p => ({ ...p, body: p.body + tag })); return; }
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? start;
    const next  = start + tag.length;
    setCampaignForm(p => ({
      ...p,
      body: `${p.body.slice(0, start)}${tag}${p.body.slice(end)}`,
    }));
    requestAnimationFrame(() => {
      if (!campaignHtmlRef.current) return;
      campaignHtmlRef.current.focus();
      campaignHtmlRef.current.selectionStart = next;
      campaignHtmlRef.current.selectionEnd   = next;
    });
  }, [campaignEditorMode]);

  const insertTemplateMergeTag = useCallback((tag: string) => {
    if (templateEditorMode === 'rich') {
      templateEditorRef.current?.insertHtmlSnippet(tag);
      return;
    }
    const el = templateHtmlRef.current;
    if (!el) { setTemplateForm(p => ({ ...p, body: p.body + tag })); return; }
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? start;
    const next  = start + tag.length;
    setTemplateForm(p => ({
      ...p,
      body: `${p.body.slice(0, start)}${tag}${p.body.slice(end)}`,
    }));
    requestAnimationFrame(() => {
      if (!templateHtmlRef.current) return;
      templateHtmlRef.current.focus();
      templateHtmlRef.current.selectionStart = next;
      templateHtmlRef.current.selectionEnd   = next;
    });
  }, [templateEditorMode]);

  // Block snippets factory (uses current color state)
  const makeHeroSnippet = () => `<div data-email-section="true" style="background-color:${richSectionBgColor};padding:24px;border-radius:10px;margin:0 0 16px"><h2 style="margin:0 0 10px;color:#f2e8d1;font-size:24px;line-height:1.2">Your Big Update Title</h2><p style="margin:0;color:#c8bfb0;line-height:1.6">Start with a clear summary so riders know exactly what changed.</p></div>`;
  const makeTextSnippet = () => `<div data-email-block="true" style="background-color:${richBlockBgColor};padding:16px 18px;border-radius:8px;margin:0 0 12px"><p style="margin:0;color:#d4c9a8;line-height:1.65">Drop in a focused content block for itinerary notes, reminders, or announcements.</p></div>`;
  const makeButtonSnippet = () => `<div data-email-block="true" style="text-align:center;margin:16px 0"><a data-email-button="true" href="https://www.thewhiskeyriders.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:${richButtonBgColor};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:700;letter-spacing:0.5px">Open Portal</a></div>`;
  const makeColumnsSnippet = () => `<table data-email-block="true" role="presentation" style="width:100%;border-collapse:separate;border-spacing:8px;margin:0 0 14px"><tr><td style="width:50%;background-color:${richBlockBgColor};border-radius:8px;padding:12px;vertical-align:top"><p style="margin:0 0 6px;font-weight:700;color:#f2e8d1">Column One</p><p style="margin:0;color:#c8bfb0;line-height:1.6">Add your content here.</p></td><td style="width:50%;background-color:${richBlockBgColor};border-radius:8px;padding:12px;vertical-align:top"><p style="margin:0 0 6px;font-weight:700;color:#f2e8d1">Column Two</p><p style="margin:0;color:#c8bfb0;line-height:1.6">Keep it concise for mobile.</p></td></tr></table>`;
  const makeDividerSnippet = () => `<div data-email-block="true" style="padding:8px 0 12px"><hr style="border:0;border-top:1px solid #2f271c;margin:0" /></div>`;

  const makeLogoSnippet = (): string | null => {
    const logoUrl = header.email_header_image_url || emailAssets.find(isImageAsset)?.file_url;
    if (!logoUrl) return null;
    const safe = sanitizeLinkUrl(logoUrl);
    if (!safe) return null;
    return `<div data-email-block="true" style="text-align:center;padding:4px 0 16px"><img src="${escapeHtmlAttr(safe)}" alt="Logo" style="max-width:200px;height:auto;display:inline-block" /></div>`;
  };

  // Campaign builder insertions
  const campaignInsert = {
    hero: () => insertCampaignSnippet(makeHeroSnippet()),
    text: () => insertCampaignSnippet(makeTextSnippet()),
    button: () => insertCampaignSnippet(makeButtonSnippet()),
    columns: () => insertCampaignSnippet(makeColumnsSnippet()),
    divider: () => insertCampaignSnippet(makeDividerSnippet()),
    logo: () => { const s = makeLogoSnippet(); if (s) insertCampaignSnippet(s); else setMessage({ type: 'error', text: 'No logo image found. Upload an image asset or set a header logo first.' }); },
  };

  // Template builder insertions
  const templateInsert = {
    hero: () => insertTemplateSnippet(makeHeroSnippet()),
    text: () => insertTemplateSnippet(makeTextSnippet()),
    button: () => insertTemplateSnippet(makeButtonSnippet()),
    columns: () => insertTemplateSnippet(makeColumnsSnippet()),
    divider: () => insertTemplateSnippet(makeDividerSnippet()),
    logo: () => { const s = makeLogoSnippet(); if (s) insertTemplateSnippet(s); else setMessage({ type: 'error', text: 'No logo image found. Upload an image asset or set a header logo first.' }); },
  };

  // ─── Block reorder ─────────────────────────────────────────────────────────

  const handleReorderBlock = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setTemplateForm(prev => ({
      ...prev,
      body: reorderRichTemplateBlocks(prev.body, sourceId, targetId),
    }));
  }, []);

  const handleReorderCampaignBlock = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setCampaignForm(prev => ({
      ...prev,
      body: reorderRichTemplateBlocks(prev.body, sourceId, targetId),
    }));
  }, []);

  // ─── Color apply ──────────────────────────────────────────────────────────

  const applyEmailBg = () => {
    setTemplateForm(prev => ({ ...prev, body: applyRichEmailCanvasBackground(prev.body, richEmailBgColor) }));
    setMessage({ type: 'success', text: 'Email background updated.' });
  };

  const applyClosestStyle = (
    editorRef: React.RefObject<RichTextEditorHandle | null>,
    selector: string,
    styles: Record<string, string>,
    label: string
  ) => {
    const updated = editorRef.current?.applyStylesToClosest(selector, styles);
    if (!updated) setMessage({ type: 'error', text: `Place your cursor inside a ${label} first, then click Apply.` });
    else setMessage({ type: 'success', text: `${label} style updated.` });
  };

  const applyButtonHref = (editorRef: React.RefObject<RichTextEditorHandle | null>, href: string) => {
    const updated = editorRef.current?.setElementHref('[data-email-button="true"]', href);
    if (!updated) setMessage({ type: 'error', text: 'No button found in this email. Add a Button CTA block first.' });
    else setMessage({ type: 'success', text: 'Button link updated.' });
  };

  // ─── Assets ───────────────────────────────────────────────────────────────

  const handleUploadAsset = async (file: File) => {
    try {
      setUploadingAsset(true);
      setMessage(null);
      const token = await getAccessToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/email-assets', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success || !payload.data?.asset) throw new Error(payload.error || 'Upload failed');
      setEmailAssets(prev => [payload.data.asset, ...prev]);
      setMessage({ type: 'success', text: 'Asset uploaded.' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setUploadingAsset(false);
      if (assetInputRef.current) assetInputRef.current.value = '';
    }
  };

  const insertAssetImage = (asset: EmailAsset, forTemplate: boolean) => {
    if (forTemplate) {
      if (templateEditorMode === 'html') { insertTemplateSnippet(`<img src="${asset.file_url}" alt="${asset.name}" />`); return; }
      templateEditorRef.current?.insertImage(asset.file_url, asset.name);
    } else {
      if (campaignEditorMode === 'html') { insertCampaignSnippet(`<img src="${asset.file_url}" alt="${asset.name}" />`); return; }
      campaignEditorRef.current?.insertImage(asset.file_url, asset.name);
    }
  };

  const insertAssetLink = (asset: EmailAsset, forTemplate: boolean) => {
    const snippet = `<a href="${asset.file_url}" target="_blank" rel="noopener noreferrer">${asset.name}</a>`;
    if (forTemplate) {
      if (templateEditorMode === 'html') { insertTemplateSnippet(snippet); return; }
      templateEditorRef.current?.insertLink(asset.file_url, asset.name);
    } else {
      if (campaignEditorMode === 'html') { insertCampaignSnippet(snippet); return; }
      campaignEditorRef.current?.insertLink(asset.file_url, asset.name);
    }
  };

  const copyAssetUrl = async (asset: EmailAsset) => {
    try {
      await navigator.clipboard.writeText(asset.file_url);
      setMessage({ type: 'success', text: `Copied URL for "${asset.name}"` });
    } catch {
      setMessage({ type: 'error', text: 'Failed to copy URL' });
    }
  };

  // ─── Header/Footer ─────────────────────────────────────────────────────────

  const handleHeaderSave = async () => {
    try {
      setHeaderSaving(true);
      setMessage(null);
      const { data: userResult } = await supabase.auth.getUser();
      if (!userResult.user?.id) throw new Error('Not authenticated');
      const payload = {
        email_header_title: header.email_header_title.trim() || defaultHeader.email_header_title,
        email_header_tagline: header.email_header_tagline.trim() || defaultHeader.email_header_tagline,
        email_header_image_url: header.email_header_image_url || null,
        email_footer_text: header.email_footer_text.trim() || defaultHeader.email_footer_text,
        email_footer_image_url: header.email_footer_image_url || null,
        email_greeting: header.email_greeting.trim() || defaultHeader.email_greeting,
        updated_by: userResult.user.id,
      };
      if (siteSettingsId) {
        const { error } = await supabase.from('site_settings').update(payload).eq('id', siteSettingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('site_settings').insert(payload).select('id').single();
        if (error) throw error;
        setSiteSettingsId(data?.id ?? null);
      }
      setHeaderOriginal({ ...header });
      setMessage({ type: 'success', text: 'Email header and footer saved.' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save header' });
    } finally {
      setHeaderSaving(false);
    }
  };

  const handleImageUpload = async (file: File, slot: 'header' | 'footer') => {
    const setter = slot === 'header' ? setUploadingHeaderImage : setUploadingFooterImage;
    setter(true);
    setMessage(null);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
      if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.');
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `site/email-assets/${slot}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('photos').upload(path, file, {
        cacheControl: '3600', upsert: true, contentType: file.type,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('photos').getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('Could not get public URL.');
      slot === 'header'
        ? setHeader(p => ({ ...p, email_header_image_url: data.publicUrl }))
        : setHeader(p => ({ ...p, email_footer_image_url: data.publicUrl }));
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setter(false);
      if (slot === 'header' && headerImgRef.current) headerImgRef.current.value = '';
      if (slot === 'footer' && footerImgRef.current) footerImgRef.current.value = '';
    }
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const filteredMembers = members.filter(m =>
    !memberSearch.trim() || getMemberDisplayName(m).toLowerCase().includes(memberSearch.toLowerCase())
  );

  const filteredTestMembers = members.filter(m =>
    !testMemberSearch.trim() || getMemberDisplayName(m).toLowerCase().includes(testMemberSearch.toLowerCase())
  );

  const filteredTemplatePicker = templates.filter(t =>
    !templatePickerSearch.trim() ||
    [t.name, t.subject, t.description].some(s => s.toLowerCase().includes(templatePickerSearch.toLowerCase()))
  );

  const filteredAssets = emailAssets.filter(a =>
    !emailAssetSearch.trim() ||
    [a.name, a.path, a.file_url].some(s => s.toLowerCase().includes(emailAssetSearch.toLowerCase()))
  );

  const richTemplateBlocks = useMemo(
    () => templateEditorMode === 'rich' ? getRichTemplateBlocks(templateForm.body) : [],
    [templateEditorMode, templateForm.body]
  );

  const richCampaignBlocks = useMemo(
    () => campaignEditorMode === 'rich' ? getRichTemplateBlocks(campaignForm.body) : [],
    [campaignEditorMode, campaignForm.body]
  );

  const drafts = campaigns.filter(c => c.status === 'draft');
  const sent = campaigns.filter(c => c.status === 'sent');
  const headerChanged = JSON.stringify(header) !== JSON.stringify(headerOriginal);
  const isEditingTemplate = editingTemplateId !== null || templateForm.body !== '' || templateForm.name !== '';

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>;
  }

  // ─── Asset library panel (shared) ─────────────────────────────────────────

  const AssetLibraryPanel = ({ forTemplate }: { forTemplate: boolean }) => (
    <CollapsibleSection title="Image & Asset Library" icon={ImagePlus}>
      <div className="flex items-center justify-between gap-2">
        <input
          ref={assetInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void handleUploadAsset(f); }}
        />
        <Button size="sm" variant="outline" isLoading={uploadingAsset} onClick={() => assetInputRef.current?.click()}>
          <ImagePlus className="w-3.5 h-3.5" /> Upload Image
        </Button>
        <input
          type="text" value={emailAssetSearch} onChange={e => setEmailAssetSearch(e.target.value)}
          placeholder="Search assets..." className="flex-1 min-w-0 rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-3 py-1.5 text-xs text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
        />
      </div>
      <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5">
        {filteredAssets.length === 0 && <p className="text-xs text-brand-cream/50 py-2">No assets yet.</p>}
        {filteredAssets.map(asset => (
          <div key={asset.path} className="rounded-lg border border-brand-brown/15 bg-brand-dark-grey/30 p-2">
            <div className="flex gap-2">
              {isImageAsset(asset) ? (
                <img src={asset.file_url} alt={asset.name} className="h-10 w-10 rounded object-cover border border-brand-brown/20 shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded border border-brand-brown/20 bg-brand-dark-grey/70 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-brand-cream truncate">{asset.name}</p>
                <p className="text-[11px] text-brand-cream/50">{formatBytes(asset.file_size)}</p>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button onClick={() => void copyAssetUrl(asset)} className="px-2 py-0.5 text-[11px] rounded border border-brand-brown/20 text-brand-cream/70 hover:text-brand-cream hover:border-brand-brown/40 transition-colors">Copy URL</button>
              {isImageAsset(asset) && (
                <>
                  <button onClick={() => insertAssetImage(asset, forTemplate)} className="px-2 py-0.5 text-[11px] rounded border border-brand-brown/20 text-brand-cream/70 hover:text-brand-cream hover:border-brand-brown/40 transition-colors">Insert Image</button>
                  <button
                    onClick={() => {
                      setHeader(p => ({ ...p, email_header_image_url: asset.file_url }));
                      setMessage({ type: 'success', text: 'Header logo staged — go to Header & Footer tab to save.' });
                    }}
                    className="px-2 py-0.5 text-[11px] rounded border border-brand-brown/20 text-brand-cream/70 hover:text-brand-cream hover:border-brand-brown/40 transition-colors"
                  >Set as Logo</button>
                </>
              )}
              <button onClick={() => insertAssetLink(asset, forTemplate)} className="px-2 py-0.5 text-[11px] rounded border border-brand-brown/20 text-brand-cream/70 hover:text-brand-cream hover:border-brand-brown/40 transition-colors">Insert Link</button>
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream mb-2">Email</h1>
        <p className="text-brand-cream/70">Compose campaigns, build templates, and manage email branding.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-brand-brown/20">
        {([
          { id: 'campaigns', label: 'Campaigns', icon: Mail },
          { id: 'templates', label: 'Templates', icon: BookTemplate },
          { id: 'header', label: 'Header & Footer', icon: Layout },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setMessage(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-brand-brown text-brand-brown'
                : 'border-transparent text-brand-cream/60 hover:text-brand-cream hover:border-brand-brown/40'
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* Message banner */}
      {message && (
        <Card className={message.type === 'error' ? 'border border-red-500/40' : 'border border-green-500/40'}>
          <CardContent className={`py-3 flex items-center justify-between ${message.type === 'error' ? 'text-red-300' : 'text-green-300'}`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)}><X className="w-4 h-4 opacity-60 hover:opacity-100" /></button>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════ CAMPAIGNS */}
      {activeTab === 'campaigns' && (
        <>
          {/* Send confirmation modal */}
          {confirmSend && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <div className="bg-[#1a1a1a] border border-brand-brown/30 rounded-xl p-6 max-w-md w-full space-y-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-brand-brown shrink-0" />
                  <h2 className="text-lg font-semibold text-brand-cream">Send Campaign?</h2>
                </div>
                <p className="text-sm text-brand-cream/70">
                  <strong className="text-brand-cream">{confirmSend.subject}</strong> will be emailed to all targeted members. This cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => setConfirmSend(null)}>Cancel</Button>
                  <Button onClick={() => handleSendCampaign(confirmSend)} isLoading={sendingId === confirmSend.id}>
                    <Send className="w-4 h-4" /> Yes, Send Now
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Test Send Modal ─────────────────────────────────────────────── */}
          {testSendModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
              <div className="bg-[#1a1a1a] border border-brand-brown/30 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Send className="w-5 h-5 text-violet-400 shrink-0" />
                    <h2 className="text-lg font-semibold text-brand-cream">Send Test Email</h2>
                  </div>
                  <button type="button" onClick={() => setTestSendModal(null)} className="text-brand-cream/50 hover:text-brand-cream">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="rounded-lg border border-violet-700/30 bg-violet-900/15 px-4 py-3 text-sm text-violet-300/90">
                  A copy of <strong className="text-violet-200">{testSendModal.subject}</strong> will be sent with a{' '}
                  <code className="text-[11px] bg-violet-900/40 px-1.5 py-0.5 rounded">[TEST]</code> prefix and a preview banner.
                  Campaign status stays draft and no deliveries are recorded.
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-brand-cream/90">Send to</p>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-brand-cream/50 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={testMemberSearch}
                      onChange={e => setTestMemberSearch(e.target.value)}
                      placeholder="Search riders..."
                      className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 py-2 pl-9 pr-4 text-sm text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-2 space-y-0.5">
                    {filteredTestMembers.length === 0 && (
                      <p className="text-xs text-brand-cream/50 py-2 px-1">No riders found.</p>
                    )}
                    {filteredTestMembers.map(member => {
                      const sel = testMemberIds.includes(member.id);
                      return (
                        <label
                          key={member.id}
                          className="flex items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-brand-dark-grey/60 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-brand-cream/90 truncate">{getMemberDisplayName(member)}</p>
                            {member.email && <p className="text-xs text-brand-cream/45 truncate">{member.email}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setTestMemberIds(prev =>
                                sel ? prev.filter(id => id !== member.id) : [...prev, member.id]
                              )
                            }
                            className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              sel
                                ? 'border-violet-500 bg-violet-600 text-white'
                                : 'border-brand-brown/30 hover:border-violet-500/50'
                            }`}
                          >
                            {sel && <Check className="w-3 h-3" />}
                          </button>
                        </label>
                      );
                    })}
                  </div>

                  {/* Selected chips */}
                  {testMemberIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {testMemberIds.map(id => {
                        const m = members.find(x => x.id === id);
                        if (!m) return null;
                        return (
                          <span
                            key={id}
                            className="flex items-center gap-1 rounded-full bg-violet-800/40 border border-violet-600/40 px-2.5 py-0.5 text-xs text-violet-200"
                          >
                            {getMemberDisplayName(m)}
                            <button
                              type="button"
                              onClick={() => setTestMemberIds(prev => prev.filter(x => x !== id))}
                              className="text-violet-300/60 hover:text-violet-200"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-brand-cream/45">
                    {testMemberIds.length === 0
                      ? 'Select at least one rider above.'
                      : `${testMemberIds.length} rider${testMemberIds.length !== 1 ? 's' : ''} selected · max 10`}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setTestSendModal(null)}>Cancel</Button>
                    <Button
                      onClick={handleTestSend}
                      isLoading={sendingTest}
                      disabled={testMemberIds.length === 0}
                      className="bg-violet-700 hover:bg-violet-600 border-violet-600"
                    >
                      <Send className="w-3.5 h-3.5" /> Send Test
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[58%_42%] gap-6 items-start">

            {/* ── Compose / Edit panel ────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {editingCampaignId ? <Edit2 className="w-5 h-5 text-brand-brown" /> : <Plus className="w-5 h-5 text-brand-brown" />}
                  {editingCampaignId ? 'Edit Campaign' : 'Compose Email'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Load template */}
                {templates.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowTemplatePicker(p => !p)}
                      className="flex items-center gap-2 text-sm text-brand-brown hover:text-brand-brown/80 transition-colors"
                    >
                      <BookTemplate className="w-4 h-4" />
                      Load from template
                      <ChevronDown className={`w-4 h-4 transition-transform ${showTemplatePicker ? 'rotate-180' : ''}`} />
                    </button>
                    {showTemplatePicker && (
                      <div className="absolute top-8 left-0 z-20 w-full sm:w-96 rounded-xl border border-brand-brown/30 bg-[#1a1a1a] shadow-2xl">
                        <div className="p-3 border-b border-brand-brown/20">
                          <input
                            type="text" value={templatePickerSearch}
                            onChange={e => setTemplatePickerSearch(e.target.value)}
                            placeholder="Search templates..." autoFocus
                            className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-3 py-1.5 text-sm text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto divide-y divide-brand-brown/10">
                          {filteredTemplatePicker.length === 0 && <p className="px-4 py-3 text-sm text-brand-cream/50">No templates found.</p>}
                          {filteredTemplatePicker.map(t => (
                            <button key={t.id} type="button" onClick={() => handleLoadTemplate(t)}
                              className="w-full text-left px-4 py-3 hover:bg-brand-dark-grey/50 transition-colors">
                              <p className="text-sm font-medium text-brand-cream">{t.name}</p>
                              {t.description && <p className="text-xs text-brand-cream/50 mt-0.5">{t.description}</p>}
                              <p className="text-xs text-brand-cream/40 mt-0.5 truncate">Subject: {t.subject}</p>
                            </button>
                          ))}
                        </div>
                        <div className="p-2 border-t border-brand-brown/20 text-right">
                          <button type="button" onClick={() => setShowTemplatePicker(false)} className="text-xs text-brand-cream/50 hover:text-brand-cream px-2 py-1">Close</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Subject */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-brand-cream/90">Subject line</label>
                  <input
                    type="text" value={campaignForm.subject}
                    onChange={e => setCampaignForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder="e.g. Morocco 2027 – Important Update"
                    className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                  />
                </div>

                {/* Body editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-sm font-medium text-brand-cream/90">Email Body</label>
                    <EditorModeToggle mode={campaignEditorMode} onSwitch={switchCampaignMode} />
                  </div>

                  {/* Builder toolbar (visual mode only) */}
                  {campaignEditorMode === 'rich' && (
                    <CollapsibleSection title="Insert Blocks" icon={Paintbrush} defaultOpen={false}>
                      <BlockInsertBar
                        onHero={campaignInsert.hero} onText={campaignInsert.text}
                        onButton={campaignInsert.button} onColumns={campaignInsert.columns}
                        onDivider={campaignInsert.divider} onLogo={campaignInsert.logo}
                      />
                      <ColorControls
                        emailBg={richEmailBgColor} sectionBg={richSectionBgColor}
                        blockBg={richBlockBgColor} buttonBg={richButtonBgColor}
                        buttonTextColor={richButtonTextColor} buttonLink={richButtonLink}
                        onEmailBg={setRichEmailBgColor} onSectionBg={setRichSectionBgColor}
                        onBlockBg={setRichBlockBgColor} onButtonBg={setRichButtonBgColor}
                        onButtonTextColor={setRichButtonTextColor} onButtonLink={setRichButtonLink}
                        onApplyEmail={() => {
                          setCampaignForm(p => ({ ...p, body: applyRichEmailCanvasBackground(p.body, richEmailBgColor) }));
                          setMessage({ type: 'success', text: 'Email background updated.' });
                        }}
                        onApplySection={() => applyClosestStyle(campaignEditorRef, '[data-email-section="true"]', { 'background-color': richSectionBgColor }, 'section')}
                        onApplyBlock={() => applyClosestStyle(campaignEditorRef, '[data-email-block="true"]', { 'background-color': richBlockBgColor }, 'block')}
                        onApplyButton={() => applyClosestStyle(campaignEditorRef, '[data-email-button="true"]', { 'background-color': richButtonBgColor }, 'button')}
                        onApplyButtonText={() => applyClosestStyle(campaignEditorRef, '[data-email-button="true"]', { 'color': richButtonTextColor }, 'button text')}
                        onApplyButtonLink={() => applyButtonHref(campaignEditorRef, richButtonLink)}
                      />
                    </CollapsibleSection>
                  )}

                  {/* Merge tags — always visible in both modes */}
                  <CollapsibleSection title="Personalisation" icon={Hash} defaultOpen={false}>
                    <MergeTagsPanel onInsert={insertCampaignMergeTag} />
                  </CollapsibleSection>

                  {campaignEditorMode === 'rich' ? (
                    <RichTextEditor
                      ref={campaignEditorRef}
                      value={campaignForm.body}
                      onChange={v => setCampaignForm(p => ({ ...p, body: v }))}
                      placeholder="Write your email content here..."
                    />
                  ) : (
                    <textarea
                      ref={campaignHtmlRef}
                      value={campaignForm.body}
                      onChange={e => setCampaignForm(p => ({ ...p, body: e.target.value }))}
                      rows={18} spellCheck={false}
                      className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-3 text-brand-cream font-mono text-xs leading-relaxed focus:border-brand-brown focus:outline-none resize-y"
                      placeholder="Paste or write full email HTML..."
                    />
                  )}
                  <p className="text-xs text-brand-cream/45">
                    {campaignEditorMode === 'html'
                      ? 'HTML mode: full-email HTML (with <!DOCTYPE>) is sent as-is. Without it, branded header/footer are added automatically.'
                      : 'Visual mode: branded header/footer wrap your content automatically when sent.'}
                  </p>
                </div>

                {/* Block order (visual mode only) */}
                {campaignEditorMode === 'rich' && (
                  <CollapsibleSection title="Block Order (Drag & Drop)" icon={Layout} defaultOpen={richCampaignBlocks.length > 0}>
                    <BlockOrderPanel
                      blocks={richCampaignBlocks}
                      draggingId={draggingBlockId}
                      dropTargetId={dropTargetBlockId}
                      onDragStart={id => setDraggingBlockId(id)}
                      onDragEnter={id => setDropTargetBlockId(id)}
                      onDragLeave={() => setDropTargetBlockId(null)}
                      onDrop={targetId => {
                        if (draggingBlockId) handleReorderCampaignBlock(draggingBlockId, targetId);
                        setDropTargetBlockId(null);
                        setDraggingBlockId(null);
                      }}
                      onDragEnd={() => { setDraggingBlockId(null); setDropTargetBlockId(null); }}
                      onMoveUp={index => {
                        const prev = richCampaignBlocks[index - 1];
                        if (prev) handleReorderCampaignBlock(richCampaignBlocks[index].id, prev.id);
                      }}
                      onMoveDown={index => {
                        const next = richCampaignBlocks[index + 1];
                        if (next) handleReorderCampaignBlock(richCampaignBlocks[index].id, next.id);
                      }}
                    />
                  </CollapsibleSection>
                )}

                {/* Asset library */}
                <AssetLibraryPanel forTemplate={false} />

                {/* Recipients */}
                <CollapsibleSection title="Recipients" icon={Users} defaultOpen={true}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 px-3 py-2">
                      <input type="checkbox" checked={campaignForm.is_global}
                        onChange={e => setCampaignForm(p => ({ ...p, is_global: e.target.checked, trip_ids: e.target.checked ? [] : p.trip_ids }))}
                        className="h-4 w-4 rounded border-brand-brown/40 bg-brand-dark-grey" />
                      <span className="text-sm text-brand-cream/80">Not trip-specific</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 px-3 py-2">
                      <input type="checkbox" checked={campaignForm.tag_all_members}
                        onChange={e => setCampaignForm(p => ({ ...p, tag_all_members: e.target.checked, member_ids: e.target.checked ? [] : p.member_ids }))}
                        className="h-4 w-4 rounded border-brand-brown/40 bg-brand-dark-grey" />
                      <span className="text-sm text-brand-cream/80">All Members</span>
                    </label>
                  </div>

                  {/* Trips */}
                  <div>
                    <p className="text-xs font-medium text-brand-cream/70 mb-1.5">Target Trips</p>
                    <div className={`max-h-32 overflow-y-auto rounded-lg border border-brand-brown/20 p-2 space-y-1 ${campaignForm.is_global ? 'opacity-50 pointer-events-none' : 'bg-brand-dark-grey/30'}`}>
                      {trips.length === 0 && <p className="text-xs text-brand-cream/50 py-1 px-1">No trips yet.</p>}
                      {trips.map(trip => {
                        const sel = campaignForm.trip_ids.includes(trip.id);
                        return (
                          <label key={trip.id} className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-brand-dark-grey/60 cursor-pointer">
                            <span className="text-sm text-brand-cream/80 truncate">{trip.name}</span>
                            <button type="button"
                              onClick={() => setCampaignForm(p => ({ ...p, trip_ids: toggleId(p.trip_ids, trip.id) }))}
                              className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${sel ? 'border-brand-brown bg-brand-brown text-white' : 'border-brand-brown/30'}`}>
                              {sel && <Check className="w-3 h-3" />}
                            </button>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Members */}
                  <div>
                    <p className="text-xs font-medium text-brand-cream/70 mb-1.5">Target Specific Riders</p>
                    <div className="relative mb-1.5">
                      <Search className="w-3.5 h-3.5 text-brand-cream/50 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input type="text" value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                        placeholder="Search riders..."
                        className={`w-full rounded-lg border border-brand-brown/20 py-2 pl-9 pr-4 text-sm text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none ${campaignForm.tag_all_members ? 'opacity-50 pointer-events-none bg-brand-dark-grey/20' : 'bg-brand-dark-grey/50'}`}
                      />
                    </div>
                    <div className={`max-h-44 overflow-y-auto rounded-lg border border-brand-brown/20 p-2 space-y-1 ${campaignForm.tag_all_members ? 'opacity-50 pointer-events-none' : 'bg-brand-dark-grey/30'}`}>
                      {filteredMembers.map(member => {
                        const sel = campaignForm.member_ids.includes(member.id);
                        return (
                          <label key={member.id} className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-brand-dark-grey/60 cursor-pointer">
                            <span className="text-sm text-brand-cream/80 truncate">{getMemberDisplayName(member)}</span>
                            <button type="button"
                              onClick={() => setCampaignForm(p => ({ ...p, member_ids: toggleId(p.member_ids, member.id) }))}
                              className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${sel ? 'border-brand-brown bg-brand-brown text-white' : 'border-brand-brown/30'}`}>
                              {sel && <Check className="w-3 h-3" />}
                            </button>
                          </label>
                        );
                      })}
                    </div>
                    {campaignForm.tag_all_members && <p className="text-xs text-brand-cream/50 mt-1">Sending to every active member account.</p>}
                  </div>
                </CollapsibleSection>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button onClick={handleCampaignSave} isLoading={campaignSaving} variant="outline">
                    <Check className="w-4 h-4" /> Save Draft
                  </Button>
                  {editingCampaignId && (() => {
                    const draft = campaigns.find(c => c.id === editingCampaignId);
                    return draft ? (
                      <Button
                        variant="ghost"
                        onClick={() => openTestSendModal(draft)}
                        className="border border-violet-700/40 text-violet-300 hover:bg-violet-900/30 hover:text-violet-200"
                      >
                        <Send className="w-4 h-4" /> Send Test
                      </Button>
                    ) : null;
                  })()}
                  {editingCampaignId && (
                    <Button variant="ghost" onClick={resetCampaignForm}><X className="w-4 h-4" /> Cancel</Button>
                  )}
                </div>
                <p className="text-xs text-brand-cream/45">Save as draft, review in the list, then send when ready.</p>

              </CardContent>
            </Card>

            {/* ── Campaign list ───────────────────────────────────────────── */}
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-brand-brown" />
                    Drafts ({drafts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {drafts.length === 0 && <p className="text-sm text-brand-cream/60 py-3">No drafts yet.</p>}
                  {drafts.map(c => (
                    <div key={c.id} className="rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-4 space-y-3">
                      <div>
                        <p className="font-semibold text-brand-cream truncate">{c.subject}</p>
                        <p className="text-xs text-brand-cream/55 mt-1">
                          {formatDate(c.created_at)}
                          {c.is_global && ' · General'}
                          {c.tag_all_members && ' · All Members'}
                          {c.trip_tags.length > 0 && ` · ${c.trip_tags.map(t => t.name).join(', ')}`}
                          {c.member_tags.length > 0 && ` · ${c.member_tags.length} rider${c.member_tags.length !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setConfirmSend(c)} isLoading={sendingId === c.id}>
                          <Send className="w-3.5 h-3.5" /> Send Now
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openTestSendModal(c)}
                          className="border border-violet-700/40 text-violet-300 hover:bg-violet-900/30 hover:text-violet-200"
                        >
                          <Send className="w-3.5 h-3.5" /> Test
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCampaignEdit(c)}>
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleCampaignDelete(c)} isLoading={deletingCampaignId === c.id}>
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-brown" />
                    Sent ({sent.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sent.length === 0 && <p className="text-sm text-brand-cream/60 py-3">No campaigns sent yet.</p>}
                  {sent.map(c => (
                    <div key={c.id} className="rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-4 space-y-2">
                      <p className="font-semibold text-brand-cream truncate">{c.subject}</p>
                      <p className="text-xs text-brand-cream/55">
                        Sent {formatDate(c.sent_at)}
                        {c.tag_all_members && ' · All Members'}
                        {c.trip_tags.length > 0 && ` · ${c.trip_tags.map(t => t.name).join(', ')}`}
                        {c.member_tags.length > 0 && ` · ${c.member_tags.length} rider${c.member_tags.length !== 1 ? 's' : ''}`}
                      </p>
                      <Button size="sm" variant="danger" onClick={() => handleCampaignDelete(c)} isLoading={deletingCampaignId === c.id}>
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════ TEMPLATES */}
      {activeTab === 'templates' && (
        <>
          {/* Preview modal for saved templates */}
          {previewTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 overflow-y-auto">
              <div className="bg-[#1a1a1a] border border-brand-brown/30 rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-brand-brown/20 shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold text-brand-cream">{previewTemplate.name}</h2>
                    <p className="text-xs text-brand-cream/55 mt-0.5">Subject: {previewTemplate.subject}</p>
                  </div>
                  <button onClick={() => setPreviewTemplate(null)} className="text-brand-cream/60 hover:text-brand-cream">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 p-6">
                  <LiveEmailPreview body={previewTemplate.body} mode={detectEditorMode(previewTemplate.body)} header={header} />
                </div>
                <div className="px-6 py-4 border-t border-brand-brown/20 shrink-0 flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => setPreviewTemplate(null)}>Close</Button>
                  <Button variant="outline" onClick={() => handleTemplateEdit(previewTemplate)}>
                    <Edit2 className="w-4 h-4" /> Edit Template
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className={`grid gap-6 items-start ${isEditingTemplate ? 'grid-cols-1 xl:grid-cols-[55%_45%]' : 'grid-cols-1 xl:grid-cols-2'}`}>

            {/* ── Template editor ─────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="flex items-center gap-2">
                    {editingTemplateId ? <Edit2 className="w-5 h-5 text-brand-brown" /> : <Plus className="w-5 h-5 text-brand-brown" />}
                    {editingTemplateId ? 'Edit Template' : 'New Template'}
                  </CardTitle>
                  {isEditingTemplate && (
                    <button
                      type="button"
                      onClick={() => setShowLivePreview(p => !p)}
                      className="flex items-center gap-1.5 text-xs text-brand-cream/60 hover:text-brand-cream transition-colors"
                    >
                      {showLivePreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showLivePreview ? 'Hide preview' : 'Show preview'}
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Name + description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-brand-cream/90">Template name</label>
                    <input type="text" value={templateForm.name}
                      onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Welcome to the Ride"
                      className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-3 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-brand-cream/90">
                      Description <span className="text-brand-cream/40 font-normal">(optional)</span>
                    </label>
                    <input type="text" value={templateForm.description}
                      onChange={e => setTemplateForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="e.g. Used for new member emails"
                      className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-3 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-brand-cream/90">Default subject line</label>
                  <input type="text" value={templateForm.subject}
                    onChange={e => setTemplateForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder="e.g. Welcome to The Whiskey Riders"
                    className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                  />
                  <p className="text-xs text-brand-cream/45">Editable when loaded into a campaign.</p>
                </div>

                {/* Body editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-sm font-medium text-brand-cream/90">Body</label>
                    <EditorModeToggle mode={templateEditorMode} onSwitch={switchTemplateMode} />
                  </div>

                  {/* Builder toolbar */}
                  {templateEditorMode === 'rich' && (
                    <CollapsibleSection title="Insert Blocks" icon={Paintbrush} defaultOpen={true}>
                      <BlockInsertBar
                        onHero={templateInsert.hero} onText={templateInsert.text}
                        onButton={templateInsert.button} onColumns={templateInsert.columns}
                        onDivider={templateInsert.divider} onLogo={templateInsert.logo}
                      />
                      <ColorControls
                        emailBg={richEmailBgColor} sectionBg={richSectionBgColor}
                        blockBg={richBlockBgColor} buttonBg={richButtonBgColor}
                        buttonTextColor={richButtonTextColor} buttonLink={richButtonLink}
                        onEmailBg={setRichEmailBgColor} onSectionBg={setRichSectionBgColor}
                        onBlockBg={setRichBlockBgColor} onButtonBg={setRichButtonBgColor}
                        onButtonTextColor={setRichButtonTextColor} onButtonLink={setRichButtonLink}
                        onApplyEmail={applyEmailBg}
                        onApplySection={() => applyClosestStyle(templateEditorRef, '[data-email-section="true"]', { 'background-color': richSectionBgColor }, 'section')}
                        onApplyBlock={() => applyClosestStyle(templateEditorRef, '[data-email-block="true"]', { 'background-color': richBlockBgColor }, 'block')}
                        onApplyButton={() => applyClosestStyle(templateEditorRef, '[data-email-button="true"]', { 'background-color': richButtonBgColor }, 'button')}
                        onApplyButtonText={() => applyClosestStyle(templateEditorRef, '[data-email-button="true"]', { 'color': richButtonTextColor }, 'button text')}
                        onApplyButtonLink={() => applyButtonHref(templateEditorRef, richButtonLink)}
                      />
                    </CollapsibleSection>
                  )}

                  {/* Merge tags — always visible in both modes */}
                  <CollapsibleSection title="Personalisation" icon={Hash} defaultOpen={false}>
                    <MergeTagsPanel onInsert={insertTemplateMergeTag} />
                  </CollapsibleSection>

                  {templateEditorMode === 'rich' ? (
                    <RichTextEditor
                      ref={templateEditorRef}
                      value={templateForm.body}
                      onChange={v => setTemplateForm(p => ({ ...p, body: v }))}
                      placeholder="Write your template content here..."
                    />
                  ) : (
                    <textarea
                      ref={templateHtmlRef}
                      value={templateForm.body}
                      onChange={e => setTemplateForm(p => ({ ...p, body: e.target.value }))}
                      rows={22} spellCheck={false}
                      className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-3 text-brand-cream font-mono text-xs leading-relaxed focus:border-brand-brown focus:outline-none resize-y"
                      placeholder="Paste or write full template HTML..."
                    />
                  )}
                  <p className="text-xs text-brand-cream/45">
                    {templateEditorMode === 'html'
                      ? 'HTML mode: full control over every element, inline styles, and structure.'
                      : 'Visual mode: insert blocks, reorder them, and style with the tools above.'}
                  </p>
                </div>

                {/* Block order (visual mode only) */}
                {templateEditorMode === 'rich' && (
                  <CollapsibleSection title="Block Order (Drag & Drop)" icon={Layout} defaultOpen={richTemplateBlocks.length > 0}>
                    <BlockOrderPanel
                      blocks={richTemplateBlocks}
                      draggingId={draggingBlockId}
                      dropTargetId={dropTargetBlockId}
                      onDragStart={id => setDraggingBlockId(id)}
                      onDragEnter={id => setDropTargetBlockId(id)}
                      onDragLeave={() => setDropTargetBlockId(null)}
                      onDrop={targetId => {
                        if (draggingBlockId) handleReorderBlock(draggingBlockId, targetId);
                        setDropTargetBlockId(null);
                        setDraggingBlockId(null);
                      }}
                      onDragEnd={() => { setDraggingBlockId(null); setDropTargetBlockId(null); }}
                      onMoveUp={index => {
                        const prev = richTemplateBlocks[index - 1];
                        if (prev) handleReorderBlock(richTemplateBlocks[index].id, prev.id);
                      }}
                      onMoveDown={index => {
                        const next = richTemplateBlocks[index + 1];
                        if (next) handleReorderBlock(richTemplateBlocks[index].id, next.id);
                      }}
                    />
                  </CollapsibleSection>
                )}

                {/* Asset library */}
                <AssetLibraryPanel forTemplate={true} />

                {/* Save actions */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-brand-brown/10">
                  <Button onClick={handleTemplateSave} isLoading={templateSaving}>
                    <Check className="w-4 h-4" />
                    {editingTemplateId ? 'Update Template' : 'Save Template'}
                  </Button>
                  {(editingTemplateId || templateForm.name || templateForm.body) && (
                    <Button variant="ghost" onClick={resetTemplateForm}><X className="w-4 h-4" /> Cancel</Button>
                  )}
                </div>

              </CardContent>
            </Card>

            {/* ── Right column: live preview when editing, list otherwise ─── */}
            {isEditingTemplate && showLivePreview ? (
              <div className="xl:sticky xl:top-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Eye className="w-4 h-4 text-brand-brown" />
                      Live Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LiveEmailPreview body={templateForm.body} mode={templateEditorMode} header={header} />
                    <p className="text-xs text-brand-cream/40 mt-2 text-center">Updates as you type</p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-brand-brown" />
                    Saved Templates ({templates.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {templates.length === 0 && (
                    <p className="text-sm text-brand-cream/60 py-4">No templates yet. Create one to get started.</p>
                  )}
                  {templates.map(template => {
                    const creatorName = template.creator
                      ? getMemberDisplayName(template.creator as { full_name: string | null; nickname: string | null; avatar_url?: string | null; status?: string })
                      : null;
                    return (
                      <div key={template.id} className="rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-4 space-y-3">
                        <div>
                          <p className="font-semibold text-brand-cream">{template.name}</p>
                          {template.description && <p className="text-sm text-brand-cream/60 mt-0.5">{template.description}</p>}
                          <p className="text-xs text-brand-cream/40 mt-1">Subject: <span className="text-brand-cream/60">{template.subject}</span></p>
                          <p className="text-xs text-brand-cream/40 mt-0.5">
                            {creatorName ? `By ${creatorName} · ` : ''}Updated {formatDateShort(template.updated_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => setPreviewTemplate(template)}>
                            <Eye className="w-3.5 h-3.5" /> Preview
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleTemplateEdit(template)}>
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleTemplateDelete(template)} isLoading={deletingTemplateId === template.id}>
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════ HEADER & FOOTER TAB */}
      {activeTab === 'header' && (
        <div className="max-w-2xl space-y-6">

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="w-5 h-5 text-brand-brown" />
                Email Header
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-brand-cream/60">
                The branded banner that appears at the top of every rich-text email.
              </p>

              {/* Logo upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-brand-cream/90">Logo / Image</label>
                {header.email_header_image_url && (
                  <div className="flex items-center gap-3 rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-3">
                    <img src={header.email_header_image_url} alt="Header" className="h-10 w-auto max-w-[140px] object-contain rounded" />
                    <button type="button" onClick={() => setHeader(p => ({ ...p, email_header_image_url: null }))}
                      className="ml-auto text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                )}
                <input ref={headerImgRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleImageUpload(f, 'header'); }} />
                <Button variant="outline" size="sm" isLoading={uploadingHeaderImage} onClick={() => headerImgRef.current?.click()}>
                  <ImagePlus className="w-4 h-4" />
                  {header.email_header_image_url ? 'Replace image' : 'Upload image'}
                </Button>
                <p className="text-xs text-brand-cream/40">PNG, JPG, SVG — max 5 MB.</p>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-brand-cream/90">Title</label>
                <input type="text" value={header.email_header_title}
                  onChange={e => setHeader(p => ({ ...p, email_header_title: e.target.value }))}
                  placeholder="The Whiskey Riders"
                  className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                />
              </div>

              {/* Tagline */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-brand-cream/90">Tagline</label>
                <input type="text" value={header.email_header_tagline}
                  onChange={e => setHeader(p => ({ ...p, email_header_tagline: e.target.value }))}
                  placeholder="Until We Ride"
                  className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                />
              </div>

              {/* Live preview */}
              <div className="rounded-lg overflow-hidden border border-brand-brown/30">
                <div className="bg-brand-brown px-6 py-4 text-center">
                  {header.email_header_image_url && (
                    <img src={header.email_header_image_url} alt="Header preview"
                      className="mx-auto mb-2 max-h-[64px] max-w-[220px] w-auto h-auto object-contain" />
                  )}
                  {header.email_header_title && (
                    <p className="text-white font-semibold tracking-widest text-xs uppercase">{header.email_header_title}</p>
                  )}
                  {header.email_header_tagline && (
                    <p className="text-white/70 text-xs tracking-wide mt-1">{header.email_header_tagline}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Greeting prefix */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand-brown" />
                Greeting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-brand-cream/60">
                The opening word used before each recipient&apos;s name — e.g. <span className="text-brand-cream/80 font-medium">&ldquo;Hi Andreas,&rdquo;</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-brand-cream/90">Greeting prefix</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={header.email_greeting}
                    onChange={e => setHeader(p => ({ ...p, email_greeting: e.target.value }))}
                    placeholder="Hi"
                    maxLength={30}
                    className="w-40 rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                  />
                  <span className="text-brand-cream/40 text-sm">[Recipient name],</span>
                </div>
                <p className="text-xs text-brand-cream/40">Appears as: <span className="text-brand-cream/60 italic">{header.email_greeting || 'Hi'} Andreas,</span></p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-brown" />
                Email Footer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-brand-cream/60">
                Appears at the bottom of every rich-text email.
              </p>

              {/* Footer image */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-brand-cream/90">Footer image <span className="text-brand-cream/40 font-normal">(optional)</span></label>
                {header.email_footer_image_url && (
                  <div className="flex items-center gap-3 rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-3">
                    <img src={header.email_footer_image_url} alt="Footer" className="h-8 w-auto max-w-[120px] object-contain rounded" />
                    <button type="button" onClick={() => setHeader(p => ({ ...p, email_footer_image_url: null }))}
                      className="ml-auto text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                )}
                <input ref={footerImgRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleImageUpload(f, 'footer'); }} />
                <Button variant="outline" size="sm" isLoading={uploadingFooterImage} onClick={() => footerImgRef.current?.click()}>
                  <ImagePlus className="w-4 h-4" />
                  {header.email_footer_image_url ? 'Replace image' : 'Upload image'}
                </Button>
                <p className="text-xs text-brand-cream/40">PNG, JPG, SVG — max 5 MB.</p>
              </div>

              {/* Footer text */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-brand-cream/90">Footer text</label>
                <textarea rows={3} value={header.email_footer_text}
                  onChange={e => setHeader(p => ({ ...p, email_footer_text: e.target.value }))}
                  placeholder="You're receiving this because you're a member of The Whiskey Riders."
                  className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none resize-none"
                />
              </div>

              {/* Footer preview */}
              <div className="rounded-lg overflow-hidden border border-brand-brown/30">
                <div className="bg-[#111] border-t border-brand-brown/20 px-6 py-4 text-center">
                  {header.email_footer_image_url && (
                    <img src={header.email_footer_image_url} alt="" className="mx-auto mb-2 max-h-[48px] max-w-[160px] w-auto h-auto object-contain" />
                  )}
                  <p className="text-[#666] text-xs">
                    {header.email_footer_text || "You're receiving this because you're a member of The Whiskey Riders."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Full preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-brand-cream/70">
                <Eye className="w-4 h-4 text-brand-brown" />
                Full Email Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden border border-brand-brown/30 text-sm">
                <div className="bg-brand-brown px-6 py-4 text-center">
                  {header.email_header_image_url && <img src={header.email_header_image_url} alt="" className="mx-auto mb-2 max-h-[64px] max-w-[220px] w-auto h-auto object-contain" />}
                  {header.email_header_title && <p className="text-white font-semibold tracking-widest text-xs uppercase">{header.email_header_title}</p>}
                  {header.email_header_tagline && <p className="text-white/70 text-xs tracking-wide mt-1">{header.email_header_tagline}</p>}
                </div>
                <div className="bg-[#111] px-6 py-6">
                  <p className="text-[#C9B98A] mb-3 text-sm">{header.email_greeting || 'Hi'} Rider,</p>
                  <p className="text-[#d4c9a8] text-sm leading-relaxed">Your email body content will appear here...</p>
                  <div className="mt-6 text-center">
                    <div className="inline-block bg-brand-brown text-white text-sm font-semibold px-7 py-3 rounded-lg">Visit the Portal</div>
                  </div>
                </div>
                <div className="bg-[#111] border-t border-brand-brown/20 px-6 py-4 text-center">
                  {header.email_footer_image_url && <img src={header.email_footer_image_url} alt="" className="mx-auto mb-2 max-h-[48px] max-w-[160px] w-auto h-auto object-contain" />}
                  <p className="text-[#666] text-xs">{header.email_footer_text || "You're receiving this because you're a member of The Whiskey Riders."}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleHeaderSave} isLoading={headerSaving} disabled={!headerChanged && !headerSaving}>
              <Check className="w-4 h-4" /> Save Changes
            </Button>
            {headerChanged && (
              <Button variant="ghost" onClick={() => setHeader({ ...headerOriginal })}>
                <X className="w-4 h-4" /> Reset
              </Button>
            )}
          </div>
          {!headerChanged && !headerSaving && (
            <p className="text-xs text-brand-cream/40">No unsaved changes.</p>
          )}
        </div>
      )}

    </div>
  );
}
