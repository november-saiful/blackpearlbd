import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import type { OutputBundle, OutputChunk } from 'rollup'
import react from '@vitejs/plugin-react'
import path from 'path'

// `[url prefix, hashed chunk, [hashed css]]`, matched in order.
type RoutePreload = [string, string, string[]]

// Every route but Home is a lazy chunk, so its download only starts once React
// renders and the page skeleton stays up for the whole fetch. The chunk names
// carry a content hash, so the document cannot name them; this plugin reads
// them from the bundle and teaches the page which one its URL needs. Home is
// not listed: it is part of the entry bundle and has no skeleton window.
function routePreloadPlugin(): Plugin {
  const routes: Array<{ match: string; page: string }> = [
    { match: '/deals/', page: 'DealDetail' },
    { match: '/deals', page: 'Deals' },
    { match: '/build-package', page: 'BuildPackage' },
    { match: '/search', page: 'SearchResults' },
    { match: '/profile', page: 'Profile' },
    { match: '/auth/callback', page: 'AuthCallback' },
    { match: '/admin/users', page: 'Admin/Users' },
    { match: '/admin/deals', page: 'Admin/Deals' },
    { match: '/admin/bookings', page: 'Admin/Bookings' },
    { match: '/admin/custom-packages', page: 'Admin/CustomPackages' },
    { match: '/admin/reviews', page: 'Admin/Reviews' },
    { match: '/admin/media', page: 'Admin/Media' },
    { match: '/admin', page: 'Admin/Dashboard' },
  ]

  return {
    name: 'route-preload',
    apply: 'build',
    transformIndexHtml: {
      // The bundle the HTML refers to only exists after Rollup has run.
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        const chunks = Object.values(ctx.bundle as OutputBundle).filter(
          (out): out is OutputChunk & { viteMetadata?: { importedCss?: Set<string> } } =>
            out.type === 'chunk',
        )
        const preloads: RoutePreload[] = []
        for (const route of routes) {
          // Not every route gets a chunk of its own: Deals shares one with its
          // filter modules and has no facade, so find the chunk that carries the
          // page module rather than the chunk named after it.
          const page = `/src/pages/${route.page}.tsx`
          const chunk = chunks.find(
            (c) =>
              !c.isEntry &&
              Object.keys(c.modules).some((id) => id.replace(/\\/g, '/').endsWith(page)),
          )
          if (!chunk) continue
          const css: string[] = []
          chunk.viteMetadata?.importedCss?.forEach((file) => css.push(`/${file}`))
          preloads.push([route.match, `/${chunk.fileName}`, css])
        }
        if (preloads.length === 0) return html

        // Plain ES5: this runs before the entry module, in every browser the
        // site supports. An exact match for a single path, a prefix for one
        // ending in a slash. The route chunk's own imports are covered by the
        // modulepreload's dependency fetch, and the vendor chunks are already
        // preloaded by the entry.
        const script = [
          '(function(){',
          `var routes=${JSON.stringify(preloads)};`,
          'var p=location.pathname.replace(/\\/+$/,"")||"/";',
          'for(var i=0;i<routes.length;i++){',
          'var r=routes[i],m=r[0];',
          'var hit=m.charAt(m.length-1)==="/"?p.indexOf(m)===0:p===m;',
          'if(!hit)continue;',
          'var head=document.head;',
          'var js=document.createElement("link");',
          'js.rel="modulepreload";js.crossOrigin="";js.href=r[1];head.appendChild(js);',
          'for(var j=0;j<r[2].length;j++){',
          'var css=document.createElement("link");',
          'css.rel="preload";css.as="style";css.crossOrigin="";css.href=r[2][j];head.appendChild(css);',
          '}',
          'return;',
          '}',
          '})();',
        ].join('')

        return {
          html,
          tags: [{ tag: 'script', children: script, injectTo: 'head-prepend' }],
        }
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const apiOrigin = loadEnv(mode, process.cwd(), '').VITE_API_URL

  return {
    plugins: [
      react(),
      routePreloadPlugin(),
      {
        // Vite cannot substitute an env var inside a URL attribute when the
        // variable is missing; the literal `%VITE_API_URL%` then fails the HTML
        // build as a malformed URI. Add the tag only when there is an origin.
        name: 'inject-api-preconnect',
        transformIndexHtml(html) {
          if (!apiOrigin || !/^https?:\/\/[^\s"']+$/.test(apiOrigin)) return html
          return {
            html,
            tags: [
              {
                tag: 'link',
                attrs: { rel: 'preconnect', href: apiOrigin, crossorigin: '' },
                injectTo: 'head',
              },
            ],
          }
        },
      },
    ],
    test: {
      exclude: ['e2e/**', 'node_modules/**'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
    },
    build: {
      rollupOptions: {
        output: {
          // Asset URLs use a dot before the content hash (`chunk.a1b2c3.js`)
          // rather than Vite's default dash. A response cached under an asset
          // URL outlives any deploy, browsers and the CDN hold it `immutable`
          // for a year, so a URL that was ever answered with the SPA fallback
          // stays broken for whoever holds it, including after the file is back.
          // One scheme change retires every URL cached under the old one, so the
          // affected clients stop asking for it. See src/lib/preload-recovery.ts
          // and public/assets/404.html for the rest of the defence.
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash][extname]',
          manualChunks: {
            // ── Core React ecosystem ──────────────────────────────────
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],

            // ── Data fetching & state ─────────────────────────────────
            'vendor-data': ['@tanstack/react-query', 'zustand'],

            // ── UI primitives (Radix + Tailwind) ──────────────────────
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-label',
              '@radix-ui/react-popover',
              '@radix-ui/react-select',
              '@radix-ui/react-slot',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
              '@radix-ui/react-tooltip',
              'class-variance-authority',
              'clsx',
              'tailwind-merge',
            ],

            // ── Icons ────────────────────────────────────────────────
            'vendor-icons': ['@hugeicons/react', '@hugeicons/core-free-icons'],

            // PDF generation is deliberately not grouped here. jspdf and its
            // canvas renderer are reachable only through a dynamic import in
            // useBookings, and a manual chunk for them also becomes the home of
            // Vite's preload helper, which makes the entry import the whole
            // 150 kB chunk up front.

            // ── Forms & validation ─────────────────────────────────────
            'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],

            // ── Auth (Supabase) ───────────────────────────────────────
            'vendor-auth': ['@supabase/supabase-js'],
          },
        },
      },
      // Warn when any chunk exceeds 400 kB (before it was 500 kB warning)
      chunkSizeWarningLimit: 400,
    },
  }
})
