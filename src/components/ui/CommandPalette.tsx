import React, { useState, useEffect, useCallback } from 'react';
import { Command, Search, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  category?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
  group?: string;
}

interface CommandPaletteProps {
  items: CommandItem[];
  onClose?: () => void;
  placeholder?: string;
}

export function CommandPalette({
  items,
  onClose,
  placeholder = 'Type a command...',
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredItems = search
    ? items.filter((item) =>
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase())
      )
    : items.sort((a, b) => (a.group || '').localeCompare(b.group || ''));

  const handleSelect = (item: CommandItem) => {
    item.action();
    setOpen(false);
    setSearch('');
    onClose?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearch('');
        break;
    }
  };

  // Global keyboard shortcut (Cmd+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-xl">
        {/* Search Input */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
            <Search size={18} className="text-gray-400" />
            <input
              autoFocus
              type="text"
              placeholder={placeholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none text-sm"
            />
            <div className="text-gray-500 text-xs flex gap-1">
              <kbd className="px-2 py-1 bg-gray-700 rounded">esc</kbd>
            </div>
          </div>

          {/* Commands List */}
          <div className="max-h-[400px] overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400">
                No commands found
              </div>
            ) : (
              filteredItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    'w-full px-4 py-3 flex items-center gap-3 text-left text-sm transition-colors border-b border-gray-700/50',
                    index === selectedIndex
                      ? 'bg-gray-700/60 text-gray-100'
                      : 'text-gray-300 hover:bg-gray-700/30'
                  )}
                >
                  {/* Icon */}
                  {item.icon && (
                    <div className="text-gray-500 flex-shrink-0">
                      {item.icon}
                    </div>
                  )}

                  {/* Label & Description */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.label}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {item.description}
                      </div>
                    )}
                  </div>

                  {/* Shortcut & Arrow */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.shortcut && (
                      <div className="text-xs text-gray-500">{item.shortcut}</div>
                    )}
                    <ChevronRight size={14} className="text-gray-600" />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer Info */}
          <div className="bg-gray-900 px-4 py-2 border-t border-gray-700 text-xs text-gray-500 flex items-center justify-between">
            <span>{filteredItems.length} command(s)</span>
            <div className="flex gap-2">
              <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-700">↑↓</kbd>
              <kbd className="px-2 py-1 bg-gray-800 rounded border border-gray-700">⏎</kbd>
              <span className="text-gray-600 ml-1">to navigate and select</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for managing command palette
interface UseCommandPaletteOptions {
  items: CommandItem[];
}

export function useCommandPalette(options: UseCommandPaletteOptions) {
  const [open, setOpen] = useState(false);

  return {
    open,
    setOpen,
    items: options.items,
  };
}
