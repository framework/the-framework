import { hostname } from 'node:os'
import { parseArgs } from 'node:util'
import { nodeGitRunner } from '@gemstack/agent-data'
import { projectRoot } from '@gemstack/skill-branches'
import { DRIVER_NAMES, isDriverName, isPidAlive, readyToRun, spawnRun, withdrawMarker, writeMarker } from 'agent-runner'
import { Refused, listSubagents, readSubagent, startSubagent, stopSubagent, type SubagentDeps } from './subagents.js'

/**
 * The `orchestration` command: JSON on stdout, one line for a person on stderr, and the exit code
 * says how it went — 0 for a result, 1 for a refusal or a failure, 2 for a command line that
 * could not be read.
 */

export const USAGE = `usage: orchestration <command>

  start <task> [--model <id>] [--driver <${DRIVER_NAMES.join('|')}>]
                    start a subagent on the task, on a branch started from yours; answers its id at once
  list              your subagents, newest first
  read <id>         one subagent: how it stands, its branch, and its last reply as \`result\`
  stop <id>         stop a subagent that is running

JSON on stdout. Exit code 1 for a refusal or a failure (\`reason\` in the JSON, why on stderr), 2 for a usage error.`

export interface CliIo {
  cwd: string
  env: NodeJS.ProcessEnv
  stdout: (line: string) => void
  stderr: (line: string) => void
}

class Usage extends Error {}

export async function runCli(argv: string[], io: CliIo, given: Partial<SubagentDeps> = {}): Promise<number> {
  const deps: SubagentDeps = { git: nodeGitRunner(), host: hostname(), isAlive: isPidAlive, stop: pid => void process.kill(pid, 'SIGTERM'), ready: readyToRun, now: () => new Date(), mark: writeMarker, unmark: withdrawMarker, spawn: spawnRun, ...given }
  const [command, ...rest] = argv
  const run = command && Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined
  if (!run) {
    io.stderr(USAGE)
    return 2
  }
  try {
    io.stdout(JSON.stringify(await run(rest, io, deps)))
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

type Command = (args: string[], io: CliIo, deps: SubagentDeps) => Promise<unknown>

const COMMANDS: Record<string, Command> = {
  async start(args, io, deps) {
    const { positionals, values } = parse(args, { model: { type: 'string' }, driver: { type: 'string' } }, 1)
    const task = positionals[0]!
    if (!task.trim()) throw new Usage('the task is empty')
    const driver = values.driver
    if (driver !== undefined && !isDriverName(driver)) throw new Usage(`unknown driver "${driver}"; the drivers are ${DRIVER_NAMES.join(' and ')}`)
    const started = await startSubagent(await project(io.cwd, deps), io.env, { task, ...(values.model !== undefined ? { model: values.model } : {}), ...(driver !== undefined ? { driver } : {}) }, deps)
    if (started.uncommitted) io.stderr('your checkout has uncommitted changes: the subagent does not have them')
    return { ok: true, ...started }
  },

  async list(args, io, deps) {
    parse(args, {}, 0)
    return listSubagents(await project(io.cwd, deps), io.env)
  },

  async read(args, io, deps) {
    const { positionals } = parse(args, {}, 1)
    return { ok: true, ...(await readSubagent(await project(io.cwd, deps), io.env, positionals[0]!)) }
  },

  async stop(args, io, deps) {
    const { positionals } = parse(args, {}, 1)
    return { ok: true, ...(await stopSubagent(await project(io.cwd, deps), io.env, positionals[0]!, deps)) }
  },
}

/** The project the working directory belongs to, even from inside a checkout under `.branches/`. */
async function project(cwd: string, deps: SubagentDeps): Promise<string> {
  try {
    return await projectRoot(cwd, deps.git)
  } catch (err) {
    if (!/not a git repository/i.test(err instanceof Error ? err.message : String(err))) throw err
    throw new Refused({ ok: false, reason: 'not-a-repo' }, 'not inside a git repository')
  }
}

type Options = Record<string, { type: 'string' | 'boolean' }>

function parse<O extends Options>(args: string[], options: O, count: number) {
  try {
    const parsed = parseArgs({ args, options, allowPositionals: true, strict: true })
    if (parsed.positionals.length !== count) throw new Usage(`expected ${count} argument(s), got ${parsed.positionals.length}`)
    return parsed
  } catch (err) {
    throw err instanceof Usage ? err : new Usage(err instanceof Error ? err.message : String(err))
  }
}
