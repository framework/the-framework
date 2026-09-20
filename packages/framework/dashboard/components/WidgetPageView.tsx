import { Component, type ReactNode } from 'react'
import type { ProjectSummary } from '../../src/index.js'
import { WidgetHostContext, type WidgetProject } from '../widget/index.js'
import type { MountedPage } from '../lib/use-widgets.js'
import { useHostServices } from '../lib/host-services.js'

/** A widget page that throws shows this instead of taking the whole dashboard down. */
class WidgetBoundary extends Component<{ label: string; children: ReactNode }, { error: string | null }> {
  override state = { error: null as string | null }
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
  override render() {
    if (this.state.error === null) return this.props.children
    return (
      <div role="alert" className="p-6 text-sm text-danger">
        The {this.props.label} page failed: {this.state.error}
      </div>
    )
  }
}

/**
 * One widget page in the main pane (#1774): the page, given the projects that have its package,
 * inside the host context its `useWidgetHost` reads (its package, the shell's services), and
 * inside a boundary, so a broken widget breaks only its own page.
 */
export function WidgetPageView({ page, projects, path }: { page: MountedPage; projects: ProjectSummary[]; path: string[] }) {
  const host = useHostServices(page.package)
  const having: WidgetProject[] = page.projects.flatMap(id => {
    const project = projects.find(p => p.id === id)
    return project ? [{ id: project.id, name: project.name }] : []
  })
  const Page = page.Page
  return (
    <WidgetHostContext.Provider value={host}>
      <WidgetBoundary key={page.segment} label={page.label}>
        <Page projects={having} path={path} />
      </WidgetBoundary>
    </WidgetHostContext.Provider>
  )
}
