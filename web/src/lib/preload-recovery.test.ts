import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHUNK_RELOAD_FLAG, installPreloadRecovery } from './preload-recovery';

// Minimal stand-ins for the browser globals the recovery touches, so this stays
// a node-environment test (the project does not use jsdom).
function setUpBrowser() {
  const listeners = new Map<string, EventListener>();
  const reload = vi.fn();
  const entries = new Map<string, string>();

  vi.stubGlobal('window', {
    addEventListener: (type: string, listener: EventListener) => {
      listeners.set(type, listener);
    },
    location: { reload },
  });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
  });

  return {
    reload,
    entries,
    /** Dispatch `vite:preloadError` the way Vite's preload helper does. */
    dispatchPreloadError() {
      const event = new Event('vite:preloadError', { cancelable: true });
      listeners.get('vite:preloadError')?.(event);
      return event;
    },
  };
}

describe('installPreloadRecovery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reloads and swallows the rejection so React never renders an error', () => {
    const browser = setUpBrowser();
    installPreloadRecovery();

    const event = browser.dispatchPreloadError();

    expect(browser.reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(browser.entries.get(CHUNK_RELOAD_FLAG)).toBe('1');
  });

  it('never reload-loops: a second failure in the session surfaces instead', () => {
    const browser = setUpBrowser();
    installPreloadRecovery();

    browser.dispatchPreloadError();
    const second = browser.dispatchPreloadError();

    expect(browser.reload).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
  });

  it('recovers again once the route loader clears the shared flag', () => {
    const browser = setUpBrowser();
    installPreloadRecovery();

    browser.dispatchPreloadError();
    browser.entries.delete(CHUNK_RELOAD_FLAG); // lazyPage clears it on success
    browser.dispatchPreloadError();

    expect(browser.reload).toHaveBeenCalledTimes(2);
  });
});
