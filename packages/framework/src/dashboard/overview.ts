import { readAllAgents, readLiveMetas, type LiveAgent, type AgentMeta, type AgentStatus } from '../store/index.js'
import { sessionNameField } from '../agent-view.js'
import type { ProjectSummary } from './projects.js'
import { collectQueue, type ProjectQueue } from './queue.js'
import { readTickets, type WorkspaceTicket } from './tickets.js'
import { TICKETS_DIR } from '../tickets.js'
import { cloudRunState } from '../cloud-run-state.js'
import { bridgeQuestions } from './bridge-store.js'
import { hostname } from 'node:os'

// The first-sidebar Overview (#437, part of #314): a cross-project glance at what the agent
// is working on right now, the size of the backlog, and the recently active projects. It
// rolls up three existing file projections across the whole registry — the live agent meta
// (`.the-framework/agent.json`, kept current per event), the TODO queue (queue.ts), and each
// project's last activity (ProjectSummary.lastActivityAt from its sessions).

/** One project's in-flight run, surfaced in the Overview's "working now" list. */
export interface ActiveAgent {
  projectId: string
  projectName: string
  /** Which run this is (#738): a project can have several in flight, one per worktree. */
  agentId: string
  /** The agent's own checkout, so its git/file status is read from the worktree it edits (#738). */
  cwd: string
  status: AgentStatus
  /** What the user asked to build (the agent's `scope` event). */
  intent?: string
  scope?: string
  /** ISO timestamp of the agent's last event. */
  updatedAt?: string
  /** The session name the agent chose (#326), when it set one. */
  sessionName?: string
  /** Whether the agent signalled `setReadyForMerge()` (#326): drives the building/ready dot. */
  readyForMerge?: boolean
  /**
   * A web run at work on its cloud side (#1668): in its session, or parked on a question the
   * bridge reported. Its local half is over, so it is not a live agent — it is listed because the
   * cloud side is the agent, and "no agents working" over a waiting cloud session was a lie.
   */
  cloud?: 'in-cloud' | 'waiting'
  /** The machine whose daemon started it (#1648), only when that is not this one. */
  host?: string
}

/** One recently active project, most-recent first. */
export interface RecentProject {
  projectId: string
  projectName: string
  lastActivityAt?: string
}

/** The cross-project Overview payload. */
export interface Overview {
  /** Projects with a running agent, most-recently-updated first. */
  active: ActiveAgent[]
  /** Total open TODO items across every project. */
  queueOpen: number
  /** The most recently active projects (capped). */
  recent: RecentProject[]
}

/** One recent session, tagged with the project it belongs to, for the cross-project rail. */
export interface RecentAgent {
  projectId: string
  projectName: string
  agent: AgentMeta
}

/** How many recent projects the Overview surfaces. */
const RECENT_LIMIT = 5

/** How many recent sessions the home rail pools across every project. */
const RECENT_RUNS_LIMIT = 30

/** Injectable reader so {@link buildRecentAgents} is unit-testable off disk. */
export interface RecentAgentsDeps {
  agents?: (cwd: string) => Promise<AgentMeta[]>
}

/**
 * Every project's sessions pooled and sorted newest-first (capped), so the shared sidebar (#shared-
 * shell) can show recents on the home/Overview where no single project is selected. Each row carries
 * the project it belongs to, so selecting it jumps into that project's session. Forgiving — a project
 * whose agents cannot be read simply contributes nothing.
 */
export async function buildRecentAgents(projects: ProjectSummary[], deps: RecentAgentsDeps = {}): Promise<RecentAgent[]> {
  const readAgents = deps.agents ?? readAllAgents
  const all: RecentAgent[] = []
  for (const project of projects) {
    for (const agent of await readAgents(project.path).catch(() => [])) {
      all.push({ projectId: project.id, projectName: project.name, agent })
    }
  }
  all.sort((a, b) => (b.agent.startedAt ?? '').localeCompare(a.agent.startedAt ?? ''))
  // One row per run (#1648): two checkouts of one repository share their archive, so every run
  // was listed once per checkout; the first project to list it keeps it.
  const seen = new Set<string>()
  return all.filter(row => !seen.has(row.agent.id) && seen.add(row.agent.id)).slice(0, RECENT_RUNS_LIMIT)
}

