import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: keyof T | 'actions';
  label: string;
  sortable?: boolean;
  width?: string;
  className?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export interface DataTableRow<T> {
  id: string;
  data: T;
  expandable?: boolean;
  expandedContent?: React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: DataTableRow<T>[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  stickyHeader?: boolean;
  maxHeight?: string;
  emptyMessage?: string;
  rowClassName?: (row: T) => string;
}

export function DataTable<T>({
  columns,
  rows,
  isLoading,
  onRowClick,
  onSort,
  stickyHeader = true,
  maxHeight = 'max-h-[600px]',
  emptyMessage = 'No data available',
  rowClassName,
}: DataTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig?.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    onSort?.(key, direction);
  };

  const isRowExpanded = (id: string) => expandedRows.has(id);

  return (
    <div className={cn('border border-gray-700 rounded-lg overflow-hidden', maxHeight && 'overflow-y-auto')}>
      <table className="w-full border-collapse">
        <thead>
          <tr
            className={cn(
              'bg-gray-900 border-b border-gray-700',
              stickyHeader && 'sticky top-0 z-10'
            )}
          >
            {rows.some((r) => r.expandable) && (
              <th className="w-8 px-4 py-3" />
            )}
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={cn(
                  'px-4 py-3 text-left text-sm font-semibold text-gray-300 whitespace-nowrap',
                  column.width && `w-${column.width}`,
                  column.sortable && 'cursor-pointer hover:text-gray-100'
                )}
                onClick={() => column.sortable && handleSort(String(column.key))}
              >
                <div className="flex items-center gap-2">
                  <span>{column.label}</span>
                  {column.sortable && (
                    <ArrowUpDown
                      size={14}
                      className={cn(
                        'opacity-0 group-hover:opacity-100 transition-opacity',
                        sortConfig?.key === String(column.key) && 'opacity-100 text-blue-400'
                      )}
                    />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length + (rows.some((r) => r.expandable) ? 1 : 0)} className="px-4 py-8 text-center">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400" />
                </div>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (rows.some((r) => r.expandable) ? 1 : 0)} className="px-4 py-8 text-center text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <React.Fragment key={row.id}>
                <tr
                  className={cn(
                    'border-b border-gray-800 hover:bg-gray-800/50 transition-colors',
                    onRowClick && 'cursor-pointer',
                    rowClassName?.(row.data)
                  )}
                  onClick={() => onRowClick?.(row.data)}
                >
                  {row.expandable && (
                    <td className="w-8 px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleRowExpand(row.id)}
                        className="text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        {isRowExpanded(row.id) ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        )}
                      </button>
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={`${row.id}-${String(column.key)}`}
                      className={cn(
                        'px-4 py-3 text-gray-200 text-sm',
                        column.className
                      )}
                    >
                      {column.render
                        ? column.render(row.data[column.key as keyof T], row.data)
                        : (String(row.data[column.key as keyof T]) || '–')}
                    </td>
                  ))}
                </tr>
                {row.expandable && isRowExpanded(row.id) && (
                  <tr className="bg-gray-800/30 border-b border-gray-800">
                    <td colSpan={columns.length + 1} className="px-4 py-4">
                      {row.expandedContent}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
