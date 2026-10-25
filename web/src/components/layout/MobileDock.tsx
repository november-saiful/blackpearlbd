import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Compass, User, Phone } from '@/components/ui/icons'
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon'
import { useAuth } from '@/hooks/useAuth'
import { SlideActionButton } from '@/components/ui/slide-action-button'
import { Dock, DockItem } from '@/components/ui/dock'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  external?: boolean
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, href: '/' },
  { id: 'deals', label: 'Deals', icon: Compass, href: '/deals' },
  { id: 'build', label: 'Build', icon: BuildPackageIcon, href: '/build-package' },
  { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
]

const allItems: NavItem[] = [
  ...navItems,
  { id: 'call', label: 'Call', icon: Phone, href: 'tel:+8801897655530', external: true },
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
  const [callOpen, setCallOpen] = useState(false)

  const activeId = idMap[pathname] ?? null

  const handleClick = (item: NavItem) => {
    if (item.id === 'call') {
      setCallOpen(true)
      return
    }
    if (item.external) {
      window.open(item.href, '_blank')
      return
    }
    if (item.id === 'profile' && !isAuthenticated) {
      signInWithGoogle()
      return
    }
    navigate(item.href)
  }

  // Close on Escape
  useEffect(() => {
    if (!callOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCallOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [callOpen])

  return (
    <>
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 md:hidden">
        <Dock
          size={56}
          className="glass-nav pointer-events-auto mx-auto w-full max-w-sm justify-around rounded-[1.75rem] px-1.5 py-1.5"
        >
          {allItems.map((item) => {
            const isActive = item.id === activeId || (item.id === 'call' && callOpen)
            const Icon = item.icon
            const itemClass = cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              isActive ? 'text-foreground' : 'text-foreground/65',
            )

            if (item.id === 'call') {
              return (
                <DockItem
                  key={item.id}
                  active={isActive}
                  aria-label={item.label}
                  onClick={() => handleClick(item)}
                >
                  <div className={itemClass}>
                    <Icon className="size-5" />
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
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </a>
              </DockItem>
            )
          })}
        </Dock>
      </nav>

      {/* Call CTA overlay */}
      {callOpen && (
        <>
          {/* Backdrop: blurs everything, click to dismiss */}
          <div
            className="glass-scrim fixed inset-0 z-[60] md:hidden"
            onClick={() => setCallOpen(false)}
            aria-hidden="true"
          />
          {/* CTA panel: fixed bottom-center, above backdrop */}
          <div className="fixed bottom-32 left-1/2 z-[70] -translate-x-1/2 md:hidden">
            <div className="glass-strong rounded-2xl p-5">
              <p className="mb-3 text-center text-sm font-medium text-foreground">
                Slide to call us
              </p>
              <SlideActionButton
                completeLabel="Calling…"
                onComplete={() => {
                  window.location.href = 'tel:+8801897655530'
                }}
              >
                Call +880 1897655530
              </SlideActionButton>
            </div>
          </div>
        </>
      )}
    </>
  )
}
