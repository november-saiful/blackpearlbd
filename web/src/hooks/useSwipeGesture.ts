import { useCallback, useEffect, useRef } from 'react'

type SwipeDirection = 'left' | 'right'

interface UseSwipeGestureOptions {
  /** Whether swipe gestures are enabled */
  enabled?: boolean
  /** Minimum horizontal distance (px) to trigger a swipe */
  threshold?: number
  /** Maximum vertical distance (px) allowed before cancelling (to avoid hijacking scroll) */
  verticalThreshold?: number
  /** Called when a right swipe is detected (open) */
  onSwipeRight?: () => void
  /** Called when a left swipe is detected (close) */
  onSwipeLeft?: () => void
}

/**
 * Detects horizontal swipe gestures on touch devices.
 *
 * - Swipe **right** from the left edge of the screen → opens the sidebar
 * - Swipe **left** when the sidebar is open → closes it
 *
 * The hook attaches touch listeners to the given `target` (defaults to `document`).
 * It ignores vertical swipes so normal scrolling still works.
 */
export function useSwipeGesture({
  enabled = true,
  threshold = 50,
  verticalThreshold = 80,
  onSwipeRight,
  onSwipeLeft,
}: UseSwipeGestureOptions = {}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return
      const touch = e.touches[0]
      touchStart.current = { x: touch.clientX, y: touch.clientY }
      swiped.current = false
    },
    [enabled],
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !touchStart.current || swiped.current) return

      const touch = e.touches[0]
      const dx = touch.clientX - touchStart.current.x
      const dy = Math.abs(touch.clientY - touchStart.current.y)

      // If the user has moved more vertically than our tolerance, abort,
      // they're scrolling, not swiping.
      if (dy > verticalThreshold) {
        touchStart.current = null
        return
      }

      // Only trigger once per touch sequence
      if (Math.abs(dx) >= threshold) {
        swiped.current = true
        const direction: SwipeDirection = dx > 0 ? 'right' : 'left'

        if (direction === 'right') {
          onSwipeRight?.()
        } else {
          onSwipeLeft?.()
        }
      }
    },
    [enabled, threshold, verticalThreshold, onSwipeRight, onSwipeLeft],
  )

  const handleTouchEnd = useCallback(() => {
    touchStart.current = null
    swiped.current = false
  }, [])

  useEffect(() => {
    if (!enabled) return

    const target = document

    target.addEventListener('touchstart', handleTouchStart, { passive: true })
    target.addEventListener('touchmove', handleTouchMove, { passive: true })
    target.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      target.removeEventListener('touchstart', handleTouchStart)
      target.removeEventListener('touchmove', handleTouchMove)
      target.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd])
}
