import { parseArgs } from 'node:util'
import { nodeGitRunner, type GitRunner } from '@gemstack/agent-data'
import { projectRoot } from '@gemstack/skill-branches'
import { DRIVER_NAMES, detachResume, detachRun, isDriverName, readyToRun, resumeProject, runProject } from './runner.js'
import { initHooks } from './init.js'

/**
 * The command line: JSON on stdout, one line for a person on stderr, and the exit code says how
 * it went — 0 for a result, 1 for a refusal or a failure, 2 for a command that could not be read.
 * The same contract as the skills' commands, so a person and a dashboard read it the same way.
 */

export const USAGE = `usage: agent-runner <command>

  run <prompt> [--model <id>] [--driver <claude-code|codex>] [--then <prompt>]
                                one run of <prompt> in its own checkout, now, recorded; on Claude Code unless --driver says Codex,
                                on the coding agent's own default model unless --model names one;
                                with --then, once it ends done with a pull request, a fresh agent on its branch gets that prompt and the run's id, and the merge waits for it
  run --detach <prompt>         the same run in its own process, answered at once with its id: what a dashboard's start hook runs
  run --resume <id> [<text>] [--answer <label>]
                                continue an ended run: the same record, its session resumed; the text as the next prompt, or the answer to the question it ended on
  run --detach --resume <id> …  the same continuing in its own process, answered at once: what a dashboard's resume hook runs
  check [--driver <claude-code|codex>]
                                whether a run can start here: the coding agent's CLI installed and logged in, and its warnings; what a dashboard's check hook runs
  init                          this tool's lines in the dashboard's .the-framework/hooks.yml, so its Start works; a line already there is kept

When a run ends waiting on a question, or ends done with a pull request it did not have, the \`ended:\` line in the
project's .agent-runner/config.yml runs, if there is one, in the project's root, with MESSAGE (one line for a person),
RUN_ID, STATUS, QUESTION and PR_URL in its environment. The file is this machine's: keep it out of git (this tool hides
.agent-runner/ from git once a run has started here). A run's coding agent leaves out the person's own setup so it
does the same job on every machine; in the same file, each part comes back with its own line under \`personal:\`:
  personal:
    memory: on        Claude Code's auto-memory; Codex's memories
    connectors: on    your claude.ai connectors; Codex's apps and plugins
    skills: on        Claude Code: your user settings (effort, model, hooks, a login through apiKeyHelper), the skills
                      synced from your claude.ai account, ~/.claude/CLAUDE.md, ~/.claude/skills.
                      Codex: ~/.codex/AGENTS.md, ~/.codex/skills, ~/.codex/config.toml (with a model provider or
                      login set there) and its memories, so Codex's memory: on needs skills: on too.
                      Skills in ~/.agents/skills load either way; \`check\` warns while skills is off.

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
  async run(args, io, git) {
    const { positionals, values } = parse(args, { id: { type: 'string' }, model: { type: 'string' }, resume: { type: 'string' }, answer: { type: 'string' }, detach: { type: 'boolean' }, driver: { type: 'string' }, then: { type: 'string' } }, 0, 1)
    const repo = await project(io.cwd, git)
    const driver = values.driver
    if (driver !== undefined && !isDriverName(driver)) throw new Usage(`unknown driver "${driver}"; the drivers are ${DRIVER_NAMES.join(' and ')}`)
    if (values.resume !== undefined) {
      if (driver !== undefined) throw new Usage('--resume takes no --driver: a run continues on the coding agent its record names')
      if (values.id !== undefined) throw new Usage('--resume takes no --id: a run continues under its own')
      if (values.then !== undefined) throw new Usage('--resume takes no --then: a run continues with the follow-up its record names')
      if (positionals[0] === undefined && values.answer === undefined) throw new Usage('a text or --answer is needed to resume a run')
    }
    if (values.then !== undefined && !values.then.trim()) throw new Usage('--then needs a prompt')
    // A person's run is refused before it spends a checkout when its coding agent cannot start;
    // a scheduler asks the same before it marks, and a resumed run's agent already ran once here.
    if (values.resume === undefined && values.id === undefined) {
      const ready = await readyToRun(repo, driver ?? 'claude-code')
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
    const repo = await project(io.cwd, git)
    return { ok: true, ...(await readyToRun(repo, driver)) }
  },

  async init(args, io, git) {
    parse(args, {}, 0)
    const repo = await project(io.cwd, git)
    const outcome = await initHooks(repo)
    if (outcome.ok) return outcome
    const line = outcome.reason === 'no-dashboard' ? 'no .the-framework/ here: add the project in the dashboard first' : `${outcome.file}: ${outcome.detail ?? 'unreadable'}`
    throw new Refused(outcome, line)
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

