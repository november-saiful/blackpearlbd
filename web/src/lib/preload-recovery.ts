/**
 * Recovery for the failures Vite's module-preload helper raises when a chunk's
 * asset cannot be loaded — the symptom of a tab (or a cache entry) left over
 * from an earlier deploy.
 *
 * Background, because the two halves of this file only make sense together:
 * every file under /assets/ is content-hashed and served `immutable` for a
 * year. A redeploy therefore cannot correct anything already cached — so when a
 * build references an asset that the deployment does not contain (or that the
 * CDN answered with the SPA fallback HTML while it was missing), the browser
 * and the edge keep handing back that response until the URL itself changes.
 *
 * The helper rejects in two distinct situations, and they deserve opposite
 * handling:
 *
 *  1. A **stylesheet** failed ("Unable to preload CSS for ..."). The chunk
 *     itself still loads, so swallowing Vite's rethrow keeps the page readable
 *     minus some styling. Reloading here is what produced an endless reload
 *     loop: the retry hit the same cached response forever. Instead the page
 *     stays up and the poisoned cache entry is refreshed in the background, so
 *     the *next* visit gets the real file once the edge is clean.
 *
 *  2. A **script** chunk failed. There is no useful page without it, so this
 *     reloads — but only a couple of times per tab, with a cooldown between
 *     attempts, so a permanently broken asset surfaces as an error instead of
 *     an infinite reload. When the budget is spent the rejection is allowed to
 *     reach the route error boundary, which explains what to do.
 */
const ATTEMPTS_KEY = 'bp-chunk-reloads';

/** Reload budget per tab session, and the minimum gap between two attempts. */
const MAX_RELOADS = 2;
const RELOAD_COOLDOWN_MS = 15_000;

type Attempts = { count: number; lastAt: number };

/** Fallback for when sessionStorage is unavailable (private mode, blocked). */
let memoryAttempts: Attempts = { count: 0, lastAt: 0 };

function readAttempts(): Attempts {
  try {
    const raw = sessionStorage.getItem(ATTEMPTS_KEY);
    // Storage is authoritative when it is readable: a fresh session must start
    // with a full budget even if an earlier load left a count in memory.
    if (!raw) return { count: 0, lastAt: 0 };
    const parsed = JSON.parse(raw) as Partial<Attempts>;
    return {
      count: Number.isFinite(parsed.count) ? Number(parsed.count) : 0,
      lastAt: Number.isFinite(parsed.lastAt) ? Number(parsed.lastAt) : 0,
    };
  } catch {
    return memoryAttempts;
  }
}

function writeAttempts(attempts: Attempts): void {
  memoryAttempts = attempts;
  try {
    sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch {
    // The in-memory copy still bounds this page load.
  }
}

/**
 * True when a reload is worth trying: budget left, and not immediately after a
 * reload that evidently did not help (that gap is what makes the loop stop).
 */
export function canReloadForStaleBuild(now: number = Date.now()): boolean {
  const { count, lastAt } = readAttempts();
  if (count >= MAX_RELOADS) return false;
  // A missing timestamp means nothing has been attempted yet.
  return lastAt <= 0 || now - lastAt >= RELOAD_COOLDOWN_MS;
}

/** Claims a reload attempt and starts it. False when the budget is spent. */
export function reloadForStaleBuild(now: number = Date.now()): boolean {
  if (!canReloadForStaleBuild(now)) return false;
  writeAttempts({ count: readAttempts().count + 1, lastAt: now });
  window.location.reload();
  return true;
}

/** "Unable to preload CSS for /assets/x.css" — Vite's message for case 1. */
export function isCssPreloadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /unable to preload css/i.test(message);
}

/** The asset URL Vite named in a CSS preload failure, when it named one. */
export function preloadFailureUrl(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const match = /unable to preload css for (\S+)/i.exec(message);
  return match ? match[1] : null;
}

/**
 * Best-effort repair of a stale cache entry.
 *
 * `cache: 'reload'` bypasses the stored response *and* replaces it, which is
 * the only way out for a browser that already holds the SPA fallback HTML under
 * an asset URL — the entry is `immutable`, so nothing else would ever evict it.
 * That is exactly the state that makes "refresh" useless, so this runs in the
 * background while the page keeps working, and is deliberately limited to
 * same-origin build assets.
 */
export function refreshCachedAsset(url: string): void {
  try {
    const target = new URL(url, window.location.origin);
    if (target.origin !== window.location.origin) return;
    if (!target.pathname.startsWith('/assets/')) return;
    void fetch(target.href, { cache: 'reload' }).catch(() => {
      // Offline, blocked, or the file is genuinely gone — the caller has
      // already decided the page can live without it.
    });
  } catch {
    // Malformed URL: nothing to repair.
  }
}

export function installPreloadRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    // Vite types this event for us: `payload` is whatever the helper rejected
    // with, which is how we tell a stylesheet failure from a broken chunk.
    const reason = event.payload;

    if (isCssPreloadFailure(reason)) {
      // Keep the page: the chunk loads without its stylesheet, which beats an
      // error screen and, unlike a reload, cannot loop. The browser already
      // logged the MIME failure; nothing extra to report here.
      event.preventDefault();
      const failedUrl = preloadFailureUrl(reason);
      if (failedUrl) refreshCachedAsset(failedUrl);
      return;
    }

    if (!canReloadForStaleBuild()) {
      // Budget spent: let the rejection reach the route error boundary, which
      // tells the visitor the app was updated and offers a fresh load.
      return;
    }

    event.preventDefault();
    reloadForStaleBuild();
  });

  // A script chunk that comes back as HTML is reported by the module loader
  // before Vite sees it, so repair the named URL here too when we can.
  window.addEventListener(
    'error',
    (event) => {
      const target = event.target as HTMLScriptElement | null;
      if (target?.tagName === 'SCRIPT' && target.src) refreshCachedAsset(target.src);
    },
    true,
  );
}
