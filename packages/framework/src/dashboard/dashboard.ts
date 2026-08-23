import type { ProjectSummary } from './projects.js'
import { collectQueue, type ProjectQueue } from './queue.js'
import { hasTickets } from './tickets.js'
import { buildOverview, type ActiveAgent, type OverviewDeps } from './overview.js'

// The Overview dashboard page (#471): the cross-project rollup that used to live cramped in
// the first sidebar, promoted to a real at-a-glance page. It reuses buildOverview for the
// "working now" facts and adds what the page and the onboarding checklist ask of it. Still a pure
// projection of the same files (agent.json + agents/ + TODO).
//
// It used to carry more: per-project agent counts, how past agents ended, and a two-week activity
// window. #1139 cut the surfaces that drew them and left the numbers being computed for nobody —
// which cost a `listAgents` fan-out over every project's whole archive on each poll, twice a cycle
// between the two pollers. What is left is what someone reads.

/** One project's rollup row. */
export interface ProjectStat {
  projectId: string
  /** Whether the repo has any ticket in `tickets/` (#958) — presence only, not a count. */
  hasTickets: boolean
}

/** The dashboard page payload (#471). */
export interface DashboardData {
  totals: {
    projects: number
    openTodos: number
  }
  /** Agents going right now, most-recently-updated first (from {@link buildOverview}). */
  active: ActiveAgent[]
  /** Every registered project, most-recently-active first. */
  projects: ProjectStat[]
  /** The per-project open TODO backlog (from {@link collectQueue}). */
  queue: ProjectQueue[]
}

/** Injectable readers so {@link buildDashboard} is unit-testable off disk. */
export interface DashboardDeps extends OverviewDeps {
  /** Whether a project has tickets (#958). Defaults to {@link hasTickets} (false on any error). */
  tickets?: (cwd: string) => Promise<boolean>
}

/**
 * Build the Overview dashboard: the {@link buildOverview} rollup (working now / queue) plus the
 * per-project ticket presence the onboarding checklist reads. Forgiving — a project whose state
 * cannot be read simply contributes nothing.
 */
export async function buildDashboard(projects: ProjectSummary[], deps: DashboardDeps = {}): Promise<DashboardData> {
  const hasTicketsFor = deps.tickets ?? (cwd => hasTickets(cwd).catch(() => false))

  // Compute the queue once and hand it to buildOverview so the backlog is read a single time.
  const queue = await (deps.queue ?? (p => collectQueue(p)))(projects)
  const overview = await buildOverview(projects, { ...deps, queue: async () => queue })

  // Most-recently-active first: the checklist takes the head of this list as the project to act
  // on, so the order is the output here even though the timestamp itself is not.
  const ordered = [...projects].sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''))
  const projectStats: ProjectStat[] = []
  for (const project of ordered) {
    projectStats.push({ projectId: project.id, hasTickets: await hasTicketsFor(project.path) })
  }

  return {
    totals: {
      projects: projects.length,
      openTodos: overview.queueOpen,
    },
    active: overview.active,
    projects: projectStats,
    queue,
  }
}