/** One project's tickets, for the cross-project Tickets page (#1144). */
export interface ProjectTickets {
  projectId: string
  projectName: string
  tickets: WorkspaceTicket[]
}

/** Injectable reader so {@link collectAllTickets} is unit-testable off disk. */
export interface AllTicketsDeps {
  tickets?: (cwd: string) => Promise<WorkspaceTicket[]>
}

/**
 * Every registered project's tickets, one list per project (#1144) — the cross-project Tickets
 * page. Unlike {@link buildHotTickets} this does not pool or bucket: a ticket belongs to one
 * project, and the page's whole point is reading each project's backlog (and reaching its own
 * import/update) rather than one merged feed. Kept in registry order, project included even when
 * its list comes back empty, so import stays reachable there — the same read failing simply
 * leaves that project's list empty rather than dropping the section.
 */
export async function collectAllTickets(projects: ProjectSummary[], deps: AllTicketsDeps = {}): Promise<ProjectTickets[]> {
  const readT = deps.tickets ?? readTickets
  return Promise.all(
    projects.map(async project => ({
      projectId: project.id,
      projectName: project.name,
      tickets: await readT(project.path).catch((): WorkspaceTicket[] => []),
    })),
  )
}

/** Which lane of the "hot tickets" overview (#1139) a ticket sits in. */
export type HotBucket = 'in-progress' | 'ai-queue' | 'high-priority'

/** One ticket surfaced on the Overview's hot-tickets card, tagged with its project and lane. */
export interface HotTicket {
  projectId: string
  projectName: string
  bucket: HotBucket
  ticket: WorkspaceTicket
  /**
   * An agent is implementing this ticket right now (#1117): its id, for the card to link into.
   *
   * The difference between "someone planned this at some point" and "this is being coded as you
   * look at it", which the plan/spike proxy could not tell apart. Only set for a ticket a live agent
   * actually recorded (`AgentMeta.ticket`), so absent still means the lane was inferred.
   */
  agentId?: string
}

/** Where the ticket format's 10-0 scale starts reading as high. */
const HIGH_PRIORITY_FLOOR = 7

/**
 * Whether a `priority:` value reads as "do this soon". The ticket format's own scale
 * (`ticketing_format.md`: `10-0 … 10: critical — act immediately, 0: only if capacity`), so 7 and
 * up qualify — NOT the P0/P1 convention, whose low-numbers-first reading is not this format.
 * Getting that backwards is what kept a backlog full of `Priority: 8` tickets off the card
 * entirely. Word spellings (`high`/`urgent`/…) are no longer read: the format says 0-10.
 */
function isHighPriority(priority: string): boolean {
  const n = Number.parseInt(priority, 10)
  return !Number.isNaN(n) && n >= HIGH_PRIORITY_FLOOR
}

/**
 * A ticket's lane (#1139), or null when it is in none of the three the card shows:
 * - in-progress: an agent is implementing it right now (#1117), or failing that the agent has
 *   planned it, so work is under way in the older, inferred sense.
 * - ai-queue: it sits in the AI Queue — an open `TODO_AGENTS.md` entry links to it — so the
 *   framework will pick it up on its own.
 * - high-priority: none of the above, but flagged high priority; what a human would likely queue next.
 *
 * Precedence follows that order: work already under way outranks a queued ticket, which outranks a
 * bare priority flag. Everything else is dropped — the card is a shortlist, not the whole backlog.
 *
 * `implementing` is the only hard evidence and exists for a drain agent only, so the plan proxy
 * still carries every ticket someone is working by hand.
 */
