/**
 * The scroll hover gate.
 *
 * A surface entering hover animates a fill and an inset rim, which repaints the
 * whole area for the length of that animation, and a pointer resting over the
 * page cannot help but cross a succession of cards while they move underneath.
 * On the home page that was 18 frames over 33ms against 5 with the pointer taken
 * away, and it is the page visibly twitching under the cursor.
 *
 * So while a wheel or trackpad gesture is moving the page this flags the
 * scroller, and the stylesheet takes the pointer off the content until it
 * settles. A touch flick is left alone: it fires no hover, and the lift off the
 * screen is a tap the page must answer. A press releases the flag at once, so
 * the wait is never longer than one window.
 */

/** How long the flag survives after the last scroll event. */
export const HOVER_GATE_MS = 160

/** How long after a wheel event a moving page still counts as wheel driven. */
export const WHEEL_CONTINUES_MS = 400

/** The attribute set on the scroller while the pointer is off the content. */
export const SCROLLING_ATTRIBUTE = 'data-scrolling'

type GateTarget = {
  hasAttribute(name: string): boolean
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
  addEventListener(type: string, listener: () => void, options?: { passive?: boolean }): void
  removeEventListener(type: string, listener: () => void): void
}

/**
 * Starts the gate and returns a detach. `now` is injectable so the two windows
 * can be tested without waiting out a timer or trusting a fake clock.
 */
export function attachScrollHoverGate(
  target: GateTarget,
  now: () => number = () => performance.now(),
): () => void {
  let idle: ReturnType<typeof setTimeout> | undefined
  let lastWheel = 0

  const release = () => {
    clearTimeout(idle)
    target.removeAttribute(SCROLLING_ATTRIBUTE)
  }
  const arm = () => {
    if (!target.hasAttribute(SCROLLING_ATTRIBUTE)) target.setAttribute(SCROLLING_ATTRIBUTE, '')
    clearTimeout(idle)
    idle = setTimeout(release, HOVER_GATE_MS)
  }
  const onWheel = () => {
    lastWheel = now()
    arm()
  }
  const onScroll = () => {
    if (now() - lastWheel < WHEEL_CONTINUES_MS) arm()
  }

  target.addEventListener('wheel', onWheel, { passive: true })
  target.addEventListener('scroll', onScroll, { passive: true })
  target.addEventListener('pointerdown', release, { passive: true })

  return () => {
    target.removeEventListener('wheel', onWheel)
    target.removeEventListener('scroll', onScroll)
    target.removeEventListener('pointerdown', release)
    release()
  }
}
