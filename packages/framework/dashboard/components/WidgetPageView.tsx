import { Component, type ReactNode } from 'react'
import type { ProjectSummary } from '../../src/index.js'
import { WidgetHostContext, type WidgetProject } from '../widget/index.js'
import type { MountedPage } from '../lib/use-widgets.js'
import { useHostServices } from '../lib/host-services.js'

/** A widget's piece that throws shows this instead of taking the whole dashboard down. */
class WidgetBoundary extends Component<{ label: string; children: ReactNode }, { error: string | null }> {
  override state = { error: null as string | null }
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
  override render() {
    if (this.state.error === null) return this.props.children
    return (
      <div role="alert" className="p-6 text-sm text-danger">
        The {this.props.label} failed: {this.state.error}
      </div>
    )
  }
}

/**
 * Where one widget's piece renders (#1774/#1818): inside the host context its `useWidgetHost`
 * reads (its package, the shell's services), and inside a boundary, so a broken widget breaks
 * only its own piece. The page view and the Overview's cards both render through it. `label`
 * names the piece in the boundary's line: "Logs page", "queue card".
 */
export function WidgetSlot({ package: pkg, label, children }: { package: string; label: string; children: ReactNode }) {
  const host = useHostServices(pkg)
  return (
    <WidgetHostContext.Provider value={host}>
      <WidgetBoundary label={label}>{children}</WidgetBoundary>
    </WidgetHostContext.Provider>
  )
}

/** The registered projects a widget's piece is given: the ones that have its package, by id and name, leaving out any the dashboard does not list. */
export function projectsHaving(ids: readonly string[], projects: readonly ProjectSummary[]): WidgetProject[] {
  return ids.flatMap(id => {
    const project = projects.find(p => p.id === id)
    return project ? [{ id: project.id, name: project.name }] : []
  })
}

/** One widget page in the main pane (#1774): the page, given the projects that have its package, in its slot. */
export function WidgetPageView({ page, projects, path }: { page: MountedPage; projects: ProjectSummary[]; path: string[] }) {
  const Page = page.Page
  return (
    <WidgetSlot key={page.segment} package={page.package} label={`${page.label} page`}>
      <Page projects={projectsHaving(page.projects, projects)} path={path} />
    </WidgetSlot>
  )
}
