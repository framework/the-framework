import { parseArgs } from 'node:util'
import { nodeGitRunner, type GitRunner } from '@gemstack/agent-data'
import { projectRoot } from '@gemstack/skill-branches'
import { schedulerStatus, startScheduler, stopScheduler, tickProject } from './scheduler.js'
import { initHooks } from './init.js'
import { updateState, withSwitch } from './state.js'
import { readSchedule } from './schedule.js'

/**
 * The command line: JSON on stdout, one line for a person on stderr, and the exit code says how
 * it went — 0 for a result, 1 for a refusal or a failure, 2 for a command that could not be read.
 * The same contract as the skills' commands, so a person and a dashboard read it the same way.
 */

export const USAGE = `usage: agent-scheduler <command>

  tick                          pull agent-data, sweep, read agent-schedule.md, start what is due, each a run of agent-runner
  init                          this tool's lines in the dashboard's .the-framework/hooks.yml, so it runs while the dashboard is open; a line already there is kept
  start [--keep-alive]          the scheduler on, ticking every minute in its own process
  stop [--unless-keep-alive]    the scheduler off; runs in flight go to the end; with the flag a keep-alive scheduler is left running
  status                        the state file, and whether the scheduler's process is alive
  model <id>                    the model every scheduled run starts on (this user)
  offset <points>               how far past the spend boundary a run may still start (this user)
  switch <command> <on|off>     whether a command of agent-schedule.md runs on this machine, the command as its line names it (quoted when it has a word after it); what a dashboard's switch hook runs

JSON on stdout. Exit code 1 for a refusal or a failure (the reason on stderr), 2 for a usage error.`

export interface CliIo {
  cwd: string
  stdout: (line: string) => void
  stderr: (line: string) => void
}

export type CliRefusal = { ok: false; reason: string; [key: string]: unknown }

class Refused extends Error {
  constructor(readonly outcome: CliRefusal, readonly line: string) {
    super(line)
  }
}

class Usage extends Error {}

export async function runCli(argv: string[], io: CliIo, git: GitRunner = nodeGitRunner()): Promise<number> {
  const [command, ...rest] = argv
  const run = command && Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined
  if (!run) {
    io.stderr(USAGE)
    return 2
  }
  try {
    const result = await run(rest, io, git)
    io.stdout(JSON.stringify(result))
    return 0
  } catch (err) {
    if (err instanceof Usage) {
      io.stderr(`${err.message}\n\n${USAGE}`)
      return 2
    }
    if (err instanceof Refused) {
      io.stdout(JSON.stringify(err.outcome))
      io.stderr(err.line)
      return 1
    }
    const detail = err instanceof Error ? err.message : String(err)
    io.stdout(JSON.stringify({ ok: false, reason: 'failed', detail }))
    io.stderr(detail)
    return 1
  }
}

type Command = (args: string[], io: CliIo, git: GitRunner) => Promise<unknown>

const COMMANDS: Record<string, Command> = {
  async tick(args, io, git) {
    parse(args, {}, 0)
    const repo = await project(io.cwd, git)
    const record = await tickProject(repo, { git, log: io.stderr })
    return { ok: true, ...record }
  },

  async init(args, io, git) {
    parse(args, {}, 0)
    const repo = await project(io.cwd, git)
    const outcome = await initHooks(repo)
    if (outcome.ok) return outcome
    const line = outcome.reason === 'no-dashboard' ? 'no .the-framework/ here: add the project in the dashboard first' : `${outcome.file}: ${outcome.detail ?? 'unreadable'}`
    throw new Refused(outcome, line)
  },

  async start(args, io, git) {
    const { values } = parse(args, { foreground: { type: 'boolean' }, 'keep-alive': { type: 'boolean' } }, 0)
    const repo = await project(io.cwd, git)
    const state = await startScheduler(repo, {
      ...(values.foreground ? { foreground: true } : {}),
      ...(values['keep-alive'] ? { keepAlive: true } : {}),
      log: io.stderr,
    })
    return { ok: true, ...state }
  },

  async stop(args, io, git) {
    const { values } = parse(args, { 'unless-keep-alive': { type: 'boolean' } }, 0)
    const repo = await project(io.cwd, git)
    const state = await stopScheduler(repo, { ...(values['unless-keep-alive'] ? { unlessKeepAlive: true } : {}) })
    if (state.kept) io.stderr('keep-alive is on, the scheduler keeps running')
    return { ok: true, ...state }
  },

  async status(args, io, git) {
    parse(args, {}, 0)
    const repo = await project(io.cwd, git)
    return { ok: true, ...(await schedulerStatus(repo)) }
  },

  async model(args, io, git) {
    const { positionals } = parse(args, {}, 1)
    const repo = await project(io.cwd, git)
    return { ok: true, ...(await updateState(repo, s => ({ ...s, model: positionals[0]! }), git)) }
  },

  async offset(args, io, git) {
    const { positionals } = parse(args, {}, 1)
    const points = Number(positionals[0])
    if (!Number.isFinite(points)) throw new Usage(`${positionals[0]} is not a number of percentage points`)
    const repo = await project(io.cwd, git)
    return { ok: true, ...(await updateState(repo, s => ({ ...s, spendOffset: points }), git)) }
  },

  async switch(args, io, git) {
    const { positionals } = parse(args, {}, 2)
    const [name, to] = positionals as [string, string]
    if (to !== 'on' && to !== 'off') throw new Usage(`${to} is neither on nor off`)
    const repo = await project(io.cwd, git)
    const schedule = await readSchedule(repo)
    if (!schedule) throw new Refused({ ok: false, reason: 'no-schedule' }, 'no agent-schedule.md in this repository')
    const command = schedule.commands.find(c => c.name === name)
    if (!command) throw new Refused({ ok: false, reason: 'not-scheduled', command: name }, `agent-schedule.md has no line for ${name}`)
    return { ok: true, ...(await updateState(repo, s => withSwitch(s, name, to === 'on', command.on), git)) }
  },
}

/** The project the working directory belongs to, even from inside a checkout under `.branches/`. */
async function project(cwd: string, git: GitRunner): Promise<string> {
  try {
    return await projectRoot(cwd, git)
  } catch (err) {
    if (!/not a git repository/i.test(err instanceof Error ? err.message : String(err))) throw err
    throw new Refused({ ok: false, reason: 'not-a-repo' }, 'not inside a git repository')
  }
}

type Options = Record<string, { type: 'string' | 'boolean' }>

function parse<O extends Options>(args: string[], options: O, min: number, max: number = min) {
  try {
    const parsed = parseArgs({ args, options, allowPositionals: true, strict: true })
    if (parsed.positionals.length < min || parsed.positionals.length > max) {
      throw new Usage(`expected ${max === min ? min : `${min} to ${max}`} argument(s), got ${parsed.positionals.length}`)
    }
    return parsed
  } catch (err) {
    throw err instanceof Usage ? err : new Usage(err instanceof Error ? err.message : String(err))
  }
}

