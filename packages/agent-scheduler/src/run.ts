import { hostname } from 'node:os'
import type { Driver, DriverEvent } from 'agent-driver'
import { nodeGitRunner, type GitRunner } from '@gemstack/agent-data'
import { agentBranchName, createCheckout, reclaimWorktree, worktreeBranch } from '@gemstack/skill-branches'
import type { LogsDeps, RunStatus } from '@gemstack/skill-logs'
import { LiveLog, toCard, type LiveEvent } from './live-log.js'
import { markerCard, recordRun, writeMarker, type SchedulerMark } from './records.js'
import { prOfBranch, type GhRunner } from './pr.js'

/**
 * One run (#1774): a checkout from the branches package, a session from agent-driver, the prompt
 * once, and the agent's own loop to the end. No system prompt, no gates, no steering: the
 * command's skill file is the whole instruction, and the agent publishes its own work through
 * the skills in its checkout. This process records the run and reclaims the checkout when the
 * agent stops; a run that dies is caught by the sweep on a later tick.
 *
 * One-shot: `agent-scheduler run <prompt>` needs no scheduler running. The tick spawns the same
 * thing with the marker already written and the id chosen.
 */

/** Filesystem-safe, time-ordered id from an ISO start: the shape the dashboard sorts runs by. */
export function runIdFrom(startedAt: string): string {
  return startedAt.replace(/[:.]/g, '-')
}

export interface RunOptions {
  /** What the agent is told, usually a slash command. */
  prompt: string
  /** The run's id; minted from the start time when absent. */
  id?: string
  /** Whether the run's marker is already on the branch: the tick writes it before it spawns. A person's run marks itself. */
  marked?: boolean
  /** The command the run is for, as the schedule names it; the prompt's own name when absent. */
  command?: string
  model: string
  driver: Driver
  host?: string
  pid?: number
  now?: () => Date
  git?: GitRunner
  gh?: GhRunner
  logs?: LogsDeps
  log?: (line: string) => void
}

export interface RunOutcome {
  id: string
  status: Exclude<RunStatus, 'running'>
  branch?: string
  pr?: { number: number; url: string }
  cost?: number
  /** Whether the checkout went once the remote had its branch, or stayed and why. */
  checkout: { reclaimed: true } | { reclaimed: false; reason: string }
  detail?: string
}

export async function runCommand(repo: string, opts: RunOptions): Promise<RunOutcome> {
  const git = opts.git ?? nodeGitRunner()
  const now = opts.now ?? (() => new Date())
  const clock = () => now().toISOString()
  const host = opts.host ?? hostname()
  const pid = opts.pid ?? process.pid
  const startedAt = clock()
  const id = opts.id ?? runIdFrom(startedAt)
  const command = opts.command ?? opts.prompt.replace(/^\//, '').split(/\s+/)[0] ?? opts.prompt
  const mark: SchedulerMark = { command, host, pid }
  const log = opts.log ?? (() => {})
  const logs = opts.logs ?? {}

  // A person's run marks itself; the tick's run was marked before it was spawned.
  if (!opts.marked) {
    const marked = await writeMarker(repo, markerCard({ id, startedAt, prompt: opts.prompt, driver: opts.driver.id, model: opts.model, mark }), logs)
    if (!marked.ok && !marked.committed) log(`[agent-scheduler] the run's record could not be written: ${marked.error}`)
  }

  // The checkout: the branches package's one sequence. Without one there is no run, and the
  // record says so instead of a marker left running.
  let checkout: { path: string; branch: string }
  try {
    checkout = await createCheckout(repo, { agentId: id }, git)
  } catch (err) {
    const detail = `could not create a checkout: ${errorMessage(err)}`
    await recordRun(repo, { ...markerCard({ id, startedAt, prompt: opts.prompt, driver: opts.driver.id, model: opts.model, mark }), status: 'failed', endedAt: clock() }, [{ kind: 'ended', status: 'failed', detail }], logs)
    return { id, status: 'failed', checkout: { reclaimed: false, reason: 'no checkout' }, detail }
  }

  const live = await LiveLog.open(checkout.path, {
    status: 'running',
    id,
    startedAt,
    updatedAt: startedAt,
    pid,
    host,
    intent: opts.prompt,
    kind: 'prompt',
    scheduler: mark,
  }, clock)
  await live.append({ kind: 'session', driver: opts.driver.id, workspace: checkout.path, fake: opts.driver.id === 'fake', model: opts.model })
  await live.append({ kind: 'intent', text: opts.prompt })
  await live.append({ kind: 'branch', branch: checkout.branch })

  // The session, and the agent's own loop to the end. Usage is summed across turns for the
  // dashboard's spend readout; the session id is the agent's `claude --resume` handle.
  let turns = 0
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }
  const onEvent = (event: DriverEvent): void => {
    void live.append({ kind: 'driver', event })
    if (event.type === 'session') void live.append({ kind: 'session-update', sessionId: event.sessionId })
    if (event.type === 'result') {
      if (event.sessionId) void live.append({ kind: 'session-update', sessionId: event.sessionId })
      if (event.usage) {
        turns++
        usage.inputTokens += event.usage.inputTokens
        usage.outputTokens += event.usage.outputTokens
        usage.cacheReadTokens += event.usage.cacheReadTokens
        usage.cacheCreationTokens += event.usage.cacheCreationTokens
        void live.append({ kind: 'usage', ...(event.usage.costUsd !== undefined ? { costUsd: event.usage.costUsd } : {}), ...usage, turns })
      }
    }
  }
  let status: Exclude<RunStatus, 'running'> = 'done'
  let detail: string | undefined
  try {
    const session = await opts.driver.start({ cwd: checkout.path, model: opts.model, onEvent })
    try {
      await session.prompt(opts.prompt)
    } finally {
      await session.dispose().catch(() => {})
    }
  } catch (err) {
    status = 'failed'
    detail = errorMessage(err)
  }

  // Where the work ended up: the agent renames its branch itself, and the pull request it opened,
  // if any, is read back off the branch.
  const branch = (await worktreeBranch(checkout.path, git).catch(() => undefined)) ?? checkout.branch
  if (branch !== live.meta.branch) await live.append({ kind: 'branch', branch })
  const pr = await prOfBranch(repo, branch, opts.gh)
  const end: LiveEvent = { kind: 'end', ok: status === 'done', ...(detail !== undefined ? { detail } : {}) }
  await live.append(end)

  const recorded = await recordRun(repo, toCard(live.meta, pr), live.diary(), logs)
  if (!recorded.ok && !recorded.committed) log(`[agent-scheduler] the run's record could not be written: ${recorded.error}`)

  // The checkout goes once the remote has everything it holds (the branches rule); a dirty tree
  // or a branch that could not be pushed keeps it, and the sweep tries again on a later tick.
  const reclaimed = await reclaimWorktree(repo, checkout.path, { mayPush: true, birthBranch: agentBranchName(id), git })
  const outcome: RunOutcome = {
    id,
    status,
    branch,
    ...(pr ? { pr } : {}),
    ...(live.meta.cost !== undefined ? { cost: live.meta.cost } : {}),
    checkout: reclaimed.ok ? { reclaimed: true } : { reclaimed: false, reason: reclaimReason(reclaimed) },
    ...(detail !== undefined ? { detail } : {}),
  }
  return outcome
}

function reclaimReason(outcome: { ok: false; reason: string; detail?: string }): string {
  return outcome.detail ? `${outcome.reason}: ${outcome.detail}` : outcome.reason
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
