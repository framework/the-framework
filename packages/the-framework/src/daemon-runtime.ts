import { spawn, type ChildProcess } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { appendFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import {
  agentIdFromStartedAt,
  startedAtFromAgentId,
  addWorktree,
  agentBranchName,
  linkDependencies,
  excludeDependencyLinks,
  archiveWorktreeAgent,
  restoreArchivedAgent,
  attachWorktree,
  worktreePath,
  listAgents,
  findAgent,
  archivedAgentPaths,
  currentBranch,
  readLiveMetas,
  readLiveMeta,
  resolveAgentEventsPath,
  FRAMEWORK_DIR,
  EVENTS_FILE,
  META_FILE,
  AGENT_META_VERSION,
  isPidAlive,
  type AgentMeta,
} from './store/index.js'
import type { FrameworkEvent } from './events.js'
import { writeAgentSpec } from './agent-spec.js'
import type { StartAgentKind, StartAgentOptions, StartAgentResult, AddProjectResult } from './dashboard/index.js'
import type { EventsSource, RemoteAgents } from './dashboard/rpc-serve.js'
import { RelayedAgents, startRemoteAgent } from './dashboard/remote-run.js'
import { agentBranchFor } from './dashboard/agent-handoff.js'
import { dispatchRelayRpc } from './dashboard-rpc/relay-dispatch.js'
import { tailEvents, tailAgentEvents } from './dashboard-rpc/events-tail.js'
import { ensureArchiveIgnored, resolveUserDir } from './agent-archive.js'
import { removeProjectWorktree } from './worktrees.js'
import { scopedKey, parseScopedKey, keyBelongsTo } from './runtime-keys.js'
import { addProject, listProjects, projectId } from './registry.js'
import { isTicketPath } from './tickets.js'
import { resolveProjectAgentOptions } from './daemon-services.js'
import { installProject, enumerateGitRepos } from './install.js'
import { isGitRepo } from './project.js'
import { isCliTimeout } from './cli-exec.js'
import { withAgentLock } from './agent-locks.js'
import { errorMessage } from './error-message.js'
import { preflight, preflightProblems, type PreflightResult } from './preflight.js'
import { isDriverName, type DriverName } from './driver-names.js'

/**
 * How long a passing agent preflight (#1326) is trusted before it is probed again. Short enough
 * that logging out mid-session is noticed within a session's worth of starts, long enough that a
 * burst of starts pays for the probes once.
 */
const DRIVER_READY_TTL_MS = 30_000

/**
 * The daemon's per-project business logic (#393/#736): spawning runs into worktrees, installing
 * projects, and app previews, plus the spawn/terminate plumbing those need. Split from daemon.ts
 * so that file reads as the daemon's lifecycle (state file, ports, boot, shutdown) and this reads
 * as what the daemon does for a project -- the split createProjectRuntime's own doc always
 * claimed, finished.
 */

/**
 * Locate the CLI entry to re-invoke for a detached child, refusing to re-exec a test
 * file. Under `node --test` (or a direct `node foo.test.js`) `process.argv[1]` is the test
 * file, which re-runs the whole suite instead of the daemon/run body — and that suite calls
 * back here, so each spawn spawns another: a fork bomb. A real agent passes the compiled bin
 * (or an explicit `binPath`), so the guard only ever trips in tests.
 */
export function resolveSpawnBin(explicitBinPath: string | undefined): string {
  const binPath = explicitBinPath ?? process.argv[1]
  if (!binPath) throw new Error('cannot locate the framework CLI entry')
  if (!explicitBinPath && (process.env.NODE_TEST_CONTEXT || /\.test\.[cm]?[jt]s$/.test(binPath))) {
    throw new Error('refusing to spawn a framework process from a test entry; pass an explicit binPath')
  }
  return binPath
}

/**
 * Clean up after a `git worktree add` that was SIGTERMed mid-write (#997). Observed behavior: git
 * removes its own administrative entry on the way out but leaves the partial checkout it had
 * already written, so `git worktree prune` finds nothing to do and the directory stays.
 *
 * Only a timeout kill is cleaned up. Any other rejection may be git refusing a path that was
 * already on disk before this agent asked for it, and that is not ours to delete.
 */
export async function cleanupTimedOutWorktree(repo: string, agentId: string, err: unknown): Promise<void> {
  if (!isCliTimeout(err)) return
  await rm(worktreePath(repo, agentId), { recursive: true, force: true }).catch(() => {})
}

/** Best-effort append of a `log` event to an agent's live stream, so a daemon-side note surfaces on a
 * run whose own process wrote every other line. Never throws. */
async function appendAgentLog(cwd: string, message: string): Promise<void> {
  const event: FrameworkEvent = { kind: 'log', message }
  await appendFile(join(cwd, FRAMEWORK_DIR, EVENTS_FILE), JSON.stringify(event) + '\n').catch(() => {})
}

/** Spawn a detached, unref'd framework child (`node <binPath> --agent <specPath>`) that outlives us. */
export function spawnDetached(binPath: string, specPath: string, stderrFile?: string): ChildProcess {
  // stderr goes to a file, never a pipe: a detached child must not block on a dead parent's pipe
  // buffer, and the file is what makes a silent boot death diagnosable (#1261). Best-effort — a
  // run must still start when the log cannot be opened.
  let fd: number | undefined
  if (stderrFile) {
    try {
      mkdirSync(dirname(stderrFile), { recursive: true })
      fd = openSync(stderrFile, 'w')
    } catch {}
  }
  const child = spawn(process.execPath, [binPath, '--agent', specPath], {
    detached: true,
    stdio: ['ignore', 'ignore', fd ?? 'ignore'],
  })
  if (fd !== undefined) closeSync(fd)
  child.unref()
  return child
}

/** Where a spawned agent's stderr lands (#1261), so a child that dies at boot leaves a trace. */
export function agentStderrPath(cwd: string): string {
  return join(cwd, FRAMEWORK_DIR, 'stderr.log')
}

/** One line saying how a child ended, for the failed-start marker (#1261). */
function exitDetail(code: number | null, signal: NodeJS.Signals | null): string {
  return code !== null
    ? `its process exited with code ${code} before reporting anything`
    : `its process was killed by ${signal ?? 'a signal'} before reporting anything`
}

/**
 * Leave a `failed` marker behind a child that died before writing its own lifecycle (#1261).
 *
 * A healthy agent's first act is opening its store (`agent.json` + `events.jsonl`); a child that
 * exited without one never booted — a module resolution error being the observed case — and with
 * stdio detached the crash went nowhere, so the session page polled "Waiting for the session to
 * start" forever. The daemon's exit handler is the one place that knows, so it writes the minimal
 * meta the page needs and surfaces the child's stderr tail in the agent log. A child that wrote its
 * own meta is left alone: its lifecycle is its own to report.
 */
export async function markFailedStart(cwd: string, agentId: string, intent: string, detail: string): Promise<boolean> {
  const metaPath = join(cwd, FRAMEWORK_DIR, META_FILE)
  if (await stat(metaPath).then(() => true, () => false)) return false
  const now = new Date().toISOString()
  const meta: AgentMeta = {
    version: AGENT_META_VERSION,
    status: 'failed',
    id: agentId,
    startedAt: startedAtFromAgentId(agentId) ?? now,
    updatedAt: now,
    ...(intent.trim() ? { intent } : {}),
  }
  const stderrTail = (await readFile(agentStderrPath(cwd), 'utf8').catch(() => '')).trim().slice(-2000)
  await mkdir(join(cwd, FRAMEWORK_DIR), { recursive: true }).catch(() => {})
  await writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n').catch(() => {})
  await appendAgentLog(cwd, `The session failed to start: ${detail}.` + (stderrTail ? `\n\n${stderrTail}` : ''))
  console.log(`[framework] run ${agentId} failed to start: ${detail}`)
  return true
}

/**
 * Driver deaths worth one more try (#1281): the connection dropped or the API buckled mid-run —
 * failures about the transport, not the work. Conservative on purpose: an agent that failed for any
 * reason this does not name stays failed, because retrying a real failure just re-runs it.
 */
const TRANSIENT_FAILURE =
  /connection closed|connection reset|connection error|econnreset|etimedout|socket hang up|overloaded|rate.?limit|api error: 5\d\d|internal server error/i

/** Whether an agent's failure detail names a transient transport error (#1281). */
export function isTransientAgentFailure(detail: string | undefined): boolean {
  return detail !== undefined && TRANSIENT_FAILURE.test(detail)
}

/**
 * The detail the agent's own `end` event failed with, off its archived event log (#1281), or
 * undefined when the agent did not fail by its own report. Only a child-written `end` counts: a
 * boot death (#1261) never writes one, and retrying an agent that cannot boot would just re-crash.
 */
export function lastAgentFailureDetail(eventsJsonl: string): string | undefined {
  let detail: string | undefined
  for (const line of eventsJsonl.split('\n')) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line) as { kind?: string; ok?: boolean; detail?: string }
      if (event.kind === 'end') detail = event.ok === false ? event.detail : undefined
    } catch {
      // A malformed line is not this reader's problem; the events around it still count.
    }
  }
  return detail
}

