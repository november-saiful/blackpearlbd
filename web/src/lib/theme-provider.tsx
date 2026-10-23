'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createGlassTheme, createGlassThemeTokens } from 'open-glass-ui/core'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'theme'

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  applyGlassTheme(resolved)
}

/*
 * OpenGlass's material is driven by two things that are scoped to its own theme
 * boundary by default: `[data-ogui-design="liquid"]` (which theme the recipes
 * and `--ogui-lg-*` tokens follow) and the `--ogui-color-*` palette. Radix
 * portals mount their content on document.body, outside any provider the app
 * renders, so without this a dialog's buttons, badges and menus would fall back
 * to the library's unthemed dark defaults.
 *
 * Mounting the same theme on the document root makes every OpenGlass class and
 * token resolve everywhere, portals included, and keeps the library in step
 * with the site's own light/dark toggle.
 */
function applyGlassTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.oguiDesign = 'liquid'
  root.dataset.oguiAppearance = resolved
  const tokens = createGlassThemeTokens(createGlassTheme(resolved))
  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next === 'system' ? getSystemTheme() : next)
  }, [])

  // Apply theme on mount and when resolvedTheme changes. A layout effect, not
  // a passive one: the OpenGlass palette has to be on the root before the first
  // paint, or recipe-styled controls flash the library's unthemed defaults.
  useLayoutEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemTheme(mql.matches ? 'dark' : 'light')
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
