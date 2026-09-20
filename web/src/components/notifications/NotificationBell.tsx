import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const TYPE_ICONS: Record<string, string> = {
  booking_confirmed: '📋',
  booking_approved: '✅',
  booking_rejected: '❌',
  booking_processing: '⏳',
  package_approved: '✅',
  package_rejected: '❌',
  package_processing: '⏳',
  pearls_earned: '💎',
  welcome: '👋',
};

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, close]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read_at) {
      markRead(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
    close();
  };

  const displayNotifications = notifications.slice(0, 10);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 mt-2 w-80 max-h-96 overflow-hidden bg-background rounded-lg shadow-lg border border-border z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-xs text-secondary hover:text-secondary/80 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-72">
            {displayNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              displayNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border/50 last:border-0',
                    !notification.read_at && 'bg-secondary/5'
                  )}
                  role="menuitem"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {TYPE_ICONS[notification.type] || '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          'text-sm truncate',
                          !notification.read_at ? 'font-semibold text-foreground' : 'text-foreground'
                        )}>
                          {notification.title}
                        </p>
                        {!notification.read_at && (
                          <span className="flex h-2 w-2 flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-secondary opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>
                    {!notification.read_at && (
                      <Check className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {notifications.length > 10 && (
            <div className="px-4 py-2 border-t border-border text-center">
              <a href="/profile?tab=notifications" className="text-xs text-secondary hover:text-secondary/80">
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
