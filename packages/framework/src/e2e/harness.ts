// The world behind the backend E2E story tests (see README.md): the daemon's business logic wired
// exactly as `runDaemon` wires it, against throwaway state, with runs spawned through
// `fake-agent-bin.js` so the full production lifecycle executes offline.
import { mkdtempSync } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { setDashboardContext } from '../dashboard-rpc/context.js'
import { createProjectRuntime, type ProjectRuntime } from '../daemon-runtime.js'
import { registryPreferencesStore, projectId } from '../registry.js'
import { registryDiscordCredentialsStore } from '../discord-credentials-store.js'
import { resolveAgentEventsPath, type AgentMeta, type AgentStatus } from '../store/index.js'
import { withFileBranch } from '@gemstack/agent-data'
import { worktreePath } from '@gemstack/skill-branches'
import { QUEUE_FILE, TICKETS_BRANCH, TICKETS_DIR } from '@gemstack/skill-tickets'
import { withAgentLock } from '../agent-locks.js'
import { tailAgentEvents } from '../dashboard-rpc/events-tail.js'
import { sendAddProject } from '../dashboard-rpc/projects.js'
import { sendStart } from '../dashboard-rpc/control.js'
import { onAgents } from '../dashboard-rpc/reads.js'
import type { FrameworkEvent } from '../events.js'
import type { StartAgentKind, StartAgentOptions } from '../dashboard/types.js'
import type { AgentSpec } from '../agent-spec.js'
import type { QuotaView } from '../dashboard/quota.js'
import type { AutoPmReport, AutoPmOnly } from '../auto-pm.js'

// Re-home the process-global config home FIRST: the registry, preferences, and daemon state all
// resolve through $XDG_CONFIG_HOME at call time, and run-tests.mjs gives the whole suite ONE
// shared throwaway home — so without this, story files running as sibling processes would see
// each other's registered projects in every cross-project rollup (onProjects, onQueue, onOverview).
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), 'framework-e2e-config-'))

const exec = promisify(execFile)

/** Run `git <args>` in `cwd`, failing the story loudly on error (a broken fixture is a test bug). */
export async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, { cwd })
  return stdout
}

/** One registered project inside a {@link StoryWorld}: a real git repo the stories act on. */
export interface StoryProject {
  /** The registry id every dashboard RPC keys by. */
  id: string
  /** The repo's checkout path on disk. */
  cwd: string
}

/** A live tail of one agent's event log — the same source `onEvents` streams to the browser. */
export interface AgentTail {
  /** Every event seen so far, in arrival order. Poll with {@link waitFor}. */
  events: FrameworkEvent[]
  stop(): void
}

/**
 * Everything one story test stands up: the daemon runtime on a temp home, the dashboard context
 * the daemon would wire, and factories for registered projects. `close()` is the
 * whole teardown — it stops spawned agents the way daemon shutdown does, then removes the state.
 */
export interface StoryWorld {
  /** The daemon's home workspace (a plain temp dir, not a registered project). */
  home: string
  runtime: ProjectRuntime
  /** The usage panel's reading (mutable): what `onQuota` serves. */
  quota: { view: QuotaView }
  /** The auto-PM panel's stubs (mutable): what `onAutoPm` reports and what a sweep records. */
  autoPm: { report?: AutoPmReport; sweeps: Array<{ only?: AutoPmOnly; projectId?: string }> }
  /**
   * Bind one dashboard RPC to this world's context. The real mount wires the context once, at
   * start-up; a story stands several worlds up in one process, so re-providing before every call
   * is what keeps each story's calls addressing its own world rather than the last one's.
   */
  rpc<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R
  /** The session spec of every child this world spawned, one entry per spawn, oldest first. */
  spawnedSpecs(): Promise<AgentSpec[]>
  /**
   * Create a real git repo (initial commit included) and register it through the same
   * `sendAddProject` RPC the dashboard's Add-project dialog calls.
   */
  addProject(files?: Record<string, string>): Promise<StoryProject>
  /** Start an agent through the same `sendStart` RPC the launcher calls; returns the agent id. */
  startAgent(project: StoryProject, prompt: string, options?: StartAgentOptions, kind?: StartAgentKind): Promise<string>
  /** Poll `onAgents` until the agent reports one of `until`, failing after `timeoutMs`. */
  waitAgent(project: StoryProject, agentId: string, until: AgentStatus | AgentStatus[], timeoutMs?: number): Promise<AgentMeta>
  /**
   * Wait until the daemon's teardown has retired the agent's worktree. An agent's meta flips to
   * `done` before teardown archives the checkout, and acting on the session in that window
   * (push, resume) races teardown's own git commits — the same window a user hits by clicking
   * Push the instant a session finishes. The stories that act on a finished session wait here
   * first, which is also the honest reading of "finished".
   */
  waitRetired(project: StoryProject, agentId: string, timeoutMs?: number): Promise<void>
  /** Follow an agent's event log live (replays what is already on disk first). */
  tailAgent(project: StoryProject, agentId: string): Promise<AgentTail>
  close(): Promise<void>
}