export function ticketBucket(
  ticket: WorkspaceTicket,
  opts: { implementing?: boolean; queued?: boolean } = {},
): HotBucket | null {
  if (opts.implementing || ticket.planned) return 'in-progress'
  if (opts.queued) return 'ai-queue'
  if (ticket.priority && isHighPriority(ticket.priority)) return 'high-priority'
  return null
}

/** `[title](target)` at the very start of a queue entry — where a queued ticket's link is written. */
const QUEUE_LEADING_LINK = /^\s*\[[^\]]+\]\(([^)\s]+)\)/

/**
 * The ticket file an open queue entry points at, or undefined when it is not a ticket link. Mirrors
 * the dashboard's `queueEntryLabel`: only a link at the START of the entry names the work, and only
 * one under `tickets/` is a ticket. Returned as the bare filename, the key {@link WorkspaceTicket.file}
 * uses.
 */
function queuedTicketFile(entry: string): string | undefined {
  const link = QUEUE_LEADING_LINK.exec(entry)
  if (!link) return undefined
  const prefix = `${TICKETS_DIR}/`
  return link[1]!.startsWith(prefix) ? link[1]!.slice(prefix.length) : undefined
}

/** How many hot tickets the Overview pools before the card trims per lane. */
const HOT_TICKETS_LIMIT = 60

/** Injectable readers so {@link buildHotTickets} is unit-testable off disk. */
export interface HotTicketsDeps {
  tickets?: (cwd: string) => Promise<WorkspaceTicket[]>
  /** The project's live agents, read for the ticket each one recorded (#1117). */
  liveAgents?: (cwd: string) => Promise<LiveAgent[]>
  /** The cross-project TODO queue, for the AI-Queue lane (#1139). Defaults to {@link collectQueue}. */
  queue?: (projects: ProjectSummary[]) => Promise<ProjectQueue[]>
}

/**
 * Every project's tickets pooled and bucketed for the Overview's "hot tickets" card (#1139): what is
 * being worked on (implementing/planned), what sits in the AI Queue (an open `TODO_AGENTS.md`
 * entry links to it), and what is merely flagged high priority. Ordered lane-first (in-progress,
 * ai-queue, high-priority), file order within a lane; a ticket in none of the three is dropped.
 * Forgiving — a project whose tickets cannot be read simply contributes nothing.
 */
export async function buildHotTickets(projects: ProjectSummary[], deps: HotTicketsDeps = {}): Promise<HotTicket[]> {
  const readT = deps.tickets ?? readTickets
  const readAgents = deps.liveAgents ?? readLiveMetas
  // The AI Queue: which tickets an open TODO_AGENTS.md entry links to, per project (#1139).
  const queues = await (deps.queue ?? (p => collectQueue(p)))(projects)
  const queuedByProject = new Map<string, Set<string>>()
  for (const q of queues) {
    const files = new Set<string>()
    for (const item of q.items) {
      if (item.done) continue
      const file = queuedTicketFile(item.text)
      if (file) files.add(file)
    }
    queuedByProject.set(q.projectId, files)
  }
  const all: HotTicket[] = []
  for (const project of projects) {
    // Which of this project's tickets are being implemented right now, by agent id (#1117). Built
    // per project because a ticket path is only unique within its own repo.
    const implementing = new Map<string, string>()
    for (const meta of await readAgents(project.path).catch(() => [])) {
      if (meta.status !== 'running' || !meta.ticket) continue
      implementing.set(meta.ticket, meta.id)
    }
    const queued = queuedByProject.get(project.id) ?? new Set<string>()
    for (const ticket of await readT(project.path).catch(() => [])) {
      const agentId = implementing.get(`${TICKETS_DIR}/${ticket.file}`)
      const bucket = ticketBucket(ticket, { implementing: agentId !== undefined, queued: queued.has(ticket.file) })
      // A ticket in none of the three shown lanes is left off the card entirely.
      if (!bucket) continue
      all.push({
        projectId: project.id,
        projectName: project.name,
        bucket,
        ticket,
        ...(agentId ? { agentId } : {}),
      })
    }
  }
  const lane: Record<HotBucket, number> = { 'in-progress': 0, 'ai-queue': 1, 'high-priority': 2 }
  all.sort((a, b) => lane[a.bucket] - lane[b.bucket])
  return all.slice(0, HOT_TICKETS_LIMIT)
}

