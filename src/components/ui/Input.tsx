import { cn } from '@/lib/utils';
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'w-full px-4 py-2 rounded-lg bg-brand-dark-grey border border-brand-brown/20 text-brand-cream placeholder-brand-cream/40',
        'focus:outline-none focus:border-brand-brown focus:ring-2 focus:ring-brand-brown/20',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-colors',
        className
      )}
      {...props}
    />
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function TextArea({ className, ...props }: TextAreaProps) {
  return (
    <textarea
      className={cn(
        'w-full px-4 py-2 rounded-lg bg-brand-dark-grey border border-brand-brown/20 text-brand-cream placeholder-brand-cream/40',
        'focus:outline-none focus:border-brand-brown focus:ring-2 focus:ring-brand-brown/20',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-colors',
        'resize-vertical',
        className
      )}
      {...props}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'w-full px-4 py-2 rounded-lg bg-brand-dark-grey border border-brand-brown/20 text-brand-cream',
        'focus:outline-none focus:border-brand-brown focus:ring-2 focus:ring-brand-brown/20',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-colors',
        'appearance-none',
        'cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
