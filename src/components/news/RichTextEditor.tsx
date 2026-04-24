'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Strikethrough,
  Unlink,
  Underline,
} from 'lucide-react';
import { sanitizeLinkUrl, toEditorHtml, toSearchableNewsText } from '@/lib/news/content';

export interface RichTextEditorHandle {
  focus: () => void;
  insertImage: (url: string, alt?: string) => void;
  insertLink: (url: string, text?: string) => void;
  insertHtmlSnippet: (html: string) => void;
  applyStylesToClosest: (selector: string, styles: Record<string, string>) => boolean;
}

interface RichTextEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  onRequestInsertImage?: () => void;
}

interface ToolbarButtonProps {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarButton({ title, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="h-8 w-8 rounded border border-brand-brown/20 bg-brand-dark-grey/40 text-brand-cream/80 hover:bg-brand-dark-grey/80 hover:text-brand-cream flex items-center justify-center"
    >
      {children}
    </button>
  );
}

const DISALLOWED_EDITOR_TAGS = new Set([
  'style',
  'script',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'head',
  'html',
  'body',
  'title',
  'base',
  'form',
  'input',
  'textarea',
  'select',
  'option',
  'button',
]);

function sanitizeEditorSurfaceHtml(raw: string): string {
  if (typeof window === 'undefined') return raw;

  const parser = new DOMParser();
  const document = parser.parseFromString(`<div>${raw}</div>`, 'text/html');
  const wrapper = document.body.firstElementChild as HTMLElement | null;
  if (!wrapper) return '';

  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        node.removeChild(child);
        continue;
      }

      const element = child as HTMLElement;
      const tag = element.tagName.toLowerCase();
      if (DISALLOWED_EDITOR_TAGS.has(tag)) {
        const fragment = document.createDocumentFragment();
        while (element.firstChild) {
          fragment.appendChild(element.firstChild);
        }
        element.replaceWith(fragment);
        continue;
      }

      const attrs = Array.from(element.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) {
          element.removeAttribute(attr.name);
          continue;
        }

        if (name === 'href' || name === 'src') {
          const safe = sanitizeLinkUrl(attr.value || '');
          if (safe) {
            element.setAttribute(attr.name, safe);
          } else {
            element.removeAttribute(attr.name);
          }
        }
      }

      walk(element);
    }
  };

  walk(wrapper);

  return wrapper.innerHTML;
}

