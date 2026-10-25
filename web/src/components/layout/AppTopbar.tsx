import { useState, useCallback, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Search,
  User,
  Home,
  Backpack,
  LayoutDashboard,
  HelpCircle,
  Phone,
  Bookmark,
  Package,
  Trash2,
  Mail,
  LogOut,
  ArrowRight,
  X,
} from '@/components/ui/icons'
import type { IconComponent } from '@/components/ui/icons'
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon'
import { MenuAltIcon } from '@/components/icons/MenuAltIcon'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { LanguageGlobe } from '@/components/ui/language-globe'
import { UserDropdown, type UserDropdownAction } from '@/components/ui/user-dropdown'
import {
  CommandPalette,
  type CommandItem,
} from '@/components/ui/command-palette'
import { useTheme } from '@/lib/theme-provider'
import { onOpenSearchPalette } from '@/lib/search-palette'
import { useContentLocale } from '@/lib/locale'
import { isLocaleRevealRunning, toggleLocaleWithReveal } from '@/lib/locale-reveal'
import { useLocalizedDeals } from '@/lib/deal-locale'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { SlideActionButton } from '@/components/ui/slide-action-button'
import { SwipeableList, type SwipeableListItem } from '@/components/ui/swipeable-list'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { useBookmarkSync } from '@/hooks/useBookmarks';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

import { formatCurrency } from '@/lib/utils'
import { formatDealLocation } from '@/components/deals/deals-destination'

const PRIMARY_NAV = [
  { href: '/', label: 'Home' },
  { href: '/deals', label: 'Tour Deals' },
  { href: '/build-package', label: 'Build Package' },
] as const

const SUPPORT_URL = 'https://blackpearl.travel/support'
const CONTACT_EMAIL = 'mailto:team@blackpearl.bd'
const CONTACT_PHONE = '+8801897655530'

type QuickLink = {
  href: string
  title: string
  desc: string
  icon: IconComponent
  external?: boolean
}

const QUICK_LINKS: QuickLink[] = [
  {
    href: '/profile',
    title: 'My Profile',
    desc: 'Bookings, pearls and account settings.',
    icon: User,
  },
  {
    href: SUPPORT_URL,
    title: 'Support',
    desc: 'Help with an existing booking.',
    icon: HelpCircle,
    external: true,
  },
  {
    href: CONTACT_EMAIL,
    title: 'Contact',
    desc: 'Talk to the team about a custom trip.',
    icon: Mail,
    external: true,
  },
]

function useCommandPaletteItems() {
  const navigate = useNavigate()
  const { isAdmin, logout } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const { results } = useGlobalSearch(searchQuery)

  const navigationItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      {
        id: 'home',
        label: 'Home',
        group: 'Navigation',
        icon: Home as IconComponent,
        hint: '/',
        onSelect: () => navigate('/'),
      },
      {
        id: 'deals',
        label: 'Tour Deals',
        group: 'Navigation',
        icon: Backpack as IconComponent,
        hint: '/deals',
        onSelect: () => navigate('/deals'),
      },
      {
        id: 'build-package',
        label: 'Build Package',
        group: 'Navigation',
        icon: BuildPackageIcon as IconComponent,
        hint: '/build-package',
        onSelect: () => navigate('/build-package'),
      },
      {
        id: 'profile',
        label: 'My Profile',
        group: 'Navigation',
        icon: User as IconComponent,
        hint: '/profile',
        onSelect: () => navigate('/profile'),
      },
    ]

    if (isAdmin) {
      items.push({
        id: 'admin-dashboard',
        label: 'Admin Dashboard',
        group: 'Admin',
        icon: LayoutDashboard as IconComponent,
        hint: '/admin',
        onSelect: () => navigate('/admin'),
      })
    }

    items.push({
      id: 'help',
      label: 'Help & Support',
      group: 'Actions',
      icon: HelpCircle as IconComponent,
      onSelect: () => window.open(SUPPORT_URL, '_blank'),
    })

    return items
  }, [navigate, isAdmin, logout])

  const searchItems: CommandItem[] = useMemo(() => {
    if (!searchQuery.trim()) return []

    return results.slice(0, 10).map((result) => ({
      id: `search-${result.id}`,
      label: result.title,
      group: result.type === 'deal' ? 'Deals' : result.type === 'bookmark' ? 'Bookmarks' : 'Packages',
      icon: result.type === 'deal' ? Backpack : result.type === 'bookmark' ? Bookmark : Package,
      hint: result.dealCode || undefined,
      onSelect: () => navigate(result.href),
    }))
  }, [searchQuery, results, navigate])

  const allItems = useMemo(() => {
    if (searchQuery.trim()) {
      const viewAllItem: CommandItem = {
        id: 'search-view-all',
        label: `View all results for "${searchQuery}"`,
        group: 'Search',
        icon: Search as IconComponent,
        onSelect: () => navigate(`/search?q=${encodeURIComponent(searchQuery)}`),
      }
      return [...searchItems, viewAllItem, ...navigationItems]
    }
    return navigationItems
  }, [searchQuery, searchItems, navigationItems, navigate])

  return { items: allItems, searchQuery, setSearchQuery }
}

