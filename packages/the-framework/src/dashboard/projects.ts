import { basename } from 'node:path'
import { listProjects, type ProjectRecord } from '../registry.js'
import { isActivated } from '../project.js'
import { loadFrameworkConfig, type FrameworkFileConfig } from '../config.js'
import { readAllAgents, type AgentMeta } from '../store/index.js'

/**
 * The multi-project read side (#392): projects the daemon serves come from the registry (#390),
 * and every read resolves a project id to that project's path before running the per-cwd reader
 * underneath. One daemon serves them all; it runs one agent at a time per project (#393).
 */

/** One project's summary for the Projects sidebar (#314). */
export interface ProjectSummary {
  /** Registry id (stable, URL-safe). */
  id: string
  /** Absolute repo path. */
  path: string
  /** Display name (the path's basename). */
  name: string
  /** True when the repo still has its `.the-framework/` marker. */
  activated: boolean
  /** ISO timestamp of the project's newest activity: its most recent session. */
  lastActivityAt?: string
  /**
   * The repo's committed run defaults from `the-framework.yml` (#842), so the launcher can show
   * what an agent there will actually resolve to. Read fresh on every summarize, which is what keeps
   * it current after an edit; absent when the repo sets nothing (or the file is malformed, which
   * {@link loadFrameworkConfig} reports as empty rather than failing).
   */
  fileConfig?: FrameworkFileConfig
}

/** Injectable readers so {@link summarizeProject} is unit-testable off disk. */
export interface SummarizeDeps {
  isActivated?: (path: string) => Promise<boolean>
  /** The project's runs (live + archived), newest-first. Defaults to {@link readAllAgents}. */
  readAgents?: (path: string) => Promise<AgentMeta[]>
  /** The repo's `the-framework.yml` (#842). Defaults to {@link loadFrameworkConfig}. */
  readFileConfig?: (path: string) => Promise<FrameworkFileConfig>
}

/** A project's runs, live prepended to the archived history. Forgiving: a failed read is `[]`. */
/**
 * Derive a {@link ProjectSummary} from a registry record: its display name, whether
 * it is still activated, and its last activity. Forgiving: a failed read reads as an
 * inactive project with no activity, never a throw.
 *
 * Activity is the sessions themselves (B3). It used to be the newest of those and the latest
 * `LOGS.md` entry — a committed markdown re-narration of the same sessions, which could only ever
 * be older than the agent it described.
 */
export async function summarizeProject(record: ProjectRecord, deps: SummarizeDeps = {}): Promise<ProjectSummary> {
  const checkActivated = deps.isActivated ?? isActivated
  const loadAgents = deps.readAgents ?? readAllAgents
  const loadFileConfig = deps.readFileConfig ?? (path => loadFrameworkConfig(path))
  const activated = await checkActivated(record.path).catch(() => false)
  const [agents, fileConfig] = await Promise.all([
    loadAgents(record.path).catch(() => [] as AgentMeta[]),
    loadFileConfig(record.path).catch(() => ({}) as FrameworkFileConfig),
  ])
  // ISO timestamps sort chronologically.
  const agentActivity = agents.map(r => r.updatedAt || r.startedAt).filter(Boolean)
  const lastActivityAt = agentActivity.filter((a): a is string => !!a).sort().at(-1)
  const summary: ProjectSummary = {
    id: record.id,
    path: record.path,
    name: basename(record.path),
    activated,
  }
  if (lastActivityAt) summary.lastActivityAt = lastActivityAt
  // Omitted when the repo sets nothing, so a project with no yml carries no key at all.
  if (Object.keys(fileConfig).length) summary.fileConfig = fileConfig
  return summary
}

/**
 * Reads the registry to serve the multi-project endpoints. The dashboard server
 * holds one of these; the daemon uses the default (the real registry), tests pass
 * a fake so the server is exercised without touching the user's registry.
 */
export interface ProjectsProvider {
  /** Every registered project, summarized, for the projects read. */
  list(): Promise<ProjectSummary[]>
  /** The absolute path for a registry id, or `undefined` when unknown. */
  resolvePath(id: string): Promise<string | undefined>
}

/** A {@link ProjectsProvider} backed by the global registry (#390). */
export function defaultProjectsProvider(): ProjectsProvider {
  return {
    async list() {
      const records = await listProjects().catch(() => [])
      return Promise.all(records.map(record => summarizeProject(record)))
    },
    async resolvePath(id) {
      const records = await listProjects().catch(() => [])
      return records.find(record => record.id === id)?.path
    },
  }
}
