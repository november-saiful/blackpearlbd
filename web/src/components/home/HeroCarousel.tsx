import { useMemo } from 'react'
import ApertureCarousel, { type Slide } from '@/components/ui/aperture-carousel'
import { formatDealLocation } from '@/components/deals/deals-destination'
import { useLocalizedDeals } from '@/lib/deal-locale'
import { useContentLocale, type ContentLocale } from '@/lib/locale'
import { formatCurrency } from '@/lib/utils'
import type { TourDeal } from '@/types'

const MAX_SLIDES = 6

const FALLBACK_IMAGE_IDS = [
  'photo-1507525428034-b723cf961d3e',
  'photo-1470071459604-3b5ec3a7fe05',
  'photo-1506905925346-21bda4d32df4',
  'photo-1476514525535-07fb3b4ae5f1',
  'photo-1500530855697-b586d89ba3ee',
]

const unsplash = (id: string, width: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`

/** Features first, then the rest of the catalogue, as a full-bleed slide deck. */
function buildDealSlides(deals: TourDeal[], locale: ContentLocale): Slide[] {
  return [...deals]
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured))
    .slice(0, MAX_SLIDES)
    .map((deal, index) => {
      const location =
        formatDealLocation(deal.destination, deal.sub_destination) ||
        (locale === 'bn' ? 'বাংলাদেশ' : 'Bangladesh')
      const duration =
        locale === 'bn'
          ? `${deal.duration_days} দিন`
          : `${deal.duration_days} ${deal.duration_days === 1 ? 'day' : 'days'}`
      const price = deal.price > 0 ? formatCurrency(deal.price) : null

      return {
        image: deal.image_url || unsplash(FALLBACK_IMAGE_IDS[index % FALLBACK_IMAGE_IDS.length], 1920),
        eyebrow: location,
        title: deal.title,
        meta: [duration, price].filter((value): value is string => Boolean(value)),
        cta: {
          label: locale === 'bn' ? 'বিস্তারিত দেখুন' : 'View details',
          href: `/deals/${deal.slug}`,
        },
        alt: deal.title,
      }
    })
}

/**
 * The catalogue can be empty after a successful load, or after a failed one.
 * The painted landscapes keep the hero's full frame in place instead of
 * collapsing it, and the copy explains the state rather than showing invented
 * deals. While the first request is still in flight the hero renders
 * `HeroLoadingFrame` instead, so the painted art never flashes in and out.
 */
function fallbackSlides(locale: ContentLocale, failed?: boolean): Slide[] {
  if (failed) {
    return [
      {
        title:
          locale === 'bn'
            ? 'ট্যুর ডিলগুলো এখন পাওয়া যাচ্ছে না'
            : 'Tour deals are unavailable right now',
        caption:
          locale === 'bn'
            ? 'কাস্টম প্যাকেজ শুরু করুন, বাকিটা আমরা দেখছি।'
            : 'Start a custom package and we will pick it up from there.',
        palette: 'mist',
        seed: 9,
      },
    ]
  }

  return [
    {
      title:
        locale === 'bn' ? 'আপনার জন্য গড়া ভ্রমণ' : 'Curated journeys, built around you',
      caption:
        locale === 'bn'
          ? 'বাংলাদেশ ও তার বাইরের বাছাই করা ট্যুর।'
          : 'Handpicked tours across Bangladesh and beyond.',
      palette: 'dawn',
      seed: 6,
    },
    {
      title:
        locale === 'bn' ? 'পাহাড় আর কুয়াশার মিলন' : 'Where the hills meet the haze',
      caption:
        locale === 'bn'
          ? 'চা-বাগান, দীর্ঘ সমুদ্রসৈকত আর ভোরের সুন্দরবন।'
          : 'Tea gardens, long beaches and the Sundarbans at first light.',
      palette: 'mist',
      seed: 13,
    },
  ]
}

/** The real hero's frame, held open while the first deal request is in flight. */
function HeroLoadingFrame() {
  const mobileBottom = 'bottom-[calc(clamp(40px,7vh,72px)+4.75rem+env(safe-area-inset-bottom,0px))]'
  const trackBottom = 'bottom-[calc(clamp(20px,3.5vh,36px)+4.75rem+env(safe-area-inset-bottom,0px))]'

  return (
    <div
      className="relative h-[100svh] min-h-[540px] w-full overflow-hidden"
      aria-busy="true"
      aria-label="Loading featured tour deals"
    >
      <div
        className="absolute inset-0 bg-gradient-to-b from-muted via-muted/70 to-background"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/80 to-transparent"
        aria-hidden="true"
      />
      <div
        className={`absolute left-[clamp(20px,4vw,56px)] right-[clamp(20px,4vw,56px)] ${mobileBottom} animate-pulse motion-reduce:animate-none md:bottom-[clamp(40px,7vh,72px)]`}
        aria-hidden="true"
      >
        <div className="h-5 w-24 rounded-md bg-foreground/10" />
        <div className="mt-3.5 h-9 w-[min(560px,85%)] rounded-xl bg-foreground/10 sm:h-12" />
        <div className="mt-3 h-9 w-[min(420px,62%)] rounded-xl bg-foreground/10 sm:h-12" />
        <div className="mt-4 flex gap-2">
          <div className="h-8 w-24 rounded-[10px] bg-foreground/10" />
          <div className="h-8 w-28 rounded-[10px] bg-foreground/10" />
        </div>
        <div className="mt-4 h-[42px] w-40 rounded-[10px] bg-foreground/10" />
      </div>
      <div
        className={`absolute left-[clamp(20px,4vw,56px)] right-[clamp(20px,4vw,56px)] ${trackBottom} h-px bg-foreground/15 md:bottom-[clamp(20px,3.5vh,36px)]`}
        aria-hidden="true"
      />
    </div>
  )
}

export function HeroCarousel({
  deals,
  hasError,
  isLoading,
}: {
  deals: TourDeal[]
  hasError?: boolean
  isLoading?: boolean
}) {
  const { locale } = useContentLocale()
  const localizedDeals = useLocalizedDeals(deals)

  const slides = useMemo(() => {
    const dealSlides = buildDealSlides(localizedDeals, locale)
    return dealSlides.length > 0 ? dealSlides : fallbackSlides(locale, hasError)
  }, [localizedDeals, locale, hasError])

  const waiting = Boolean(isLoading) && localizedDeals.length === 0 && !hasError

  return (
    <>
      <h1 className="sr-only">BlackPearl: curated tour deals and custom travel packages</h1>
      {waiting ? (
        <HeroLoadingFrame />
      ) : (
        <ApertureCarousel
          slides={slides}
          height="100svh"
          autoplay={3000}
          duration={1100}
          reserveMobileDock
          ariaLabel="Featured tour deals"
          className="min-h-[540px]"
        />
      )}
    </>
  )
}
