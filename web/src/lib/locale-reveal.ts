/**
 * Language switch reveal. View Transitions shows the old page while a circle
 * clip-paths open from the pressed point, and a hairline ring rides the
 * expanding edge (see `.lang-reveal-ring` / `lang-reveal-*` keyframes in
 * index.css). Where View Transitions are unavailable, or motion is reduced,
 * the locale still switches, just without the reveal.
 */
import { flushSync } from 'react-dom'
import type { MouseEvent as ReactMouseEvent } from 'react'

const REVEAL_NAME = 'lang-ring'

type ToggleLocale = () => void

let running = false

// Read by the top-bar globe so its wordmark is already in the new language in
// the snapshot the reveal opens onto, instead of popping over at the end.
export function isLocaleRevealRunning() {
  return running
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function toggleLocaleWithReveal(
  event: ReactMouseEvent<HTMLElement>,
  toggleLocale: ToggleLocale,
) {
  if (running) return
  if (prefersReducedMotion() || typeof document.startViewTransition !== 'function') {
    toggleLocale()
    return
  }

  const rect = event.currentTarget.getBoundingClientRect()
  // Keyboard activation reports 0,0 — fall back to the control's centre.
  const x = event.clientX || rect.left + rect.width / 2
  const y = event.clientY || rect.top + rect.height / 2
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  )

  const root = document.documentElement
  root.style.setProperty('--lang-x', `${x}px`)
  root.style.setProperty('--lang-y', `${y}px`)
  root.style.setProperty('--lang-r', `${radius}px`)

  // Empty on purpose: its snapshot is transparent, and the ring itself is a
  // gradient painted on the transition's own layer (see index.css) so the
  // stroke stays one crisp width as the radius grows.
  const ring = document.createElement('div')
  ring.className = 'lang-reveal-ring'
  ring.setAttribute('aria-hidden', 'true')
  ring.style.viewTransitionName = REVEAL_NAME

  running = true
  const transition = document.startViewTransition(() => {
    flushSync(toggleLocale)
    document.body.appendChild(ring)
  })

  void transition.finished
    .catch(() => undefined)
    .then(() => {
      ring.remove()
      root.style.removeProperty('--lang-x')
      root.style.removeProperty('--lang-y')
      root.style.removeProperty('--lang-r')
      running = false
    })
}
