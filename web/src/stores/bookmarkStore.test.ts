import { beforeEach, describe, expect, it, vi } from 'vitest';

// The store talks to the API directly; mocking it keeps these tests about the
// toggle's own behaviour (optimistic update, rollback, server sync).
vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }
  return {
    ApiError,
    api: {
      saveDeal: vi.fn(),
      unsaveDeal: vi.fn(),
      getSavedDeals: vi.fn(),
    },
  };
});

import { ApiError, api } from '@/lib/api';
import { useBookmarkStore } from './bookmarkStore';
import type { TourDeal } from '@/types';

const mockApi = api as unknown as {
  saveDeal: ReturnType<typeof vi.fn>;
  unsaveDeal: ReturnType<typeof vi.fn>;
  getSavedDeals: ReturnType<typeof vi.fn>;
};

const deal = {
  id: 'deal-1',
  slug: 'kuakata-sea',
  title: 'Kuakata Sea & Heritage Tour',
  destination: 'Kuakata',
  price: 9800,
} as TourDeal;

// Minimal localStorage so the guest path can be asserted without a DOM.
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
});

function savedInStorage(): unknown[] {
  return JSON.parse(storage.get('blackpearl-bookmarks') ?? '[]');
}

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
  useBookmarkStore.setState({
    bookmarks: [],
    serverIds: {},
    isAuthenticated: false,
    isInitialized: true,
  });
});

describe('toggleBookmark', () => {
  it('saves a guest bookmark, then removes it on the next click', async () => {
    await useBookmarkStore.getState().toggleBookmark(deal);

    expect(useBookmarkStore.getState().isBookmarked('deal-1')).toBe(true);
    expect(savedInStorage()).toHaveLength(1);

    await useBookmarkStore.getState().toggleBookmark(deal);

    expect(useBookmarkStore.getState().isBookmarked('deal-1')).toBe(false);
    expect(savedInStorage()).toHaveLength(0);
  });

  it('keeps every surface in step, since they all read the one store', async () => {
    const { toggleBookmark } = useBookmarkStore.getState();
    await toggleBookmark(deal);

    // This is what the topbar badge, the dropdown and the profile list read.
    expect(useBookmarkStore.getState().bookmarks.map((b) => b.id)).toEqual(['deal-1']);
  });

  it('pushes the save to the server for a signed-in user', async () => {
    mockApi.saveDeal.mockResolvedValue({
      savedDeal: { id: 'row-1', user_id: 'u1', deal_id: 'deal-1', created_at: '' },
    });
    useBookmarkStore.setState({ isAuthenticated: true });

    await useBookmarkStore.getState().toggleBookmark(deal);

    expect(mockApi.saveDeal).toHaveBeenCalledWith('deal-1');
    expect(useBookmarkStore.getState().isBookmarked('deal-1')).toBe(true);
    expect(storage.size).toBe(0); // signed-in users are not stored locally
  });

  it('unsaves by row id on the second click, without re-listing', async () => {
    mockApi.saveDeal.mockResolvedValue({
      savedDeal: { id: 'row-1', user_id: 'u1', deal_id: 'deal-1', created_at: '' },
    });
    mockApi.unsaveDeal.mockResolvedValue({ message: 'removed' });
    useBookmarkStore.setState({ isAuthenticated: true });

    await useBookmarkStore.getState().toggleBookmark(deal);
    await useBookmarkStore.getState().toggleBookmark(deal);

    expect(mockApi.unsaveDeal).toHaveBeenCalledWith('row-1');
    expect(mockApi.getSavedDeals).not.toHaveBeenCalled();
    expect(useBookmarkStore.getState().isBookmarked('deal-1')).toBe(false);
  });

  it('rolls the optimistic save back when the server rejects it', async () => {
    mockApi.saveDeal.mockRejectedValue(new ApiError('Failed to save deal', 500));
    useBookmarkStore.setState({ isAuthenticated: true });

    await useBookmarkStore.getState().toggleBookmark(deal);

    expect(useBookmarkStore.getState().isBookmarked('deal-1')).toBe(false);
  });

  it('keeps the bookmark when the server already had it', async () => {
    mockApi.saveDeal.mockRejectedValue(new ApiError('Deal already saved', 409));
    useBookmarkStore.setState({ isAuthenticated: true });

    await useBookmarkStore.getState().toggleBookmark(deal);

    expect(useBookmarkStore.getState().isBookmarked('deal-1')).toBe(true);
  });

  it('restores a bookmark when the server refuses the delete', async () => {
    mockApi.unsaveDeal.mockRejectedValue(new Error('offline'));
    useBookmarkStore.setState({
      isAuthenticated: true,
      bookmarks: [deal],
      serverIds: { 'deal-1': 'row-1' },
    });

    await useBookmarkStore.getState().toggleBookmark(deal);

    expect(useBookmarkStore.getState().isBookmarked('deal-1')).toBe(true);
  });
});
