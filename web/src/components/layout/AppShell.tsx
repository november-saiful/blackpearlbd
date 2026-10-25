import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AppTopbar } from './AppTopbar'
import { MobileDock } from './MobileDock'
import { ScrollToTop } from './ScrollToTop'
import { PhonePrompt } from './PhonePrompt'
import { Footer3 } from '@/components/watermelon-ui/footer-3'
import { ViewOnMap } from '@/components/watermelon-ui/view-on-map'
import { footerNavigation } from '@/config/navigation'
import { attachScrollHoverGate } from '@/lib/scroll-hover-gate'
import { Instagram, Facebook } from '@/components/ui/icons'

// CID link: opens the Black Pearl business listing (name, hours, address)
// instead of a bare coordinate pin. The embed drops a pin at the same
// coordinates without needing a Maps API key.
const OFFICE_MAP_URL = 'https://www.google.com/maps?cid=10981613975378009793'
const OFFICE_MAP_EMBED = 'https://www.google.com/maps?q=23.738177,90.3879379&z=17&output=embed'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  // The incoming page rises and fades in on navigation, but never on the first
  // paint of a visit: that frame is the one the page is scored on, and a fade
  // would hold it back by the length of the fade. So the class only appears
  // once a navigation has actually happened, and the key remounts the page so
  // the animation has a fresh element to run on.
  const [navigated, setNavigated] = useState(false)
  const lastPath = useRef(pathname)
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    setNavigated(true)
  }, [pathname])

  // The gate flags the scroller so the stylesheet can take the pointer off the
  // content while a wheel gesture is moving it. It writes an attribute rather
  // than state: this fires on every scroll event, and a render would rebuild the
  // topbar and the whole page beneath it.
  useEffect(() => {
    const node = scroller.current
    if (!node) return
    return attachScrollHoverGate(node)
  }, [])

  return (
    <div className="relative isolate flex h-svh flex-col overflow-hidden bg-background no-scrollbar">
      <div aria-hidden className="app-ambient" />
      <div ref={scroller} data-app-scroller className="relative z-10 flex-1 overflow-y-auto pb-20 md:pb-0">
        <ScrollToTop />
        <PhonePrompt />
        <AppTopbar />
        {/* Skip link for keyboard navigation */}
        <a href="#main" className="sr-only focus-visible:focus focus-visible:bg-primary focus-visible:text-primary-foreground py-2 px-4" onClick={() => setTimeout(() => {}, 0)}>Skip to main content</a>
        <main className="flex flex-1 flex-col pb-16 md:pb-0">
          <div key={pathname} className={navigated ? 'route-enter' : undefined}>
            {children}
          </div>
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
                { label: 'Office #307, 300-Alisan Plaza, Elephant Road, Dhaka-1205', href: OFFICE_MAP_URL, external: true },
                { label: '+880 1897655530', href: 'tel:+8801897655530' },
                { label: 'team@blackpearl.bd', href: 'mailto:team@blackpearl.bd' },
              ],
              content: (
                <ViewOnMap
                  mapSrc={OFFICE_MAP_EMBED}
                  locationName="Black Pearl, Elephant Road, Dhaka"
                />
              ),
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