function NavLinkItem({
  href,
  label,
  active,
  onNavigate,
  className,
}: {
  href: string
  label: string
  active: boolean
  onNavigate?: () => void
  className?: string
}) {
  return (
    <Link
      to={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium leading-none transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'hover:bg-white/45 hover:text-accent-foreground dark:hover:bg-white/10',
        active
          ? 'glass-chip text-foreground'
          : 'text-muted-foreground',
        className,
      )}
    >
      {label}
    </Link>
  )
}

/**
 * Content-language switch. Site chrome stays in English; this only changes the
 * language tour copy is read in. The globe's lettering morphs between EN and
 * বাং in place, so the control never changes size.
 */
function LocaleSwitch({ className }: { className?: string }) {
  const { locale, toggleLocale } = useContentLocale()
  const current = locale === 'en' ? 'English' : 'Bengali'
  const next = locale === 'en' ? 'Bengali' : 'English'

  return (
    <button
      type="button"
      onClick={(event) => toggleLocaleWithReveal(event, toggleLocale)}
      lang="en"
      aria-label={`Content language: ${current}. Switch to ${next}`}
      title={`Switch content to ${next}`}
      className={cn(
        'glass-field inline-flex !size-11 shrink-0 items-center justify-center rounded-lg p-1.5 text-foreground transition-colors hover:text-foreground/75',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <LanguageGlobe locale={locale} instant={isLocaleRevealRunning()} />
    </button>
  )
}

export function AppTopbar({ className }: { className?: string }) {
  const { user, profile, isAdmin, isAuthenticated, signInWithGoogle, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [bookmarkOpen, setBookmarkOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { items: commandItems, searchQuery, setSearchQuery } = useCommandPaletteItems()
  const { bookmarks, removeBookmark } = useBookmarkStore()
  const { bookmarkCount } = useBookmarkSync()
  const navigate = useNavigate()

  const initials = useMemo(() => {
    const source = (profile?.full_name || user?.email || '').trim()
    if (!source) return 'G'
    const words = source.split(/\s+/)
    const letters = words.length > 1 ? words[0][0] + words[1][0] : source.slice(0, 2)
    return letters.toUpperCase()
  }, [profile?.full_name, user?.email])

  const handleAccountAction = useCallback(
    (action: UserDropdownAction) => {
      switch (action) {
        case 'profile':
          navigate('/profile')
          break
        case 'admin':
          navigate('/admin')
          break
        case 'help':
          window.open(SUPPORT_URL, '_blank')
          break
        case 'logout':
          logout()
          break
        case 'signin':
          signInWithGoogle()
          break
      }
    },
    [navigate, logout, signInWithGoogle],
  )

  const openPalette = useCallback(() => setPaletteOpen(true), [])

  // The mobile dock's search item lives outside this tree, so it opens the
  // palette through the shared event rather than a prop chain.
  useEffect(() => onOpenSearchPalette(openPalette), [openPalette])

  // On the home route the topbar floats over the edge-to-edge hero: fully
  // transparent at the top of the page, solid once scrolled.
  useEffect(() => {
    if (!isHome) {
      setScrolled(false)
      return
    }
    // The app scrolls in AppShell's nested overflow-y-auto container, not window.
    const container = document.querySelector('.overflow-y-auto')
    if (!container) return
    const onScroll = () => setScrolled((container as HTMLElement).scrollTop > 8)
    onScroll()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [isHome])

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [mobileOpen])

  const localizedBookmarks = useLocalizedDeals(bookmarks)

  const bookmarkItems: SwipeableListItem[] = localizedBookmarks.map((deal) => {
    return {
      id: deal.id,
      title: deal.title,
      description: formatDealLocation(deal.destination, deal.sub_destination),
      meta: formatCurrency(deal.price),
      leading: (
        <img
          src={deal.image_url || '/placeholder-deal.jpg'}
          alt={deal.title}
          className="w-12 h-12 rounded-lg object-cover"
        />
      ),
      rightActions: [
        {
          id: 'remove',
          label: 'Remove',
          icon: <Trash2 className="h-4 w-4" />,
          tone: 'danger' as const,
          onClick: () => removeBookmark(deal.id),
        },
      ],
    }
  })

  const handleBookmarkClick = useCallback((item: SwipeableListItem) => {
    const deal = bookmarks.find((b) => b.id === item.id);
    if (deal?.slug) {
      setBookmarkOpen(false);
      navigate(`/deals/${deal.slug}`);
    }
  }, [bookmarks, navigate])

  const handleBookmarkOpen = useCallback((open: boolean) => {
    setBookmarkOpen(open)
  }, [])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  // The promo strip belongs to the home hero only.
  const showAnnouncement = isHome && !scrolled

  return (
    <>
      <CommandPalette
        items={commandItems}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        placeholder="Search deals, packages, bookmarks…"
        onQueryChange={setSearchQuery}
      />

      {/*
       * The hero follows the active theme, so the floating topbar uses the
       * same tokens. Scrolling switches the header to its solid state.
       */}
      <div
        className={cn(
          'z-50',
          isHome ? 'fixed inset-x-0 top-0' : 'sticky top-0',
        )}
      >
        {/*
         * The strip stays mounted and collapses instead of unmounting, because
         * unmounting moved the whole topbar up by the strip's height in a single
         * frame the moment the page started moving. See `.announcement-collapse`.
         */}
        {isHome && (
          <div
            aria-hidden={!showAnnouncement}
            className={cn('announcement-collapse', !showAnnouncement && 'is-closed')}
          >
            <div>
              <div className="w-full border-b border-white/40 bg-gradient-to-r from-secondary/60 via-white/80 to-white/70 dark:border-white/10 dark:from-white/10 dark:via-white/5 dark:to-transparent">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs sm:text-sm">
                  <span className="glass-chip rounded px-1.5 py-0.5 font-medium text-foreground">
                    New
                  </span>
                  <span className="hidden text-muted-foreground sm:inline">
                    Winter escapes are live: handpicked tours across Cox's Bazar, Sylhet and the Sundarbans.
                  </span>
                  <span className="text-muted-foreground sm:hidden">
                    Winter escapes are live
                  </span>
                  <Link
                    to="/deals"
                    tabIndex={showAnnouncement ? 0 : -1}
                    className="group inline-flex items-center gap-1 whitespace-nowrap text-foreground underline decoration-muted-foreground/60 decoration-dashed underline-offset-4 hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Explore deals
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <header
          className={cn(
            'z-50 border-b px-4 text-foreground transition-[background-color,box-shadow] duration-300 md:px-6 lg:px-[var(--site-gutter)]',
            isHome
              ? cn(
                  'border-transparent',
                  scrolled && 'glass-bar border-transparent',
                )
              : 'glass-bar border-transparent',
            className,
          )}
        >
          <div className="flex h-16 items-center justify-between gap-3 md:h-20">
            {/* Left: burger + brand + desktop nav */}
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((open) => !open)}
                className={cn(
                  'group relative grid size-9 shrink-0 place-items-center rounded-md lg:hidden',
                  'text-muted-foreground hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <MenuAltIcon
                  className={cn(
                    'col-start-1 row-start-1 size-5 transition-all duration-200',
                    mobileOpen ? 'scale-75 opacity-0' : 'scale-100 opacity-100',
                  )}
                />
                <X
                  className={cn(
                    'col-start-1 row-start-1 size-5 transition-all duration-200',
                    mobileOpen ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                  )}
                  strokeWidth={1.8}
                />
              </button>

              <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="BlackPearl home">
                <img
                  src="/logo.svg"
                  alt=""
                  className="size-9 shrink-0 object-contain dark:invert"
                />
                <span className="max-[359px]:hidden text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">
                  BlackPearl
                </span>
              </Link>

              <nav className="ml-4 hidden items-center gap-1 lg:flex">
                {PRIMARY_NAV.map((item) => (
                  <NavLinkItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={isActive(item.href)}
                  />
                ))}

                {/* Quick links hover panel */}
                <div className="relative group">
                  <button
                    type="button"
                    aria-haspopup="true"
                    className={cn(
                      'inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium leading-none text-muted-foreground transition-colors',
                      'hover:bg-white/45 hover:text-accent-foreground dark:hover:bg-white/10',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    More
                  </button>
                  <div
                    className={cn(
                      'pointer-events-none absolute left-1/2 top-full z-40 -translate-x-1/2 pt-2 opacity-0 transition',
                      'group-hover:pointer-events-auto group-hover:opacity-100',
                      'group-focus-within:pointer-events-auto group-focus-within:opacity-100',
                    )}
                  >
                    <div className="glass-strong w-[340px] rounded-xl p-2">
                      <ul className="space-y-1">
                        {QUICK_LINKS.map((link) => (
                          <li key={link.href}>
                            <a
                              href={link.href}
                              target={link.external ? '_blank' : undefined}
                              rel={link.external ? 'noreferrer' : undefined}
                              className="flex items-start gap-3 rounded-lg border border-transparent p-2.5 transition hover:border-white/40 hover:bg-white/45 dark:hover:border-white/10 dark:hover:bg-white/10"
                            >
                              <link.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-foreground">
                                  {link.title}
                                </span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {link.desc}
                                </span>
                              </span>
                            </a>
                          </li>
                        ))}
                        {isAdmin && (
                          <li>
                            <Link
                              to="/admin"
                              className="flex items-start gap-3 rounded-lg border border-transparent p-2.5 transition hover:border-white/40 hover:bg-white/45 dark:hover:border-white/10 dark:hover:bg-white/10"
                            >
                              <LayoutDashboard className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-foreground">
                                  Admin Panel
                                </span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  Manage deals, bookings and media.
                                </span>
                              </span>
                            </Link>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </nav>
            </div>

            {/* Right: search + actions + profile */}
            <div className="flex shrink-0 items-center gap-2">
              {/* Search: styled like an input, opens the command palette */}
              <button
                type="button"
                onClick={openPalette}
                aria-label="Open search (⌘K)"
                className={cn(
                  'glass-field hidden h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors xl:flex',
                  'w-64 2xl:w-72',
                  'hover:bg-white/65 hover:text-foreground dark:hover:bg-white/10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <Search className="size-4 shrink-0" />
                <span className="truncate">Search deals…</span>
                <kbd className="glass-chip ml-auto rounded px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  ⌘K
                </kbd>
              </button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="!size-11 hidden rounded-lg md:flex xl:hidden"
                onClick={openPalette}
                aria-label="Open search (⌘K)"
              >
                <Search className="size-5" />
              </Button>

              {/* Call button */}
              <Popover open={callOpen} onOpenChange={setCallOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="!size-11 hidden rounded-lg md:flex"
                    aria-label="Call us"
                  >
                    <Phone className="size-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="end"
                  sideOffset={8}
                  className="w-auto p-4"
                >
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm font-medium text-foreground">
                      Slide to call us
                    </p>
                    <SlideActionButton
                      completeLabel="Calling…"
                      onComplete={() => {
                        window.location.href = `tel:${CONTACT_PHONE}`
                      }}
                    >
                      Call +880 1897655530
                    </SlideActionButton>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Content language */}
              <LocaleSwitch className="shrink-0" />

              {/* Bookmarks button */}
              <Popover open={bookmarkOpen} onOpenChange={handleBookmarkOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="!size-11 relative rounded-lg"
                    aria-label="Open bookmarks"
                  >
                    <Bookmark className="size-5" />
                    {bookmarks.length > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                        {bookmarks.length > 9 ? '9+' : bookmarks.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="end"
                  sideOffset={8}
                  className="w-80 p-4"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">Bookmarks</h3>
                      <span className="text-xs text-muted-foreground">
                        {bookmarks.length} saved
                      </span>
                    </div>

                    {bookmarks.length === 0 ? (
                      <div className="text-center py-8">
                        <Bookmark className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          No bookmarks yet
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Click the bookmark icon on any tour to save it here
                        </p>
                      </div>
                    ) : (
                      <SwipeableList
                        items={bookmarkItems}
                        closeOnAction={true}
                        renderItem={(item) => (
                          <div
                            role="button"
                            tabIndex={0}
                            className="flex min-w-0 items-center gap-3 w-full cursor-pointer"
                            onClick={() => handleBookmarkClick(item)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') handleBookmarkClick(item);
                            }}
                          >
                            {item.leading && (
                              <div className="shrink-0">{item.leading}</div>
                            )}
                            <div className="min-w-0 flex-1">
                              {item.title && (
                                <div className="truncate text-sm font-medium text-foreground">
                                  {item.title}
                                </div>
                              )}
                              {item.description && (
                                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {item.description}
                                </div>
                              )}
                            </div>
                            {item.meta && (
                              <div className="shrink-0 text-xs font-medium text-muted-foreground">
                                {item.meta}
                              </div>
                            )}
                            {/*
                             * Always-visible delete, in addition to the row's own
                             * swipe action: the swipe is undiscoverable on a
                             * desktop, and reaching for it shouldn't be the only
                             * way to remove a bookmark.
                             */}
                            <button
                              type="button"
                              title="Remove bookmark"
                              aria-label={
                                typeof item.title === 'string'
                                  ? `Remove ${item.title} from bookmarks`
                                  : 'Remove from bookmarks'
                              }
                              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                removeBookmark(item.id);
                              }}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        classNames={{
                          item: "rounded-lg",
                          surface: "rounded-lg",
                        }}
                      />
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <UserDropdown
                user={{
                  name: isAuthenticated ? profile?.full_name || 'User' : 'Guest',
                  username: isAuthenticated ? user?.email || '' : 'Sign in to access your profile',
                  avatar: profile?.avatar_url,
                  initials,
                }}
                isAuthenticated={isAuthenticated}
                isAdmin={isAdmin}
                theme={theme}
                onThemeChange={setTheme}
                onAction={handleAccountAction}
              />
            </div>
          </div>
        </header>
      </div>

      {/* Portalled to the body: the shell's scroll container is its own
          stacking context, so an in-tree drawer paints under the dock. */}
      {createPortal(
        <div
          className={cn(
            'fixed inset-0 z-[120] lg:hidden transition',
            mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          aria-hidden={!mobileOpen}
        >
        <div
          className={cn(
            'glass-scrim absolute inset-0 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMobileOpen(false)}
        />

        <aside
          className={cn(
            'glass-strong absolute left-0 top-0 h-full w-80 max-w-[calc(100vw-0.75rem)] overflow-y-auto rounded-r-2xl p-4 transition-transform',
            mobileOpen ? 'translate-x-0' : 'translate-x-[-100%]',
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <div className="mb-4 flex items-center justify-between">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2"
              aria-label="BlackPearl home"
            >
              <img src="/logo.svg" alt="" className="size-8 object-contain dark:invert" />
              <span className="text-lg font-semibold tracking-tight">BlackPearl</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="glass-field inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setMobileOpen(false)
              openPalette()
            }}
            className="glass-field mb-4 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search className="size-4 shrink-0" />
            Search deals, packages…
          </button>

          <div className="glass-chip mb-4 flex items-center justify-between rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-muted-foreground">
              Language
            </span>
            <LocaleSwitch />
          </div>

          <nav className="space-y-1">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'block rounded-md px-2.5 py-2 text-sm font-medium',
                  'hover:bg-white/45 hover:text-accent-foreground dark:hover:bg-white/10',
                  isActive(item.href)
                    ? 'glass-chip text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Call Us
            </div>
            <div className="glass-field rounded-xl p-3">
              <p className="mb-2 text-center text-xs text-muted-foreground">
                Slide to call
              </p>
              <SlideActionButton
                className="w-full"
                completeLabel="Calling…"
                onComplete={() => {
                  setMobileOpen(false)
                  window.location.href = `tel:${CONTACT_PHONE}`
                }}
              >
                Call +880 1897655530
              </SlideActionButton>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick Links
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noreferrer' : undefined}
                  onClick={() => setMobileOpen(false)}
                  className="glass-chip flex items-start gap-2 rounded-lg p-2 text-sm text-foreground hover:bg-white/60 dark:hover:bg-white/10"
                >
                  <link.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{link.title}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            {isAuthenticated ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setMobileOpen(false)
                    navigate('/profile')
                  }}
                >
                  <User className="size-4" />
                  My Profile
                </Button>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setMobileOpen(false)
                      navigate('/admin')
                    }}
                  >
                    <LayoutDashboard className="size-4" />
                    Admin Panel
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setMobileOpen(false)
                    logout()
                  }}
                >
                  <LogOut className="size-4" />
                  Logout
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setMobileOpen(false)
                  signInWithGoogle()
                }}
              >
                Sign in with Google
              </Button>
            )}
          </div>
        </aside>
        </div>,
        document.body,
      )}
    </>
  )
}
