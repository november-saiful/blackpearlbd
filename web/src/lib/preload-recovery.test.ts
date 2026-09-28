import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canReloadForStaleBuild,
  installPreloadRecovery,
  isCssPreloadFailure,
  preloadFailureUrl,
  refreshCachedAsset,
  reloadForStaleBuild,
} from './preload-recovery';

// Minimal stand-ins for the browser globals the recovery touches, so this stays
// a node-environment test (the project does not use jsdom).
function setUpBrowser() {
  const listeners = new Map<string, EventListener[]>();
  const reload = vi.fn();
  const entries = new Map<string, string>();
  const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));

  vi.stubGlobal('window', {
    addEventListener: (type: string, listener: EventListener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    location: { reload, origin: 'https://blackpearl.bd' },
  });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
  });
  vi.stubGlobal('fetch', fetchMock);

  return {
    reload,
    fetchMock,
    entries,
    /** Dispatch `vite:preloadError` the way Vite's preload helper does. */
    dispatchPreloadError(payload: unknown) {
      const event = Object.assign(new Event('vite:preloadError', { cancelable: true }), {
        payload,
      });
      for (const listener of listeners.get('vite:preloadError') ?? []) listener(event);
      return event;
    },
  };
}

const cssFailure = new Error('Unable to preload CSS for /assets/lightbox-Dgihpmma.css');

describe('installPreloadRecovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the page alive when a stylesheet fails, instead of reloading', () => {
    const browser = setUpBrowser();
    installPreloadRecovery();

    const event = browser.dispatchPreloadError(cssFailure);

    // The chunk still loads without its CSS, so the page renders and there is
    // nothing to reload — reloading here is what used to loop forever.
    expect(event.defaultPrevented).toBe(true);
    expect(browser.reload).not.toHaveBeenCalled();
  });

  it('refreshes the poisoned cache entry in the background', () => {
    const browser = setUpBrowser();
    installPreloadRecovery();

    browser.dispatchPreloadError(cssFailure);

    expect(browser.fetchMock).toHaveBeenCalledWith(
      'https://blackpearl.bd/assets/lightbox-Dgihpmma.css',
      { cache: 'reload' },
    );
  });

  it('reloads for a failed script chunk', () => {
    const browser = setUpBrowser();
    installPreloadRecovery();

    const event = browser.dispatchPreloadError(new Error('Failed to fetch dynamically imported module'));

    expect(event.defaultPrevented).toBe(true);
    expect(browser.reload).toHaveBeenCalledTimes(1);
  });

  it('never loops: a second failure right after the reload is left to surface', () => {
    const browser = setUpBrowser();
    installPreloadRecovery();

    browser.dispatchPreloadError(new Error('Failed to fetch dynamically imported module'));
    const second = browser.dispatchPreloadError(new Error('Failed to fetch dynamically imported module'));

    expect(browser.reload).toHaveBeenCalledTimes(1);
    // Not prevented, so the route error boundary explains the situation.
    expect(second.defaultPrevented).toBe(false);
  });

  it('stops reloading once the session budget is spent', () => {
    const browser = setUpBrowser();
    installPreloadRecovery();

    // Two reloads, well apart, exhaust the budget.
    expect(reloadForStaleBuild(0)).toBe(true);
    expect(reloadForStaleBuild(60_000)).toBe(true);
    expect(reloadForStaleBuild(600_000)).toBe(false);
    expect(canReloadForStaleBuild(600_000)).toBe(false);
    expect(browser.reload).toHaveBeenCalledTimes(2);
  });
});

describe('canReloadForStaleBuild', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('grants a first reload immediately', () => {
    setUpBrowser();
    expect(canReloadForStaleBuild(1_000)).toBe(true);
  });

  it('refuses a second reload inside the cooldown', () => {
    setUpBrowser();
    reloadForStaleBuild(1_000);
    expect(canReloadForStaleBuild(1_000 + 14_999)).toBe(false);
  });

  it('allows it again after the cooldown', () => {
    setUpBrowser();
    reloadForStaleBuild(1_000);
    expect(canReloadForStaleBuild(1_000 + 15_000)).toBe(true);
  });
});

describe('failure classification', () => {
  it('recognises the CSS preload message and extracts the URL', () => {
    expect(isCssPreloadFailure(cssFailure)).toBe(true);
    expect(preloadFailureUrl(cssFailure)).toBe('/assets/lightbox-Dgihpmma.css');
  });

  it('does not classify a missing script chunk as a CSS failure', () => {
    const error = new Error('Failed to load module script: Expected a JavaScript module script');
    expect(isCssPreloadFailure(error)).toBe(false);
    expect(preloadFailureUrl(error)).toBeNull();
  });
});

describe('refreshCachedAsset', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bypasses the cache for a same-origin build asset', () => {
    const browser = setUpBrowser();
    refreshCachedAsset('/assets/index-BPWGca9D.js');
    expect(browser.fetchMock).toHaveBeenCalledWith('https://blackpearl.bd/assets/index-BPWGca9D.js', {
      cache: 'reload',
    });
  });

  it('ignores anything that is not a same-origin build asset', () => {
    const browser = setUpBrowser();
    refreshCachedAsset('https://evil.example/assets/x.js');
    refreshCachedAsset('/logo.svg');
    expect(browser.fetchMock).not.toHaveBeenCalled();
  });

  it('survives a rejected fetch', async () => {
    const browser = setUpBrowser();
    browser.fetchMock.mockReturnValue(Promise.reject(new Error('offline')));
    expect(() => refreshCachedAsset('/assets/x.css')).not.toThrow();
    await Promise.resolve();
  });
});
