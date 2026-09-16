import { parseArgs } from 'node:util'
import { checkoutRoot, nodeGitRunner, type GitRunner } from '@gemstack/agent-data'
import { projectRoot } from '@gemstack/skill-branches'
import { runProject, schedulerStatus, startScheduler, stopScheduler, tickProject } from './scheduler.js'
import { updateState } from './state.js'

/**
 * The command line: JSON on stdout, one line for a person on stderr, and the exit code says how
 * it went — 0 for a result, 1 for a refusal or a failure, 2 for a command that could not be read.
 * The same contract as the skills' commands, so a person and a dashboard read it the same way.
 */

export const USAGE = `usage: agent-scheduler <command>

  tick                          pull agent-data, sweep, read agent-schedule.md, start what is due
  run <prompt> [--model <id>]   one run of <prompt> in its own checkout, now, recorded; needs no scheduler
  start [--keep-alive]          the scheduler on, ticking every minute in its own process
  stop                          the scheduler off; runs in flight go to the end
  status                        the state file, and whether the scheduler's process is alive
  model <id>                    the model every run starts on (this user)
  offset <points>               how far past the spend boundary a run may still start (this user)

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

  async run(args, io, git) {
    const { positionals, values } = parse(args, { id: { type: 'string' }, command: { type: 'string' }, model: { type: 'string' } }, 1)
    const repo = await project(io.cwd, git)
    const outcome = await runProject(repo, {
      prompt: positionals[0]!,
      ...(values.id !== undefined ? { id: values.id } : {}),
      ...(values.command !== undefined ? { command: values.command } : {}),
      ...(values.model !== undefined ? { model: values.model } : {}),
      log: io.stderr,
    })
    return { ok: outcome.status === 'done', ...outcome }
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
    parse(args, {}, 0)
    const repo = await project(io.cwd, git)
    return { ok: true, ...(await stopScheduler(repo)) }
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

export { checkoutRoot }
