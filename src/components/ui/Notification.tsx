import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
}

interface NotificationProps {
  type: NotificationType;
  title: string;
  message?: string;
  onClose?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    const fullNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000,
    };

    setNotifications((prev) => [...prev, fullNotification]);

    if (fullNotification.duration && fullNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, fullNotification.duration);
    }

    return id;
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      <NotificationContainer notifications={notifications} onRemove={removeNotification} />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

export function Notification({
  type,
  title,
  message,
  onClose,
  icon,
  className,
}: NotificationProps) {
  const fallbackIcons = {
    success: <CheckCircle size={20} className="text-green-400" />,
    error: <AlertCircle size={20} className="text-red-400" />,
    warning: <AlertTriangle size={20} className="text-yellow-400" />,
    info: <Info size={20} className="text-blue-400" />,
  };

  const bgColors = {
    success: 'bg-green-900/30 border-green-500/30',
    error: 'bg-red-900/30 border-red-500/30',
    warning: 'bg-yellow-900/30 border-yellow-500/30',
    info: 'bg-blue-900/30 border-blue-500/30',
  };

  const textColors = {
    success: 'text-green-100',
    error: 'text-red-100',
    warning: 'text-yellow-100',
    info: 'text-blue-100',
  };

  return (
    <div className={cn('p-4 rounded-lg border mb-4', bgColors[type], className)}>
      <div className="flex items-start gap-3">
        {icon ?? fallbackIcons[type]}
        <div className="flex-1">
          <h3 className={cn('font-semibold', textColors[type])}>{title}</h3>
          {message && <p className="text-sm text-gray-300 mt-1">{message}</p>}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// Container component for displaying notifications
function NotificationContainer({
  notifications,
  onRemove,
}: {
  notifications: Notification[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => onRemove(notification.id)}
        />
      ))}
    </div>
  );
}

function NotificationItem({
  notification,
  onClose,
}: {
  notification: Notification;
  onClose: () => void;
}) {
  const icons = {
    success: <CheckCircle size={20} className="text-green-400" />,
    error: <AlertCircle size={20} className="text-red-400" />,
    warning: <AlertTriangle size={20} className="text-yellow-400" />,
    info: <Info size={20} className="text-blue-400" />,
  };

  const bgColors = {
    success: 'bg-green-900/30 border-green-500/30',
    error: 'bg-red-900/30 border-red-500/30',
    warning: 'bg-yellow-900/30 border-yellow-500/30',
    info: 'bg-blue-900/30 border-blue-500/30',
  };

  const textColors = {
    success: 'text-green-100',
    error: 'text-red-100',
    warning: 'text-yellow-100',
    info: 'text-blue-100',
  };

  return (
    <div
      className={cn(
        'p-4 rounded-lg border backdrop-blur-sm animate-in fade-in slide-in-from-right-4 duration-300',
        bgColors[notification.type]
      )}
    >
      <div className="flex items-start gap-3">
        {icons[notification.type]}
        <div className="flex-1">
          <h3 className={cn('font-semibold', textColors[notification.type])}>
            {notification.title}
          </h3>
          {notification.message && (
            <p className="text-sm text-gray-300 mt-1">{notification.message}</p>
          )}
          {notification.action && (
            <button
              onClick={() => {
                notification.action?.onClick();
                onClose();
              }}
              className={cn(
                'text-sm font-medium mt-2 hover:underline',
                textColors[notification.type]
              )}
            >
              {notification.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
