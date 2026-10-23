import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const apiOrigin = loadEnv(mode, process.cwd(), '').VITE_API_URL

  return {
    plugins: [
      react(),
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

            // ── Icons (lucide is large) ───────────────────────────────
            'vendor-icons': ['lucide-react'],

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
