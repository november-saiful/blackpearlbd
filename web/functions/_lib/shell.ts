/**
 * The built app shell, read from the Pages asset store.
 *
 * Both routes that need the shell (every rendered page, and the sitemap, which
 * only reads the API origin out of it) go through here so there is one place
 * that knows what a shell looks like.
 */
import type { PagesEnv } from './types';

export async function loadShell(env: PagesEnv, url: URL): Promise<string | null> {
  const response = await env.ASSETS.fetch(
    new Request(new URL('/index.html', url.origin), { method: 'GET' }),
  );
  if (!response.ok) return null;
  const html = await response.text();
  // A 200 that is not the shell (the /assets/404 stub, say) must never be
  // decorated as though it were a page.
  return html.includes('<div id="root">') ? html : null;
}