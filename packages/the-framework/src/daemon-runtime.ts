import { spawn, type ChildProcess } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { appendFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import {
  runIdFromStartedAt,
  startedAtFromRunId,
  addWorktree,
  runBranchName,
  linkDependencies,
  excludeDependencyLinks,
  archiveWorktreeRun,
  restoreArchivedRun,
  attachWorktree,
  worktreePath,
  listRuns,
  findRun,
  archivedRunPaths,
  commitPendingWork,
  currentBranch,
  removeWorktree,
  pruneWorktrees,
  readLiveMetas,
  readLiveMeta,
  resolveRunEventsPath,
  FRAMEWORK_DIR,
  EVENTS_FILE,
  META_FILE,
  RUN_META_VERSION,
  isPidAlive,
  type RunMeta,
} from './store/index.js'
import type { FrameworkEvent } from './events.js'
import { writeSessionSpec } from './session-spec.js'
import type { StartRunKind, StartRunOptions, StartRunResult, AddProjectResult } from './dashboard/index.js'
import type { EventsSource, RemoteRuns } from './dashboard/telefunc-serve.js'
import { RelayedRuns, startRemoteRun } from './dashboard/remote-run.js'
import { runBranchFor } from './dashboard/run-handoff.js'
import { dispatchRelayRpc } from './dashboard-rpc/relay-dispatch.js'
import { tailEvents, tailRunEvents } from './dashboard-rpc/events-tail.js'
import { ensureSessionsIgnored, resolveUserDir } from './sessions.js'
import { scopedKey, parseScopedKey, keyBelongsTo } from './runtime-keys.js'
import { addProject, listProjects, projectId, topicScratchPath } from './registry.js'
import { isTicketPath } from './tickets.js'
import { resolveProjectRunOptions } from './daemon-services.js'
import { installProject, enumerateGitRepos } from './install.js'
import { isGitRepo } from './project.js'
import { isCliTimeout } from './cli-exec.js'
import { withRunLock } from './run-locks.js'
import { errorMessage } from './error-message.js'
import { preflight, preflightProblems, type PreflightResult } from './preflight.js'
import { isAgentName, type AgentName } from './agent-names.js'

/**
 * How long a passing agent preflight (#1326) is trusted before it is probed again. Short enough
 * that logging out mid-session is noticed within a session's worth of starts, long enough that a
 * burst of starts pays for the probes once.
 */
const AGENT_READY_TTL_MS = 30_000

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
 * back here, so each spawn spawns another: a fork bomb. A real run passes the compiled bin
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
 * already on disk before this run asked for it, and that is not ours to delete.
 */
export async function cleanupTimedOutWorktree(repo: string, runId: string, err: unknown): Promise<void> {
  if (!isCliTimeout(err)) return
  await rm(worktreePath(repo, runId), { recursive: true, force: true }).catch(() => {})
}

/**
 * Retire a finished topic run's scratch dir (#1120), by the same retention rule as a worktree
 * ({@link createProjectRuntime}'s tearDownWorktree): a run that finished cleanly has nothing left to
 * look at, so its scratch goes; a failed or stopped run keeps it, which is when you want to see what
 * it died holding. The scratch is not a git checkout, so there is no branch to preserve and no work
 * to commit — the run's own `run.json`/`events.jsonl` live inside it and go with it. Best-effort:
 * this runs off a process-exit event with nothing to return to.
 */
export async function tearDownTopicScratch(scratchCwd: string): Promise<void> {
  const meta = await readLiveMeta(scratchCwd).catch(() => undefined)
  if (meta?.status !== 'done') return // failed / stopped / unreadable: keep it for inspection
  await rm(scratchCwd, { recursive: true, force: true }).catch(() => {})
}

/** Best-effort append of a `log` event to a run's live stream, so a daemon-side note (a #1122
 * re-home failure) surfaces on a run whose own process wrote every other line. Never throws. */
async function appendRunLog(cwd: string, message: string): Promise<void> {
  const event: FrameworkEvent = { kind: 'log', message }
  await appendFile(join(cwd, FRAMEWORK_DIR, EVENTS_FILE), JSON.stringify(event) + '\n').catch(() => {})
}

/**
 * Move a bound topic run's history into its new worktree (#1122), so `--continue-run` reopens the
 * same run row rather than starting empty. Copies the event log and the meta, with `topic` cleared
 * and the bound project recorded, since the run is an ordinary project run from here on. A torn/
 * missing meta is left behind, so continue-run falls back to a fresh row rather than writing junk.
 */
export async function moveTopicRunHistory(scratchCwd: string, worktreeCwd: string, boundProjectId: string): Promise<void> {
  const from = join(scratchCwd, FRAMEWORK_DIR)
  const to = join(worktreeCwd, FRAMEWORK_DIR)
  await mkdir(to, { recursive: true })
  await writeFile(join(to, EVENTS_FILE), await readFile(join(from, EVENTS_FILE), 'utf8').catch(() => ''))
  const raw = await readFile(join(from, META_FILE), 'utf8').catch(() => '')
  if (!raw) return
  try {
    const { topic: _topic, ...meta } = JSON.parse(raw) as RunMeta
    await writeFile(join(to, META_FILE), JSON.stringify({ ...meta, boundProjectId }, null, 2) + '\n')
  } catch {
    // torn meta: leave it, so continue-run opens a fresh row instead of on a half-written one
  }
}

/** Spawn a detached, unref'd framework child (`node <binPath> --session <specPath>`) that outlives us. */
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
  const child = spawn(process.execPath, [binPath, '--session', specPath], {
    detached: true,
    stdio: ['ignore', 'ignore', fd ?? 'ignore'],
  })
  if (fd !== undefined) closeSync(fd)
  child.unref()
  return child
}

