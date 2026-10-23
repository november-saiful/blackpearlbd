/**
 * Puts the composed metadata and the crawlable body into the app shell.
 *
 * The shell is the built `index.html`: real asset URLs, the inline theme script,
 * and an empty `<div id="root">`. Everything here is a string edit against that
 * known shape, and every step is a no-op when its anchor is missing, so an
 * unexpected shell degrades to "served unannotated" rather than to broken HTML.
 */

const TITLE_TAG = /<title>[\s\S]*?<\/title>/i;
const DESCRIPTION_TAG = /<meta\s+name="description"[^>]*>/i;
const ROOT_ELEMENT = /<div id="root">\s*<\/div>/i;

/**
 * Compose the page: the page's own head tags in place of the shell's, and the
 * content skeleton inside the root element.
 *
 * `skeletonHtml` is left out entirely when it is empty: React's `createRoot`
 * clears the container on first commit, so injected content is never reconciled
 * and can never cause a hydration mismatch.
 */
export function composePage(shell: string, headHtml: string, skeletonHtml: string): string {
  if (!shell.includes('</head>')) return shell;

  let html = shell
    .replace(TITLE_TAG, '')
    .replace(DESCRIPTION_TAG, '')
    .replace('</head>', `    ${headHtml}\n  </head>`);

  if (skeletonHtml) {
    html = html.replace(ROOT_ELEMENT, `<div id="root">${skeletonHtml}</div>`);
  }

  return html;
}