import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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

          // ── PDF generation (lazy-loaded by BookingCard/InvoiceGenerator) ──
          'vendor-pdf': ['jspdf', 'jspdf-autotable', 'canvg'],

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
})
