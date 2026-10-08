import { parseArgs } from 'node:util'
import { nodeGitRunner, type GitRunner } from '@openagt/agent-data'
import { projectRoot } from '@openagt/skill-branches'
import { schedulerStatus, startScheduler, stopScheduler, tickProject } from './scheduler.js'
import { initHooks } from './init.js'
import { cleanup } from './cleanup.js'
import { PUBLISH_PICKS, isAgents, isSwitchedOn, updateState, withAgents, withPace, withPublish, withSwitch, type PublishPick } from './state.js'
import { parseInterval, parseTimeOfDay, sinceNow, takesTimeOfDay } from './pace.js'
import { readSchedule, type ScheduledCommand } from './schedule.js'

/**
 * The command line: JSON on stdout, one line for a person on stderr, and the exit code says how
 * it went — 0 for a result, 1 for a refusal or a failure, 2 for a command that could not be read.
 * The same contract as the skills' commands, so a person and a dashboard read it the same way.
 */

export const USAGE = `usage: agent-scheduler <command>

  tick                          pull agent-data, sweep, read the commands the project's skills schedule, start what is due, each a run of agent-runner
  init                          this tool's lines in the dashboard's .openagent/hooks.yml, so it runs while the dashboard is open; a line already there is kept
  start [--keep-alive]          the scheduler on, ticking every minute in its own process
  stop [--unless-keep-alive]    the scheduler off; runs in flight go to the end; with the flag a keep-alive scheduler is left running
  status                        the state file, and whether the scheduler's process is alive
  model <id>                    the model every scheduled run starts on (this user)
  offset <points>               how far past the spend boundary a run may still start (this user)
  switch <command> <on|off>     whether a scheduled command runs on this machine, the command as status names it (quoted when it has a word after it); every one starts off, and off is taken for any name
  publish <command> <nothing|commit|branch|pr|merge>
                                how far this machine's runs of a scheduled command publish; commit until picked
  pace <command> <skill|work|N<m|h|d|w|mo>> [HH:MM]
                                how often at most a scheduled command starts on this machine: an interval (15m, 6h, 2d, 2w, 1mo; 1 to 9999), with a time of day
                                for days, weeks or months (2d 10:00, this machine's time); work for whenever its check finds work; skill for the skill's own pace again, taken for any name
  agents <command> <skill|N>    how many runs of a scheduled command may be in flight at once, as this machine counts them, every machine's runs counted;
                                a whole number from 1 to 99; skill for the skill's own number again, taken for any name
  cleanup                       remove what this tool left in the project: the state file and the scheduler's log, then .agent-scheduler/ and the rule hiding it from git once it is empty;
                                refused while the state names a scheduler that is alive; the command a dashboard asks for when a project is removed with its files

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
    const line = outcome.reason === 'no-dashboard' ? 'no .openagent/ here: add the project in the dashboard first' : `${outcome.file}: ${outcome.detail ?? 'unreadable'}`
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
    // Off needs no scheduled command: a switch left on for a skill that is gone can always be taken back.
    if (to === 'on') await scheduled(repo, name)
    // Switched on, a time of day counts from now: a row ticked after its time waits for the next one, as when the time was picked.
    // A command already on is left as it is, so asking twice does not put a missed time off.
    return { ok: true, ...(await updateState(repo, s => (to === 'off' ? withSwitch(s, name, false) : isSwitchedOn(s, name) ? s : withPace(withSwitch(s, name, true), name, sinceNow(s.paces?.[name], new Date()))), git)) }
  },

  async publish(args, io, git) {
    const { positionals } = parse(args, {}, 2)
    const [name, to] = positionals as [string, string]
    if (!(PUBLISH_PICKS as readonly string[]).includes(to)) throw new Usage(`${to} is none of ${PUBLISH_PICKS.join(', ')}`)
    const repo = await project(io.cwd, git)
    await scheduled(repo, name)
    return { ok: true, ...(await updateState(repo, s => withPublish(s, name, to as PublishPick), git)) }
  },

  async pace(args, io, git) {
    const { positionals } = parse(args, {}, 2, 3)
    const [name, to, at] = positionals as [string, string, string | undefined]
    const interval = parseInterval(to)
    if (to !== 'skill' && to !== 'work' && !interval) throw new Usage(`${to} is none of skill, work, or an interval like 15m, 6h, 2d, 2w, 1mo`)
    const time = at === undefined ? undefined : parseTimeOfDay(at)
    if (at !== undefined && !time) throw new Usage(`${at} is no time of day like 10:00`)
    if (time && !(interval && takesTimeOfDay(interval))) throw new Usage('a time of day goes with days, weeks or months')
    const repo = await project(io.cwd, git)
    // Taking a pace back needs no scheduled command: one left for a skill that is gone can always be taken back.
    if (to === 'skill') return { ok: true, ...(await updateState(repo, s => withPace(s, name, undefined), git)) }
    const command = await scheduled(repo, name)
    if (to === 'work' && command.when === undefined) throw new Refused({ ok: false, reason: 'no-check', command: name }, `${name} has no check, so nothing would say when there is work`)
    const every = interval?.text
    return {
      ok: true,
      ...(await updateState(
        repo,
        s => {
          if (every === undefined) return withPace(s, name, { work: true })
          // The same pace picked again is the same pick: when it was made stays, so a time that was missed is still due.
          const before = s.paces?.[name]
          const same = typeof before === 'object' && before !== null && 'every' in before && before.every === every && before.at === time?.text && typeof before.since === 'string'
          return withPace(s, name, { every, ...(time ? { at: time.text } : {}), since: same ? before.since : new Date().toISOString() })
        },
        git,
      )),
    }
  },

  async agents(args, io, git) {
    const { positionals } = parse(args, {}, 2)
    const [name, to] = positionals as [string, string]
    const count = /^\d+$/.test(to) ? Number(to) : undefined
    if (to !== 'skill' && !isAgents(count)) throw new Usage(`${to} is neither skill nor a whole number from 1 to 99`)
    const repo = await project(io.cwd, git)
    // Taking a number back needs no scheduled command: one left for a skill that is gone can always be taken back.
    if (to !== 'skill') await scheduled(repo, name)
    return { ok: true, ...(await updateState(repo, s => withAgents(s, name, count), git)) }
  },

  async cleanup(args, io, git) {
    parse(args, {}, 0)
    const outcome = await cleanup(await project(io.cwd, git), { git })
    if (outcome.ok) return outcome
    throw new Refused(outcome, `the scheduler is running here (pid ${outcome.pid}): stop it first with agent-scheduler stop`)
  },
}

/** The scheduled command of that name; refused where no skill of the project schedules it, with why when its skill's schedule cannot be read. */
async function scheduled(repo: string, name: string): Promise<ScheduledCommand> {
  const schedule = await readSchedule(repo)
  const command = schedule.commands.find(c => c.name === name)
  if (command) return command
  const skill = name.split(' ')[0]!
  const unreadable = schedule.unreadable.find(u => u.skill === skill)
  if (unreadable) throw new Refused({ ok: false, reason: 'unreadable-schedule', skill, detail: unreadable.reason }, `the schedule of ${skill} cannot be read: ${unreadable.reason}`)
  throw new Refused({ ok: false, reason: 'not-scheduled', command: name }, `no skill of this project schedules ${name}`)
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