/** How many times a transiently-dead agent is continued before its failure stands (#1281). */
export const MAX_TRANSIENT_RETRIES = 2

/** The pause before a retry (#1281): long enough for a dropped connection to be worth re-trying. */
const TRANSIENT_RETRY_DELAY_MS = 15_000

/** How long a continuation waits for its finished previous leg to exit and retire (#1529). */
const FINISHED_LEG_EXIT_GRACE_MS = 15_000

/** What the continued session is told (#1281), in the resume (#923) prompt's shape. */
const RETRY_PROMPT =
  'This session died to a transient connection error, not because anyone asked it to stop. Look at what you had already done, then carry on from there and finish the work.'


export function delay(ms: number): Promise<void> {
  return new Promise(resolvePromise => setTimeout(resolvePromise, ms))
}

/**
 * Stop a process and wait for it to actually go: SIGTERM, then SIGKILL if the grace period lapses.
 * Returns whether it was alive to begin with.
 *
 * Both callers need the escalation for the same reason and had their own copy of it: a process
 * that ignores SIGTERM (or wedges in shutdown) must not be left holding a port or a worktree.
 */
export async function terminate(pid: number, graceMs: number): Promise<boolean> {
  if (!isPidAlive(pid)) return false
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // exited between the check and the signal
  }
  if (!(await waitForExit(pid, graceMs))) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // raced us to exit
    }
    await waitForExit(pid, 1000)
  }
  return true
}

/** Poll until the process is gone, or the timeout lapses. */
async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const step = 50
  for (let waited = 0; waited <= timeoutMs; waited += step) {
    if (!isPidAlive(pid)) return true
    await delay(step)
  }
  return !isPidAlive(pid)
}

