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

/**
 * A link a dashboard page shows (#1774): the name of some work and where it points. What a
 * {@link LinkAction} is given. The dashboard knows nothing of what the link names; the page that
 * shows it does, and says so in these three fields.
 */
export interface WidgetLink {
  /** The link's text: the name of the work. */
  text: string
  /**
   * Where the link points: a path inside the project's repository (`tickets/2026-01-01_x.md`) or an
   * absolute URL. Absent for plain text that names work without pointing anywhere.
   */
  href?: string
  /** How urgent the page says the work is, 0 (only if capacity) to 10 (critical); absent when the page does not say. */
  priority?: number
}

/** What a link action did: done, or stopped, with the reason the action or its command gave. */
export type LinkActionResult = { ok: true } | { ok: false; error: string }

/**
 * An action a widget offers on the links dashboard pages show (#1774): one verb, done by the
 * widget package's own command. The dashboard shows it as a button beside any link whose project
 * has the widget's package, with no page naming the widget: the page shows links, the widget acts
 * on links, the dashboard puts the two together.
 */
export interface LinkAction {
  /** The button's label, a short verb phrase: "Add to queue". */
  label: string
  /** What the button says once the action is done: "Queued". The label with a check mark otherwise. */
  doneLabel?: string
  /** The button's icon; none otherwise. */
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  /**
   * Act on the links, in the order given, all in one project. `host` runs the widget package's
   * own commands in that project. A batch stops at its first failure and says why.
   */
  run(host: WidgetHost, projectId: string, links: WidgetLink[]): Promise<LinkActionResult>
}

/** What a widget module default-exports. */
export interface WidgetDefinition {
  /** The pages the widget adds, each with a sidebar row. */
  pages?: WidgetPage[]
  /** The actions the widget offers on the links dashboard pages show, wherever the link's project has the widget's package. */
  linkActions?: LinkAction[]
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

/** What the dashboard knows about the widget it is serving: its package, and how to navigate. */
export type WidgetHostBase = Pick<WidgetHost, 'package' | 'openAgent'>

/**
 * The host for one widget: the dashboard's navigation, and its commands bound to the widget's own
 * package. `acts` marks every command as an action on the project rather than a page's read: the
 * dashboard builds a link action's host with it, so what the action wrote is read back at once.
 */
export function widgetHost(base: WidgetHostBase, opts: { acts?: boolean } = {}): WidgetHost {
  return {
    ...base,
    runCommand: (projectId, args, command) => runWidgetCommand(projectId, base.package, args, command, opts.acts ?? false),
  }
}

/** Set by the dashboard around every widget page it renders: the widget's package and the navigation. */
export const WidgetHostContext = createContext<WidgetHostBase | null>(null)

/** The dashboard's services for the widget being rendered. Only valid inside a widget page. */
export function useWidgetHost(): WidgetHost {
  const host = useContext(WidgetHostContext)
  if (!host) throw new Error('useWidgetHost is only available inside a widget page')
  return widgetHost(host)
}

// The dashboard's own building blocks, so a widget looks like the rest of the page.
export { Button, buttonVariants, type ButtonProps } from '../components/ui/button.js'
export { Badge } from '../components/ui/badge.js'
export { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card.js'
export { Skeleton } from '../components/ui/skeleton.js'
export { cn } from '../lib/utils.js'
export { formatRelative, formatDateTime, formatDuration } from '../lib/format-date.js'
export { usePolled } from '../lib/use-async.js'
