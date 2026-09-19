import { useEffect, useState } from 'react'
import { onWidgets, type DashboardWidget } from '../rpc/widgets.js'
import type { WidgetDefinition, WidgetPage } from '../widget/index.js'
import { usePolled } from './use-async.js'
import { isPageSegment } from './route.js'

/** A widget page as the shell mounts it: the page, plus the package it came from and the projects that have it. */
export interface MountedPage extends WidgetPage {
  package: string
  projects: string[]
}

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
 * The pages the registered projects' widgets add (#1774), in package order; a segment two widgets
 * claim goes to the first. `loaded` is false until the widget list has been read and every module
 * in it imported, so the shell can tell "no such page" from "not loaded yet".
 */
export function useWidgetPages(): { pages: MountedPage[]; loaded: boolean } {
  const { value: widgets, loaded: listed } = usePolled(onWidgets, NO_WIDGETS, 30_000, [])
  const [state, setState] = useState<{ pages: MountedPage[]; loaded: boolean }>({ pages: [], loaded: false })
  useEffect(() => {
    if (!listed) return
    let live = true
    void Promise.all(widgets.map(async widget => ({ widget, definition: await load(widget.url) }))).then(loadedWidgets => {
      if (!live) return
      const pages: MountedPage[] = []
      for (const { widget, definition } of loadedWidgets) {
        for (const page of definition?.pages ?? []) {
          if (!isPageSegment(page.segment) || pages.some(p => p.segment === page.segment)) continue
          pages.push({ ...page, package: widget.package, projects: widget.projects })
        }
      }
      setState({ pages, loaded: true })
    })
    return () => {
      live = false
    }
  }, [widgets, listed])
  return state
}
