import { useSyncExternalStore } from 'react'
import { setSidePanelOpen } from './side-panel.js'

// A changed file asked for from the chat: the row of a file at the end of a turn opens the side
// panel on the tab that lists what the agent changed, with that file picked. The ask is kept for
// the page it was made on (`sidePanelName`), for the page's life; `at` tells one ask from the
// next for the same file.

/** The file asked for, and which ask it is. */
export interface RevealedChange {
  path: string
  at: number
}

const asked = new Map<string, RevealedChange>()
const listeners = new Set<() => void>()
let asks = 0

/** Open the side panel of the page with this name, on this changed file. */
export function revealChange(name: string, path: string): void {
  asked.set(name, { path, at: ++asks })
  setSidePanelOpen(name, true)
  for (const listener of listeners) listener()
}

/** The file last asked for on the page with this name, as reactive state; none when none was. */
export function useRevealedChange(name: string): RevealedChange | undefined {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => asked.get(name),
    () => undefined,
  )
}

/** Forget every ask (for tests). */
export function forgetRevealedChanges(): void {
  asked.clear()
  for (const listener of listeners) listener()
}
