import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { hostname } from 'node:os'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ClaudeCodeDriver, CodexDriver, checkDriverReady, probeCli, type CliProbe, type Driver, type DriverReadiness } from 'agent-driver'
import { findRun } from '@gemstack/skill-logs'
import { readPersonal, type PersonalSetup } from './config.js'
import { markerCard, writeMarker } from './records.js'
import { resumeRun, runCommand, runIdFrom, type RunOutcome } from './run.js'
import { acquireRunLock, handOverRunLock, isPidAlive, releaseRunLock, runStderrPath } from './run-lock.js'

/**
 * The tool's process side: a run in this process, the same run detached in its own process and
 * answered at once, a resume either way, and whether a run can start here at all. State in files
 * throughout; nothing waits in memory.
 */

/** This package's executable, for the processes it spawns: the bin beside `dist/`. */
const BIN = fileURLToPath(new URL('../bin/agent-runner', import.meta.url))

/** The environment name the tickets skill reads the claiming agent's id from. */
export const AGENT_ID_ENV = 'AGENT_ID'

/** The coding agents a run can be on, by the name the run's record carries. */
export const DRIVER_NAMES = ['claude-code', 'codex'] as const
export type DriverName = (typeof DRIVER_NAMES)[number]

export function isDriverName(name: string): name is DriverName {
  return (DRIVER_NAMES as readonly string[]).includes(name)
}

/**
 * Whether a run on `driver` can start on this machine, asked before it spends a checkout: the
 * coding agent's CLI is installed and logged in (a problem when not: the session would die
 * before its first turn). What a dashboard's check hook runs, and what a person's run and a
 * scheduler's tick refuse on. The git host is not probed: a project with no git host package runs fine, and one
 * whose git host cannot answer says so in the run's own log.
 */
export async function readyToRun(driver: DriverName, deps: { probe?: CliProbe; isRoot?: () => boolean } = {}): Promise<DriverReadiness> {
  const probe = deps.probe ?? probeCli
  return checkDriverReady(driver, { probe, ...(deps.isRoot ? { isRoot: deps.isRoot } : {}) })
}

/** The command line of a spawned run: the model, the coding agent and the follow-up named only when the run has them, so the run's own defaults apply otherwise. */
export function runArgs(run: SpawnedRun): string[] {
  const args = ['run', run.prompt, '--id', run.id]
  if (run.model !== undefined) args.push('--model', run.model)
  if (run.driver !== undefined) args.push('--driver', run.driver)
  if (run.then !== undefined) args.push('--then', run.then)
  return args
}

