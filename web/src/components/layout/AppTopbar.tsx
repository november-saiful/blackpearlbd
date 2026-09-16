import { useState, useCallback, useMemo, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Search,
  User,
  LogOut,
  Home,
  Compass,
  LayoutDashboard,
  Users,
  Calendar,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  Phone,
  Bookmark,
  Package,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

    items.push({
      id: 'logout',
      label: 'Log Out',
      group: 'Actions',
      icon: LogOut as LucideIcon,
      onSelect: () => {
        logout()
        navigate('/')
      },
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
    description: deal.destination,
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
                    classNames={{
                      item: "rounded-lg",
                      surface: "rounded-lg",
                    }}
                  />
                )}
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="!h-11 !w-11 rounded-lg px-0 aria-expanded:bg-transparent hover:bg-accent"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="!size-11 rounded-lg bg-muted object-cover"
                  />
                ) : (
                  <User className="size-5 text-muted-foreground" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-0">
              {!isAuthenticated ? (
                /* ── Signed-out state ── */
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <User className="size-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Guest</p>
                      <p className="text-xs text-muted-foreground">Sign in to access your profile</p>
                    </div>
                  </div>
                  <Button onClick={signInWithGoogle} className="w-full" size="sm">
                    <svg className="size-4 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign in with Google
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-1">Theme</p>
                  <DropdownMenuGroup className="p-1">
                    <DropdownMenuItem
                      onClick={() => setTheme('light')}
                      className={cn(theme === 'light' && 'bg-accent text-accent-foreground')}
                    >
                      <Sun className="size-4" />
                      Light
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme('dark')}
                      className={cn(theme === 'dark' && 'bg-accent text-accent-foreground')}
                    >
                      <Moon className="size-4" />
                      Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme('system')}
                      className={cn(theme === 'system' && 'bg-accent text-accent-foreground')}
                    >
                      <Monitor className="size-4" />
                      System
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </div>
              ) : (
                /* ── Signed-in state ── */
                <>
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="size-10 rounded-lg bg-muted object-cover shrink-0"
                        />
                      ) : (
                        <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <User className="size-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium">
                          {profile?.full_name || 'User'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user?.email}
                        </p>
                        {isAdmin && (
                          <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup className="p-1">
                    <DropdownMenuItem asChild>
                      <Link to="/profile">
                        <User className="size-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link to="/admin">
                          <LayoutDashboard className="size-4" />
                          Admin
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup className="p-1">
                    <DropdownMenuItem
                      onClick={() => setTheme('light')}
                      className={cn(theme === 'light' && 'bg-accent text-accent-foreground')}
                    >
                      <Sun className="size-4" />
                      Light
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme('dark')}
                      className={cn(theme === 'dark' && 'bg-accent text-accent-foreground')}
                    >
                      <Moon className="size-4" />
                      Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme('system')}
                      className={cn(theme === 'system' && 'bg-accent text-accent-foreground')}
                    >
                      <Monitor className="size-4" />
                      System
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} variant="destructive" className="p-1 m-1">
                    <LogOut className="size-4" />
                    Logout
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  )
}
