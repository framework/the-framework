// `framework/widget`: what the dashboard offers a skill package's widget (#1774).
//
// A widget is a browser module a package exports as `./dashboard`. The dashboard finds it in a
// project's dependencies, imports it at runtime, and reads its default export, a
// `WidgetDefinition`. The widget imports `react` and this module as bare names and bundles
// neither: the dashboard's import map points both at the dashboard's own running copies, so a
// widget renders inside the same React tree and uses the same components as the rest of the page.
//
// This file IS that module: the dashboard's build emits it as its own entry (`/host/widget.js`),
// sharing every module with the dashboard itself. Nothing here names a skill.
import { createContext, useContext, type ComponentType } from 'react'
import { runWidgetCommand } from '../rpc/widgets.js'
import type { WidgetCommandResult } from '../rpc/widgets.js'

export type { WidgetCommandResult }

/** A registered project that has the widget's package, as a page gets it. */
export interface WidgetProject {
  id: string
  name: string
}

/** What a widget page is rendered with. */
export interface WidgetPageProps {
  /** The registered projects whose dependencies include the widget's package, in the registry's order. */
  projects: WidgetProject[]
  /** The URL's segments after the page's own, decoded: `/logs/a` gives `['a']`. */
  path: string[]
}

/** A page a widget adds: its own URL segment and its row in the sidebar. */
export interface WidgetPage {
  /** The page's URL, `/<segment>`: a lowercase letter, then lowercase letters and digits (never a project's id, which always has a dash). */
  segment: string
  /** The sidebar row's label. */
  label: string
  /** The sidebar row's icon; a generic one when absent. */
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  /** The page itself. */
  Page: ComponentType<WidgetPageProps>
}

/** What a widget module default-exports. */
export interface WidgetDefinition {
  /** The pages the widget adds, each with a sidebar row. */
  pages?: WidgetPage[]
  /** A stylesheet to load with the widget, relative to the widget module's own URL. */
  stylesheet?: string
}

/** Type the default export: `export default defineWidget({ ... })`. */
export function defineWidget(definition: WidgetDefinition): WidgetDefinition {
  return definition
}

/** What the dashboard gives the widget it is rendering. */
export interface WidgetHost {
  /** The package the widget came from: the one whose commands {@link runCommand} runs. */
  package: string
  /**
   * Run one of the widget package's own commands in one project and get its JSON output: the
   * same command an agent runs (`npx <command> …`). `command` names one when the package has several.
   */
  runCommand(projectId: string, args: string[], command?: string): Promise<WidgetCommandResult>
  /** Open one agent's page in the dashboard: its live feed while it runs, its record after. */
  openAgent(projectId: string, agentId: string): void
}

/** Set by the dashboard around every widget page it renders: the widget's package and the navigation. */
export const WidgetHostContext = createContext<Pick<WidgetHost, 'package' | 'openAgent'> | null>(null)

/** The dashboard's services for the widget being rendered. Only valid inside a widget page. */
export function useWidgetHost(): WidgetHost {
  const host = useContext(WidgetHostContext)
  if (!host) throw new Error('useWidgetHost is only available inside a widget page')
  return {
    ...host,
    runCommand: (projectId, args, command) => runWidgetCommand(projectId, host.package, args, command),
  }
}

// The dashboard's own building blocks, so a widget looks like the rest of the page.
export { Button, buttonVariants, type ButtonProps } from '../components/ui/button.js'
export { Badge } from '../components/ui/badge.js'
export { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card.js'
export { Skeleton } from '../components/ui/skeleton.js'
export { cn } from '../lib/utils.js'
export { formatRelative, formatDateTime, formatDuration } from '../lib/format-date.js'
export { usePolled } from '../lib/use-async.js'
