import { useEffect, useState } from 'react'

/**
 * Returns `true` if the current device has a touchscreen.
 * Only checks once on mount, won't flip if a mouse is connected later.
 */
export function useTouchCapable() {
  const [canTouch, setCanTouch] = useState(false)

  useEffect(() => {
    setCanTouch(
      typeof window !== 'undefined' &&
        ('ontouchstart' in window || navigator.maxTouchPoints > 0),
    )
  }, [])

  return canTouch
}