/** Injectable readers so {@link buildOverview} is unit-testable off disk. */
export interface OverviewDeps {
  liveAgents?: (cwd: string) => Promise<LiveAgent[]>
  queue?: (projects: ProjectSummary[]) => Promise<ProjectQueue[]>
  /** Every run of a project, archived included (default {@link readAllAgents}): where the web runs are. */
  agents?: (cwd: string) => Promise<AgentMeta[]>
  /** Whether the bridge holds a question for that cloud session (default: the daemon's bridge store). */
  waiting?: (sessionId: string) => boolean
  now?: () => number
  /** This machine's hostname; `node:os` in production. */
  host?: string
}

/**
 * Build the cross-project Overview: the running agents (every live agent of each project, one per
 * worktree since #736), the total open TODO count (from {@link collectQueue}), and the most
 * recently active projects (by {@link ProjectSummary.lastActivityAt}). Forgiving — a project
 * with no live run, or none running, simply contributes nothing to `active`.
 */
export async function buildOverview(projects: ProjectSummary[], deps: OverviewDeps = {}): Promise<Overview> {
  const liveAgents = deps.liveAgents ?? readLiveMetas
  const queue = deps.queue ?? (p => collectQueue(p))
  const agents = deps.agents ?? readAllAgents
  const waiting = deps.waiting ?? (sessionId => bridgeQuestions().waiting(sessionId))
  const now = (deps.now ?? Date.now)()
  const thisHost = deps.host ?? hostname()

  const active: ActiveAgent[] = []
  // One entry per web run across projects: two checkouts of one repository share their archive,
  // so the same run is in both projects' lists; the first project to list it keeps it.
  const cloudSeen = new Set<string>()
  const entry = (project: ProjectSummary, meta: AgentMeta, cwd: string): ActiveAgent => ({
    projectId: project.id,
    projectName: project.name,
    agentId: meta.id,
    cwd,
    status: meta.status,
    ...(meta.intent ? { intent: meta.intent } : {}),
    ...(meta.updatedAt ? { updatedAt: meta.updatedAt } : {}),
    ...sessionNameField(meta.branch, meta.id),
    ...(meta.readyForMerge ? { readyForMerge: true } : {}),
    // Another machine's daemon started it (#1648): the shared data branch shows its runs here too.
    ...(meta.host !== undefined && meta.host !== thisHost ? { host: meta.host } : {}),

  })
  for (const project of projects) {
    // Every live agent of the project (#738), not just the one that used to sit at its path.
    for (const meta of await liveAgents(project.path).catch(() => [])) {
      if (meta.status !== 'running') continue
      active.push(entry(project, meta, meta.cwd))
    }
    // The web runs whose cloud side is still at work (#1668): their local half is over and their
    // checkout may be gone, so they are read from the archive and keyed to the project's own path.
    for (const meta of await agents(project.path).catch((): AgentMeta[] => [])) {
      if (meta.target !== 'web' || cloudSeen.has(meta.id)) continue
      const state = cloudRunState({ ...meta, cloudWaiting: meta.sessionId !== undefined && waiting(meta.sessionId) }, now)
      if (state !== 'in-cloud' && state !== 'waiting') continue
      cloudSeen.add(meta.id)
      active.push({ ...entry(project, meta, project.path), cloud: state })
    }
  }
  active.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

  const queues = await queue(projects)
  const queueOpen = queues.reduce((sum, q) => sum + q.open, 0)

  const recent = projects
    .filter(p => p.lastActivityAt)
    .sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''))
    .slice(0, RECENT_LIMIT)
    .map(p => ({ projectId: p.id, projectName: p.name, lastActivityAt: p.lastActivityAt! }))

  return { active, queueOpen, recent }
}
