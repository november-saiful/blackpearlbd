import { useCallback, useEffect, useRef, useState } from 'react'

interface Row {
  id: string
}

/**
 * Manages a keyboard cursor over a list of rows.
 * Resets to `null` when `key` changes (e.g. query text).
 */
export function useRowCursor<T extends Row>(rows: T[], key: string | number) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const prevKey = useRef(key)

  useEffect(() => {
    if (key !== prevKey.current) {
      setActiveIndex(null)
      prevKey.current = key
    }
  }, [key])

  const moveTo = useCallback((id: string | null) => {
    if (id === null) {
      setActiveIndex(null)
      return
    }
    // We don't know the index without the rows array, so we store the id
    // and resolve in the next render via the rows dependency.
    setActiveIndex((prev) => {
      // Find by searching rows, but we don't have them here.
      // Store the id and resolve later.
      return prev // Will be overridden by the effect below
    })
  }, [])

  // Resolve id-based moveTo
  const moveToId = useCallback(
    (id: string | null) => {
      if (id === null) {
        setActiveIndex(null)
        return
      }
      const idx = rows.findIndex((r) => r.id === id)
      if (idx !== -1) setActiveIndex(idx)
    },
    [rows],
  )

  const moveActive = useCallback(
    (delta: number) => {
      setActiveIndex((prev) => {
        if (rows.length === 0) return null
        if (prev === null) return delta > 0 ? 0 : rows.length - 1
        const next = prev + delta
        if (next < 0 || next >= rows.length) return prev
        return next
      })
    },
    [rows.length],
  )

  return {
    activeIndex: activeIndex ?? 0,
    moveTo: moveToId,
    moveActive,
  }
}
