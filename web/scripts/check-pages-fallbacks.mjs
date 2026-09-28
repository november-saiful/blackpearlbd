/**
 * Fails the build when a missing asset could again be answered with the app
 * shell, which is how the `/assets/lightbox-*.css` outage became permanent.
 *
 * `_redirects` runs before the 404 handler, and its catch-all
 * `/*  /index.html  200` is there so a deep link like /deals reaches the SPA.
 * The same rule also swallows misses under /assets/, where the build output
 * lives. A missing asset answered `200 text/html` is then cached under the
 * `/assets/*` rule in `_headers` — `immutable`, one year — so the response
 * outlives the deploy that puts the file back and every client holding it keeps
 * failing. That is why the repair had to change every asset URL rather than
 * re-upload one file.
 *
 * Two things keep the fallback honest. Both are easy to undo by accident, and
 * neither is visible in a normal build, so they are asserted here:
 *
 *   1. `public/assets/404.html` — a 404 page inside a directory makes Pages
 *      answer unmatched requests under that directory with a real 404, at any
 *      depth and with any query string, while root-level SPA routing keeps
 *      working. Verified against production: /assets/zzz.js, /assets/sub/z.js,
 *      /assets/ and /assets/z.js/ all return 404 with `no-store`, so the edge
 *      cannot cache the miss either.
 *
 *   2. Nothing in `_redirects` may match a path under /assets/. Such a rule
 *      would run first and shadow that 404 — and `_redirects` cannot express a
 *      404 of its own ("Rewrites (other status codes)" are unsupported:
 *      https://developers.cloudflare.com/pages/configuration/redirects/), so
 *      the only rule available would rewrite the miss to something cacheable.
 *
 * A root-level `404.html` is refused for the opposite reason: it covers every
 * unmatched path, so /deals and /profile would 404 before the SPA ever routed
 * them.
 *
 * Usage: node scripts/check-pages-fallbacks.mjs [--dist <dir>]
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const distFlag = argv.indexOf('--dist')
const distDir = resolve(distFlag === -1 ? 'dist' : argv[distFlag + 1] ?? 'dist')

const checks = []

/** @param {string} what @param {boolean} ok @param {string} detail */
function check(what, ok, detail) {
  checks.push({ what, ok, detail })
}

function readIfPresent(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

if (!existsSync(distDir)) {
  console.error(
    `Cannot check the Pages fallbacks: ${distDir} does not exist.\n` +
      'Run the build first (npm run build), or pass --dist <dir>.',
  )
  process.exit(1)
}

// ── 1. Asset misses must have somewhere to land ───────────────────────────────
const assetStub = join(distDir, 'assets', '404.html')
check(
  'assets/404.html exists',
  existsSync(assetStub),
  'Without it, every unmatched path under /assets/ falls through to the SPA ' +
    'rewrite: 200 text/html cached immutable for a year.',
)

// ── 2. ...but only under /assets/, never at the root ──────────────────────────
const rootStub = join(distDir, '404.html')
check(
  'no root 404.html',
  !existsSync(rootStub),
  'A root 404.html covers every unmatched path, so deep links like /deals and ' +
    '/profile would 404 before the SPA could route them.',
)

// ── 3. The SPA fallback stays, and stays away from /assets/ ───────────────────
const redirectsFile = join(distDir, '_redirects')
const redirects = readIfPresent(redirectsFile)

check(
  '_redirects is present',
  redirects !== null,
  'Pages needs it to route deep links to the SPA.',
)

if (redirects !== null) {
  const rules = redirects
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => {
      const [source, destination, code] = line.split(/\s+/)
      return { source, destination, code: Number(code) || 302 }
    })

  check(
    '_redirects still routes deep links to the SPA',
    rules.some((rule) => rule.destination === '/index.html' && rule.code === 200),
    'Without `/*  /index.html  200`, client-side routes stop resolving.',
  )

  const assetRules = rules.filter((rule) => /^\/assets(?:\/|$)/.test(rule.source))
  check(
    '_redirects leaves /assets/* alone',
    assetRules.length === 0,
    'A rule matching /assets/ runs before the 404 handler and shadows it, so ' +
      `asset misses would be answered with HTML again: ${assetRules
        .map((rule) => `${rule.source} -> ${rule.destination} ${rule.code}`)
        .join(', ')}`,
  )
}

// ── Report ────────────────────────────────────────────────────────────────────
for (const { what, ok, detail } of checks) {
  process.stdout.write(`${ok ? 'ok   ' : 'FAIL '}${what}\n`)
  if (!ok) process.stdout.write(`     ${detail}\n`)
}

const failed = checks.filter((c) => !c.ok).length
if (failed > 0) {
  process.stdout.write(
    `\n${failed} Pages fallback ${failed === 1 ? 'check' : 'checks'} failed. ` +
      'A missing asset would be served as the app shell, and the edge would ' +
      'cache that answer for up to a year.\n',
  )
  process.exit(1)
}

process.stdout.write(
  `\nPages fallbacks look right: asset misses 404, app routes still reach the SPA.\n`,
)
