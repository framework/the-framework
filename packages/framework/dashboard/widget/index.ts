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
import type { AgentStatus } from '../../src/index.js'
import { runWidgetCommand } from '../rpc/widgets.js'
import type { WidgetCommandResult } from '../rpc/widgets.js'

export type { WidgetCommandResult, AgentStatus }

/** A registered project that has the widget's package, as a page gets it. */
export interface WidgetProject {
  id: string
  name: string
}

/**
 * What a widget page is rendered with. A page reads its sub-path and navigates within itself
 * through {@link WidgetHost.openPage}; the dashboard's own pages reach it the same way, by the
 * link convention below.
 *
 * A link into a project's files (`WidgetLink.href` such as `tickets/2026-01-01_x.md`) opens the
 * mounted page named by its first segment, at `/<segment>/<projectId>/<rest…>`: the path a page
 * gets for it is `[projectId, ...rest]`. So a page that shows one project's file under its own
 * segment is where every such link in the dashboard lands, and the dashboard names no page.
 */
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

/** A run of a project as the dashboard knows it (#1774): enough for a page to name one and link to it. */
export interface WidgetAgent {
  /** The run's id, the one {@link WidgetHost.openAgent} takes. */
  id: string
  /** The session name the run's branch carries, when it has one. */
  name?: string
  /** What the run was asked, as typed or as queued; absent when its record carries none. */
  ask?: string
  status: AgentStatus
  /** ISO 8601. */
  startedAt: string
}

/** What starting a run answered: the run's id, or in words why there is none. */
export type StartRunResult = { ok: true; agentId: string } | { ok: false; error: string }

/**
 * What the dashboard gives the widget it is rendering. Every service is generic — a project, a
 * run, a page, a command — and none names a skill: what a widget composes out of them is its own.
 */
export interface WidgetHost {
  /** The package the widget came from: the one whose commands {@link runCommand} runs. */
  package: string
  /**
   * Run one of the widget package's own commands in one project and get its JSON output: the
   * same command an agent runs (`npx <command> …`). `command` names one when the package has several.
   */
  runCommand(projectId: string, args: string[], command?: string): Promise<WidgetCommandResult>
  /**
   * The same, for a command that changes the project's data (a claim released, an entry added):
   * the dashboard then syncs the project's data with origin and forgets what it had read, so the
   * change shows at once instead of at the next sync. A link action's host runs every command so.
   */
  act(projectId: string, args: string[], command?: string): Promise<WidgetCommandResult>
  /** Open one agent's page in the dashboard: its live feed while it runs, its record after. */
  openAgent(projectId: string, agentId: string): void
  /** Open a page a widget adds (this one's or another's), at a sub-path: `openPage('tickets', [projectId, file])`. */
  openPage(segment: string, path?: string[]): void
  /**
   * Start a run in one project with this prompt, with the person's own picks (which tool, which
   * model, where it runs), and land on it. Answers the run's id, or why there is none.
   */
  startRun(projectId: string, prompt: string): Promise<StartRunResult>
  /** Open the project's launcher with this prompt drafted in, to set it up before sending: "Configure first, then run". */
  configureRun(projectId: string, prompt: string): void
  /** The project's runs the dashboard knows: the ones running, and the recorded ones when the project records them. */
  agents(projectId: string): Promise<WidgetAgent[]>
}

/** What the dashboard knows about the widget it is serving: every service but the commands, which it binds to the package. */
export type WidgetHostBase = Omit<WidgetHost, 'runCommand' | 'act'>

/**
 * The host for one widget: the dashboard's services, and its commands bound to the widget's own
 * package. `acts` marks every command as an action on the project rather than a page's read: the
 * dashboard builds a link action's host with it, so what the action wrote is read back at once.
 */
export function widgetHost(base: WidgetHostBase, opts: { acts?: boolean } = {}): WidgetHost {
  return {
    ...base,
    runCommand: (projectId, args, command) => runWidgetCommand(projectId, base.package, args, command, opts.acts ?? false),
    act: (projectId, args, command) => runWidgetCommand(projectId, base.package, args, command, true),
  }
}

/**
 * Set by the dashboard around every widget page it renders: the widget's package and the
 * dashboard's services. A test of a widget page provides a whole host here, commands included,
 * and {@link useWidgetHost} hands it over as it is.
 */
export const WidgetHostContext = createContext<WidgetHostBase | WidgetHost | null>(null)

/** The dashboard's services for the widget being rendered. Only valid inside a widget page. */
export function useWidgetHost(): WidgetHost {
  const host = useContext(WidgetHostContext)
  if (!host) throw new Error('useWidgetHost is only available inside a widget page')
  return 'runCommand' in host ? host : widgetHost(host)
}

// The dashboard's own building blocks, so a widget looks like the rest of the page.
export { Button, buttonVariants, type ButtonProps } from '../components/ui/button.js'
export { Badge } from '../components/ui/badge.js'
export { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card.js'
export { Skeleton } from '../components/ui/skeleton.js'
export { Checkbox } from '../components/ui/checkbox.js'
export { Input } from '../components/ui/input.js'
export { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover.js'
export { RangeSlider } from '../components/ui/slider.js'
export { Separator } from '../components/ui/separator.js'
export { ScrollArea } from '../components/ui/scroll-area.js'
export { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip.js'
export { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu.js'
export { Markdown } from '../components/Markdown.js'
export { StartAgentButton } from '../components/StartAgentButton.js'
export { LinkActions, type ProjectLinks, type LinkTargets } from '../components/LinkActions.js'
export { cn } from '../lib/utils.js'
export { formatRelative, formatDateTime, formatDuration, formatAge } from '../lib/format-date.js'
export { usePolled, useLoaded } from '../lib/use-async.js'
export { useAction } from '../lib/use-action.js'