/** A run spawned in its own process, its marker already on the branch. */
export interface SpawnedRun {
  id: string
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
 * The run's process, detached from whoever started it: `agent-runner run <prompt> --id <id>`, its
 * stderr kept. The run's lock is taken here before the process exists and handed to it once it
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

/** A resumed run's process, detached the same way: `agent-runner run --resume <id> …`. */
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
 * A run started the way a scheduler starts one, and answered at once: the marker written on the
 * branch, the run's process spawned detached, the id returned. What a dashboard's start hook
 * runs: it needs the id back now, not when the agent ends.
 */
export async function detachRun(
  repo: string,
  opts: { prompt: string; model?: string; driver?: DriverName; then?: string; now?: () => Date; log?: (line: string) => void },
  deps: { spawn?: typeof spawnRun; host?: string } = {},
): Promise<{ id: string; driver: DriverName; model?: string }> {
  const now = opts.now ?? (() => new Date())
  const id = runIdFrom(now().toISOString())
  const driver = opts.driver ?? 'claude-code'
  const model = opts.model
  // The lock before the marker: a scheduler's sweep that reads the marker in the moment before
  // the run's process has its checkout sees the run held, not gone.
  await acquireRunLock(repo, id, { pid: process.pid, isAlive: isPidAlive })
  try {
    const then = opts.then !== undefined ? { then: opts.then } : {}
    const marked = await writeMarker(repo, markerCard({ id, startedAt: now().toISOString(), prompt: opts.prompt, driver, ...(model !== undefined ? { model } : {}), mark: { host: deps.host ?? hostname(), ...then } }))
    if (!marked.ok && !marked.committed) opts.log?.(`[agent-runner] the run's record could not be written: ${marked.error}`)
    await (deps.spawn ?? spawnRun)(repo, { id, prompt: opts.prompt, driver, ...(model !== undefined ? { model } : {}), ...then })
  } catch (err) {
    await releaseRunLock(repo, id, process.pid)
    throw err
  }
  return { id, driver, ...(model !== undefined ? { model } : {}) }
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
 * A run of the real project, in this process, on the coding agent named (Claude Code when none is). A
 * scheduler's run comes with its id and its marker already on the branch; a person's run mints its
 * id here and marks itself. A follow-up it names runs on the same coding agent. The model is the
 * one given; none given, the coding agent starts on its own default.
 */
export async function runProject(repo: string, opts: { prompt: string; id?: string; model?: string; driver?: DriverName; then?: string; log?: (line: string) => void }): Promise<RunOutcome> {
  const id = opts.id ?? runIdFrom(new Date().toISOString())
  const driver = opts.driver ?? 'claude-code'
  const setup = await readPersonal(repo, opts.log ?? (() => {}))
  return runCommand(repo, {
    prompt: opts.prompt,
    id,
    marked: opts.id !== undefined,
    ...(opts.model !== undefined ? { model: opts.model } : {}),
    driver: driverFor(driver, id, setup),
    ...(opts.then !== undefined ? { then: opts.then, nextDriver: (next: string) => driverFor(driver, next, setup) } : {}),
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
  if (!isDriverName(recorded)) throw new Error(`run ${opts.id} is on ${recorded}, which agent-runner cannot start`)
  const setup = await readPersonal(repo, opts.log ?? (() => {}))
  return resumeRun(repo, {
    id: opts.id,
    ...(opts.text !== undefined ? { text: opts.text } : {}),
    ...(opts.answer !== undefined ? { answer: opts.answer } : {}),
    ...(opts.model !== undefined ? { model: opts.model } : {}),
    driver: (deps.driverFor ?? driverFor)(recorded, opts.id, setup),
    nextDriver: next => (deps.driverFor ?? driverFor)(recorded, next, setup),
    ...(opts.log ? { log: opts.log } : {}),
  })
}

/**
 * The coding agent a run is on, unrestricted either way: Claude Code with permissions bypassed, Codex
 * with full access. The run's agent pushes its branch and opens its pull request itself, which
 * Codex's default sandbox (the workspace only) does not allow. The run's id is in the agent's
 * environment, so the claim it makes names the run (the tickets skill reads `AGENT_ID`).
 *
 * Claude Code starts without the person's own setup, so a run does the same job on every machine,
 * each part loaded only when this machine's config turns it on (`personal:` in `config.ts`):
 * `memory` (auto-memory), `connectors` (claude.ai connectors), `skills` (user settings, which carry
 * the skills synced from the claude.ai account, with `~/.claude/CLAUDE.md` and `~/.claude/skills`).
 * The project's own instructions, skills and settings always load. Codex is started as it is.
 */
export function driverFor(name: DriverName, id: string, setup: PersonalSetup): Driver {
  const env: NodeJS.ProcessEnv = { ...process.env, [AGENT_ID_ENV]: id }
  switch (name) {
    case 'claude-code': {
      if (!setup.memory) env['CLAUDE_CODE_DISABLE_AUTO_MEMORY'] = '1'
      if (!setup.connectors) env['ENABLE_CLAUDEAI_MCP_SERVERS'] = 'false'
      return new ClaudeCodeDriver({ permissionMode: 'bypassPermissions', env, ...(setup.skills ? {} : { extraArgs: ['--setting-sources', 'project,local'] }) })
    }
    case 'codex':
      return new CodexDriver({ sandbox: 'danger-full-access', env })
  }
}
