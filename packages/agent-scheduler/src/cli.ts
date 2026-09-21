import { parseArgs } from 'node:util'
import { nodeGitRunner, type GitRunner } from '@gemstack/agent-data'
import { projectRoot } from '@gemstack/skill-branches'
import { DRIVER_NAMES, detachResume, detachRun, isDriverName, readyToRun, resumeProject, runProject, schedulerStatus, startScheduler, stopScheduler, tickProject } from './scheduler.js'
import { initHooks } from './init.js'
import { updateState, withSwitch } from './state.js'
import { readSchedule } from './schedule.js'

/**
 * The command line: JSON on stdout, one line for a person on stderr, and the exit code says how
 * it went — 0 for a result, 1 for a refusal or a failure, 2 for a command that could not be read.
 * The same contract as the skills' commands, so a person and a dashboard read it the same way.
 */

export const USAGE = `usage: agent-scheduler <command>

  tick                          pull agent-data, sweep, read agent-schedule.md, start what is due
  run <prompt> [--model <id>] [--driver <claude-code|codex>] [--then <prompt>]
                                one run of <prompt> in its own checkout, now, recorded; needs no scheduler; on Claude Code unless --driver says Codex;
                                with --then, once it ends done with a pull request, a fresh agent on its branch gets that prompt and the run's id, and the merge waits for it
  run --detach <prompt>         the same run in its own process, answered at once with its id: what a dashboard's start hook runs
  run --resume <id> [<text>] [--answer <label>]
                                continue an ended run: the same record, its session resumed; the text as the next prompt, or the answer to the question it ended on
  run --detach --resume <id> …  the same continuing in its own process, answered at once: what a dashboard's resume hook runs
  check [--driver <claude-code|codex>]
                                whether a run can start here: the coding agent's CLI installed and logged in; what a dashboard's check hook runs
  init                          this tool's lines in the dashboard's .the-framework/hooks.yml, so its Start works; a line already there is kept
  start [--keep-alive]          the scheduler on, ticking every minute in its own process
  stop [--unless-keep-alive]    the scheduler off; runs in flight go to the end; with the flag a keep-alive scheduler is left running
  status                        the state file, and whether the scheduler's process is alive
  model <id>                    the model every run starts on (this user)
  offset <points>               how far past the spend boundary a run may still start (this user)
  switch <command> <on|off>     whether a command of agent-schedule.md runs on this machine; what a dashboard's switch hook runs

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
    const { positionals, values } = parse(args, { id: { type: 'string' }, command: { type: 'string' }, model: { type: 'string' }, resume: { type: 'string' }, answer: { type: 'string' }, detach: { type: 'boolean' }, driver: { type: 'string' }, then: { type: 'string' } }, 0, 1)
    const repo = await project(io.cwd, git)
    const driver = values.driver
    if (driver !== undefined && !isDriverName(driver)) throw new Usage(`unknown driver "${driver}"; the drivers are ${DRIVER_NAMES.join(' and ')}`)
    if (values.resume !== undefined) {
      if (driver !== undefined) throw new Usage('--resume takes no --driver: a run continues on the coding agent its record names')
      if (values.id !== undefined || values.command !== undefined) throw new Usage('--resume takes no --id or --command: a run continues under its own')
      if (values.then !== undefined) throw new Usage('--resume takes no --then: a run continues with the follow-up its record names')
      if (positionals[0] === undefined && values.answer === undefined) throw new Usage('a text or --answer is needed to resume a run')
    }
    if (values.then !== undefined && !values.then.trim()) throw new Usage('--then needs a prompt')
    // A person's run is refused before it spends a checkout when its coding agent cannot start;
    // the tick asks the same before it marks, and a resumed run's agent already ran once here.
    if (values.resume === undefined && values.id === undefined) {
      const ready = await readyToRun(driver ?? 'claude-code')
      if (ready.problems.length > 0) throw new Refused({ ok: false, reason: 'not-ready', ...ready }, ready.problems.join(' '))
    }
    const then = values.then !== undefined ? { then: values.then.trim() } : {}
    if (values.detach && values.resume !== undefined) {
      const resumed = await detachResume(repo, {
        id: values.resume,
        ...(positionals[0] !== undefined ? { text: positionals[0] } : {}),
        ...(values.answer !== undefined ? { answer: values.answer } : {}),
        ...(values.model !== undefined ? { model: values.model } : {}),
      })
      return { ok: true, detached: true, ...resumed }
    }
    if (values.detach) {
      if (positionals[0] === undefined) throw new Usage('expected 1 argument(s), got 0')
      if (values.id !== undefined) throw new Usage('--detach takes no --id: the run\'s id is minted and answered')
      const started = await detachRun(repo, { prompt: positionals[0], ...(values.model !== undefined ? { model: values.model } : {}), ...(driver !== undefined ? { driver } : {}), ...then, log: io.stderr })
      return { ok: true, detached: true, ...started }
    }
    if (values.resume !== undefined) {
      const outcome = await resumeProject(repo, {
        id: values.resume,
        ...(positionals[0] !== undefined ? { text: positionals[0] } : {}),
        ...(values.answer !== undefined ? { answer: values.answer } : {}),
        ...(values.model !== undefined ? { model: values.model } : {}),
        log: io.stderr,
      })
      return { ok: outcome.status === 'done' || outcome.status === 'waiting', ...outcome }
    }
    if (positionals[0] === undefined) throw new Usage('expected 1 argument(s), got 0')
    const outcome = await runProject(repo, {
      prompt: positionals[0],
      ...(values.id !== undefined ? { id: values.id } : {}),
      ...(values.command !== undefined ? { command: values.command } : {}),
      ...(values.model !== undefined ? { model: values.model } : {}),
      ...(driver !== undefined ? { driver } : {}),
      ...then,
      log: io.stderr,
    })
    return { ok: outcome.status === 'done' || outcome.status === 'waiting', ...outcome }
  },

  async check(args, io, git) {
    const { values } = parse(args, { driver: { type: 'string' } }, 0)
    const driver = values.driver ?? 'claude-code'
    if (!isDriverName(driver)) throw new Usage(`unknown driver "${driver}"; the drivers are ${DRIVER_NAMES.join(' and ')}`)
    await project(io.cwd, git)
    return { ok: true, ...(await readyToRun(driver)) }
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

