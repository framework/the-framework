import { useSyncExternalStore } from 'react'

// Whether the side panel (the Files / Changes rail) is open. Closed until the person opens it, and
// remembered in this browser: it is how one person likes this screen, not a setting of the project,
// and it is read at once, so the panel is where it was left from the first frame.

/** localStorage key holding `open` while the side panel is open; absent, it is closed. */
const SIDE_PANEL_KEY = 'fw.side-panel'

const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(SIDE_PANEL_KEY) === 'open'
  } catch {
    return false
  }
}

/** Open or close the side panel, and remember it. */
export function setSidePanelOpen(open: boolean): void {
  try {
    if (open) globalThis.localStorage?.setItem(SIDE_PANEL_KEY, 'open')
    else globalThis.localStorage?.removeItem(SIDE_PANEL_KEY)
  } catch {
    // A browser that keeps nothing: the panel still opens, for this page.
    fallback = open
  }
  for (const listener of listeners) listener()
}

/** What a browser that keeps nothing was last told, so the button still works there. */
let fallback: boolean | undefined

/** Whether the side panel is open, as reactive state. */
export function useSidePanelOpen(): boolean {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => fallback ?? read(),
    () => false,
  )
}
