import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useBookmarkStore } from '@/stores/bookmarkStore';

/**
 * Mount once in the router tree (RootLayout).
 * Handles:
 *  1. Initial load: loads localStorage for guests, server for logged-in users.
 *  2. Mid-session login: syncs local bookmarks to server, switches to server mode.
 *  3. Mid-session logout: clears bookmarks.
 */
export function useInitializeBookmarks() {
  const { isAuthenticated, isLoading } = useAuth();
  const { initialize, onLogin, onLogout, isInitialized } = useBookmarkStore();
  const prevAuthRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Wait until auth state is resolved
    if (isLoading) return;

    const prevAuth = prevAuthRef.current;

    // First render: initialize
    if (prevAuth === null) {
      prevAuthRef.current = isAuthenticated;
      initialize(isAuthenticated);
      return;
    }

    // Auth state changed: login or logout
    if (prevAuth !== isAuthenticated) {
      prevAuthRef.current = isAuthenticated;
      if (isAuthenticated) {
        onLogin();
      } else {
        onLogout();
      }
    }
  }, [isAuthenticated, isLoading, initialize, onLogin, onLogout, isInitialized]);
}

export function useBookmarkSync() {
  const { bookmarks } = useBookmarkStore();

  return {
    bookmarkCount: bookmarks.length,
  };
}