/** Where a spawned run's stderr lands (#1261), so a child that dies at boot leaves a trace. */
export function runStderrPath(cwd: string): string {
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
 * A healthy run's first act is opening its store (`run.json` + `events.jsonl`); a child that
 * exited without one never booted — a module resolution error being the observed case — and with
 * stdio detached the crash went nowhere, so the session page polled "Waiting for the session to
 * start" forever. The daemon's exit handler is the one place that knows, so it writes the minimal
 * meta the page needs and surfaces the child's stderr tail in the run log. A child that wrote its
 * own meta is left alone: its lifecycle is its own to report.
 */
export async function markFailedStart(cwd: string, runId: string, intent: string, detail: string): Promise<boolean> {
  const metaPath = join(cwd, FRAMEWORK_DIR, META_FILE)
  if (await stat(metaPath).then(() => true, () => false)) return false
  const now = new Date().toISOString()
  const meta: RunMeta = {
    version: RUN_META_VERSION,
    status: 'failed',
    id: runId,
    startedAt: startedAtFromRunId(runId) ?? now,
    updatedAt: now,
    ...(intent.trim() ? { intent } : {}),
  }
  const stderrTail = (await readFile(runStderrPath(cwd), 'utf8').catch(() => '')).trim().slice(-2000)
  await mkdir(join(cwd, FRAMEWORK_DIR), { recursive: true }).catch(() => {})
  await writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n').catch(() => {})
  await appendRunLog(cwd, `The session failed to start: ${detail}.` + (stderrTail ? `\n\n${stderrTail}` : ''))
  console.log(`[framework] run ${runId} failed to start: ${detail}`)
  return true
}

/**
 * Driver deaths worth one more try (#1281): the connection dropped or the API buckled mid-run —
 * failures about the transport, not the work. Conservative on purpose: a run that failed for any
 * reason this does not name stays failed, because retrying a real failure just re-runs it.
 */
const TRANSIENT_FAILURE =
  /connection closed|connection reset|connection error|econnreset|etimedout|socket hang up|overloaded|rate.?limit|api error: 5\d\d|internal server error/i

/** Whether a run's failure detail names a transient transport error (#1281). */
export function isTransientRunFailure(detail: string | undefined): boolean {
  return detail !== undefined && TRANSIENT_FAILURE.test(detail)
}

/**
 * The detail the run's own `end` event failed with, off its archived event log (#1281), or
 * undefined when the run did not fail by its own report. Only a child-written `end` counts: a
 * boot death (#1261) never writes one, and retrying a run that cannot boot would just re-crash.
 */
export function lastRunFailureDetail(eventsJsonl: string): string | undefined {
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

/** How many times a transiently-dead run is continued before its failure stands (#1281). */
export const MAX_TRANSIENT_RETRIES = 2

/** The pause before a retry (#1281): long enough for a dropped connection to be worth re-trying. */
const TRANSIENT_RETRY_DELAY_MS = 15_000

/** How long a continuation waits for its finished previous leg to exit and retire (#1529). */
const FINISHED_LEG_EXIT_GRACE_MS = 15_000

/** What the continued session is told (#1281), in the #923 resume prompt's shape. */
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
 * What the previous leg of a run says about itself, for {@link waitOutFinishedLeg}. `unknown` is
 * the honest third answer — the leg has no readable state *this instant* — and is deliberately
 * not folded into either of the other two.
 */
export type FinishedLegState = 'ended' | 'running' | 'unknown'

/**
 * Wait out the previous leg of the run a continuation is aimed at (#1529). A Resume clicked the
 * instant a run's row flips `done` can land while the child that wrote that ending is still
 * mid-exit: the run's slot then still holds a live pid, and the busy guard read "already active"
 * off a session that is over by its own account — a spurious refusal the E2E settings story
 * caught on a slow runner. A finished child's exit is imminent and its retirement is queued
 * right behind it (see `retiring` in {@link createProjectRuntime}), so wait for both, bounded by
 * `graceMs`, and let the reuse read a settled archive. A leg still calling itself `running` is a
 * genuine collision: not waited on, so the guard's refusal stands.
 *
 * `readLegState` is asked until it commits, rather than sampled once (#1540). A leg's state is
 * read off a `run.json` its own process rewrites in place, so a single read can come back
 * `unknown` for reasons that have nothing to do with the leg — a torn read, or the beat between
 * the archive being written and the worktree going. Taking one such sample for "still running"
 * skipped the wait entirely and handed the continuation to the busy guard mid-exit: #1529's
 * refusal back as a rarer race, and the flake that sent this here. Only a leg that positively
 * reports `running` short-circuits; `unknown` re-asks on the next tick, and the loop still ends
 * the moment the slot clears, so the common path costs exactly one read as before.
 */
export async function waitOutFinishedLeg(
  key: string,
  slots: { starting: Set<string>; activeRuns: Map<string, number>; retiring: Map<string, Promise<void>> },
  readLegState: () => Promise<FinishedLegState>,
  graceMs: number,
): Promise<void> {
  const occupied = (): boolean => slots.starting.has(key) || slots.activeRuns.has(key)
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
  agentPreflight?: ((agent: AgentName) => Promise<PreflightResult>) | undefined
}

/** The per-project run + preview surface the dashboard drives, plus its teardown. */
export interface ProjectRuntime {
  onStart: (prompt: string, kind: StartRunKind, options?: StartRunOptions, targetProjectId?: string) => Promise<StartRunResult>
  onAddProject: (path: string, directory: boolean) => Promise<AddProjectResult>
  /** The live event stream for a run this daemon is relaying from a device (#1067), else undefined
   *  so `onEvents` falls back to tailing the on-disk log. Wired as the dashboard's events source. */
  remoteEventsSource: EventsSource
  /** Tail a relay-started run's on-disk events (#1067): the daemon's `/_relay/events` endpoint uses
   *  it to stream one run back to whichever daemon relayed it here. */
  tailRelayEvents: (runId: string, onEvent: (event: FrameworkEvent) => void) => () => void
  /** The relayed-run lookup the dashboard's read RPCs consult (#1067 slice 2): which device a remote
   *  run runs on, so a run-scoped RPC forwards there instead of resolving a local checkout. */
  remoteRuns: RemoteRuns
  /** The device side of the relay (#1067 slice 2): run one whitelisted read/steer/handoff RPC against
   *  this daemon's own home checkout, for a daemon that relayed a run here. */
  onRelayRpc: (fn: string, args: unknown[]) => Promise<unknown>
  /** Live runs on a project (#685), so a background job can tell an idle project from a busy one. */
  activeRunCount: (targetProjectId: string) => number
  /**
   * Stop the runs this daemon spawned. Returns how many were stopped. Called on shutdown, before
   * the previews go.
   */
  stopRuns: (graceMs?: number) => Promise<number>
  /** Stop every live preview so their dev servers do not outlive the daemon (#475). */
  dispose: () => Promise<void>
}

/**
 * The daemon's per-project runtime (#393): the run and preview state keyed by project id,
 * plus the RPCs the dashboard invokes over Telefunc. A project runs any number of concurrent
 * runs (each in its own worktree, #736) and one preview. The home `cwd` is the default target — a request
 * with no project id (or the home id) resolves to it without a registry lookup. Split out of
 * {@link runDaemon} so the daemon body reads as lifecycle and this reads as business logic.
 */
export function createProjectRuntime({ cwd, env, binPath, retryDelayMs, agentPreflight }: ProjectRuntimeOptions): ProjectRuntime {
  const homeId = projectId(resolve(cwd))
  // The run-key namespace for project-less topic runs (#1120): `@`-prefixed so it can never equal a
  // real project id (projectId always appends `-<hash>`), so a topic run belongs to no project.
  const TOPIC_PROJECT_KEY = '@topic'
  // Live run pids, keyed per run rather than per project (#736) — see onStart for the key.
  const activeRuns = new Map<string, number>()
  const starting = new Set<string>() // reserved keys mid-spawn, to close the async gap
  // A finished leg's exit → retirement chain, parked per run slot so a continuation that raced
  // the exit (#1529) can await the retirement instead of reusing a checkout mid-removal.
  const retiring = new Map<string, Promise<void>>()
  const parkRetirement = (key: string, retired: Promise<void>): void => {
    retiring.set(key, retired)
    void retired.finally(() => {
      if (retiring.get(key) === retired) retiring.delete(key)
    })
  }
  // Runs this daemon is relaying to/from a connected device (#1067): the local half of a remote run.
  const relayedRuns = new RelayedRuns()
  // The relayed-run lookup the dashboard's read RPCs consult (#1067 slice 2): is this runId remote, and
  // which device owns it. Outlives the event stream so a finished remote run's push/PR still reaches it.
  const remoteRuns: RemoteRuns = {
    target: runId => relayedRuns.target(runId),
    list: projectId => relayedRuns.list(projectId),
  }
  // The device side of the relay (#1067 slice 2): run one whitelisted read/steer/handoff RPC against this
  // daemon's own home checkout, for a daemon that relayed a run here. Home id forces the addressed project.
  const onRelayRpc = (fn: string, args: unknown[]): Promise<unknown> => dispatchRelayRpc(homeId, fn, args)

  // A project id resolves to its repo path via the registry; the home id (or none)
  // resolves to the daemon's own `cwd` without a lookup.
  const resolveProject = async (id: string | undefined): Promise<string | undefined> => {
    if (!id || id === homeId) return cwd
    const records = await listProjects(undefined, env).catch(() => [])
    return records.find(record => record.id === id)?.path
  }

  /**
   * Put a continued run (#762) back in its own checkout: the same worktree if it was retained, else
   * its own branch checked out fresh. Its archived history is restored into the checkout so the run
   * reopens its log rather than starting empty, which is what keeps it one row.
   *
   * The branch is the session's if the agent named one, else the run-id branch it started on.
   * Returns undefined when none of that is possible, so the caller can fall back to a new run.
   */
  const continueWorkspace = (projectCwd: string, runId: string): Promise<{ cwd: string; runId: string } | undefined> =>
    // Under the same run lock as teardown: a Resume clicked off a freshly-`done` run lands here
    // while teardown is still archiving the very history this restores — reusing the checkout
    // mid-retirement spawned the continuation into a tree about to be removed. Waiting the
    // teardown out costs the click a beat and makes the reuse read a settled archive.
    withRunLock(worktreePath(projectCwd, runId), async () => {
      try {
        const path = worktreePath(projectCwd, runId)
        const existing = await stat(path).then(s => s.isDirectory()).catch(() => false)
        if (!existing) {
          const archived = (await listRuns(projectCwd).catch(() => [])).find(run => run.id === runId)
          // The recorded branch first (#1277): an agent that branched itself (#326 allows it) has
          // its work there, and re-attaching by the session-name guess would continue the run on a
          // branch without its previous commits.
          const branch = runBranchFor(archived ?? { id: runId })
          await attachWorktree(projectCwd, { runId, branch })
          await linkDependencies(projectCwd, path).catch(() => [])
        }
        await restoreArchivedRun(projectCwd, path, runId).catch(() => false)
        return { cwd: path, runId }
      } catch (err) {
        console.log(`[framework] could not continue session ${runId} (${errorMessage(err)}); starting a new one`)
        return undefined
      }
    })

  /**
   * Whether the agent this run picked can actually start (#1326), as one line to show when it
   * cannot. `undefined` means go.
   *
   * Only the two targets that spend the local CLI are gated. An `actions` run executes on a
   * GitHub Actions runner and drives it over the API, so a laptop with no `claude` on it starts
   * that run perfectly well; a `web` run is started *by* the local CLI under a pty, so it needs
   * the binary and the login exactly as a local run does. A `remote` run never reaches here,
   * having been handed to its device further up.
   *
   * Only a *pass* is cached, and only briefly. Two probes cost around half a second, which is
   * nothing against a run but more than the window the one-at-a-time guard closes in, so paying
   * it on every Start would make back-to-back starts race. Caching the failure instead would be
   * the worse trade: logging in has to be picked up by the very next Start, not by a timeout or
   * a daemon restart, so a broken setup is re-probed every time and costs only the user who
   * already cannot run anything.
   */
  const readyUntil = new Map<AgentName, number>()
  const checkAgentReady = async (options: StartRunOptions): Promise<string | undefined> => {
    if (options.target === 'actions') return undefined
    const agent = isAgentName(options.agent) ? options.agent : 'claude'
    if ((readyUntil.get(agent) ?? 0) > Date.now()) return undefined
    const result = await (agentPreflight ? agentPreflight(agent) : preflight({ agent }))
    if (!result.ok) return preflightProblems(result).join('; ')
    readyUntil.set(agent, Date.now() + AGENT_READY_TTL_MS)
    return undefined
  }

  /**
   * The checkout a run gets (#736). Each run is given its own git worktree under the project's
   * `.the-framework/worktrees/<runId>`, on a `the-framework/run-<runId>` branch, so N runs on one
   * repo never fight over the working tree — and the user's own checkout, uncommitted work
   * included, is left untouched.
   *
   * A project that *structurally* cannot provide one — it is not a git repo — falls back to the
   * main checkout, which is exactly the pre-#736 behavior, and keeps its pre-#736 limit of one run
   * at a time, since those runs *would* collide. Signalled by the absent `runId`.
   *
   * A project that *is* a repo and whose `worktree add` failed does not fall back (#997): that
   * downgrade silently pointed the agent at the user's own working tree, uncommitted work
   * included, which is the one thing #736 exists to prevent. A `worktree add` on a large repo can
   * outrun its budget and be SIGTERMed, so this is reachable in normal use, not just on a broken
   * repo. The run fails instead, because a failed run is recoverable by starting it again and a
   * checkout with agent edits mixed into it is not.
   */
  const allocateWorkspace = async (
    projectCwd: string,
    runId: string,
  ): Promise<{ ok: true; workspace: { cwd: string; runId?: string } } | { ok: false; error: string }> => {
    try {
      const worktree = await addWorktree(projectCwd, { runId, branch: runBranchName(runId) })
      // `node_modules` is gitignored, so a fresh worktree has none: link the parent's in, and
      // make git ignore the links (a `node_modules/` rule does not match a symlink, #738).
      await linkDependencies(projectCwd, worktree.path).catch(() => [])
      await excludeDependencyLinks(projectCwd).catch(() => {})
      return { ok: true, workspace: { cwd: worktree.path, runId } }
    } catch (err) {
      if (await isGitRepo(projectCwd)) {
        await cleanupTimedOutWorktree(projectCwd, runId, err)
        return { ok: false, error: `could not create a worktree for this run: ${errorMessage(err)}` }
      }
      console.log(`[framework] ${basename(projectCwd)} is not a git repository, so it gets no worktree; running in the main checkout`)
      return { ok: true, workspace: { cwd: projectCwd } }
    }
  }

  /**
   * Retire a finished run's worktree (#737). Its history lives inside the worktree, so it is
   * copied into the repo first — otherwise removing the checkout would delete the run from the
   * dashboard's history.
   *
   * Then the retention rule: a run that finished cleanly has nothing left to look at once its
   * work is committed, so its worktree goes. A run that failed or was stopped keeps its checkout,
   * because that is exactly when you want to see the half-finished working tree and the diff it
   * died holding. Those are removed explicitly (the dashboard's Remove), never silently on a timer.
   *
   * Best-effort from end to end: this runs off a process-exit event with nothing to return to,
   * so a failure here must not take the daemon down.
   */
  /** The project half of a preview key from a checkout: the registry id every preview RPC keys by. */
  const projectKeyFor = (projectCwd: string): string => projectId(resolve(projectCwd))
  // Under the run lock: a Push/Remove/Resume fired off a freshly-`done` meta lands in the daemon
  // while this is mid-archive, and both sides commit in the same checkout. The loser used to
  // report "could not commit the work this session left uncommitted" — or worse, this side lost
  // and kept a worktree it should have removed. Serialized, whoever runs first commits the whole
  // pending state (`add -A`) and the other side finds a clean tree and carries on.
  const tearDownWorktree = (projectCwd: string, worktree: string, runId?: string): Promise<void> =>
    withRunLock(worktree, async () => {
      try {
        // Where the work ended up, recorded before the checkout can go (#799). The branch outlives
        // the worktree and is the only handle the dashboard has left on a finished session.
        const branch = await currentBranch(worktree)
        // Filed under the identity this repo commits as, and the ignore rules taught to keep it, so
        // the session survives the repo being cleaned (#1179).
        const user = await resolveUserDir(projectCwd)
        await ensureSessionsIgnored(projectCwd, user).catch(() => false)
        const meta = await archiveWorktreeRun(worktree, projectCwd, undefined, branch, user)
        if (meta?.status !== 'done') return // failed / stopped / unreadable: keep it for inspection
        // A finished run can still be holding an uncommitted edit (#786), and removing the
        // checkout would destroy it. Commit it to the run's branch, which outlives the
        // worktree; if that cannot be done, keep the checkout rather than take the diff with it.
        if (!(await commitPendingWork(worktree))) {
          console.log(`[framework] keeping worktree ${worktree}: its uncommitted work could not be committed`)
          return
        }
        await removeWorktree(projectCwd, worktree)
        await pruneWorktrees(projectCwd)
      } catch {
        // A worktree we could not retire is a worktree left on disk, which is the safe direction.
      }
    })

  // One more try for a run the API dropped mid-work (#1281): the failure is about the transport,
  // not the work, and the continue-run machinery (#762/#923) reopens the retained checkout on its
  // recorded branch (#1278). Counted in memory on purpose: a daemon restart already re-resumes
  // runs (#923), and a lost count only ever grants one extra attempt.
  const runRetries = new Map<string, number>()
  const retryTransientDeath = async (
    projectCwd: string,
    targetProjectId: string | undefined,
    runId: string,
    options: StartRunOptions,
  ): Promise<void> => {
    const attempts = runRetries.get(runId) ?? 0
    if (attempts >= MAX_TRANSIENT_RETRIES) return
    const meta = (await listRuns(projectCwd).catch((): RunMeta[] => [])).find(run => run.id === runId)
    // Only a run that failed by its own report, and only a local one: a web/actions run's
    // lifecycle lives elsewhere and is not this daemon's to replay. A stopped run stays stopped.
    if (meta?.status !== 'failed') return
    if (meta.target !== undefined && meta.target !== 'local') return
    const jsonl = (await archivedRunPaths(projectCwd, runId).catch((): string[] => [])).find(path => path.endsWith('.jsonl'))
    const detail = jsonl ? lastRunFailureDetail(await readFile(jsonl, 'utf8').catch(() => '')) : undefined
    if (!isTransientRunFailure(detail)) return
    runRetries.set(runId, attempts + 1)
    console.log(
      `[framework] session ${runId} died to a transient error (${detail}); continuing it in ${(retryDelayMs ?? TRANSIENT_RETRY_DELAY_MS) / 1000}s, attempt ${attempts + 1} of ${MAX_TRANSIENT_RETRIES}`,
    )
    // Unref'd: a pending retry must never hold the daemon open, and a daemon that exits first
    // simply does not retry — #923's resume owns the restart case.
    const timer = setTimeout(() => {
      void onStart(
        RETRY_PROMPT,
        'build',
        {
          ...options,
          // Unattended like #923's resume: nobody is watching a retry, and the run must end.
          unattended: true,
          continueRunId: runId,
          ...(meta.sessionId ? { resumeSession: meta.sessionId } : {}),
        },
        targetProjectId,
      ).then(result => {
        if (!result.ok) console.log(`[framework] could not continue session ${runId} after its transient death: ${result.error}`)
      })
    }, retryDelayMs ?? TRANSIENT_RETRY_DELAY_MS)
    timer.unref?.()
  }

  /**
   * Re-home a bound topic run into its project (#1122). A topic run (#1120) lives in a neutral
   * scratch dir; binding it to a project (#1121) has to MOVE the conversation there. This reuses the
   * continue-run machinery (#762) pointed at a newly chosen project: allocate a fresh worktree in the
   * bound project, copy the run's history in, resume the SAME agent session in that worktree, and
   * stop the scratch child. The one case #762 never hit is the target project having no prior
   * worktree for this run, which is exactly {@link allocateWorkspace}'s job.
   *
   * Returns whether it re-homed. On failure (unknown project, or a worktree that could not be
   * allocated) it retains the scratch and surfaces a log event, so the conversation is never lost
   * and the run never points at a dead cwd, the same retain-on-failure direction as a worktree.
   * `markRehomed` is called the instant re-home is committed (before the scratch child is stopped),
   * so the child's own teardown leaves the scratch for this to remove rather than racing it.
   */
  const rehomeTopicRun = async (opts: {
    scratchCwd: string
    runId: string
    boundProjectId: string
    options: StartRunOptions
    realBin: string
    child: ChildProcess
    markRehomed: () => void
  }): Promise<boolean> => {
    const { scratchCwd, runId, boundProjectId, options, realBin, child, markRehomed } = opts
    const projectCwd = await resolveProject(boundProjectId)
    if (!projectCwd) {
      await appendRunLog(scratchCwd, `could not re-home this run: unknown project ${boundProjectId}`)
      return false
    }
    // The resume handle, read before the scratch goes: without it the agent starts a fresh session.
    const sessionId = (await readLiveMeta(scratchCwd).catch(() => undefined))?.sessionId
    const allocated = await allocateWorkspace(projectCwd, runId)
    if (!allocated.ok) {
      await appendRunLog(scratchCwd, `could not re-home this run into ${basename(projectCwd)}: ${allocated.error}`)
      return false
    }
    const workspace = allocated.workspace
    // Committed now: stop the scratch child (its conversation lives in the resumed session, not in
    // scratch), and take the scratch teardown away from its exit handler so this owns it.
    markRehomed()
    if (child.pid !== undefined) await terminate(child.pid, 5000)
    await moveTopicRunHistory(scratchCwd, workspace.cwd, boundProjectId)
    const key = scopedKey(boundProjectId, workspace.runId)
    // A short continuation note in the spirit of continuationPrompt: the resumed session already
    // carries the whole conversation, so this only tells it where it now is.
    const note = `You have been moved into project ${basename(projectCwd)} and are now working in its checkout. Continue where you left off.`
    const continued = spawnDetached(
      realBin,
      // Reopen the moved run rather than truncating it, and resume the agent session so the
      // conversation continues seamlessly. `topic` is dropped: this is an ordinary project run now.
      await writeSessionSpec({
        prompt: note,
        kind: 'prompt',
        cwd: workspace.cwd,
        ...(workspace.runId ? { runId: workspace.runId } : {}),
        continueRun: true,
        options: { ...options, ...(sessionId ? { resumeSession: sessionId } : {}) },
      }, env),
      workspace.runId ? runStderrPath(workspace.cwd) : undefined,
    )
    const settle = (detail: string): void => {
      activeRuns.delete(key)
      const { cwd: checkout, runId: movedRunId } = workspace
      if (!movedRunId) return
      // The moved meta is normally already there, so the marker no-ops; it only writes when the
      // copy was torn AND the resumed child died at boot (#1261) — the same hang either way.
      parkRetirement(
        key,
        markFailedStart(checkout, movedRunId, '', detail)
          .catch(() => {})
          .then(() => tearDownWorktree(projectCwd, checkout, movedRunId)),
      )
    }
    continued.once('error', err => settle(`its process could not be spawned (${errorMessage(err)})`))
    continued.once('exit', (code, signal) => settle(exitDetail(code, signal)))
    if (continued.pid !== undefined) activeRuns.set(key, continued.pid)
    // Re-home succeeded, so the scratch is spent: remove it outright. The retain-on-failure rule is
    // for a run that ended in scratch, not one that moved on with its conversation intact.
    await rm(scratchCwd, { recursive: true, force: true }).catch(() => {})
    return true
  }

  /**
   * Start a project-less "topic" run (#1120): no project, no repo, no worktree. The run spawns in a
   * neutral scratch dir under the config home, so the agent has nothing to touch — the "ask a
   * question / plan / draft a ticket without a repo" path. It still produces the normal lifecycle
   * (`events.jsonl`, `run.json`, settle) inside that dir, so its files are readable exactly like a
   * worktree run's. Its `--run-id` is unique per start, so the busy guard never trips; it is keyed
   * off {@link TOPIC_PROJECT_KEY} so it belongs to no registered project.
   *
   * Once the run binds to a project (#1121) it re-homes into that project's worktree (#1122): the
   * daemon tails the scratch run's own event log for the `bind` recorded there and hands the
   * conversation to {@link rehomeTopicRun}, rather than adding a run<->daemon IPC path.
   */
  const onStartTopic = async (
    prompt: string,
    kind: StartRunKind,
    options: StartRunOptions,
  ): Promise<StartRunResult> => {
    let realBin: string
    try {
      realBin = resolveSpawnBin(binPath)
    } catch (err) {
      return { ok: false, error: errorMessage(err) }
    }
    const runId = runIdFromStartedAt(new Date().toISOString())
    const scratchCwd = topicScratchPath(env, runId)
    try {
      // The `.the-framework/` dir too, so the bind watcher's fs.watch attaches before the run's
      // first write rather than relying on the poll backstop to notice the dir appear.
      await mkdir(join(scratchCwd, FRAMEWORK_DIR), { recursive: true })
    } catch (err) {
      return { ok: false, error: `could not create a scratch directory for this topic run: ${errorMessage(err)}` }
    }
    const key = scopedKey(TOPIC_PROJECT_KEY, runId)
    starting.add(key)
    try {
      const child = spawnDetached(
        realBin,
        await writeSessionSpec({ prompt, kind, cwd: scratchCwd, runId, topic: true, options }, env),
        runStderrPath(scratchCwd),
      )
      // Re-home on bind (#1122): once, and only on a committed re-home. `rehomed` gates the scratch
      // teardown below; `inFlight` stops a second bind racing a re-home already underway, but a bind
      // that failed to re-home leaves the watcher armed so a later bind (to a good project) retries.
      let rehomed = false
      let inFlight = false
      let stopBindWatch = (): void => {}
      const settle = (detail: string): void => {
        activeRuns.delete(key)
        stopBindWatch()
        if (rehomed) return // a committed re-home removes the scratch itself
        // The failed marker lands before the teardown reads the meta (#1261), so a boot death is
        // recorded and the retain-on-fail rule then keeps the scratch for inspection.
        void markFailedStart(scratchCwd, runId, prompt, detail).finally(() => void tearDownTopicScratch(scratchCwd))
      }
      child.once('error', err => settle(`its process could not be spawned (${errorMessage(err)})`))
      child.once('exit', (code, signal) => settle(exitDetail(code, signal)))
      stopBindWatch = tailEvents<FrameworkEvent>(join(scratchCwd, FRAMEWORK_DIR, EVENTS_FILE), event => {
        if (rehomed || inFlight || event.kind !== 'bind') return
        inFlight = true
        void rehomeTopicRun({ scratchCwd, runId, boundProjectId: event.projectId, options, realBin, child, markRehomed: () => (rehomed = true) })
          .then(ok => {
            if (ok) stopBindWatch()
          })
          .finally(() => (inFlight = false))
      })
      if (child.pid !== undefined) activeRuns.set(key, child.pid)
      return { ok: true, runId }
    } finally {
      starting.delete(key)
    }
  }

  // Start-from-dashboard (#345): spawn `framework --session <spec>` for the checkout
  // as a detached child — the same spawn ensureDaemon uses for the daemon itself. The run
  // streams into the page via its tailed event log, and its gates + Stop steer through the
  // control channel (#344).
  //
  // Concurrency is per run, not per project (#736): the #393 one-run-per-project refusal
  // existed because two runs shared one working tree, and worktrees remove that collision.
  // Rom's call on the cap is unbounded ("the best solution for the user unless/until we
  // stumble upon issues"), so the guard now only refuses a duplicate of the *same* checkout —
  // which in practice means the fallback path above.
  const onStart = async (
    prompt: string,
    kind: StartRunKind,
    options: StartRunOptions = {},
    targetProjectId?: string,
  ): Promise<StartRunResult> => {
    // Run on a connected device (#1067): forward the run to the remote daemon and relay its events
    // back, without allocating a worktree or touching this daemon's busy guard; the remote owns
    // both. `remote` is stripped so the remote starts an ordinary local run and does not relay on.
    // Slice 1 runs in the device's own home checkout; which remote project it targets is a later slice.
    if (options.remote) {
      const { remote, ...forwarded } = options
      const result = await startRemoteRun(remote, { prompt, kind, options: forwarded })
      if (result.ok && result.runId) {
        // A relayed run has no local worktree or pid, so its list row is a memory-only stub (#1077):
        // registered here so onRuns can show it and a dashboard reload re-opens it. Never written to disk.
        const now = new Date().toISOString()
        const meta: RunMeta = {
          version: RUN_META_VERSION,
          status: 'running',
          id: result.runId,
          startedAt: now,
          updatedAt: now,
          target: 'remote',
          ...(prompt ? { intent: prompt } : {}),
          ...(remote.label ? { remoteLabel: remote.label } : {}),
        }
        relayedRuns.register(result.runId, remote, meta, targetProjectId ?? homeId)
      }
      return result
    }
    // Project-less topic run (#1120): no project, no repo, no worktree — spawned into a neutral
    // scratch dir instead. Kept a branch of its own rather than overloading "absent projectId = home".
    if (options.topic) return onStartTopic(prompt, kind, options)
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
    // `{resumeSession, continueRunId, agent}` and nothing else, so the run's armed handoff fell
    // back to bare defaults — a session that ran its first leg merge-armed resumed with the merge
    // silently disarmed and ended in a draft PR. The project's resolved options are the base and
    // the caller's explicit ones stay on top. A fresh start is untouched — the launcher resolves
    // its options client-side and sends them whole.
    if (options.continueRunId) {
      options = { ...(await resolveProjectRunOptions(projectKey, env)), ...options }
      // A Resume fired the instant its run flips `done` can also land while the child that wrote
      // that ending is still mid-exit (#1529): the slot then still holds a live pid, and the busy
      // guard below refused a continuation of a session that is over by its own account. Wait the
      // exit and its queued retirement out, so the guard judges only real collisions and the
      // checkout reuse reads a settled archive.
      const { continueRunId } = options
      await waitOutFinishedLeg(
        scopedKey(projectKey, continueRunId),
        { starting, activeRuns, retiring },
        async () => {
          // The composed read (live meta wins over archive): the leg just wrote `done` into its
          // worktree and teardown has not archived it yet, so the archive-only list cannot see it.
          // No row at all is `unknown`, never `ended` (#1540): the leg is mid-teardown, or its
          // meta was caught mid-rewrite, and neither says anything about whether it is still up.
          const meta = continueRunId ? await findRun(projectCwd, continueRunId).catch(() => undefined) : undefined
          if (!meta) return 'unknown'
          return meta.status === 'running' ? 'running' : 'ended'
        },
        FINISHED_LEG_EXIT_GRACE_MS,
      )
    }

    // A run must not spend a branch and a worktree on an agent that can never start (#1326).
    // That is what #1323 looked like from outside: six projects' worth of run branches piling up
    // while every session died before writing run.json, with the dashboard stuck on "Waiting for
    // the session to start...". Probed here, above the allocation, because this is the one place
    // a daemon-started run is born; the CLI's own path has gated on preflight since #542.
    const preflightError = await checkAgentReady(options)
    if (preflightError) return { ok: false, error: preflightError }

    // Continuing an existing run (#762) reuses its id, checkout and log; anything else is new.
    const continued = options.continueRunId ? await continueWorkspace(projectCwd, options.continueRunId) : undefined
    // A repo that could not be given a worktree fails the Start rather than borrowing the user's
    // own checkout (#997); the dashboard shows the reason, and starting again is the retry.
    const allocated = continued
      ? ({ ok: true, workspace: continued } as const)
      : await allocateWorkspace(projectCwd, runIdFromStartedAt(new Date().toISOString()))
    if (!allocated.ok) return { ok: false, error: allocated.error }
    const workspace = allocated.workspace
    // A run in its own worktree is keyed by that worktree, so it never collides with a
    // sibling; a fallback run is keyed by the project, restoring the one-at-a-time guard.
    const key = scopedKey(projectKey, workspace.runId)
    const active = activeRuns.get(key)
    if (starting.has(key) || (active !== undefined && isPidAlive(active))) {
      return { ok: false, busy: true, error: 'a session is already active for this project; stop it or wait for it to finish' }
    }
    activeRuns.delete(key)
    starting.add(key)
    try {
      // [Research] (#331) carries an empty prompt fine: its "what" defaults to `this PR`. A
      // `prompt` kind (#353) is a preset the user reviewed in the textarea: run it verbatim,
      // never re-render. `runId` is the id its worktree is named with, so the directory and the
      // run recorded inside it are one string — and tells it the framework owns its branch.
      const child = spawnDetached(
        realBin,
        await writeSessionSpec({
          prompt,
          kind,
          cwd: workspace.cwd,
          ...(workspace.runId ? { runId: workspace.runId } : {}),
          // Reopen the run's log instead of truncating it: the follow-up IS that run.
          ...(continued ? { continueRun: true } : {}),
          options,
        }, env),
        ...(workspace.runId ? [runStderrPath(workspace.cwd)] : []),
      )
      // The run narrates itself through its own `.the-framework/events.jsonl`, which the
      // dashboard streams over a Telefunc Channel; the daemon just tracks liveness.
      const settle = (detail: string): void => {
        activeRuns.delete(key)
        const { cwd: checkout, runId } = workspace
        if (!runId) return
        // The failed marker lands before the teardown reads the meta (#1261), so a boot death is
        // archived as `failed` and the worktree is then kept for inspection, not removed. After
        // teardown the archive is readable, which is when a transient death earns a retry (#1281).
        parkRetirement(
          key,
          markFailedStart(checkout, runId, prompt, detail)
            .catch(() => {})
            .then(() => tearDownWorktree(projectCwd, checkout, runId))
            .then(() => retryTransientDeath(projectCwd, targetProjectId, runId, options))
            .catch(() => {}),
        )
      }
      child.once('error', err => settle(`its process could not be spawned (${errorMessage(err)})`))
      child.once('exit', (code, signal) => settle(exitDetail(code, signal)))
      if (child.pid !== undefined) activeRuns.set(key, child.pid)
      // Hand back the run's id (#761) so the dashboard can select this run rather than guess.
      return { ok: true, ...(workspace.runId ? { runId: workspace.runId } : {}) }
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
   * How many runs are live on a project (#685). Run keys are `<projectKey>::<runId>`, or the
   * bare project key for a run that got no worktree, so both spellings count. The pid is
   * re-checked rather than trusted: `settle` clears the entry on exit, but a run whose exit
   * event never arrived would otherwise keep a project looking busy forever.
   */
  const activeRunCount = (targetProjectId: string): number => {
    let live = 0
    for (const [key, pid] of activeRuns) {
      if (!keyBelongsTo(key, targetProjectId)) continue
      if (isPidAlive(pid)) live++
    }
    return live + [...starting].filter(key => keyBelongsTo(key, targetProjectId)).length
  }

  /**
   * Stop the runs this daemon spawned. Ctrl-C closes everything: the dashboard runs in the
   * foreground, and nothing it started outlives it.
   *
   * A spawned run is detached so it survives the CLI that asked for it, not so it survives the
   * daemon that owns it: left alone it becomes an orphan on `ppid 1`, holding a worktree and a
   * headless browser, with no daemon left that knows about it. So each gets a SIGTERM, which the
   * run already handles by aborting cleanly and group-killing its agent, and a SIGKILL if it will
   * not go. Only runs in `activeRuns` — a run this daemon merely steers is not its to stop.
   *
   * What is stopped here is not lost, it is just not restarted for you: the run keeps its worktree
   * and branch (a run that ends `stopped` is retained, see tearDownWorktree), so the next start
   * continues the same conversation in the same checkout — when you ask for it.
   */
  const stopRuns = async (graceMs = 5000): Promise<number> => {
    const stopping = [...activeRuns.entries()]
    activeRuns.clear()
    let stopped = 0
    for (const [, pid] of stopping) if (await terminate(pid, graceMs)) stopped++
    return stopped
  }

  // The dashboard's events source (#1067): a stream for a run this daemon is relaying from a device,
  // else undefined so `onEvents` tails the on-disk log as usual for an ordinary local run.
  const remoteEventsSource: EventsSource = (_projectId, runId) => relayedRuns.get(runId)

  // Tail a relay-started run's own log (#1067) for the `/_relay/events` endpoint. The relocating
  // tail, for the same reason as the dashboard's onEvents: teardown moves the journal into the
  // archive, and the device's fixed-path tail went silent without the run's final events. The
  // initial attach takes whatever the resolver answers (a non-git fallback run's journal IS the
  // root one); a relocation refuses the root fallback — there it is another run's feed.
  const rootJournal = join(cwd, FRAMEWORK_DIR, EVENTS_FILE)
  const tailRelayEvents = (runId: string, onEvent: (event: FrameworkEvent) => void): (() => void) => {
    let initial = true
    return tailRunEvents<FrameworkEvent>(async () => {
      const next = await resolveRunEventsPath(cwd, runId)
      if (initial) {
        initial = false
        return next
      }
      return next === rootJournal ? undefined : next
    }, onEvent)
  }

  const dispose = async (): Promise<void> => {
    relayedRuns.dispose()
  }

  return {
    onStart,
    onAddProject,
    remoteEventsSource,
    tailRelayEvents,
    remoteRuns,
    onRelayRpc,
    activeRunCount,
    stopRuns,
    dispose,
  }
}
