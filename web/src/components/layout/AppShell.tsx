import type { ReactNode } from 'react'
import { AppTopbar } from './AppTopbar'
import { MobileDock } from './MobileDock'
import { ScrollToTop } from './ScrollToTop'
import { PhonePrompt } from './PhonePrompt'
import { Footer3 } from '@/components/watermelon-ui/footer-3'
import { footerNavigation } from '@/config/navigation'
import { Instagram, Facebook } from 'lucide-react'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-svh flex-col overflow-hidden no-scrollbar">
      <div className="flex-1 overflow-y-auto">
        <ScrollToTop />
        <PhonePrompt />
        <AppTopbar />
        <main className="flex flex-1 flex-col pb-16 md:pb-0">
          {children}
        </main>

        <Footer3
          brandName="BlackPearl"
          description="Your premier tours and travel agency. Discover amazing destinations, create custom packages, and embark on unforgettable journeys."
          logo={<img src="/logo.svg" alt="BlackPearl" className="h-8 w-8 object-contain color-[hsl(var(--primary))]" />}
          linkGroups={[
            {
              title: 'Quick Links',
              links: [
                { label: 'Tour Deals', href: '/deals' },
                { label: 'Build Package', href: '/build-package' },
                { label: 'My Profile', href: '/profile' },
              ],
            },
            {
              title: 'Support',
              links: footerNavigation.map((item) => ({
                label: item.name,
                href: item.href,
              })),
            },
            {
              title: 'Contact',
              links: [
                { label: 'Office #307, 300-Alisan Plaza, Elephant Road, Dhaka-1205', href: '#' },
                { label: '+880 1898766630', href: 'tel:+8801898766630' },
                { label: 'team@blackpearl.bd', href: 'mailto:team@blackpearl.bd' },
              ],
            },
          ]}
          socialLinks={[
            { icon: <Instagram className="h-4 w-4" />, href: 'https://instagram.com/blackpearl.bd' },
            { icon: <Facebook className="h-4 w-4" />, href: 'https://facebook.com/blackpearl.bd' },
          ]}
          copyright={`© ${new Date().getFullYear()} BlackPearl. All rights reserved.`}
          legalLinks={[
            { label: 'Privacy Policy', href: '#' },
            { label: 'Terms of Service', href: '#' },
          ]}
        />
      </div>

      <MobileDock />
    </div>
  )
}