/** Poll `read` until it yields a non-undefined value; the failure names `what` went unmet. */
export async function waitFor<T>(
  read: () => T | undefined | Promise<T | undefined>,
  what: string,
  timeoutMs = 30_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await read()
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    await new Promise(r => setTimeout(r, 100))
  }
}

/**
 * Set `FRAMEWORK_FAKE_AWAIT` for the Starts inside `fn`, so their fake agent's first turn parks
 * on that gate. Env-scoped rather than per-call because the spawned child reads it at boot; the
 * finally puts it back before the next story's Starts inherit it.
 */
export async function withFakeAwait<T>(mode: 'choices' | 'multiselect' | 'confirmation', fn: () => Promise<T>): Promise<T> {
  process.env.FRAMEWORK_FAKE_AWAIT = mode
  try {
    return await fn()
  } finally {
    delete process.env.FRAMEWORK_FAKE_AWAIT
  }
}

/** A minimal passing preflight: E2E runs never probe the real agent CLI (there is none here). */
const agentReady = async () => ({ ok: true, checks: [] })

/**
 * Stand up one story world. The dashboard context mirrors `runDaemon`'s `startDashboard` wiring
 * piece for piece — same closures, same registry-backed stores — except where the daemon holds a
 * live poller/loop (quota, auto PM), which a story controls through mutable stubs instead.
 */
