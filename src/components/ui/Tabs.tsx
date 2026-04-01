import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
}

export function Tabs({
  tabs,
  defaultTab,
  onChange,
  variant = 'default',
  size = 'md',
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variantClasses = (isActive: boolean) => {
    switch (variant) {
      case 'pills':
        return isActive
          ? 'bg-blue-600 text-white'
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700';
      case 'underline':
        return isActive
          ? 'border-b-2 border-blue-500 text-blue-400'
          : 'border-b-2 border-transparent text-gray-400 hover:text-gray-300';
      default:
        return isActive
          ? 'bg-gray-700 text-white border-b-2 border-blue-500'
          : 'bg-gray-800 text-gray-400 border-b-2 border-transparent hover:bg-gray-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab List */}
      <div className={cn(
        'flex gap-2 overflow-x-auto pb-2',
        variant === 'pills' && 'gap-2 bg-gray-900/30 p-2 rounded-lg w-fit'
      )}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            disabled={tab.disabled}
            className={cn(
              'flex items-center gap-2 font-medium transition-all rounded-lg',
              sizeClasses[size],
              variantClasses(activeTab === tab.id),
              tab.disabled && 'opacity-50 cursor-not-allowed',
              variant === 'pills' && 'rounded-lg',
              variant === 'underline' && 'rounded-none'
            )}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="ml-2 px-2 py-0.5 bg-red-600 text-white rounded-full text-xs font-bold">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-200">
        {tabs.find((t) => t.id === activeTab)?.content}
      </div>
    </div>
  );
}
