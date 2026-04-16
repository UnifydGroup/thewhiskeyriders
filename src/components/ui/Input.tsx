import { cn } from '@/lib/utils';
import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  maxLength?: number;
  showCharCount?: boolean;
}

export function Input({
  className,
  type = 'text',
  label,
  error,
  helpText,
  maxLength,
  showCharCount = false,
  ...props
}: InputProps) {
  const [value, setValue] = useState(props.value || '');
  const charCount = typeof value === 'string' ? value.length : 0;
  const isOverLimit = maxLength ? charCount > maxLength : false;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (maxLength && newValue.length > maxLength) {
      return;
    }
    setValue(newValue);
    props.onChange?.(e);
  };

  return (
    <div className="w-full space-y-1">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">
            {label}
          </label>
          {showCharCount && maxLength && (
            <span
              className={cn(
                'text-xs',
                isOverLimit ? 'text-red-400' : 'text-gray-500'
              )}
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      )}
      <input
        type={type}
        maxLength={maxLength}
        className={cn(
          'w-full px-4 py-2 rounded-lg bg-gray-800 border text-base text-gray-100 placeholder-gray-500',
          error
            ? 'border-red-500 focus:ring-2 focus:ring-red-500/30'
            : 'border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
          'focus:outline-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          className
        )}
        value={value}
        onChange={handleChange}
        {...props}
      />
      {error && (
        <div className="flex items-center gap-1 text-red-400 text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      {!error && helpText && (
        <p className="text-gray-500 text-sm">{helpText}</p>
      )}
    </div>
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
  maxLength?: number;
  showCharCount?: boolean;
}

export function TextArea({
  className,
  label,
  error,
  helpText,
  maxLength,
  showCharCount = false,
  ...props
}: TextAreaProps) {
  const [value, setValue] = useState(props.value || '');
  const charCount = typeof value === 'string' ? value.length : 0;
  const isOverLimit = maxLength ? charCount > maxLength : false;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (maxLength && newValue.length > maxLength) {
      return;
    }
    setValue(newValue);
    props.onChange?.(e);
  };

  return (
    <div className="w-full space-y-1">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">
            {label}
          </label>
          {showCharCount && maxLength && (
            <span
              className={cn(
                'text-xs',
                isOverLimit ? 'text-red-400' : 'text-gray-500'
              )}
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      )}
      <textarea
        maxLength={maxLength}
        className={cn(
          'w-full px-4 py-2 rounded-lg bg-gray-800 border text-base text-gray-100 placeholder-gray-500',
          error
            ? 'border-red-500 focus:ring-2 focus:ring-red-500/30'
            : 'border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
          'focus:outline-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          'resize-vertical',
          'min-h-[100px]',
          className
        )}
        value={value}
        onChange={handleChange}
        {...props}
      />
      {error && (
        <div className="flex items-center gap-1 text-red-400 text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      {!error && helpText && (
        <p className="text-gray-500 text-sm">{helpText}</p>
      )}
    </div>
  );
}

// Alias for compatibility
export const Textarea = TextArea;

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'w-full px-4 py-2 rounded-lg bg-brand-dark-grey border border-brand-brown/20 text-base text-brand-cream',
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
