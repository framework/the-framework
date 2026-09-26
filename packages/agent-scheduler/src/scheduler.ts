import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readClaudeQuota } from '@agent-driver/claude'
import { isPidAlive, markerCard, readyToRun, runIdFrom, spawnRun, sweep, withdrawMarker, writeMarker } from 'agent-runner'
import { DATA_BRANCH, nodeGitRunner, pullFileBranch, type GitRunner } from '@gemstack/agent-data'
import { CHECK_TIMEOUT_MS, SCHEDULER_LOG, TICK_MS } from './names.js'
import { inFlight, lastStart } from './records.js'
import { readSchedule } from './schedule.js'
import { readState, stateDir, updateState, withoutPid, type State, type TickRecord } from './state.js'
import { projectHasCommand, runCheck, tick } from './tick.js'

/**
 * The tool's process side (#1774): a tick wired to the real project, and the scheduler's own small
 * process that ticks every minute between `start` and `stop`. A due command is a run of
 * `agent-runner`, spawned in its own process. State in files throughout; the process holds nothing
 * a restart would lose.
 */

/** This package's executable, for the scheduler's own process: the bin beside `dist/`. */
const BIN = fileURLToPath(new URL('../bin/agent-scheduler', import.meta.url))

/** One tick of the real project, and the state written with what it decided. */
export async function tickProject(repo: string, opts: { git?: GitRunner; log?: (line: string) => void; now?: () => Date; stopped?: () => boolean } = {}): Promise<TickRecord> {
  const git = opts.git ?? nodeGitRunner()
  const log = opts.log ?? (() => {})
  const now = opts.now ?? (() => new Date())
  const host = hostname()
  const state = await readState(repo)
  const schedule = await readSchedule(repo)
  const record = await tick({
    state,
    schedule,
    host,
    now,
    pull: () => pullFileBranch(repo, DATA_BRANCH, { git, log }),
    sweep: () => sweep(repo, { host, isAlive: isPidAlive, now, git, log }),
    hasCommand: name => projectHasCommand(repo, name),
    check: shell => runCheck(repo, shell, CHECK_TIMEOUT_MS),
    lastStart: command => lastStart(repo, command, schedule),
    inFlight: command => inFlight(repo, command, schedule),
    ready: () => readyToRun(repo, 'claude-code'),
    quota: () => readClaudeQuota({ cwd: repo }),
    mint: () => runIdFrom(now().toISOString()),
    writeMarker: card => writeMarker(repo, card),
    withdrawMarker: id => withdrawMarker(repo, id),
    spawn: run => spawnRun(repo, run),
    driver: 'claude-code',
    ...(opts.stopped ? { stopped: opts.stopped } : {}),
    log,
  })
  await updateState(repo, s => ({ ...s, lastTick: record }), git)
  for (const line of describe(record)) log(line)
  return record
}

/** `start`: the state on, and the scheduler's own process ticking until `stop`, unless this process is it. */
export async function startScheduler(repo: string, opts: { foreground?: boolean; everyMs?: number; keepAlive?: boolean; log?: (line: string) => void } = {}): Promise<State> {
  const state = await updateState(repo, s => ({ ...s, on: true, ...(opts.keepAlive !== undefined ? { keepAlive: opts.keepAlive } : {}) }))
  if (state.pid !== undefined && isPidAlive(state.pid) && state.pid !== process.pid) return state
  if (opts.foreground) {
    await loop(repo, opts.everyMs ?? TICK_MS, opts.log ?? (() => {}))
    return readState(repo)
  }
  const logPath = join(stateDir(repo), SCHEDULER_LOG)
  mkdirSync(stateDir(repo), { recursive: true })
  const fd = openSync(logPath, 'a')
  const child = spawn(process.execPath, [BIN, 'start', '--foreground'], { cwd: repo, detached: true, stdio: ['ignore', fd, fd] })
  closeSync(fd)
  child.unref()
  await new Promise<void>((resolve, reject) => {
    child.once('spawn', resolve)
    child.once('error', reject)
  })
  return updateState(repo, s => ({ ...s, pid: child.pid!, startedAt: new Date().toISOString() }))
}

/**
 * The scheduler's process: a tick now and every interval, until SIGINT or SIGTERM. The stop waits
 * for the tick in flight, which starts nothing more once the stop is in; and it clears only this
 * process's pid from the state: a dashboard's close hook stops this scheduler and its open hook
 * starts the next one before this tick is over, and that one's pid must stay.
 */
async function loop(repo: string, everyMs: number, log: (line: string) => void): Promise<void> {
  await updateState(repo, s => ({ ...s, pid: process.pid, startedAt: new Date().toISOString() }))
  let stopped = false
  let inflight: Promise<unknown> = Promise.resolve()
  const once = (): void => {
    inflight = inflight.then(() => tickProject(repo, { log, stopped: () => stopped })).catch(err => log(`[agent-scheduler] tick failed: ${err instanceof Error ? err.message : String(err)}`))
  }
  const timer = setInterval(once, everyMs)
  once()
  await new Promise<void>(resolve => {
    const stop = (): void => {
      if (stopped) return
      stopped = true
      clearInterval(timer)
      resolve()
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  })
  await inflight
  await updateState(repo, s => withoutPid(s, process.pid))
}

/**
 * `stop`: the state off, and the scheduler's process asked to stop. Agents in flight run to the end.
 * With `unlessKeepAlive`, a keep-alive scheduler is left as it is and the answer says `kept`: the
 * one reader of keep-alive, meant for the line a dashboard runs when it closes.
 */
export async function stopScheduler(repo: string, opts: { unlessKeepAlive?: boolean } = {}): Promise<State & { kept: boolean }> {
  const state = await readState(repo)
  if (opts.unlessKeepAlive && state.keepAlive) return { ...state, kept: true }
  if (state.pid !== undefined && isPidAlive(state.pid)) {
    try {
      process.kill(state.pid, 'SIGINT')
    } catch {
      // Gone between the probe and the signal.
    }
  }
  const stopped = await updateState(repo, s => {
    const { pid: _pid, startedAt: _startedAt, ...rest } = s
    return { ...rest, on: false }
  })
  return { ...stopped, kept: false }
}

/** `status`: the state, and whether its process is alive. */
export async function schedulerStatus(repo: string): Promise<State & { running: boolean }> {
  const state = await readState(repo)
  return { ...state, running: state.pid !== undefined && isPidAlive(state.pid) }
}

function describe(record: TickRecord): string[] {
  const lines = [`[agent-scheduler] tick ${record.at}${record.note ? `: ${record.note}` : ''}`]
  for (const d of record.decisions) lines.push(`[agent-scheduler]   ${d.command}: ${d.outcome}`)
  return lines
}
