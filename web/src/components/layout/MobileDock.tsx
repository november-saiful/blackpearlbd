import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Backpack, Search, User } from '@/components/ui/icons'
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon'
import { useAuth } from '@/hooks/useAuth'
import { Dock, DockItem } from '@/components/ui/dock'
import { openSearchPalette } from '@/lib/search-palette'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, href: '/' },
  { id: 'deals', label: 'Deals', icon: Backpack, href: '/deals' },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'build', label: 'Build', icon: BuildPackageIcon, href: '/build-package' },
  { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
]

const idMap: Record<string, string> = {
  '/': 'home',
  '/deals': 'deals',
  '/build-package': 'build',
  '/profile': 'profile',
}

export function MobileDock() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, signInWithGoogle } = useAuth()

  const activeId = idMap[pathname] ?? null

  const handleClick = (item: NavItem) => {
    if (item.id === 'search') {
      openSearchPalette()
      return
    }
    if (item.id === 'profile' && !isAuthenticated) {
      signInWithGoogle()
      return
    }
    if (item.href) navigate(item.href)
  }

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 md:hidden">
      <Dock
        size={48}
        className="glass-nav pointer-events-auto mx-auto gap-1 rounded-[1.5rem] px-1.5 py-1"
      >
        {navItems.map((item) => {
          const isActive = item.id === activeId
          const Icon = item.icon
          const itemClass = cn(
            'flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium outline-none transition-colors',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
            isActive ? 'text-foreground' : 'text-foreground/65',
          )

          if (item.id === 'search') {
            return (
              <DockItem
                key={item.id}
                aria-label="Search"
                onClick={() => handleClick(item)}
              >
                <div className={itemClass}>
                  <Icon className="size-[18px]" />
                  <span>{item.label}</span>
                </div>
              </DockItem>
            )
          }

          return (
            <DockItem key={item.id} active={isActive}>
              <a
                href={item.href}
                aria-label={item.label}
                className={itemClass}
                onClick={(e) => {
                  e.preventDefault()
                  handleClick(item)
                }}
              >
                <Icon className="size-[18px]" />
                <span>{item.label}</span>
              </a>
            </DockItem>
          )
        })}
      </Dock>
    </nav>
  )
}
