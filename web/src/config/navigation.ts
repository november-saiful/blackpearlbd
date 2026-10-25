import {
  Home,
  Backpack,
  Package,
  User,
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  HelpCircle,
} from '@/components/ui/icons'
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon'

export interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

export interface NavigationGroup {
  label: string
  items: NavigationItem[]
}

// Regular user navigation items
export const userNavigation: NavigationItem[] = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Tour Deals', href: '/deals', icon: Backpack },
  { name: 'Build Package', href: '/build-package', icon: BuildPackageIcon },
  { name: 'My Profile', href: '/profile', icon: User },
]

// Admin navigation items
export const adminNavigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Deals', href: '/admin/deals', icon: Package },
  { name: 'Bookings', href: '/admin/bookings', icon: Calendar },
  { name: 'Packages', href: '/admin/custom-packages', icon: BuildPackageIcon },
]

// Footer navigation items
export const footerNavigation: NavigationItem[] = [
  { name: 'Settings', href: '/profile', icon: Settings },
  { name: 'Help', href: '#help', icon: HelpCircle },
]

// Get navigation groups based on user role
export function getNavigationGroups(isAdmin: boolean): NavigationGroup[] {
  const groups: NavigationGroup[] = [
    {
      label: 'Browse',
      items: userNavigation,
    },
  ]

  if (isAdmin) {
    groups.push({
      label: 'Management',
      items: adminNavigation,
    })
  }

  return groups
}
