'use client'

import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Compass, User } from '@/components/ui/icons'
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface NavPage {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const userPages: NavPage[] = [
  { id: 'home', label: 'Home', icon: Home, href: '/' },
  { id: 'deals', label: 'Tour Deals', icon: Compass, href: '/deals' },
  { id: 'build', label: 'Build Package', icon: BuildPackageIcon, href: '/build-package' },
  { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
]

function getCurrentPage(pages: NavPage[], pathname: string): NavPage | undefined {
  // Exact match first
  const exact = pages.find((p) => p.href === pathname)
  if (exact) return exact
  // Prefix match (for nested routes like /deals/some-slug)
  return pages.find((p) => p.href !== '/' && pathname.startsWith(p.href))
}

export function NavigationSelect({ className, hideMobile = false }: { className?: string; hideMobile?: boolean }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // On admin pages, default to Home so the dropdown still renders
  const currentPage = getCurrentPage(userPages, pathname) ?? userPages[0]

  const Icon = currentPage.icon

  return (
    <>
      {/* Mobile: icon only, non-clickable */}
      {!hideMobile && (
        <div className="flex shrink-0 items-center md:hidden">
          <Icon className="size-5" />
        </div>
      )}

      {/* Desktop: full select dropdown */}
      <Select
        value={currentPage.id}
        onValueChange={(value) => {
          const page = userPages.find((p) => p.id === value)
          if (page) navigate(page.href)
        }}
      >
        <SelectTrigger className={cn("hidden md:flex h-11 rounded-lg", className)}>
          <div className="flex items-center gap-2">
            <Icon className="size-5 shrink-0 text-muted-foreground" />
            <span>{currentPage.label}</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {userPages.map((page) => {
            const PageIcon = page.icon
            return (
              <SelectItem key={page.id} value={page.id}>
                <div className="flex items-center gap-2">
                  <PageIcon className="size-5 shrink-0" />
                  <span>{page.label}</span>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </>
  )
}
