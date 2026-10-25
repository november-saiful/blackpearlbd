import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Package, Calendar, MessageSquare, Folder, ChevronDown } from '@/components/ui/icons'
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface AdminPage {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
}

const adminPages: AdminPage[] = [
  { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  { id: 'admin-users', label: 'Users', icon: Users, href: '/admin/users' },
  { id: 'admin-deals', label: 'Deals', icon: Package, href: '/admin/deals' },
  { id: 'admin-bookings', label: 'Bookings', icon: Calendar, href: '/admin/bookings' },
  { id: 'admin-reviews', label: 'Reviews', icon: MessageSquare, href: '/admin/reviews' },
  { id: 'admin-media', label: 'Media', icon: Folder, href: '/admin/media' },
  { id: 'admin-packages', label: 'Custom Packages', icon: BuildPackageIcon, href: '/admin/custom-packages' },
]

function getCurrentAdminPage(pathname: string): AdminPage | undefined {
  const exact = adminPages.find((p) => p.href === pathname)
  if (exact) return exact
  return adminPages.find((p) => p.href !== '/admin' && pathname.startsWith(p.href))
}

export function AdminNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const currentPage = getCurrentAdminPage(pathname)

  if (!currentPage) return null

  const Icon = currentPage.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="glass-field glass-hover inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/20"
        >
          <Icon className="size-4 text-muted-foreground" />
          {currentPage.label}
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="w-56">
        {adminPages.map((page) => {
          const PageIcon = page.icon
          const isActive = page.id === currentPage.id
          return (
            <DropdownMenuItem
              key={page.id}
              onClick={() => navigate(page.href)}
              className={cn(
                'flex items-center gap-2.5 cursor-pointer',
                isActive && 'glass-chip text-accent-foreground'
              )}
            >
              <PageIcon className="size-4" />
              {page.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