/**
 * Wait until the daemon is finished with the agent slots it just stopped — the child gone *and* its
 * teardown done — or the timeout lapses.
 *
 * Killing a pid is not letting go of the repo. The child's `exit` event lands a turn after the
 * process disappears, and the teardown that event starts (archive the agent, commit its work, keep
 * or remove its checkout) runs well past that. Without this wait, shutdown's archive commit fires
 * while an agent is still being archived, and it misses that agent's ending (#912/#1179).
 *
 * A slot is settled when it is in neither map: `settle` drops it from `activeAgents` and parks its
 * teardown in `retiring`, and the teardown clears itself on the way out. An agent with no worktree
 * never enters `retiring` at all, and needs no special case — it is simply already gone from both.
 *
 * Bounded, because a wedged teardown must cost the shutdown its grace period, not the exit.
 */
export async function waitOutSlots(
  keys: readonly string[],
  slots: { activeAgents: Map<string, number>; retiring: Map<string, Promise<void>> },
  timeoutMs: number,
): Promise<void> {
  const step = 25
  const deadline = Date.now() + timeoutMs
  const held = (): string[] => keys.filter(key => slots.activeAgents.has(key) || slots.retiring.has(key))
  while (Date.now() < deadline) {
    const outstanding = held()
    if (outstanding.length === 0) return
    // Await the teardowns that have started; poll for the slots whose `exit` has yet to land.
    const parked = outstanding.flatMap(key => slots.retiring.get(key) ?? [])
    if (parked.length > 0) await Promise.all(parked.map(retired => retired.catch(() => {})))
    else await delay(step)
  }
}

/**
 * What the previous leg of an agent says about itself, for {@link waitOutFinishedLeg}. `unknown` is
 * the honest third answer — the leg has no readable state *this instant* — and is deliberately
 * not folded into either of the other two.
 */
export type FinishedLegState = 'ended' | 'running' | 'unknown'

/**
 * Wait out the previous leg of the agent a continuation is aimed at (#1529). A Resume clicked the
 * instant an agent's row flips `done` can land while the child that wrote that ending is still
 * mid-exit: the agent's slot then still holds a live pid, and the busy guard read "already active"
 * off a session that is over by its own account — a spurious refusal the E2E settings story
 * caught on a slow runner. A finished child's exit is imminent and its retirement is queued
 * right behind it (see `retiring` in {@link createProjectRuntime}), so wait for both, bounded by
 * `graceMs`, and let the reuse read a settled archive. A leg still calling itself `running` is a
 * genuine collision: not waited on, so the guard's refusal stands.
 *
 * `readLegState` is asked until it commits, rather than sampled once (#1540). A leg's state is
 * read off a `agent.json` its own process rewrites in place, so a single read can come back
 * `unknown` for reasons that have nothing to do with the leg — a torn read, or the beat between
 * the archive being written and the worktree going. Taking one such sample for "still running"
 * skipped the wait entirely and handed the continuation to the busy guard mid-exit: #1529's
 * refusal back as a rarer race, and the flake that sent this here. Only a leg that positively
 * reports `running` short-circuits; `unknown` re-asks on the next tick, and the loop still ends
 * the moment the slot clears, so the common path costs exactly one read as before.
 */
export async function waitOutFinishedLeg(
  key: string,
  slots: { starting: Set<string>; activeAgents: Map<string, number>; retiring: Map<string, Promise<void>> },
  readLegState: () => Promise<FinishedLegState>,
  graceMs: number,
): Promise<void> {
  const occupied = (): boolean => slots.starting.has(key) || slots.activeAgents.has(key)
  if (!occupied() && !slots.retiring.has(key)) return
  const deadline = Date.now() + graceMs
  let ended = false
  while (occupied() && Date.now() < deadline) {
    // Settled at `ended`: the leg cannot un-finish, so the read is not repeated once it answers.
    if (!ended) {
      const state = await readLegState()
      if (state === 'running') return
      ended = state === 'ended'
    }
    await delay(25)
  }
  await slots.retiring.get(key)?.catch(() => {})
}

/** Inputs to {@link createProjectRuntime}. */
export interface ProjectRuntimeOptions {
  /** The daemon's home workspace; a run/preview with no project id targets it. */
  cwd: string
  /** Env for the registry lookups (#393). */
  env: NodeJS.ProcessEnv
  /** The CLI entry to spawn runs with (#345); undefined uses `process.argv[1]`. */
  binPath?: string | undefined
  /** The pause before a transient-death retry (#1281); undefined uses {@link TRANSIENT_RETRY_DELAY_MS}. A test seam. */
  retryDelayMs?: number | undefined
  /** How a start checks the agent can run (#1326); undefined runs the real {@link preflight}. A test seam. */
  driverPreflight?: ((driver: DriverName) => Promise<PreflightResult>) | undefined
}

