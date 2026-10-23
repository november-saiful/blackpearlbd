import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type TouchEvent,
} from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Pause,
  Play,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { getDealCategory } from '@/lib/deal-category'
import { formatDealLocation } from '@/components/deals/deals-destination'
import { humanizeDealText } from '@/lib/text'
import type { TourDeal } from '@/types'
import './hero-carousel.css'

const DWELL_MS = 7000
const SWIPE_THRESHOLD = 45

type HeroSlide = {
  id: string
  title: string
  eyebrow: string
  description: string
  image: string
  thumb: string
  accent: string
  href: string
  rating?: string
  meta: string
  badge: string
  price?: string
}

const CATEGORY_ACCENTS: Record<string, string> = {
  beach: '#38bdf8',
  nature: '#34d399',
  hill: '#2dd4bf',
  river: '#60a5fa',
  heritage: '#f59e0b',
  adventure: '#fb923c',
  tour: '#a78bfa',
}

const FALLBACK_IMAGE_IDS = [
  'photo-1507525428034-b723cf961d3e',
  'photo-1470071459604-3b5ec3a7fe05',
  'photo-1506905925346-21bda4d32df4',
  'photo-1476514525535-07fb3b4ae5f1',
  'photo-1500530855697-b586d89ba3ee',
]

const unsplash = (id: string, width: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function bengaliClass(text: string) {
  return /[\u0980-\u09FF]/.test(text) ? 'is-bengali' : undefined
}

function titleClasses(title: string) {
  const length = title.trim().length
  return cn(length > 44 ? 'is-long' : length > 22 && 'is-medium', bengaliClass(title))
}

function buildDealSlides(deals: TourDeal[]): HeroSlide[] {
  return [...deals]
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured))
    .slice(0, 5)
    .map((rawDeal, index) => {
      const deal = humanizeDealText(rawDeal)
      const category = getDealCategory(deal)
      const fallbackImage = FALLBACK_IMAGE_IDS[index % FALLBACK_IMAGE_IDS.length]
      const duration = `${deal.duration_days} ${deal.duration_days === 1 ? 'day' : 'days'}`
      const description = (deal.short_description || deal.description || '').trim()

      return {
        id: deal.id,
        title: deal.title,
        eyebrow: formatDealLocation(deal.destination, deal.sub_destination) || 'Bangladesh',
        description: description || 'A handpicked escape from BlackPearl.',
        image: deal.image_url || unsplash(fallbackImage, 1920),
        thumb: deal.image_url || unsplash(fallbackImage, 320),
        accent: CATEGORY_ACCENTS[category.key] ?? '#a78bfa',
        href: `/deals/${deal.slug}`,
        rating: deal.avg_rating ? deal.avg_rating.toFixed(1) : undefined,
        meta: duration,
        badge: category.label,
        price: deal.price > 0 ? formatCurrency(deal.price) : undefined,
      }
    })
}

