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
 * The fallback is for crawlers and for readers with scripting off, not for the
 * gap before React mounts: painted raw it is a wall of unstyled text. Hiding it
 * keeps it in the served markup while leaving the first paint to the app; the
 * noscript rule restores it when there is no React to replace it.
 */
const FALLBACK_STYLE =
  '<style>[data-seo-skeleton]{display:none!important}</style>' +
  '<noscript><style>[data-seo-skeleton]{display:block!important}</style></noscript>';

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

  const head = skeletonHtml ? `${headHtml}\n    ${FALLBACK_STYLE}` : headHtml;
  let html = shell
    .replace(TITLE_TAG, '')
    .replace(DESCRIPTION_TAG, '')
    .replace('</head>', `    ${head}\n  </head>`);

  if (skeletonHtml) {
    html = html.replace(
      ROOT_ELEMENT,
      `<div id="root"><div data-seo-skeleton>${skeletonHtml}</div></div>`,
    );
  }

  return html;
}