/** The per-project agent + preview surface the dashboard drives, plus its teardown. */
export interface ProjectRuntime {
  onStart: (prompt: string, kind: StartAgentKind, options?: StartAgentOptions, targetProjectId?: string) => Promise<StartAgentResult>
  onAddProject: (path: string, directory: boolean) => Promise<AddProjectResult>
  /** The live event stream for an agent this daemon is relaying from a device (#1067), else undefined
   *  so `onEvents` falls back to tailing the on-disk log. Wired as the dashboard's events source. */
  remoteEventsSource: EventsSource
  /** Tail a relay-started agent's on-disk events (#1067): the daemon's `/_relay/events` endpoint uses
   *  it to stream one agent back to whichever daemon relayed it here. */
  tailRelayEvents: (agentId: string, onEvent: (event: FrameworkEvent) => void) => () => void
  /** The relayed-agent lookup the dashboard's read RPCs consult (#1067 slice 2): which device a remote
   *  run runs on, so a run-scoped RPC forwards there instead of resolving a local checkout. */
  remoteAgents: RemoteAgents
  /** The device side of the relay (#1067 slice 2): run one whitelisted read/steer/handoff RPC against
   *  this daemon's own home checkout, for a daemon that relayed an agent here. */
  onRelayRpc: (fn: string, args: unknown[]) => Promise<unknown>
  /** Live agents on a project (#685), so a background job can tell an idle project from a busy one. */
  activeAgentCount: (targetProjectId: string) => number
  /**
   * The agent ids this daemon is still responsible for: spawning, running, or mid-retirement.
   *
   * The background worktree sweep asks, because an agent's meta flips to `done` a beat *before* its
   * teardown archives and reclaims the checkout — so a sweep landing in that window would race
   * the teardown for the same directory. "Not live" on disk is not the same as "the daemon is
   * finished with it", and this is the difference.
   */
  busyAgentIds: () => ReadonlySet<string>
  /**
   * Stop the agents this daemon spawned. Returns how many were stopped. Called on shutdown, before
   * the previews go.
   */
  stopAgents: (graceMs?: number) => Promise<number>
  /** Stop every live preview so their dev servers do not outlive the daemon (#475). */
  dispose: () => Promise<void>
}

/**
 * The daemon's per-project runtime (#393): the agent and preview state keyed by project id,
 * plus the RPCs the dashboard invokes over `POST /_rpc/<name>`. A project runs any number of
 * concurrent agents (each in its own worktree, #736) and one preview. The home `cwd` is the default target — a request
 * with no project id (or the home id) resolves to it without a registry lookup. Split out of
 * {@link runDaemon} so the daemon body reads as lifecycle and this reads as business logic.
 */
