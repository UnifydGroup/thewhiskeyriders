'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: <Trash2 className="w-5 h-5 text-red-400" />,
      iconBg: 'bg-red-900/30 border-red-600/30',
      confirmBtn: 'bg-red-600 hover:bg-red-500 text-white',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      iconBg: 'bg-amber-900/30 border-amber-600/30',
      confirmBtn: 'bg-amber-600 hover:bg-amber-500 text-white',
    },
    info: {
      icon: <AlertTriangle className="w-5 h-5 text-brand-tan" />,
      iconBg: 'bg-brand-tan/10 border-brand-tan/30',
      confirmBtn: 'bg-brand-tan hover:bg-brand-tan/90 text-brand-black',
    },
  }[variant];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-brand-dark-grey border border-brand-tan/20 rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 space-y-4">
            {/* Icon + Title */}
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${variantStyles.iconBg}`}>
                {variantStyles.icon}
              </div>
              <div>
                <h3 className="font-semibold text-brand-cream text-base">{title}</h3>
                <p className="text-sm text-brand-cream/60 mt-1 leading-relaxed">{message}</p>
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg border border-brand-tan/25 text-brand-cream/70 text-sm font-medium hover:text-brand-cream hover:border-brand-tan/50 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${variantStyles.confirmBtn}`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
