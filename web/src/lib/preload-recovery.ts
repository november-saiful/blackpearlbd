/**
 * Recovery for Vite's module-preload failures that happen across a deploy.
 *
 * Everything under /assets/ is content-hashed and served `immutable` for a
 * year, so a tab that is still running the build from before the last deploy
 * keeps executing those cached chunks — even after the browser is closed and
 * reopened, because a restored tab boots from the cache instead of revalidating
 * the document. When such a chunk lazily imports a page, Vite injects a
 * <link rel="stylesheet"> for the CSS that page needs and rejects with
 * `Unable to preload CSS for /assets/<old-name>-<hash>.css` if that link
 * errors — which is what happens once a redeploy has renamed or removed the
 * file and the host answers the request with the SPA fallback (HTML) instead of
 * a 404.
 *
 * Vite emits `vite:preloadError` for the rejection and rethrows it unless a
 * listener calls preventDefault(), which is how it used to reach React Router's
 * error boundary as "Unexpected Application Error!". Swallow it and reload once
 * per session instead: a fresh index.html only references chunks that exist.
 *
 * The flag is shared with the route-level recovery in router.tsx so both paths
 * allow at most one automatic reload per session and can never reload-loop.
 */
export const CHUNK_RELOAD_FLAG = 'bp-chunk-reload';

export function installPreloadRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
      // Already tried a reload this session: let the rejection surface so the
      // route error boundary can show its "app was updated" card.
      return;
    }

    // Swallow Vite's rethrow — we recover below, so it never hits React.
    event.preventDefault();
    sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
    window.location.reload();
  });
}