const FONT_SIZES = [
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '22px', value: '22px' },
  { label: '28px', value: '28px' },
  { label: '36px', value: '36px' },
  { label: '48px', value: '48px' },
];

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    { value, onChange, placeholder = 'Write your news update...', onRequestInsertImage },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [textColor, setTextColor] = useState('#ffffff');
    const [fontSize, setFontSize] = useState('');
    const normalizedValue = sanitizeEditorSurfaceHtml(toEditorHtml(value || ''));
    const isEmpty = !toSearchableNewsText(normalizedValue).trim();

    const syncEditorValue = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;
      // Skip the sync when the editor has focus — its DOM is the source of truth while
      // the user is actively typing. Overwriting innerHTML mid-edit would reset the cursor.
      if (document.activeElement === editor) return;
      if (editor.innerHTML !== normalizedValue) {
        editor.innerHTML = normalizedValue;
      }
    }, [normalizedValue]);

    useEffect(() => {
      syncEditorValue();
    }, [syncEditorValue]);

    const refreshValue = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const sanitized = sanitizeEditorSurfaceHtml(editor.innerHTML);
      if (editor.innerHTML !== sanitized) {
        editor.innerHTML = sanitized;
      }
      onChange(sanitized);
    }, [onChange]);

    const runCommand = useCallback((command: string, valueArg?: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      document.execCommand(command, false, valueArg);
      refreshValue();
    }, [refreshValue]);

    const insertHtml = useCallback((html: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      document.execCommand('insertHTML', false, html);
      refreshValue();
    }, [refreshValue]);

    const applyStylesToClosest = useCallback((selector: string, styles: Record<string, string>) => {
      const editor = editorRef.current;
      if (!editor || typeof window === 'undefined') return false;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;

      const anchor = selection.anchorNode;
      if (!anchor) return false;

      const startEl =
        anchor.nodeType === Node.ELEMENT_NODE
          ? (anchor as Element)
          : anchor.parentElement;
      if (!startEl) return false;

      const target = startEl.closest(selector);
      if (!(target instanceof HTMLElement) || !editor.contains(target)) return false;

      for (const [prop, val] of Object.entries(styles)) {
        if (!prop.trim()) continue;
        target.style.setProperty(prop, val);
      }

      refreshValue();
      return true;
    }, [refreshValue]);

    const insertImage = useCallback((url: string, alt = '') => {
      const safeUrl = sanitizeLinkUrl(url);
      if (!safeUrl) return;
      const safeAlt = alt
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      insertHtml(`<img src="${safeUrl}" alt="${safeAlt}" />`);
    }, [insertHtml]);

    const insertLink = useCallback((url: string, text?: string) => {
      const safeUrl = sanitizeLinkUrl(url);
      if (!safeUrl) return;

      const selection = window.getSelection();
      const hasSelectedText = Boolean(selection && selection.toString().trim());

      if (hasSelectedText) {
        runCommand('createLink', safeUrl);
        runCommand('styleWithCSS', 'false');
        return;
      }

      const safeText = (text || safeUrl)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      insertHtml(`<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeText}</a>`);
    }, [insertHtml, runCommand]);

    useImperativeHandle(ref, () => ({
      focus: () => editorRef.current?.focus(),
      insertImage,
      insertLink,
      insertHtmlSnippet: insertHtml,
      applyStylesToClosest,
    }), [insertImage, insertLink, insertHtml, applyStylesToClosest]);

    /** Apply font size to selected text via a styled span.
     *  Falls back to appending a span if surroundContents throws (cross-element selection). */
    const applyFontSize = useCallback((size: string) => {
      const editor = editorRef.current;
      if (!editor || !size) return;
      editor.focus();
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (range.collapsed) return; // nothing selected — no-op rather than silently wrapping empty span
      try {
        const span = document.createElement('span');
        span.style.fontSize = size;
        span.style.lineHeight = '1.4';
        range.surroundContents(span);
      } catch {
        // selection spans multiple block elements — use execCommand fallback
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('fontSize', false, '4'); // sets a base size we can find
        // find the fontSize spans and replace with our px size
        const nodes = editor.querySelectorAll('[style*="font-size"]');
        nodes.forEach(n => {
          (n as HTMLElement).style.fontSize = size;
        });
      }
      refreshValue();
      setFontSize('');
    }, [refreshValue]);

    /** Apply foreground colour to selected text. */
    const applyTextColor = useCallback((color: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('foreColor', false, color);
      refreshValue();
    }, [refreshValue]);

    const promptInsertLink = () => {
      const provided = window.prompt('Enter link URL (https://...)');
      if (!provided) return;
      const safeUrl = sanitizeLinkUrl(provided);
      if (!safeUrl) {
        window.alert('That URL is not allowed. Use http(s), mailto, tel, or a relative URL.');
        return;
      }
      insertLink(safeUrl);
    };

    const promptInsertImage = () => {
      if (onRequestInsertImage) {
        onRequestInsertImage();
        return;
      }
      const provided = window.prompt('Enter image URL');
      if (!provided) return;
      const safeUrl = sanitizeLinkUrl(provided);
      if (!safeUrl) {
        window.alert('That image URL is not allowed.');
        return;
      }
      insertImage(safeUrl);
    };

    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-brand-brown/20 bg-brand-dark-grey/20 p-2 space-y-2">
          {/* Row 1 — block format, inline format, lists, alignment, links, image */}
          <div className="flex flex-wrap gap-1.5">
            <ToolbarButton title="Paragraph" onClick={() => runCommand('formatBlock', 'P')}>
              <Pilcrow className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Heading 2" onClick={() => runCommand('formatBlock', 'H2')}>
              <Heading2 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Heading 3" onClick={() => runCommand('formatBlock', 'H3')}>
              <Heading3 className="w-4 h-4" />
            </ToolbarButton>
            <span className="w-px bg-brand-brown/20 self-stretch mx-0.5" />
            <ToolbarButton title="Bold" onClick={() => runCommand('bold')}>
              <Bold className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Italic" onClick={() => runCommand('italic')}>
              <Italic className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Underline" onClick={() => runCommand('underline')}>
              <Underline className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Strikethrough" onClick={() => runCommand('strikeThrough')}>
              <Strikethrough className="w-4 h-4" />
            </ToolbarButton>
            <span className="w-px bg-brand-brown/20 self-stretch mx-0.5" />
            <ToolbarButton title="Quote" onClick={() => runCommand('formatBlock', 'BLOCKQUOTE')}>
              <Quote className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Bulleted list" onClick={() => runCommand('insertUnorderedList')}>
              <List className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Numbered list" onClick={() => runCommand('insertOrderedList')}>
              <ListOrdered className="w-4 h-4" />
            </ToolbarButton>
            <span className="w-px bg-brand-brown/20 self-stretch mx-0.5" />
            <ToolbarButton title="Align left" onClick={() => runCommand('justifyLeft')}>
              <AlignLeft className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Align center" onClick={() => runCommand('justifyCenter')}>
              <AlignCenter className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Align right" onClick={() => runCommand('justifyRight')}>
              <AlignRight className="w-4 h-4" />
            </ToolbarButton>
            <span className="w-px bg-brand-brown/20 self-stretch mx-0.5" />
            <ToolbarButton title="Insert link" onClick={promptInsertLink}>
              <LinkIcon className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Remove link" onClick={() => runCommand('unlink')}>
              <Unlink className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Insert image URL" onClick={promptInsertImage}>
              <ImageIcon className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Clear formatting" onClick={() => runCommand('removeFormat')}>
              <Eraser className="w-4 h-4" />
            </ToolbarButton>
          </div>

          {/* Row 2 — font size + text colour */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-brand-brown/15">
            <span className="text-[11px] text-brand-cream/50 shrink-0">Font size:</span>
            <select
              value={fontSize}
              onChange={e => {
                const size = e.target.value;
                setFontSize(size);
                if (size) applyFontSize(size);
              }}
              onMouseDown={e => e.stopPropagation()}
              className="h-7 rounded border border-brand-brown/20 bg-brand-dark-grey/50 px-1.5 text-xs text-brand-cream/80 focus:border-brand-brown focus:outline-none cursor-pointer"
            >
              <option value="">— select —</option>
              {FONT_SIZES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <span className="w-px bg-brand-brown/20 self-stretch mx-1" />

            <span className="text-[11px] text-brand-cream/50 shrink-0">Text colour:</span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={textColor}
                onChange={e => setTextColor(e.target.value)}
                onMouseDown={e => e.stopPropagation()}
                className="h-7 w-8 rounded border border-brand-brown/20 bg-transparent cursor-pointer p-0.5"
                title="Pick text colour"
              />
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => applyTextColor(textColor)}
                className="h-7 px-2 rounded border border-brand-brown/20 bg-brand-dark-grey/40 text-xs text-brand-cream/80 hover:bg-brand-dark-grey/80 hover:text-brand-cream transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        <div className="relative">
          {isEmpty && (
            <p className="pointer-events-none absolute left-4 top-3 text-brand-cream/40">
              {placeholder}
            </p>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={refreshValue}
            onBlur={refreshValue}
            className="min-h-[220px] w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-3 text-brand-cream focus:border-brand-brown focus:outline-none [&_a]:text-brand-brown [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-brand-brown/60 [&_blockquote]:pl-3 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:my-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:my-2"
          />
        </div>
      </div>
    );
  }
);
