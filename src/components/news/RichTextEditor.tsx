'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
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
  Unlink,
  Underline,
} from 'lucide-react';
import { sanitizeLinkUrl, toEditorHtml, toSearchableNewsText } from '@/lib/news/content';

export interface RichTextEditorHandle {
  focus: () => void;
  insertImage: (url: string, alt?: string) => void;
  insertLink: (url: string, text?: string) => void;
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

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    { value, onChange, placeholder = 'Write your news update...', onRequestInsertImage },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const normalizedValue = toEditorHtml(value || '');
    const isEmpty = !toSearchableNewsText(normalizedValue).trim();

    const syncEditorValue = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;
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
      onChange(editor.innerHTML);
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
    }), [insertImage, insertLink]);

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
        <div className="flex flex-wrap gap-2 rounded-lg border border-brand-brown/20 bg-brand-dark-grey/20 p-2">
          <ToolbarButton title="Paragraph" onClick={() => runCommand('formatBlock', 'P')}>
            <Pilcrow className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="Heading 2" onClick={() => runCommand('formatBlock', 'H2')}>
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="Heading 3" onClick={() => runCommand('formatBlock', 'H3')}>
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="Bold" onClick={() => runCommand('bold')}>
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="Italic" onClick={() => runCommand('italic')}>
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="Underline" onClick={() => runCommand('underline')}>
            <Underline className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="Quote" onClick={() => runCommand('formatBlock', 'BLOCKQUOTE')}>
            <Quote className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="Bulleted list" onClick={() => runCommand('insertUnorderedList')}>
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="Numbered list" onClick={() => runCommand('insertOrderedList')}>
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="Align left" onClick={() => runCommand('justifyLeft')}>
            <AlignLeft className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="Align center" onClick={() => runCommand('justifyCenter')}>
            <AlignCenter className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="Align right" onClick={() => runCommand('justifyRight')}>
            <AlignRight className="w-4 h-4" />
          </ToolbarButton>
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