export function createProjectRuntime({ cwd, env, binPath, retryDelayMs, driverPreflight }: ProjectRuntimeOptions): ProjectRuntime {
  const homeId = projectId(resolve(cwd))
  // Live run pids, keyed per agent rather than per project (#736) — see onStart for the key.
  const activeAgents = new Map<string, number>()
  const starting = new Set<string>() // reserved keys mid-spawn, to close the async gap
  // A finished leg's exit → retirement chain, parked per agent slot so a continuation that raced
  // the exit (#1529) can await the retirement instead of reusing a checkout mid-removal.
  const retiring = new Map<string, Promise<void>>()
  const parkRetirement = (key: string, retired: Promise<void>): void => {
    retiring.set(key, retired)
    void retired.finally(() => {
      if (retiring.get(key) === retired) retiring.delete(key)
    })
  }
  // Runs this daemon is relaying to/from a connected device (#1067): the local half of a remote agent.
  const relayedAgents = new RelayedAgents()
  // The relayed-agent lookup the dashboard's read RPCs consult (#1067 slice 2): is this agentId remote, and
  // which device owns it. Outlives the event stream so a finished remote agent's push/PR still reaches it.
  const remoteAgents: RemoteAgents = {
    target: agentId => relayedAgents.target(agentId),
    list: projectId => relayedAgents.list(projectId),
  }
  // The device side of the relay (#1067 slice 2): run one whitelisted read/steer/handoff RPC against this
  // daemon's own home checkout, for a daemon that relayed an agent here. Home id forces the addressed project.
  const onRelayRpc = (fn: string, args: unknown[]): Promise<unknown> => dispatchRelayRpc(homeId, fn, args)

  // A project id resolves to its repo path via the registry; the home id (or none)
  // resolves to the daemon's own `cwd` without a lookup.
  const resolveProject = async (id: string | undefined): Promise<string | undefined> => {
    if (!id || id === homeId) return cwd
    const records = await listProjects(undefined, env).catch(() => [])
    return records.find(record => record.id === id)?.path
  }

  /**
   * Put a continued agent (#762) back in its own checkout: the same worktree if it was retained, else
   * its own branch checked out fresh. Its archived history is restored into the checkout so the agent
   * reopens its log rather than starting empty, which is what keeps it one row.
   *
   * The branch is the session's if the agent named one, else the run-id branch it started on.
   * Returns undefined when none of that is possible, so the caller can fall back to a new agent.
   */
  const continueWorkspace = (projectCwd: string, agentId: string): Promise<{ cwd: string; agentId: string } | undefined> =>
    // Under the same agent lock as teardown: a Resume clicked off a freshly-`done` run lands here
    // while teardown is still archiving the very history this restores — reusing the checkout
    // mid-retirement spawned the continuation into a tree about to be removed. Waiting the
    // teardown out costs the click a beat and makes the reuse read a settled archive.
    withAgentLock(worktreePath(projectCwd, agentId), async () => {
      try {
        const path = worktreePath(projectCwd, agentId)
        const existing = await stat(path).then(s => s.isDirectory()).catch(() => false)
        if (!existing) {
          const archived = (await listAgents(projectCwd).catch(() => [])).find(agent => agent.id === agentId)
          // The recorded branch first (#1277): an agent that branched itself (#326 allows it) has
          // its work there, and re-attaching by the session-name guess would continue the agent on a
          // branch without its previous commits.
          const branch = agentBranchFor(archived ?? { id: agentId })
          await attachWorktree(projectCwd, { agentId, branch })
          await linkDependencies(projectCwd, path).catch(() => [])
        }
        await restoreArchivedAgent(projectCwd, path, agentId).catch(() => false)
        return { cwd: path, agentId }
      } catch (err) {
        console.log(`[framework] could not continue agent ${agentId} (${errorMessage(err)}); starting a new one`)
        return undefined
      }
    })

  /**
   * Whether the driver this agent picked can actually start (#1326), as one line to show when it
   * cannot. `undefined` means go.
   *
   * Only the two targets that spend the local CLI are gated. An `actions` run executes on a
   * GitHub Actions runner and drives it over the API, so a laptop with no `claude` on it starts
   * that agent perfectly well; a `web` run is started *by* the local CLI under a pty, so it needs
   * the binary and the login exactly as a local agent does. A `remote` run never reaches here,
   * having been handed to its device further up.
   *
   * Only a *pass* is cached, and only briefly. Two probes cost around half a second, which is
   * nothing against an agent but more than the window the one-at-a-time guard closes in, so paying
   * it on every Start would make back-to-back starts race. Caching the failure instead would be
   * the worse trade: logging in has to be picked up by the very next Start, not by a timeout or
   * a daemon restart, so a broken setup is re-probed every time and costs only the user who
   * already cannot run anything.
   */
  const readyUntil = new Map<DriverName, number>()
  const checkAgentReady = async (options: StartAgentOptions): Promise<string | undefined> => {
    if (options.target === 'actions') return undefined
    const driver = isDriverName(options.driver) ? options.driver : 'claude'
    if ((readyUntil.get(driver) ?? 0) > Date.now()) return undefined
    const result = await (driverPreflight ? driverPreflight(driver) : preflight({ driver }))
    if (!result.ok) return preflightProblems(result).join('; ')
    readyUntil.set(driver, Date.now() + DRIVER_READY_TTL_MS)
    return undefined
  }

  /**
   * The checkout an agent gets (#736). Each agent is given its own git worktree under the project's
   * `.the-framework/worktrees/<agentId>`, on a `the-framework/agent-<agentId>` branch, so N runs on one
   * repo never fight over the working tree — and the user's own checkout, uncommitted work
   * included, is left untouched.
   *
   * A project that *structurally* cannot provide one — it is not a git repo — falls back to the
   * main checkout, which is exactly the pre-#736 behavior, and keeps its pre-#736 limit of one agent
   * at a time, since those agents *would* collide. Signalled by the absent `agentId`.
   *
   * A project that *is* a repo and whose `worktree add` failed does not fall back (#997): that
   * downgrade silently pointed the agent at the user's own working tree, uncommitted work
   * included, which is the one thing #736 exists to prevent. A `worktree add` on a large repo can
   * outrun its budget and be SIGTERMed, so this is reachable in normal use, not just on a broken
   * repo. The agent fails instead, because a failed agent is recoverable by starting it again and a
   * checkout with agent edits mixed into it is not.
   */
  const allocateWorkspace = async (
    projectCwd: string,
    agentId: string,
  ): Promise<{ ok: true; workspace: { cwd: string; agentId?: string } } | { ok: false; error: string }> => {
    try {
      const worktree = await addWorktree(projectCwd, { agentId, branch: agentBranchName(agentId) })
      // `node_modules` is gitignored, so a fresh worktree has none: link the parent's in, and
      // make git ignore the links (a `node_modules/` rule does not match a symlink, #738).
      await linkDependencies(projectCwd, worktree.path).catch(() => [])
      await excludeDependencyLinks(projectCwd).catch(() => {})
      return { ok: true, workspace: { cwd: worktree.path, agentId } }
    } catch (err) {
      if (await isGitRepo(projectCwd)) {
        await cleanupTimedOutWorktree(projectCwd, agentId, err)
        return { ok: false, error: `could not create a worktree for this run: ${errorMessage(err)}` }
      }
      console.log(`[framework] ${basename(projectCwd)} is not a git repository, so it gets no worktree; running in the main checkout`)
      return { ok: true, workspace: { cwd: projectCwd } }
    }
  }

  /**
   * Retire a finished agent's worktree (#737). Its history lives inside the worktree, so it is
   * copied into the repo first — otherwise removing the checkout would delete the agent from the
   * dashboard's history.
   *
   * Then the retention rule: an agent that finished cleanly has nothing left to look at once its
   * work is committed, so its worktree goes. An agent that failed or was stopped keeps its checkout,
   * because that is exactly when you want to see the half-finished working tree and the diff it
   * died holding. Those are removed explicitly (the dashboard's Remove), never silently on a timer.
   *
   * Best-effort from end to end: this runs off a process-exit event with nothing to return to,
   * so a failure here must not take the daemon down.
   */
  /** The project half of a preview key from a checkout: the registry id every preview RPC keys by. */
  const projectKeyFor = (projectCwd: string): string => projectId(resolve(projectCwd))
  // Under the agent lock: a Push/Remove/Resume fired off a freshly-`done` meta lands in the daemon
  // while this is mid-archive, and both sides commit in the same checkout. The loser used to
  // report "could not commit the work this session left uncommitted" — or worse, this side lost
  // and kept a worktree it should have removed. Serialized, whoever runs first commits the whole
  // pending state (`add -A`) and the other side finds a clean tree and carries on.
  const tearDownWorktree = (projectCwd: string, worktree: string, agentId?: string): Promise<void> =>
    withAgentLock(worktree, async () => {
      try {
        // Where the work ended up, recorded before the checkout can go (#799). The branch outlives
        // the worktree and is the only handle the dashboard has left on a finished session.
        const branch = await currentBranch(worktree)
        // Filed under the identity this repo commits as, and the ignore rules taught to keep it, so
        // the session survives the repo being cleaned (#1179).
        const user = await resolveUserDir(projectCwd)
        await ensureArchiveIgnored(projectCwd, user).catch(() => false)
        await archiveWorktreeAgent(worktree, projectCwd, undefined, branch, user)
        // One rule (E5): the checkout goes once its work is on the remote, whatever state the agent
        // ended in. `removeProjectWorktree` owns the whole sequence — commit what is pending, push
        // the branch, remove only if the remote has it — so teardown, the sweep and the dashboard's
        // Remove button are one behaviour. A push that cannot land keeps the checkout, and the
        // sweep retries it later. It used to keep a failed or stopped run's checkout "for
        // inspection", which meant those accumulated one per session until someone noticed.
        // The directory's own name is the agent id, so this never depends on the caller having one.
        const outcome = await removeProjectWorktree(projectCwd, agentId ?? basename(worktree))
        if (!outcome.ok) console.log(`[framework] keeping worktree ${worktree}: ${outcome.error}`)
      } catch {
        // A worktree we could not retire is a worktree left on disk, which is the safe direction.
      }
    })

  // One more try for an agent the API dropped mid-work (#1281): the failure is about the transport,
  // not the work, and the continue-agent machinery (#762/#923) reopens the retained checkout on its
  // recorded branch (#1278). Counted in memory on purpose: a daemon restart already re-resumes
  // runs (#923), and a lost count only ever grants one extra attempt.
  const agentRetries = new Map<string, number>()
  const retryTransientDeath = async (
    projectCwd: string,
    targetProjectId: string | undefined,
    agentId: string,
    options: StartAgentOptions,
  ): Promise<void> => {
    const attempts = agentRetries.get(agentId) ?? 0
    if (attempts >= MAX_TRANSIENT_RETRIES) return
    const meta = (await listAgents(projectCwd).catch((): AgentMeta[] => [])).find(agent => agent.id === agentId)
    // Only a run that failed by its own report, and only a local one: a web/actions run's
    // lifecycle lives elsewhere and is not this daemon's to replay. A stopped agent stays stopped.
    if (meta?.status !== 'failed') return
    if (meta.target !== undefined && meta.target !== 'local') return
    const jsonl = (await archivedAgentPaths(projectCwd, agentId).catch((): string[] => [])).find(path => path.endsWith('.jsonl'))
    const detail = jsonl ? lastAgentFailureDetail(await readFile(jsonl, 'utf8').catch(() => '')) : undefined
    if (!isTransientAgentFailure(detail)) return
    agentRetries.set(agentId, attempts + 1)
    console.log(
      `[framework] agent ${agentId} died to a transient error (${detail}); continuing it in ${(retryDelayMs ?? TRANSIENT_RETRY_DELAY_MS) / 1000}s, attempt ${attempts + 1} of ${MAX_TRANSIENT_RETRIES}`,
    )
    // Unref'd: a pending retry must never hold the daemon open, and a daemon that exits first
    // simply does not retry — #923's resume owns the restart case.
    const timer = setTimeout(() => {
      void onStart(
        RETRY_PROMPT,
        'build',
        {
          ...options,
          // Unattended like #923's resume: nobody is watching a retry, and the agent must end.
          unattended: true,
          continueAgentId: agentId,
          ...(meta.sessionId ? { resumeSession: meta.sessionId } : {}),
        },
        targetProjectId,
      ).then(result => {
        if (!result.ok) console.log(`[framework] could not continue agent ${agentId} after its transient death: ${result.error}`)
      })
    }, retryDelayMs ?? TRANSIENT_RETRY_DELAY_MS)
    timer.unref?.()
  }

  // Start-from-dashboard (#345): spawn `framework --agent <spec>` for the checkout
  // as a detached child — the same spawn ensureDaemon uses for the daemon itself. The agent
  // streams into the page via its tailed event log, and its gates + Stop steer through the
  // control channel (#344).
  //
  // Concurrency is per agent, not per project (#736): the one-run-per-project (#393) refusal
  // existed because two agents shared one working tree, and worktrees remove that collision.
  // Rom's call on the cap is unbounded ("the best solution for the user unless/until we
  // stumble upon issues"), so the guard now only refuses a duplicate of the *same* checkout —
  // which in practice means the fallback path above.
  const onStart = async (
    prompt: string,
    kind: StartAgentKind,
    options: StartAgentOptions = {},
    targetProjectId?: string,
  ): Promise<StartAgentResult> => {
    // Run on a connected device (#1067): forward the agent to the remote daemon and relay its events
    // back, without allocating a worktree or touching this daemon's busy guard; the remote owns
    // both. `remote` is stripped so the remote starts an ordinary local agent and does not relay on.
    // Slice 1 runs in the device's own home checkout; which remote project it targets is a later slice.
    if (options.remote) {
      const { remote, ...forwarded } = options
      const result = await startRemoteAgent(remote, { prompt, kind, options: forwarded })
      if (result.ok && result.agentId) {
        // A relayed agent has no local worktree or pid, so its list row is a memory-only stub (#1077):
        // registered here so onAgents can show it and a dashboard reload re-opens it. Never written to disk.
        const now = new Date().toISOString()
        const meta: AgentMeta = {
          version: AGENT_META_VERSION,
          status: 'running',
          id: result.agentId,
          startedAt: now,
          updatedAt: now,
          target: 'remote',
          ...(prompt ? { intent: prompt } : {}),
          ...(remote.label ? { remoteLabel: remote.label } : {}),
        }
        relayedAgents.register(result.agentId, remote, meta, targetProjectId ?? homeId)
      }
      return result
    }
    const projectKey = targetProjectId ?? homeId
    const projectCwd = await resolveProject(targetProjectId)
    if (!projectCwd) return { ok: false, error: `unknown project: ${targetProjectId}` }
    let realBin: string
    try {
      realBin = resolveSpawnBin(binPath)
    } catch (err) {
      return { ok: false, error: errorMessage(err) }
    }

    // A continuation start carries only its seed (#1467): the composer's Resume sends
    // `{resumeSession, continueAgentId, agent}` and nothing else, so the agent's armed handoff fell
    // back to bare defaults — a session that ran its first leg merge-armed resumed with the merge
    // silently disarmed and ended in a draft PR. The project's resolved options are the base and
    // the caller's explicit ones stay on top. A fresh start is untouched — the launcher resolves
    // its options client-side and sends them whole.
    if (options.continueAgentId) {
      options = { ...(await resolveProjectAgentOptions(projectKey, env)), ...options }
      // A Resume fired the instant its agent flips `done` can also land while the child that wrote
      // that ending is still mid-exit (#1529): the slot then still holds a live pid, and the busy
      // guard below refused a continuation of a session that is over by its own account. Wait the
      // exit and its queued retirement out, so the guard judges only real collisions and the
      // checkout reuse reads a settled archive.
      const { continueAgentId } = options
      await waitOutFinishedLeg(
        scopedKey(projectKey, continueAgentId),
        { starting, activeAgents: activeAgents, retiring },
        async () => {
          // The composed read (live meta wins over archive): the leg just wrote `done` into its
          // worktree and teardown has not archived it yet, so the archive-only list cannot see it.
          // No row at all is `unknown`, never `ended` (#1540): the leg is mid-teardown, or its
          // meta was caught mid-rewrite, and neither says anything about whether it is still up.
          const meta = continueAgentId ? await findAgent(projectCwd, continueAgentId).catch(() => undefined) : undefined
          if (!meta) return 'unknown'
          return meta.status === 'running' ? 'running' : 'ended'
        },
        FINISHED_LEG_EXIT_GRACE_MS,
      )
    }

    // An agent must not spend a branch and a worktree on a driver that can never start (#1326).
    // That is what #1323 looked like from outside: six projects' worth of agent branches piling up
    // while every session died before writing agent.json, with the dashboard stuck on "Waiting for
    // the session to start...". Probed here, above the allocation, because this is the one place
    // a daemon-started agent is born; the CLI's own path has gated on preflight since #542.
    const preflightError = await checkAgentReady(options)
    if (preflightError) return { ok: false, error: preflightError }

    // Continuing an existing agent (#762) reuses its id, checkout and log; anything else is new.
    const continued = options.continueAgentId ? await continueWorkspace(projectCwd, options.continueAgentId) : undefined
    // A repo that could not be given a worktree fails the Start rather than borrowing the user's
    // own checkout (#997); the dashboard shows the reason, and starting again is the retry.
    const allocated = continued
      ? ({ ok: true, workspace: continued } as const)
      : await allocateWorkspace(projectCwd, agentIdFromStartedAt(new Date().toISOString()))
    if (!allocated.ok) return { ok: false, error: allocated.error }
    const workspace = allocated.workspace
    // An agent in its own worktree is keyed by that worktree, so it never collides with a
    // sibling; a fallback agent is keyed by the project, restoring the one-at-a-time guard.
    const key = scopedKey(projectKey, workspace.agentId)
    const active = activeAgents.get(key)
    if (starting.has(key) || (active !== undefined && isPidAlive(active))) {
      return { ok: false, busy: true, error: 'a session is already active for this project; stop it or wait for it to finish' }
    }
    activeAgents.delete(key)
    starting.add(key)
    try {
      // [Research] (#331) carries an empty prompt fine: its "what" defaults to `this PR`. A
      // `prompt` kind (#353) is a preset the user reviewed in the textarea: run it verbatim,
      // never re-render. `agentId` is the id its worktree is named with, so the directory and the
      // run recorded inside it are one string — and tells it the framework owns its branch.
      const child = spawnDetached(
        realBin,
        await writeAgentSpec({
          prompt,
          kind,
          cwd: workspace.cwd,
          ...(workspace.agentId ? { agentId: workspace.agentId } : {}),
          // Reopen the agent's log instead of truncating it: the follow-up IS that agent.
          ...(continued ? { continueAgent: true } : {}),
          options,
        }, env),
        ...(workspace.agentId ? [agentStderrPath(workspace.cwd)] : []),
      )
      // The agent narrates itself through its own `.the-framework/events.jsonl`, which the
      // dashboard streams over `GET /_rpc/events`; the daemon just tracks liveness.
      const settle = (detail: string): void => {
        activeAgents.delete(key)
        const { cwd: checkout, agentId } = workspace
        if (!agentId) return
        // The failed marker lands before the teardown reads the meta (#1261), so a boot death is
        // archived as `failed` and the worktree is then kept for inspection, not removed. After
        // teardown the archive is readable, which is when a transient death earns a retry (#1281).
        parkRetirement(
          key,
          markFailedStart(checkout, agentId, prompt, detail)
            .catch(() => {})
            .then(() => tearDownWorktree(projectCwd, checkout, agentId))
            .then(() => retryTransientDeath(projectCwd, targetProjectId, agentId, options))
            .catch(() => {}),
        )
      }
      child.once('error', err => settle(`its process could not be spawned (${errorMessage(err)})`))
      child.once('exit', (code, signal) => settle(exitDetail(code, signal)))
      if (child.pid !== undefined) activeAgents.set(key, child.pid)
      // Hand back the agent's id (#761) so the dashboard can select this agent rather than guess.
      return { ok: true, ...(workspace.agentId ? { agentId: workspace.agentId } : {}) }
    } finally {
      starting.delete(key)
    }
  }

  // Add project(s) (#396): install a single repo, or every git repo directly under a
  // directory, then register each so it appears in the Projects list. installProject is
  // idempotent (an already-activated repo is a no-op success); a git failure on any target
  // aborts and surfaces as an error the dialog shows.
  const onAddProject = async (path: string, directory: boolean): Promise<AddProjectResult> => {
    // Resolve relative input against the daemon cwd, and check the directory really
    // exists first: without this a bad path reaches git as a missing cwd, which
    // surfaces as the confusing "spawn git ENOENT" rather than a path error.
    const abs = resolve(path)
    const isDir = await stat(abs).then(s => s.isDirectory()).catch(() => false)
    if (!isDir) return { ok: false, error: `path does not exist or is not a directory: ${abs}` }
    const targets = directory ? await enumerateGitRepos(abs) : [abs]
    if (!targets.length) return { ok: false, error: `no git repositories found under ${abs}` }
    let added = 0
    let alreadyActivated = 0
    for (const repo of targets) {
      const result = await installProject(repo)
      if (!result.ok) return { ok: false, error: result.error }
      if (result.alreadyActivated) alreadyActivated++
      else added++
      await addProject(repo, new Date().toISOString()).catch(() => {})
    }
    return { ok: true, added, alreadyActivated }
  }

  /**
   * How many agents are live on a project (#685). Agent keys are `<projectKey>::<agentId>`, or the
   * bare project key for an agent that got no worktree, so both spellings count. The pid is
   * re-checked rather than trusted: `settle` clears the entry on exit, but an agent whose exit
   * event never arrived would otherwise keep a project looking busy forever.
   */
  const activeAgentCount = (targetProjectId: string): number => {
    let live = 0
    for (const [key, pid] of activeAgents) {
      if (!keyBelongsTo(key, targetProjectId)) continue
      if (isPidAlive(pid)) live++
    }
    return live + [...starting].filter(key => keyBelongsTo(key, targetProjectId)).length
  }

  /** See {@link ProjectRuntime.busyAgentIds}: every slot the daemon has not finished with. */
  const busyAgentIds = (): ReadonlySet<string> => {
    const ids = new Set<string>()
    for (const key of [...activeAgents.keys(), ...starting, ...retiring.keys()]) {
      const { agentId } = parseScopedKey(key)
      if (agentId) ids.add(agentId)
    }
    return ids
  }

  /**
   * Stop the agents this daemon spawned. Ctrl-C closes everything: the dashboard runs in the
   * foreground, and nothing it started outlives it.
   *
   * A spawned agent is detached so it survives the CLI that asked for it, not so it survives the
   * daemon that owns it: left alone it becomes an orphan on `ppid 1`, holding a worktree and a
   * headless browser, with no daemon left that knows about it. So each gets a SIGTERM, which the
   * run already handles by aborting cleanly and group-killing its agent, and a SIGKILL if it will
   * not go. Only runs in `activeAgents` — an agent this daemon merely steers is not its to stop.
   *
   * What is stopped here is not lost, it is just not restarted for you: the agent keeps its branch,
   * and its checkout too until the work reaches the remote (E5), so the next start continues the
   * same conversation in the same checkout — when you ask for it.
   *
   * Resolving means the daemon has let go of the repo, not merely that the processes are dead —
   * see {@link waitOutSlots}. The archive commit that runs right behind this depends on it.
   */
  const stopAgents = async (graceMs = 5000): Promise<number> => {
    const stopping = [...activeAgents.entries()]
    let stopped = 0
    for (const [, pid] of stopping) if (await terminate(pid, graceMs)) stopped++
    // Each slot is left for its own `settle` to clear, so the wait can tell a teardown that has
    // yet to start from one that has already finished.
    await waitOutSlots(stopping.map(([key]) => key), { activeAgents: activeAgents, retiring }, graceMs)
    for (const [key] of stopping) activeAgents.delete(key)
    return stopped
  }

  // The dashboard's events source (#1067): a stream for an agent this daemon is relaying from a device,
  // else undefined so `onEvents` tails the on-disk log as usual for an ordinary local agent.
  const remoteEventsSource: EventsSource = (_projectId, agentId) => relayedAgents.get(agentId)

  // Tail a relay-started agent's own log (#1067) for the `/_relay/events` endpoint. The relocating
  // tail, for the same reason as the dashboard's onEvents: teardown moves the journal into the
  // archive, and the device's fixed-path tail went silent without the agent's final events. The
  // initial attach takes whatever the resolver answers (a non-git fallback agent's journal IS the
  // root one); a relocation refuses the root fallback — there it is another agent's feed.
  const rootJournal = join(cwd, FRAMEWORK_DIR, EVENTS_FILE)
  const tailRelayEvents = (agentId: string, onEvent: (event: FrameworkEvent) => void): (() => void) => {
    let initial = true
    return tailAgentEvents<FrameworkEvent>(async () => {
      const next = await resolveAgentEventsPath(cwd, agentId)
      if (initial) {
        initial = false
        return next
      }
      return next === rootJournal ? undefined : next
    }, onEvent)
  }

  const dispose = async (): Promise<void> => {
    relayedAgents.dispose()
  }

  return {
    onStart,
    onAddProject,
    remoteEventsSource,
    tailRelayEvents,
    remoteAgents,
    onRelayRpc,
    activeAgentCount,
    busyAgentIds,
    stopAgents,
    dispose,
  }
}
