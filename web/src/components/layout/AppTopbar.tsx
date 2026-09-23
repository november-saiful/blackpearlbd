import { useState, useCallback, useMemo, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Search,
  User,
  Home,
  Compass,
  LayoutDashboard,
  HelpCircle,
  Phone,
  Bookmark,
  Package,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { UserDropdown, type UserDropdownAction } from '@/components/ui/user-dropdown'
import {
  CommandPalette,
  type CommandItem,
} from '@/components/ui/command-palette'
import { NavigationSelect } from './NavigationSelect'
import { useTheme } from '@/lib/theme-provider'
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
        icon: Home as LucideIcon,
        hint: '/',
        onSelect: () => navigate('/'),
      },
      {
        id: 'deals',
        label: 'Tour Deals',
        group: 'Navigation',
        icon: Compass as LucideIcon,
        hint: '/deals',
        onSelect: () => navigate('/deals'),
      },
      {
        id: 'build-package',
        label: 'Build Package',
        group: 'Navigation',
        icon: BuildPackageIcon as LucideIcon,
        hint: '/build-package',
        onSelect: () => navigate('/build-package'),
      },
      {
        id: 'profile',
        label: 'My Profile',
        group: 'Navigation',
        icon: User as LucideIcon,
        hint: '/profile',
        onSelect: () => navigate('/profile'),
      },
    ]

    if (isAdmin) {
      items.push({
        id: 'admin-dashboard',
        label: 'Admin Dashboard',
        group: 'Admin',
        icon: LayoutDashboard as LucideIcon,
        hint: '/admin',
        onSelect: () => navigate('/admin'),
      })
    }

    items.push({
      id: 'help',
      label: 'Help & Support',
      group: 'Actions',
      icon: HelpCircle as LucideIcon,
      onSelect: () => window.open('https://blackpearl.travel/support', '_blank'),
    })

    return items
  }, [navigate, isAdmin, logout])

  const searchItems: CommandItem[] = useMemo(() => {
    if (!searchQuery.trim()) return []

    return results.slice(0, 10).map((result) => ({
      id: `search-${result.id}`,
      label: result.title,
      group: result.type === 'deal' ? 'Deals' : result.type === 'bookmark' ? 'Bookmarks' : 'Packages',
      icon: result.type === 'deal' ? Compass : result.type === 'bookmark' ? Bookmark : Package,
      hint: result.dealCode || undefined,
      onSelect: () => navigate(result.href),
    }))
  }, [searchQuery, results, navigate])

  const allItems = useMemo(() => {
    if (searchQuery.trim()) {
      // When searching, show search results, then "view all" link, then navigation
      const viewAllItem: CommandItem = {
        id: 'search-view-all',
        label: `View all results for "${searchQuery}"`,
        group: 'Search',
        icon: Search as LucideIcon,
        onSelect: () => navigate(`/search?q=${encodeURIComponent(searchQuery)}`),
      }
      return [...searchItems, viewAllItem, ...navigationItems]
    }
    return navigationItems
  }, [searchQuery, searchItems, navigationItems, navigate])

  return { items: allItems, searchQuery, setSearchQuery }
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
          window.open('https://blackpearl.travel/support', '_blank')
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

  // On the home route the topbar floats over the edge-to-edge hero:
  // fully transparent at the top of the page, solid once scrolled.
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

  const bookmarkItems: SwipeableListItem[] = bookmarks.map((deal) => ({
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
  }))

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

  return (
    <>
      <CommandPalette
        items={commandItems}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        placeholder="Search deals, packages, bookmarks…"
        onQueryChange={setSearchQuery}
      />

      <header
        className={cn(
          "z-50 flex h-16 shrink-0 items-center justify-between border-b py-4 px-4 md:h-20 md:pr-8 md:pl-6 lg:px-[var(--site-gutter)] transition-colors duration-300",
          isHome
            ? cn(
                "fixed inset-x-0 top-0",
                scrolled ? "bg-background" : "border-transparent bg-transparent",
              )
            : "sticky top-0 bg-background",
          className,
        )}
      >
        {/* Left: BlackPearl logo */}
        <Link to="/" className="flex shrink-0 items-center gap-2 z-10">
          <img src="/logo.svg" alt="BlackPearl" className="size-9 shrink-0 object-contain color-[hsl(var(--primary))]" />
          <span className="text-2xl font-semibold tracking-tight">
            BlackPearl
          </span>
        </Link>

        {/* Right: Navigation select + Search + Profile */}
        <div className="flex shrink-0 items-center gap-2 z-10">
          {/* Navigation select */}
          <NavigationSelect className="w-48" hideMobile />

          {/* Call button */}
          <Popover open={callOpen} onOpenChange={setCallOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="!h-11 !w-11 rounded-lg hidden md:flex"
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
                    window.location.href = 'tel:+8801928319460'
                  }}
                >
                  Call +880 192-831-9460
                </SlideActionButton>
              </div>
            </PopoverContent>
          </Popover>

          {/* Search button — opens command palette */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="!h-11 !w-11 rounded-lg"
            onClick={openPalette}
            aria-label="Open search (⌘K)"
          >
            <Search className="size-5" />
          </Button>

          {/* Bookmarks button */}
          <Popover open={bookmarkOpen} onOpenChange={handleBookmarkOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="!h-11 !w-11 rounded-lg relative"
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
      </header>
    </>
  )
}
