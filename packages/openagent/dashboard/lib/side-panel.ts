import { useSyncExternalStore } from 'react'

// Whether the side panel (the Files / Changes rail) is open, for each page that has one: an agent's
// page, or the "New agent" page. Each is closed until the person opens it there, and is found as it
// was left on coming back. Remembered in this browser: it is how one person left this screen, not a
// setting of the project, and it is read at once, so the panel is where it was left from the first
// frame.

/** localStorage key holding the names of the pages whose side panel is open, oldest first. */
const SIDE_PANEL_KEY = 'oa.side-panel'

/** How many open panels are remembered; opening one more forgets the oldest. */
const REMEMBERED = 200

const listeners = new Set<() => void>()

/** The name the side panel of a page is kept under: the agent's, or the "New agent" page's own. */
export function sidePanelName(projectId: string, agentId: string | null | undefined): string {
  return agentId ? `${projectId}/${agentId}` : 'new'
}

/** What a browser that keeps nothing was last told, so the button still works there. */
let fallback: string[] | undefined

function read(): string[] {
  if (fallback) return fallback
  try {
    const kept: unknown = JSON.parse(globalThis.localStorage?.getItem(SIDE_PANEL_KEY) ?? '[]')
    return Array.isArray(kept) ? kept.filter(name => typeof name === 'string') : []
  } catch {
    return []
  }
}

/** Open or close the side panel of the page with this name, and remember it. */
export function setSidePanelOpen(name: string, open: boolean): void {
  const others = read().filter(kept => kept !== name)
  const names = open ? [...others, name].slice(-REMEMBERED) : others
  try {
    if (names.length > 0) globalThis.localStorage?.setItem(SIDE_PANEL_KEY, JSON.stringify(names))
    else globalThis.localStorage?.removeItem(SIDE_PANEL_KEY)
  } catch {
    // A browser that keeps nothing: the panel still opens, for this page load.
    fallback = names
  }
  for (const listener of listeners) listener()
}

/** Whether the side panel of the page with this name is open, as reactive state. */
export function useSidePanelOpen(name: string): boolean {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => read().includes(name),
    () => false,
  )
}
