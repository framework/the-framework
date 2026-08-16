import { listAgents, type AgentMeta, type AgentStatus } from '../store/index.js'
import type { ProjectSummary } from './projects.js'
import { collectQueue, type ProjectQueue } from './queue.js'
import { hasTickets } from './tickets.js'
import { buildOverview, type ActiveAgent, type RecentProject, type OverviewDeps } from './overview.js'

// The Overview dashboard page (#471): the cross-project rollup that used to live cramped in
// the first sidebar, promoted to a real at-a-glance page. It reuses buildOverview for the
// "working now" / recent / queue-size facts and adds the numbers a landing page wants —
// per-project run counts and open TODOs, how past runs ended, and run activity over the last
// two weeks. Still a pure projection of the same files (agent.json + runs/ + LOGS.md + TODO).

/** One project's rollup row for the dashboard's projects table. */
export interface ProjectStat {
  projectId: string
  projectName: string
  /** Whether the repo still has its `.the-framework/` marker. */
  activated: boolean
  /** Whether an agent is live for this project right now. */
  running: boolean
  /** Archived (finished) runs recorded under `agents/`. */
  agents: number
  /** Open TODO items in this project's queue. */
  openTodos: number
  /** Whether the repo has any ticket in `tickets/` (#958) — presence only, not a count. */
  hasTickets: boolean
  lastActivityAt?: string
}

/** One day's finished-run count, for the activity chart. */
export interface ActivityDay {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string
  count: number
}

/** The dashboard page payload (#471). */
export interface DashboardData {
  totals: {
    projects: number
    activeAgents: number
    openTodos: number
    /** Archived runs across every project. */
    totalAgents: number
  }
  /** How past runs ended, across every project (archived runs only). */
  agentsByStatus: Record<AgentStatus, number>
  /** Finished runs per day over the last {@link ACTIVITY_DAYS} days, oldest-first. */
  activity: ActivityDay[]
  /** Runs going right now, most-recently-updated first (from {@link buildOverview}). */
  active: ActiveAgent[]
  /** The most recently active projects (capped). */
  recent: RecentProject[]
  /** Every registered project with its run/TODO rollup, most-recently-active first. */
  projects: ProjectStat[]
  /** The per-project open TODO backlog (from {@link collectQueue}). */
  queue: ProjectQueue[]
}

/** How many days of run activity the chart covers. */
const ACTIVITY_DAYS = 14

/** Injectable readers/clock so {@link buildDashboard} is unit-testable off disk. */
export interface DashboardDeps extends OverviewDeps {
  /** Archived runs for a project path. Defaults to {@link listAgents} (forgiving of a missing dir). */
  agents?: (cwd: string) => Promise<AgentMeta[]>
  /** Whether a project has tickets (#958). Defaults to {@link hasTickets} (false on any error). */
  tickets?: (cwd: string) => Promise<boolean>
  /** The clock, for the activity window. Defaults to `new Date()`. */
  now?: () => Date
}

/** Local `YYYY-MM-DD` key for a date (bucketing runs by the day the user saw them start). */
function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Build the Overview dashboard: the {@link buildOverview} rollup (working now / recent /
 * queue size) plus per-project run counts, how past runs ended, and a two-week activity
 * window. Forgiving — a project whose `agents/` is missing simply contributes nothing.
 */
export async function buildDashboard(projects: ProjectSummary[], deps: DashboardDeps = {}): Promise<DashboardData> {
  const listAgentsFor = deps.agents ?? (cwd => listAgents(cwd).catch(() => []))
  const hasTicketsFor = deps.tickets ?? (cwd => hasTickets(cwd).catch(() => false))
  const now = deps.now ? deps.now() : new Date()

  // Compute the queue once and hand it to buildOverview so the backlog is read a single time.
  const queue = await (deps.queue ?? (p => collectQueue(p)))(projects)
  const overview = await buildOverview(projects, { ...deps, queue: async () => queue })
  const openByProject = new Map(queue.map(q => [q.projectId, q.open]))

  // Seed the activity window with the last ACTIVITY_DAYS days at zero (oldest-first) so a
  // quiet stretch still shows empty bars rather than collapsing the axis.
  const dayKeys: string[] = []
  const buckets = new Map<string, number>()
  for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = localDateKey(d)
    dayKeys.push(key)
    buckets.set(key, 0)
  }

  const agentsByStatus: Record<AgentStatus, number> = { running: 0, done: 0, stopped: 0, failed: 0 }
  const projectStats: ProjectStat[] = []
  let totalAgents = 0
  for (const project of projects) {
    const agents = await listAgentsFor(project.path)
    totalAgents += agents.length
    for (const agent of agents) {
      agentsByStatus[agent.status] += 1
      const key = localDateKey(new Date(agent.startedAt))
      if (buckets.has(key)) buckets.set(key, buckets.get(key)! + 1)
    }
    projectStats.push({
      projectId: project.id,
      projectName: project.name,
      activated: project.activated,
      running: overview.active.some(a => a.projectId === project.id),
      agents: agents.length,
      openTodos: openByProject.get(project.id) ?? 0,
      hasTickets: await hasTicketsFor(project.path),
      ...(project.lastActivityAt ? { lastActivityAt: project.lastActivityAt } : {}),
    })
  }
  projectStats.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''))

  return {
    totals: {
      projects: projects.length,
      activeAgents: overview.active.length,
      openTodos: overview.queueOpen,
      totalAgents,
    },
    agentsByStatus,
    activity: dayKeys.map(date => ({ date, count: buckets.get(date) ?? 0 })),
    active: overview.active,
    recent: overview.recent,
    projects: projectStats,
    queue,
  }
}
