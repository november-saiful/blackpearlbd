import { create } from 'zustand';
import type { TourDeal } from '@/types';
import { api, ApiError } from '@/lib/api';
import toast from 'react-hot-toast';

const BOOKMARKS_STORAGE_KEY = 'blackpearl-bookmarks';

// ── Storage helpers ──────────────────────────────────────────────
/** Guests keep bookmarks in localStorage; signed-in users on the server. */
function loadFromStorage(): TourDeal[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(bookmarks: TourDeal[]) {
  try {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    /* localStorage unavailable */
  }
}

function clearStorage() {
  try {
    localStorage.removeItem(BOOKMARKS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ── State ────────────────────────────────────────────────────────
interface BookmarkState {
  bookmarks: TourDeal[];
  /**
   * `saved_deals` row id per deal id, for signed-in users. Keeping it means an
   * unsave is a direct DELETE instead of re-listing every saved deal first.
   */
  serverIds: Record<string, string>;
  /** Whether the current session is authenticated (server-backed). */
  isAuthenticated: boolean;
  isInitialized: boolean;

  /**
   * The single action every bookmark button in the app calls: saves the deal
   * when it isn't bookmarked yet, removes it when it is. Guests are included —
   * their bookmarks live in localStorage until they sign in.
   */
  toggleBookmark: (deal: TourDeal) => Promise<void>;
  addBookmark: (deal: TourDeal) => Promise<void>;
  removeBookmark: (dealId: string) => Promise<void>;
  isBookmarked: (dealId: string) => boolean;
  clearBookmarks: () => void;

  /** Called once on app mount. */
  initialize: (authenticated: boolean) => Promise<void>;
  /** Called when the user logs in mid-session. */
  onLogin: () => Promise<void>;
  /** Called when the user logs out. */
  onLogout: () => void;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  // ── Initial state ─────────────────────────────────────────────
  bookmarks: loadFromStorage(),
  serverIds: {},
  isAuthenticated: false,
  isInitialized: false,

  // ── Toggle ────────────────────────────────────────────────────
  toggleBookmark: async (deal) => {
    if (get().bookmarks.some((b) => b.id === deal.id)) {
      await get().removeBookmark(deal.id);
    } else {
      await get().addBookmark(deal);
    }
  },

  // ── Add ───────────────────────────────────────────────────────
  addBookmark: async (deal) => {
    const { bookmarks, isAuthenticated } = get();
    if (bookmarks.some((b) => b.id === deal.id)) return;

    // Optimistic local update: the icon flips immediately.
    const next = [deal, ...bookmarks];
    set({ bookmarks: next });

    if (!isAuthenticated) {
      saveToStorage(next);
      toast.success('Bookmarked!');
      return;
    }

    try {
      const { savedDeal } = await api.saveDeal(deal.id);
      if (savedDeal?.id) {
        set((state) => ({
          serverIds: { ...state.serverIds, [deal.id]: savedDeal.id },
        }));
      }
      toast.success('Bookmarked!');
    } catch (error) {
      // 409 means the server already had it (e.g. saved on another device).
      // That is the desired end state, so keep the local bookmark.
      if (error instanceof ApiError && error.status === 409) {
        toast.success('Bookmarked!');
        return;
      }
      // Anything else: roll the optimistic update back.
      const rolledBack = get().bookmarks.filter((b) => b.id !== deal.id);
      set({ bookmarks: rolledBack });
      saveToStorage(rolledBack);
      toast.error('Failed to save bookmark');
    }
  },

  // ── Remove ────────────────────────────────────────────────────
  removeBookmark: async (dealId) => {
    const { bookmarks, isAuthenticated, serverIds } = get();
    const removed = bookmarks.find((b) => b.id === dealId);
    if (!removed) return;

    const next = bookmarks.filter((b) => b.id !== dealId);
    set({ bookmarks: next });

    if (!isAuthenticated) {
      saveToStorage(next);
      toast.success('Bookmark removed');
      return;
    }

    try {
      let serverId = serverIds[dealId];
      if (!serverId) {
        // Saved before this session started, so the row id isn't known yet.
        const { savedDeals } = await api.getSavedDeals();
        serverId = savedDeals.find((sd) => sd.deal_id === dealId)?.id ?? '';
      }
      if (serverId) await api.unsaveDeal(serverId);

      set((state) => {
        const remaining = { ...state.serverIds };
        delete remaining[dealId];
        return { serverIds: remaining };
      });
      toast.success('Bookmark removed');
    } catch {
      // Put it back where it was, so the list matches the server again.
      const current = get().bookmarks;
      if (!current.some((b) => b.id === dealId)) {
        const originalIndex = bookmarks.findIndex((b) => b.id === dealId);
        const restored = [...current];
        restored.splice(Math.min(originalIndex, restored.length), 0, removed);
        set({ bookmarks: restored });
      }
      toast.error('Failed to remove bookmark');
    }
  },

  // ── Query ─────────────────────────────────────────────────────
  isBookmarked: (dealId) => get().bookmarks.some((b) => b.id === dealId),

  // ── Clear ─────────────────────────────────────────────────────
  clearBookmarks: () => {
    set({ bookmarks: [], serverIds: {} });
    clearStorage();
  },

  // ── App-load initialization ───────────────────────────────────
  initialize: async (authenticated) => {
    if (get().isInitialized) return;

    if (authenticated) {
      set({ isAuthenticated: true });
      await fetchFromServer(set);
    }
    // Guest: bookmarks already loaded from localStorage in the initial state

    set({ isInitialized: true });
  },

  // ── Mid-session login ─────────────────────────────────────────
  onLogin: async () => {
    const { bookmarks: localBookmarks } = get();

    set({ isAuthenticated: true });

    // Push every local guest bookmark to the server (best-effort).
    for (const deal of localBookmarks) {
      try {
        await api.saveDeal(deal.id);
      } catch {
        /* already saved, or offline: the pull below is the source of truth */
      }
    }

    // Pull the merged server list (includes everything just synced plus any
    // bookmarks that already existed on the server).
    await fetchFromServer(set);

    // Local storage is no longer the source of truth
    clearStorage();
  },

  // ── Mid-session logout ────────────────────────────────────────
  onLogout: () => {
    clearStorage();
    set({ isAuthenticated: false, bookmarks: [], serverIds: {} });
  },
}));

// ── Helper: fetch bookmarks from server → state ──────────────────
async function fetchFromServer(
  set: (partial: Partial<BookmarkState>) => void,
) {
  try {
    const { savedDeals } = await api.getSavedDeals();
    const serverBookmarks = savedDeals
      .filter((sd) => sd.deal)
      .map((sd) => sd.deal as TourDeal);
    const serverIds: Record<string, string> = {};
    for (const sd of savedDeals) serverIds[sd.deal_id] = sd.id;
    set({ bookmarks: serverBookmarks, serverIds });
  } catch (error) {
    console.error('Failed to load bookmarks from server:', error);
  }
}
