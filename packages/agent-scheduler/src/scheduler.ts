import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { hostname } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ClaudeCodeDriver, CodexDriver, checkDriverReady, probeCli, readClaudeQuota, type CliProbe, type Driver, type DriverReadiness } from 'agent-driver'
import { findRun } from '@gemstack/skill-logs'
import { DATA_BRANCH, nodeGitRunner, pullFileBranch, type GitRunner } from '@gemstack/agent-data'
import { CHECK_TIMEOUT_MS, SCHEDULER_LOG, TICK_MS } from './names.js'
import { inFlight, lastStart, markerCard, withdrawMarker, writeMarker } from './records.js'
import { resumeRun, runCommand, runIdFrom, type RunOutcome } from './run.js'
import { promptCommand, readSchedule } from './schedule.js'
import { readState, runStderrPath, stateDir, updateState, withoutPid, type State, type TickRecord } from './state.js'
import { sweep } from './sweep.js'
import { acquireRunLock, handOverRunLock, isPidAlive, releaseRunLock } from './run-lock.js'
import { projectHasCommand, runCheck, tick } from './tick.js'

/**
 * The tool's process side (#1774): a tick wired to the real project, the detached run, and the
 * scheduler's own small process that ticks every minute between `start` and `stop`. State in
 * files throughout; the process holds nothing a restart would lose.
 */

/** This package's executable, for the processes it spawns: the bin beside `dist/`. */
const BIN = fileURLToPath(new URL('../bin/agent-scheduler', import.meta.url))

/** The environment name the tickets skill reads the claiming agent's id from. */
export const AGENT_ID_ENV = 'AGENT_ID'

/** The coding agents a run can be on, by the name the run's record carries. */
export const DRIVER_NAMES = ['claude-code', 'codex'] as const
export type DriverName = (typeof DRIVER_NAMES)[number]

export function isDriverName(name: string): name is DriverName {
  return (DRIVER_NAMES as readonly string[]).includes(name)
}

