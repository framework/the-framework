import { contextProjects, resolveProjectPath } from './context.js'
import { findProjectWidget, readProjectWidgets, runWidgetCommand as runCommand, type WidgetCommandResult } from '../project-widgets.js'
import { widgetUrl } from '../dashboard/widget-serve.js'
import { providedDataChanged } from '../store/provided.js'

export type { WidgetCommandResult } from '../project-widgets.js'

/** One widget as the dashboard loads it: where its module is, and which projects have it. */
export interface DashboardWidget {
  /** The package that brings it. */
  package: string
  /** The URL of its browser module, served from the first project that has it. */
  url: string
  /** The registered projects whose packages include it, in the registry's order. */
  projects: string[]
}

/**
 * Every widget any registered project brings (#1774), one per package: the sidebar and the pages
 * are cross-project, like the Overview. A package several projects install is loaded once, from
 * the first of them in the registry's order; its page then reads each project through that
 * project's own command. A project that cannot be read contributes nothing.
 */
export async function onWidgets(): Promise<DashboardWidget[]> {
  const byPackage = new Map<string, DashboardWidget>()
  for (const project of await contextProjects().list()) {
    const widgets = await readProjectWidgets(project.path).catch(() => [])
    for (const widget of widgets) {
      const known = byPackage.get(widget.package)
      if (known) known.projects.push(project.id)
      else byPackage.set(widget.package, { package: widget.package, url: widgetUrl(project.id, widget), projects: [project.id] })
    }
  }
  return [...byPackage.values()]
}

/**
 * Run one of a widget package's commands in one project and answer its JSON output: how a widget
 * reads (and changes) its own data. Refused for an unknown project and for a package that is not a
 * widget of that project, so a page can run only its own package's commands, never an arbitrary
 * program. Once the command has run, the framework forgets what it had read of that project's
 * provided data (its queue, its runs): the command may have written it, and the next read sees
 * that at once instead of a cached copy.
 */
export async function runWidgetCommand(projectId: string, pkg: string, args: string[], command?: string): Promise<WidgetCommandResult> {
  const root = await resolveProjectPath(projectId)
  if (!root) return { ok: false, error: 'unknown project' }
  if (!Array.isArray(args)) return { ok: false, error: 'arguments must be a list' }
  const widget = await findProjectWidget(root, pkg)
  if (!widget) return { ok: false, error: `${pkg} brings no widget to this project` }
  const result = await runCommand(root, widget, args, command)
  providedDataChanged(root)
  return result
}
