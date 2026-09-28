import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Compass, User, Phone } from 'lucide-react'
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon'
import { useAuth } from '@/hooks/useAuth'
import { SlideActionButton } from '@/components/ui/slide-action-button'
import { Dock, DockItem } from '@/components/ui/dock'

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
  { id: 'call', label: 'Call', icon: Phone, href: 'tel:+8801898766630', external: true },
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        {/* Translucent backdrop bar – full screen width */}
        {/* Gradient fade from transparent into the solid bar */}
        <div className="absolute inset-x-0 bottom-16 h-12 bg-gradient-to-b from-transparent to-background/70" />
        {/* Solid blurred bar with top border */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-background/70 shadow-[0_-1px_0_0_var(--border)]" />

        {/* Dock pill – floats above the backdrop */}
        <div className="relative flex justify-center px-2.5 pb-safe pt-2">
          <Dock size={56} className="w-full max-w-sm justify-around rounded-2xl border border-border bg-card px-2 shadow-lg">
          {allItems.map((item) => {
            const isActive = item.id === activeId || (item.id === 'call' && callOpen)
            const Icon = item.icon

            if (item.id === 'call') {
              return (
                <DockItem
                  key={item.id}
                  active={isActive}
                  aria-label={item.label}
                  onClick={() => handleClick(item)}
                >
                  <div className="flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-foreground">
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
                  className="flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-foreground"
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
        </div>
      </nav>

      {/* Call CTA overlay */}
      {callOpen && (
        <>
          {/* Backdrop – blurs everything, click to dismiss */}
          <div
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-md md:hidden"
            onClick={() => setCallOpen(false)}
            aria-hidden="true"
          />
          {/* CTA panel – fixed bottom-center, above backdrop */}
          <div className="fixed bottom-32 left-1/2 z-[70] -translate-x-1/2 md:hidden">
            <div className="rounded-2xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-xl">
              <p className="mb-3 text-center text-sm font-medium text-foreground">
                Slide to call us
              </p>
              <SlideActionButton
                completeLabel="Calling…"
                onComplete={() => {
                  window.location.href = 'tel:+8801898766630'
                }}
              >
                Call +880 1898766630
              </SlideActionButton>
            </div>
          </div>
        </>
      )}
    </>
  )
}