/** One tick of the real project, and the state written with what it decided. */
export async function tickProject(repo: string, opts: { git?: GitRunner; log?: (line: string) => void; now?: () => Date; stopped?: () => boolean } = {}): Promise<TickRecord> {
  const git = opts.git ?? nodeGitRunner()
  const log = opts.log ?? (() => {})
  const now = opts.now ?? (() => new Date())
  const host = hostname()
  const state = await readState(repo)
  const record = await tick({
    state,
    schedule: await readSchedule(repo),
    host,
    now,
    pull: () => pullFileBranch(repo, DATA_BRANCH, { git, log }),
    sweep: () => sweep(repo, { host, isAlive: isPidAlive, now, git, log }),
    hasCommand: name => projectHasCommand(repo, name),
    check: shell => runCheck(repo, shell, CHECK_TIMEOUT_MS),
    lastStart: command => lastStart(repo, command),
    inFlight: command => inFlight(repo, command),
    ready: () => readyToRun('claude-code'),
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

/**
 * Whether a run on `driver` can start on this machine, asked before it spends a checkout: the
 * coding agent's CLI is installed and logged in (a problem when not: the session would die
 * before its first turn). What a dashboard's check hook runs, and what a person's run and the
 * tick refuse on. The git host is not probed: a project with no git host package runs fine, and one
 * whose git host cannot answer says so in the run's own log.
 */
export async function readyToRun(driver: DriverName, deps: { probe?: CliProbe; isRoot?: () => boolean } = {}): Promise<DriverReadiness> {
  const probe = deps.probe ?? probeCli
  return checkDriverReady(driver, { probe, ...(deps.isRoot ? { isRoot: deps.isRoot } : {}) })
}

/** The command line of a spawned run: the model, the coding agent and the follow-up named only when the run has them, so the run's own defaults apply otherwise. */
export function runArgs(run: SpawnedRun): string[] {
  const args = ['run', run.prompt, '--id', run.id, '--command', run.command]
  if (run.model !== undefined) args.push('--model', run.model)
  if (run.driver !== undefined) args.push('--driver', run.driver)
  if (run.then !== undefined) args.push('--then', run.then)
  return args
}

/** A run the tick or a detached start spawns in its own process. */
export interface SpawnedRun {
  id: string
  command: string
  prompt: string
  model?: string
  driver?: DriverName
  /** The follow-up's prompt (`run --then`); a person's start only. */
  then?: string
}

/** The command line of a spawned resume: the text as the argument, or the answer. */
export function resumeArgs(run: { id: string; text?: string; answer?: string; model?: string }): string[] {
  const args = ['run', '--resume', run.id]
  if (run.text !== undefined) args.push(run.text)
  if (run.answer !== undefined) args.push('--answer', run.answer)
  if (run.model !== undefined) args.push('--model', run.model)
  return args
}

/**
 * The run's process, detached from the tick that started it: `agent-scheduler run <prompt> --id <id>`,
 * its stderr kept. The run's lock is taken here before the process exists and handed to it once it
 * does, so the sweep never finds the run with neither a lock nor a checkout while it boots.
 */
export async function spawnRun(repo: string, run: SpawnedRun): Promise<void> {
  await acquireRunLock(repo, run.id, { pid: process.pid, isAlive: isPidAlive })
  try {
    const child = await spawnDetached(repo, run.id, runArgs(run))
    await handOverRunLock(repo, run.id, process.pid, child)
  } catch (err) {
    await releaseRunLock(repo, run.id, process.pid)
    throw err
  }
}

/** A resumed run's process, detached the same way: `agent-scheduler run --resume <id> …`. */
export async function spawnResume(repo: string, run: { id: string; text?: string; answer?: string; model?: string }): Promise<void> {
  await spawnDetached(repo, run.id, resumeArgs(run))
}

/** Spawn a detached process of this tool for the run `id`; resolves with its pid once it is spawned. */
async function spawnDetached(repo: string, id: string, args: string[]): Promise<number> {
  const stderrPath = runStderrPath(repo, id)
  mkdirSync(dirname(stderrPath), { recursive: true })
  const fd = openSync(stderrPath, 'a')
  const child = spawn(process.execPath, [BIN, ...args], {
    cwd: repo,
    detached: true,
    stdio: ['ignore', 'ignore', fd],
    env: { ...process.env, [AGENT_ID_ENV]: id },
  })
  closeSync(fd)
  child.unref()
  await new Promise<void>((resolve, reject) => {
    child.once('spawn', resolve)
    child.once('error', reject)
  })
  return child.pid!
}

/**
 * A run started the way the tick starts one, and answered at once: the marker written on the
 * branch, the run's process spawned detached, the id returned. What a dashboard's start hook
 * runs: it needs the id back now, not when the agent ends. The command is the schedule line the
 * prompt names, else the prompt's first word without its slash, so the run counts against that
 * command's cap and interval like a scheduled one.
 */
export async function detachRun(
  repo: string,
  opts: { prompt: string; model?: string; driver?: DriverName; then?: string; now?: () => Date; log?: (line: string) => void },
  deps: { spawn?: typeof spawnRun; host?: string } = {},
): Promise<{ id: string; command: string; driver: DriverName; model?: string }> {
  const now = opts.now ?? (() => new Date())
  const id = runIdFrom(now().toISOString())
  const command = promptCommand(opts.prompt, await readSchedule(repo))
  const driver = opts.driver ?? 'claude-code'
  const model = await modelFor(repo, driver, opts.model)
  // The lock before the marker: a scheduler's sweep that reads the marker in the moment before
  // the run's process has its checkout sees the run held, not gone.
  await acquireRunLock(repo, id, { pid: process.pid, isAlive: isPidAlive })
  try {
    const then = opts.then !== undefined ? { then: opts.then } : {}
    const marked = await writeMarker(repo, markerCard({ id, startedAt: now().toISOString(), prompt: opts.prompt, driver, ...(model !== undefined ? { model } : {}), mark: { command, host: deps.host ?? hostname(), ...then } }))
    if (!marked.ok && !marked.committed) opts.log?.(`[agent-scheduler] the run's record could not be written: ${marked.error}`)
    await (deps.spawn ?? spawnRun)(repo, { id, command, prompt: opts.prompt, driver, ...(model !== undefined ? { model } : {}), ...then })
  } catch (err) {
    await releaseRunLock(repo, id, process.pid)
    throw err
  }
  return { id, command, driver, ...(model !== undefined ? { model } : {}) }
}

/**
 * An ended run continued in its own process, and answered at once: what a dashboard's resume
 * hook runs. A run this project has no record of is refused here, while someone is still
 * listening; everything after is the resumed run's own record.
 */
export async function detachResume(
  repo: string,
  opts: { id: string; text?: string; answer?: string; model?: string },
  deps: { spawn?: typeof spawnResume } = {},
): Promise<{ id: string }> {
  if (!(await findRun(repo, opts.id))) throw new Error(`no run ${opts.id} in this project`)
  await (deps.spawn ?? spawnResume)(repo, opts)
  return { id: opts.id }
}

/**
 * A run of the real project, in this process, on the coding agent named (Claude Code when none is). The
 * tick's run comes with its id and its marker already on the branch; a person's run mints its
 * id here and marks itself. A follow-up it names runs on the same coding agent.
 */
export async function runProject(repo: string, opts: { prompt: string; id?: string; command?: string; model?: string; driver?: DriverName; then?: string; log?: (line: string) => void }): Promise<RunOutcome> {
  const id = opts.id ?? runIdFrom(new Date().toISOString())
  const driver = opts.driver ?? 'claude-code'
  const model = await modelFor(repo, driver, opts.model)
  return runCommand(repo, {
    prompt: opts.prompt,
    id,
    marked: opts.id !== undefined,
    ...(opts.command !== undefined ? { command: opts.command } : {}),
    ...(model !== undefined ? { model } : {}),
    driver: driverFor(driver, id),
    ...(opts.then !== undefined ? { then: opts.then, nextDriver: (next: string) => driverFor(driver, next) } : {}),
    ...(opts.log ? { log: opts.log } : {}),
  })
}

/**
 * Continue an ended run of the real project, in this process: the user's text, or the answer to
 * the question it ended on. The coding agent is the one the run's record names: the session
 * to resume is its own.
 */
export async function resumeProject(
  repo: string,
  opts: { id: string; text?: string; answer?: string; model?: string; log?: (line: string) => void },
  deps: { driverFor?: typeof driverFor } = {},
): Promise<RunOutcome> {
  const card = await findRun(repo, opts.id)
  const recorded = card?.driver ?? 'claude-code'
  if (!isDriverName(recorded)) throw new Error(`run ${opts.id} is on ${recorded}, which agent-scheduler cannot start`)
  return resumeRun(repo, {
    id: opts.id,
    ...(opts.text !== undefined ? { text: opts.text } : {}),
    ...(opts.answer !== undefined ? { answer: opts.answer } : {}),
    ...(opts.model !== undefined ? { model: opts.model } : {}),
    driver: (deps.driverFor ?? driverFor)(recorded, opts.id),
    nextDriver: next => (deps.driverFor ?? driverFor)(recorded, next),
    ...(opts.log ? { log: opts.log } : {}),
  })
}

/**
 * The coding agent a run is on, unrestricted either way: Claude Code with permissions bypassed, Codex
 * with full access. The run's agent pushes its branch and opens its pull request itself, which
 * Codex's default sandbox (the workspace only) does not allow. The run's id is in the agent's
 * environment, so the claim it makes names the run (the tickets skill reads `AGENT_ID`).
 */
export function driverFor(name: DriverName, id: string): Driver {
  const env = { ...process.env, [AGENT_ID_ENV]: id }
  switch (name) {
    case 'claude-code':
      return new ClaudeCodeDriver({ permissionMode: 'bypassPermissions', env })
    case 'codex':
      return new CodexDriver({ sandbox: 'danger-full-access', env })
  }
}

/**
 * The model a run starts on: the one given; else, on Claude Code, the one this user's state
 * names. The state's model is a Claude model, so a Codex run with none given names none and
 * Codex starts on its own default.
 */
async function modelFor(repo: string, driver: DriverName, given: string | undefined): Promise<string | undefined> {
  if (given !== undefined) return given
  return driver === 'claude-code' ? (await readState(repo)).model : undefined
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
