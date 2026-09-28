import { createContext, useContext, useEffect, useState } from 'react'
import { onModules, type DashboardModule } from '../rpc/modules.js'
import type { LinkAction, ModuleCard, ModuleDefinition, ModulePage } from '../module/index.js'
import { usePolled } from './use-async.js'
import { isPageSegment } from './route.js'

/** A module page as the shell mounts it: the page, plus the package it came from and the projects that have it. */
export interface MountedPage extends ModulePage {
  package: string
  projects: string[]
}

/** A link action as the shell mounts it (#1774): the action, plus the package it came from and the projects that have it. */
export interface MountedLinkAction extends LinkAction {
  package: string
  projects: string[]
}

/** A card as the shell mounts it (#1818): the card, plus the package it came from and the projects that have it. */
export interface MountedCard extends ModuleCard {
  package: string
  projects: string[]
}

/** The place of a card that names none. */
const DEFAULT_CARD_ORDER = 50

/** What the installed modules bring, once loaded: their pages, their cards and their link actions. */
export interface MountedModules {
  pages: MountedPage[]
  /** The Overview's cards, in the order they are drawn: by `order`, then by package name. */
  cards: MountedCard[]
  linkActions: MountedLinkAction[]
  /** True once the module list was read and every module in it imported or skipped. */
  loaded: boolean
}

const NOTHING_MOUNTED: MountedModules = { pages: [], cards: [], linkActions: [], loaded: false }

/** Each module's browser part, imported once per page load, by URL; a module that fails to load is skipped. */
const imported = new Map<string, Promise<ModuleDefinition | undefined>>()

function load(url: string): Promise<ModuleDefinition | undefined> {
  let loading = imported.get(url)
  if (!loading) {
    loading = import(/* @vite-ignore */ url).then(
      (loaded: { default?: ModuleDefinition }) => {
        const definition = loaded.default
        if (!definition || typeof definition !== 'object') return undefined
        // The module's stylesheet sits beside its module; it is linked once, like the module.
        if (definition.stylesheet) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = new URL(definition.stylesheet, new URL(url, window.location.href)).href
          document.head.appendChild(link)
        }
        return definition
      },
      (error: unknown) => {
        console.warn(`[framework] the module at ${url} did not load:`, error)
        return undefined
      },
    )
    imported.set(url, loading)
  }
  return loading
}

const NO_MODULES: DashboardModule[] = []

/**
 * What the registered projects' modules add (#1774), in package order: the pages, a segment two
 * modules claim going to the first, the cards (#1818), sorted by their order then their package, and the link actions, every one of them, each carrying the
 * package it came from and the projects that have it. `loaded` is false until the module list has
 * been read and every module in it imported, so the shell can tell "no such page" from "not
 * loaded yet".
 */
export function useModules(): MountedModules {
  const { value: modules, loaded: listed } = usePolled(onModules, NO_MODULES, 30_000, [])
  const [state, setState] = useState<MountedModules>(NOTHING_MOUNTED)
  useEffect(() => {
    if (!listed) return
    let live = true
    void Promise.all(modules.map(async module => ({ module, definition: await load(module.url) }))).then(loadedModules => {
      if (!live) return
      const pages: MountedPage[] = []
      const cards: MountedCard[] = []
      const linkActions: MountedLinkAction[] = []
      for (const { module, definition } of loadedModules) {
        for (const page of definition?.pages ?? []) {
          if (!isPageSegment(page.segment) || pages.some(p => p.segment === page.segment)) continue
          pages.push({ ...page, package: module.package, projects: module.projects })
        }
        for (const card of definition?.cards ?? []) {
          cards.push({ ...card, package: module.package, projects: module.projects })
        }
        for (const action of definition?.linkActions ?? []) {
          linkActions.push({ ...action, package: module.package, projects: module.projects })
        }
      }
      // Numbers, not a list the shell keeps: a third package sits between two others without the shell knowing it exists.
      cards.sort((a, b) => (a.order ?? DEFAULT_CARD_ORDER) - (b.order ?? DEFAULT_CARD_ORDER) || a.package.localeCompare(b.package))
      setState({ pages, cards, linkActions, loaded: true })
    })
    return () => {
      live = false
    }
  }, [modules, listed])
  return state
}

/**
 * The mounted modules, for any component in the shell (#1774): the shell reads them once with
 * {@link useModules} and provides them here, so a page deep in the tree finds the link actions
 * without the shell threading them through every prop. Outside the provider: nothing mounted,
 * not loaded.
 */
export const ModulesContext = createContext<MountedModules>(NOTHING_MOUNTED)

/** The installed modules' pages and link actions, as the shell mounted them. */
export function useMountedModules(): MountedModules {
  return useContext(ModulesContext)
}
