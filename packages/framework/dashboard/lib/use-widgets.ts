import { createContext, useContext, useEffect, useState } from 'react'
import { onWidgets, type DashboardWidget } from '../rpc/widgets.js'
import type { LinkAction, WidgetCard, WidgetDefinition, WidgetPage } from '../widget/index.js'
import { usePolled } from './use-async.js'
import { isPageSegment } from './route.js'

/** A widget page as the shell mounts it: the page, plus the package it came from and the projects that have it. */
export interface MountedPage extends WidgetPage {
  package: string
  projects: string[]
}

/** A link action as the shell mounts it (#1774): the action, plus the package it came from and the projects that have it. */
export interface MountedLinkAction extends LinkAction {
  package: string
  projects: string[]
}

/** A card as the shell mounts it (#1818): the card, plus the package it came from and the projects that have it. */
export interface MountedCard extends WidgetCard {
  package: string
  projects: string[]
}

/** The place of a card that names none. */
const DEFAULT_CARD_ORDER = 50

/** What the installed widgets bring, once loaded: their pages, their cards and their link actions. */
export interface MountedWidgets {
  pages: MountedPage[]
  /** The Overview's cards, in the order they are drawn: by `order`, then by package name. */
  cards: MountedCard[]
  linkActions: MountedLinkAction[]
  /** True once the widget list was read and every module in it imported or skipped. */
  loaded: boolean
}

const NOTHING_MOUNTED: MountedWidgets = { pages: [], cards: [], linkActions: [], loaded: false }

/** Each widget module, imported once per page load, by URL; a module that fails to load is skipped. */
const modules = new Map<string, Promise<WidgetDefinition | undefined>>()

function load(url: string): Promise<WidgetDefinition | undefined> {
  let loading = modules.get(url)
  if (!loading) {
    loading = import(/* @vite-ignore */ url).then(
      (module: { default?: WidgetDefinition }) => {
        const definition = module.default
        if (!definition || typeof definition !== 'object') return undefined
        // The widget's stylesheet sits beside its module; it is linked once, like the module.
        if (definition.stylesheet) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = new URL(definition.stylesheet, new URL(url, window.location.href)).href
          document.head.appendChild(link)
        }
        return definition
      },
      (error: unknown) => {
        console.warn(`[framework] the widget at ${url} did not load:`, error)
        return undefined
      },
    )
    modules.set(url, loading)
  }
  return loading
}

const NO_WIDGETS: DashboardWidget[] = []

/**
 * What the registered projects' widgets add (#1774), in package order: the pages, a segment two
 * widgets claim going to the first, the cards (#1818), sorted by their order then their package, and the link actions, every one of them, each carrying the
 * package it came from and the projects that have it. `loaded` is false until the widget list has
 * been read and every module in it imported, so the shell can tell "no such page" from "not
 * loaded yet".
 */
export function useWidgets(): MountedWidgets {
  const { value: widgets, loaded: listed } = usePolled(onWidgets, NO_WIDGETS, 30_000, [])
  const [state, setState] = useState<MountedWidgets>(NOTHING_MOUNTED)
  useEffect(() => {
    if (!listed) return
    let live = true
    void Promise.all(widgets.map(async widget => ({ widget, definition: await load(widget.url) }))).then(loadedWidgets => {
      if (!live) return
      const pages: MountedPage[] = []
      const cards: MountedCard[] = []
      const linkActions: MountedLinkAction[] = []
      for (const { widget, definition } of loadedWidgets) {
        for (const page of definition?.pages ?? []) {
          if (!isPageSegment(page.segment) || pages.some(p => p.segment === page.segment)) continue
          pages.push({ ...page, package: widget.package, projects: widget.projects })
        }
        for (const card of definition?.cards ?? []) {
          cards.push({ ...card, package: widget.package, projects: widget.projects })
        }
        for (const action of definition?.linkActions ?? []) {
          linkActions.push({ ...action, package: widget.package, projects: widget.projects })
        }
      }
      // Numbers, not a list the shell keeps: a third package sits between two others without the shell knowing it exists.
      cards.sort((a, b) => (a.order ?? DEFAULT_CARD_ORDER) - (b.order ?? DEFAULT_CARD_ORDER) || a.package.localeCompare(b.package))
      setState({ pages, cards, linkActions, loaded: true })
    })
    return () => {
      live = false
    }
  }, [widgets, listed])
  return state
}

/**
 * The mounted widgets, for any component in the shell (#1774): the shell reads them once with
 * {@link useWidgets} and provides them here, so a page deep in the tree finds the link actions
 * without the shell threading them through every prop. Outside the provider: nothing mounted,
 * not loaded.
 */
export const WidgetsContext = createContext<MountedWidgets>(NOTHING_MOUNTED)

/** The installed widgets' pages and link actions, as the shell mounted them. */
export function useMountedWidgets(): MountedWidgets {
  return useContext(WidgetsContext)
}