export async function makeWorld(): Promise<StoryWorld> {
  const home = mkdtempSync(join(tmpdir(), 'framework-e2e-home-'))
  const argvFile = join(home, 'spawned-argv.jsonl')
  process.env.FRAMEWORK_E2E_ARGV_FILE = argvFile

  const runtime = createProjectRuntime({
    cwd: home,
    env: process.env,
    binPath: fileURLToPath(new URL('./fake-agent-bin.js', import.meta.url)),
    driverPreflight: agentReady,
  })

  const quota = { view: { windows: [] } as QuotaView }
  const autoPm: StoryWorld['autoPm'] = { sweeps: [] }
  const context = {
    startAgent: runtime.onStart,
    addProject: runtime.onAddProject,
    eventsSource: runtime.remoteEventsSource,
    remote: runtime.remoteAgents,
    preferences: registryPreferencesStore(),
    discord: registryDiscordCredentialsStore(),
    // The story sets one view; both questions are answered off it, since a story that cares about
    // the model's own week states that window in the view it sets (#1619).
    quota: { read: async () => quota.view, boundaryFor: async () => quota.view.boundary, stop: () => {} },
    autoPm: () => autoPm.report,
    autoPmSweep: async (opts?: { only?: AutoPmOnly; projectId?: string }) => {
      autoPm.sweeps.push(opts ?? {})
    },
    projectErrors: () => [],
    bridgeBrowser: { status: async () => ({ state: 'off' as const }), start: async () => {}, stop: async () => {}, act: async () => {} },
  }

  const repos: string[] = []
  const tails: AgentTail[] = []
  const started: Array<{ cwd: string; agentId: string }> = []

  const rpc: StoryWorld['rpc'] = fn => {
    return (...args) => {
      // Re-wired per call so a story's own overrides win over whatever ran before it.
      setDashboardContext(context)
      return fn(...args)
    }
  }

  const world: StoryWorld = {
    home,
    runtime,
    quota,
    autoPm,
    rpc,

    async spawnedSpecs() {
      const raw = await readFile(argvFile, 'utf8').catch(() => '')
      return raw
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as AgentSpec)
    },

    async addProject(files = {}) {
      const cwd = mkdtempSync(join(tmpdir(), 'framework-e2e-repo-'))
      repos.push(cwd)
      await git(cwd, 'init', '-q', '-b', 'main')
      await git(cwd, 'config', 'user.email', 'e2e@test')
      await git(cwd, 'config', 'user.name', 'e2e')
      const seeded = Object.keys(files).length ? files : { 'README.md': '# story fixture\n' }
      // The tickets and the queue live on the `tickets` branch (#1748), never in the working
      // tree: a story that seeds them names the same paths, and they land where the product reads.
      const onBranch = Object.entries(seeded).filter(([file]) => file.startsWith(`${TICKETS_DIR}/`) || file === QUEUE_FILE)
      for (const [file, text] of Object.entries(seeded)) {
        if (onBranch.some(([f]) => f === file)) continue
        await mkdir(dirname(join(cwd, file)), { recursive: true })
        await writeFile(join(cwd, file), text)
      }
      await git(cwd, 'add', '-A')
      await git(cwd, 'commit', '-q', '-m', 'seed')
      if (onBranch.length) {
        const result = await withFileBranch(cwd, TICKETS_BRANCH, 'seed', async dir => {
          for (const [file, text] of onBranch) {
            await mkdir(dirname(join(dir, file)), { recursive: true })
            await writeFile(join(dir, file), text)
          }
        })
        if (!result.ok) throw new Error(`could not seed the tickets branch: ${result.error}`)
      }
      // A bare repo standing in for `origin`, because a real project has one and the retention
      // rule is about it (E5): a session's checkout is reclaimed once its work reaches the remote,
      // so a fixture with nowhere to push would keep every checkout forever.
      const origin = join(cwd, 'origin.git')
      await git(cwd, 'init', '-q', '--bare', origin)
      await git(cwd, 'remote', 'add', 'origin', origin)
      const added = await rpc(sendAddProject)(cwd)
      if (!added.ok) throw new Error(`could not register the fixture repo: ${added.error}`)
      return { id: projectId(resolve(cwd)), cwd }
    },

    async startAgent(project, prompt, options = {}, kind: StartAgentKind = 'prompt') {
      const result = await rpc(sendStart)(project.id, prompt, kind, options)
      if (!result.ok) throw new Error(`sendStart refused: ${result.error}`)
      if (!result.agentId) throw new Error('sendStart returned no run id for a worktree project')
      started.push({ cwd: project.cwd, agentId: result.agentId })
      return result.agentId
    },

    async waitAgent(project, agentId, until, timeoutMs = 30_000) {
      const wanted = Array.isArray(until) ? until : [until]
      let last: AgentMeta | undefined
      return waitFor(
        async () => {
          const agents = await rpc(onAgents)(project.id)
          last = agents.find(agent => agent.id === agentId)
          return last && wanted.includes(last.status) ? last : undefined
        },
        `run ${agentId} to be ${wanted.join('/')} (last seen: ${JSON.stringify(last?.status)})`,
        timeoutMs,
      )
    },

    async waitRetired(project, agentId, timeoutMs = 30_000) {
      const worktree = worktreePath(project.cwd, agentId)
      await waitFor(
        async () => ((await stat(worktree).catch(() => undefined)) ? undefined : true),
        `run ${agentId}'s worktree to be retired`,
        timeoutMs,
      )
    },

    async tailAgent(project, agentId) {
      const events: FrameworkEvent[] = []
      // The relocating tail — the same seam the dashboard's onEvents rides: when teardown moves
      // the journal into the archive, the tail re-resolves the agent's journal and carries its
      // offset, so the feed keeps the final events even when their fs.watch signal was lost.
      const stop = tailAgentEvents<FrameworkEvent>(
        () => resolveAgentEventsPath(project.cwd, agentId),
        event => events.push(event),
      )
      const tail = { events, stop }
      tails.push(tail)
      return tail
    },

    async close() {
      for (const tail of tails) tail.stop()
      // Same order as daemon shutdown: stop the agents this world spawned, then the previews.
      await runtime.stopAgents(2000).catch(() => 0)
      // Teardowns fire off child-exit events and outlive the assertions — deleting the repos
      // under a mid-flight archive-commit-retire kills its git ("cannot lock ref 'HEAD'") and
      // litters the output with stranded-worktree warnings. Acquiring each agent's lock is the
      // daemon's own way of waiting a teardown out.
      await Promise.all(
        started.map(({ cwd, agentId }) =>
          withAgentLock(worktreePath(cwd, agentId), async () => {}),
        ),
      )
      await runtime.dispose().catch(() => {})
      delete process.env.FRAMEWORK_E2E_ARGV_FILE
      await rm(home, { recursive: true, force: true }).catch(() => {})
      for (const repo of repos) await rm(repo, { recursive: true, force: true }).catch(() => {})
    },
  }
  return world
}