export function HeroCarousel({
  deals,
  isLoading,
  hasError,
}: {
  deals: TourDeal[]
  isLoading?: boolean
  hasError?: boolean
}) {
  const slides = useMemo(() => buildDealSlides(deals), [deals])

  const [index, setIndex] = useState(0)
  // Bumped whenever the dwell should restart without changing slide (re-click,
  // resume after hover/tab pause). Also remounts the progress bar animation.
  const [cycle, setCycle] = useState(0)
  const [mounted, setMounted] = useState(false)
  // The first slide arrives with the page: it is already the largest element on
  // screen, so fading its copy in only postpones the moment it is painted. It
  // renders revealed until the first rotation, after which every slide staggers.
  const [introPending, setIntroPending] = useState(true)
  const [hoverPaused, setHoverPaused] = useState(false)
  const [focusPaused, setFocusPaused] = useState(false)
  const [tabHidden, setTabHidden] = useState(false)
  const [offscreen, setOffscreen] = useState(false)
  const [userPaused, setUserPaused] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  // Only the active photo is mounted at first. Each slide is a full-screen
  // upload of roughly 200 KB, and a strip of five of them starves the hero
  // text, the fonts and the deals request on a phone connection. The next
  // slide is warmed once the active one has painted; a slide's thumbnail
  // appears only when its photo is already in the HTTP cache.
  const [loadedImages, setLoadedImages] = useState<Set<string>>(() => new Set())
  const [previousIndex, setPreviousIndex] = useState<number | null>(null)
  const lastIndex = useRef(0)

  const markLoaded = useCallback((id: string) => {
    setLoadedImages((current) => {
      if (current.has(id)) return current
      const next = new Set(current)
      next.add(id)
      return next
    })
  }, [])

  const sectionRef = useRef<HTMLElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const activeIndex = slides.length > 0 ? Math.min(index, slides.length - 1) : 0
  const activeSlide = slides[activeIndex] as HeroSlide | undefined
  const hasSlides = slides.length > 0
  const paused = hoverPaused || focusPaused || tabHidden || offscreen || userPaused

  const goTo = useCallback(
    (target: number) => {
      if (slides.length === 0) return
      setIndex(((target % slides.length) + slides.length) % slides.length)
      setCycle((current) => current + 1)
    },
    [slides.length],
  )

  // First paint renders inactive, then the active class lands one frame later
  // so the background crossfade and the copy stagger actually animate in.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  // Hold the outgoing photo for the length of the crossfade, then release it
  // so at most two full-screen images are ever mounted.
  useEffect(() => {
    if (activeIndex === lastIndex.current) return
    const previous = lastIndex.current
    lastIndex.current = activeIndex
    setIntroPending(false)
    setPreviousIndex(previous)
    const timer = window.setTimeout(() => setPreviousIndex(null), 1200)
    return () => window.clearTimeout(timer)
  }, [activeIndex])

  const activeLoaded = activeSlide ? loadedImages.has(activeSlide.id) : false

  // Warm the rest of the strip one photo at a time, starting only after the
  // current photo has painted. Each download is roughly 200 KB, so firing them
  // together would compete with the first paint on a phone connection; loading
  // them in sequence fills the thumbnails in the seconds after the hero lands
  // and the effect re-runs on every arrival to queue the following one.
  useEffect(() => {
    if (!mounted || !activeLoaded || slides.length < 2) return
    let pending
    for (let step = 1; step < slides.length; step += 1) {
      const candidate = slides[(activeIndex + step) % slides.length]
      if (!loadedImages.has(candidate.id)) {
        pending = candidate
        break
      }
    }
    if (!pending) return
    const timer = window.setTimeout(() => {
      const image = new Image()
      image.onload = () => markLoaded(pending.id)
      image.src = pending.image
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [activeIndex, activeLoaded, loadedImages, markLoaded, mounted, slides])

  useEffect(() => {
    if (paused || slides.length < 2) return
    const timer = window.setTimeout(() => {
      setIndex((activeIndex + 1) % slides.length)
      setCycle((current) => current + 1)
    }, DWELL_MS)
    return () => window.clearTimeout(timer)
  }, [activeIndex, cycle, paused, slides.length])

  // Resuming restarts the dwell and the progress bar from zero, keeping the
  // visual timer in step with the JS timer.
  const wasPaused = useRef(paused)
  useEffect(() => {
    if (wasPaused.current && !paused) setCycle((current) => current + 1)
    wasPaused.current = paused
  }, [paused])

  // The deck is below the fold for most of a visit, and a rotation no one can
  // see still decodes, crossfades and scales full-screen photos while the
  // visitor scrolls the grid, so it stops the moment it leaves the viewport.
  // Keyed on the section actually existing: the loading placeholder has no ref,
  // so an effect with no dependency would run before there is anything to watch.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting))
    observer.observe(section)
    return () => observer.disconnect()
  }, [hasSlides])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const onEnter = () => setHoverPaused(true)
    const onLeave = () => setHoverPaused(false)
    section.addEventListener('mouseenter', onEnter)
    section.addEventListener('mouseleave', onLeave)
    return () => {
      section.removeEventListener('mouseenter', onEnter)
      section.removeEventListener('mouseleave', onLeave)
    }
  }, [hasSlides])

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden)
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return

      const section = sectionRef.current
      if (!section) return
      const rect = section.getBoundingClientRect()
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return

      event.preventDefault()
      goTo(activeIndex + (event.key === 'ArrowRight' ? 1 : -1))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, goTo])

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (
      event.touches.length !== 1 ||
      (event.target as HTMLElement).closest('.hero-carousel__thumbs')
    ) {
      touchStart.current = null
      return
    }
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return

    const dx = event.changedTouches[0].clientX - start.x
    const dy = event.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.2) {
      goTo(activeIndex + (dx < 0 ? 1 : -1))
    }
  }

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFocusPaused(false)
    }
  }

  // Nothing to rotate yet: reserve the full hero height rather than inventing
  // slides, so the first real deal drops into place with no layout shift.
  if (!activeSlide) {
    return isLoading ? <HeroLoading /> : <HeroEmpty failed={hasError} />
  }

  const style = {
    '--accent': activeSlide.accent,
    '--dwell': `${DWELL_MS}ms`,
  } as CSSProperties

  return (
    <section
      ref={sectionRef}
      className={cn('hero-carousel', paused && 'is-paused', offscreen && 'is-offscreen')}
      style={style}
      aria-roledescription="carousel"
      aria-label="Featured tour deals"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onFocusCapture={(event) => {
        // Pointer clicks also focus a button; only keyboard focus should stop
        // the rotation, otherwise tapping a thumbnail would silently pause it.
        if ((event.target as HTMLElement).matches(':focus-visible')) setFocusPaused(true)
      }}
      onBlurCapture={handleBlur}
    >
      <h1 className="sr-only">BlackPearl: curated tour deals and custom travel packages</h1>

      <div className="hero-carousel__bgs" aria-hidden="true">
        {slides.map((slide, slideIndex) => {
          const isActive = (mounted || introPending) && slideIndex === activeIndex
          const showImage = slideIndex === activeIndex || slideIndex === previousIndex
          return (
            <div
              key={slide.id}
              className={cn('hero-carousel__bg', isActive && 'is-active')}
            >
              {showImage && (
                <img
                  src={slide.image}
                  alt=""
                  loading="eager"
                  decoding="async"
                  {...{ fetchpriority: slideIndex === activeIndex ? 'high' : 'low' }}
                  onLoad={() => markLoaded(slide.id)}
                  onError={(event) => {
                    event.currentTarget.style.opacity = '0'
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="hero-carousel__scrim" aria-hidden="true" />
      <div className="hero-carousel__grain" aria-hidden="true" />

      <div className="hero-carousel__stage">
        <div className="hero-carousel__contents">
          {slides.map((slide, slideIndex) => {
            const isActive = (mounted || introPending) && slideIndex === activeIndex
            return (
              <article
                key={slide.id}
                id={`hero-slide-${slide.id}`}
                className={cn('hero-carousel__copy', isActive && 'is-active')}
                role="group"
                aria-roledescription="slide"
                aria-label={`${slideIndex + 1} of ${slides.length}: ${slide.title}`}
                aria-hidden={!isActive}
              >
                <div className="hero-carousel__panel">
                  <div
                    className={cn('hero-carousel__line hero-carousel__eyebrow', bengaliClass(slide.eyebrow))}
                    style={{ '--i': 0 } as CSSProperties}
                  >
                    <span className="hero-carousel__eyebrow-bar" />
                    {slide.eyebrow}
                  </div>

                  <h2
                    className={cn('hero-carousel__line hero-carousel__title', titleClasses(slide.title))}
                    style={{ '--i': 1 } as CSSProperties}
                  >
                    {slide.title}
                  </h2>

                  <div className="hero-carousel__line hero-carousel__meta" style={{ '--i': 2 } as CSSProperties}>
                    {slide.rating && (
                      <>
                        <span className="hero-carousel__rating">★ {slide.rating}</span>
                        <span className="hero-carousel__dot" />
                      </>
                    )}
                    <span>{slide.meta}</span>
                    <span className="hero-carousel__dot" />
                    <span className="hero-carousel__badge">{slide.badge}</span>
                    {slide.price && (
                      <>
                        <span className="hero-carousel__dot" />
                        <span className="hero-carousel__price">{slide.price}</span>
                      </>
                    )}
                  </div>

                  <p
                    className={cn('hero-carousel__line hero-carousel__desc', bengaliClass(slide.description))}
                    style={{ '--i': 3 } as CSSProperties}
                  >
                    {slide.description}
                  </p>

                  <div className="hero-carousel__line hero-carousel__actions" style={{ '--i': 4 } as CSSProperties}>
                    <Link
                      to={slide.href}
                      tabIndex={isActive ? undefined : -1}
                      className="hero-carousel__cta hero-carousel__cta--primary"
                    >
                      Explore tour
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                    <Link
                      to="/deals"
                      tabIndex={isActive ? undefined : -1}
                      className="hero-carousel__cta hero-carousel__cta--ghost"
                    >
                      <Compass aria-hidden="true" />
                      All tour deals
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <footer className="hero-carousel__deck">
        <div className="hero-carousel__thumbs" role="tablist" aria-label="Choose a featured tour">
          {slides.map((slide, slideIndex) => {
            const isActive = slideIndex === activeIndex
            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`hero-slide-${slide.id}`}
                aria-label={`Show ${slide.title}`}
                className={cn('hero-carousel__thumb', isActive && 'is-active')}
                onClick={() => goTo(slideIndex)}
              >
                <span className="hero-carousel__thumb-media">
                  {loadedImages.has(slide.id) && (
                    <img
                      src={slide.thumb}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        event.currentTarget.style.opacity = '0'
                      }}
                    />
                  )}
                  <span className="hero-carousel__thumb-progress" aria-hidden="true">
                    {isActive && <i key={`${activeIndex}-${cycle}`} />}
                  </span>
                </span>
                <span className={cn('hero-carousel__thumb-label', bengaliClass(slide.title))}>
                  {slide.title}
                </span>
              </button>
            )
          })}
        </div>

        <div className="hero-carousel__deck-nav">
          <span className="hero-carousel__counter" aria-hidden="true">
            <b>{pad(activeIndex + 1)}</b>
            <i />
            <span>{pad(slides.length)}</span>
          </span>

          <button
            type="button"
            className="hero-carousel__arrow hero-carousel__arrow--prev"
            onClick={() => goTo(activeIndex - 1)}
            aria-label="Previous tour"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="hero-carousel__arrow hero-carousel__arrow--next"
            onClick={() => goTo(activeIndex + 1)}
            aria-label="Next tour"
          >
            <ChevronRight aria-hidden="true" />
          </button>

          {slides.length > 1 && (
            <button
              type="button"
              className="hero-carousel__arrow"
              onClick={() => setUserPaused((value) => !value)}
              aria-label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
              aria-pressed={userPaused}
            >
              {userPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            </button>
          )}
        </div>
      </footer>
    </section>
  )
}

/**
 * Holds the hero's full height while the first catalogue request is in flight.
 * The bars sit exactly where the copy will land, and nothing here pretends to
 * be a deal, so the real slides replace a placeholder rather than other copy.
 */
function HeroLoading() {
  return (
    <section className="hero-carousel" aria-busy="true" aria-label="Loading featured tour deals">
      <h1 className="sr-only">BlackPearl: curated tour deals and custom travel packages</h1>
      <div className="hero-carousel__bgs" aria-hidden="true">
        <div className="hero-carousel__bg is-active" />
      </div>
      <div className="hero-carousel__scrim" aria-hidden="true" />
      <div className="hero-carousel__stage">
        <div className="hero-carousel__contents">
          <div className="hero-carousel__copy is-active" aria-hidden="true">
            <div className="hero-carousel__panel">
              <span className="hero-skeleton hero-skeleton--eyebrow" />
              <span className="hero-skeleton hero-skeleton--title" />
              <span className="hero-skeleton hero-skeleton--title hero-skeleton--short" />
              <span className="hero-skeleton hero-skeleton--meta" />
              <span className="hero-skeleton hero-skeleton--desc" />
              <span className="hero-skeleton hero-skeleton--desc hero-skeleton--short" />
              <span className="hero-skeleton hero-skeleton--action" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** The catalogue is genuinely empty: say so instead of showing invented deals. */
function HeroEmpty({ failed }: { failed?: boolean }) {
  return (
    <section className="hero-carousel" aria-label="BlackPearl">
      <h1 className="sr-only">BlackPearl: curated tour deals and custom travel packages</h1>
      <div className="hero-carousel__bgs" aria-hidden="true">
        <div className="hero-carousel__bg is-active" />
      </div>
      <div className="hero-carousel__scrim" aria-hidden="true" />
      <div className="hero-carousel__stage">
        <div className="hero-carousel__contents">
          <div className="hero-carousel__copy is-active">
            <div className="hero-carousel__panel">
              <div className="hero-carousel__line hero-carousel__eyebrow" style={{ '--i': 0 } as CSSProperties}>
                <span className="hero-carousel__eyebrow-bar" />
                BlackPearl
              </div>
              <h2
                className="hero-carousel__line hero-carousel__title"
                style={{ '--i': 1 } as CSSProperties}
              >
                {failed ? 'Tour deals are unavailable right now' : 'Curated journeys, built around you'}
              </h2>
              <p className="hero-carousel__line hero-carousel__desc" style={{ '--i': 2 } as CSSProperties}>
                {failed
                  ? 'We could not reach the catalogue just now. Try again in a moment, or start a custom package and we will pick it up from there.'
                  : 'New tour deals are being prepared. Build a custom package in the meantime and we will take care of the rest.'}
              </p>
              <div className="hero-carousel__line hero-carousel__actions" style={{ '--i': 3 } as CSSProperties}>
                <Link to="/build-package" className="hero-carousel__cta hero-carousel__cta--primary">
                  Build your own trip
                  <ArrowUpRight aria-hidden="true" />
                </Link>
                <Link to="/deals" className="hero-carousel__cta hero-carousel__cta--ghost">
                  <Compass aria-hidden="true" />
                  All tour deals
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
