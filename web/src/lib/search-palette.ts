const OPEN_SEARCH_EVENT = 'blackpearl:open-search'

/** Open the command palette from anywhere outside the topbar's tree. */
export function openSearchPalette() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))
}

export function onOpenSearchPalette(handler: () => void) {
  window.addEventListener(OPEN_SEARCH_EVENT, handler)
  return () => window.removeEventListener(OPEN_SEARCH_EVENT, handler)
}
