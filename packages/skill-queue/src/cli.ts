import { parseArgs } from 'node:util'
import { join } from 'node:path'
import { checkoutRoot, gitReason, nodeBranchFileFs, nodeGitRunner, openBranchReader, writeFileBranchDetached, type BranchReader, type GitRunner, DATA_BRANCH } from '@gemstack/agent-data'
import { QUEUE_FILE } from './names.js'
import { appendQueueEntry, insertQueueEntry, parseQueueEntries, removeQueueEntry } from './queue.js'

/**
 * The command line over the package: the same operations a daemon calls, for an agent (and a
 * person) in a shell, in any clone of the repository.
 *
 * The contract: JSON on stdout, one line for a person on stderr, and the exit code says how it
 * went — 0 for a result, 1 for a refusal or a git failure, 2 for a command that could not be
 * read. A refusal is a rule saying no (there is no such entry); it is reported on stdout as
 * `{ ok: false, reason }` so a caller parsing the output learns why, and on stderr so a person does.
 *
 * Reads go to origin's copy of the branch, fetched first, so a command sees what every writer
 * pushed — its own earlier writes included. Writes are a remote writer's: one commit each, on a
 * throwaway checkout of origin's tip, pushed straight to the branch; a rejected push is re-applied
 * on the new tip and pushed again. The persistent checkout a daemon keeps is never touched.
 */

export const USAGE = `usage: queue [command]

  (no command)                       the queue's open entries, in order of work
  add <text> [--priority N]          put an entry on the queue, in its priority section
  done <text>                        take an entry off the queue

JSON on stdout. Exit code 1 for a refusal or a git failure (the reason on stderr), 2 for a usage error.`

/** The streams and the working directory a run of the CLI sees. */
export interface CliIo {
  cwd: string
  stdout: (line: string) => void
  stderr: (line: string) => void
}

/** A refusal: a rule said no, and the caller learns which. */
export type CliRefusal = { ok: false; reason: string; [key: string]: unknown }

/** Thrown inside a command to end it with a refusal. */
class Refused extends Error {
  constructor(
    readonly outcome: CliRefusal,
    readonly line: string,
  ) {
    super(line)
  }
}

/** Thrown inside a command for an argument that cannot be read: usage on stderr, exit 2. */
class Usage extends Error {}

/** Run the CLI: `argv` is everything after the program name. Resolves to the exit code. */
export async function runCli(argv: string[], io: CliIo, git: GitRunner = nodeGitRunner()): Promise<number> {
  const [command, ...rest] = argv
  const run = command === undefined ? list : Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined
  if (!run) {
    io.stderr(USAGE)
    return 2
  }
  try {
    io.stdout(JSON.stringify(await run(rest, io, git)))
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
    const detail = gitReason(err)
    io.stdout(JSON.stringify({ ok: false, reason: 'git-failed', detail }))
    io.stderr(detail)
    return 1
  }
}

type Command = (args: string[], io: CliIo, git: GitRunner) => Promise<unknown>

/** The bare command: the open entries, in order of work. */
const list: Command = async (args, io, git) => {
  parse(args, {}, 0)
  const reader = await open(io.cwd, git)
  return parseQueueEntries((await reader.read(QUEUE_FILE)) ?? '')
}

const COMMANDS: Record<string, Command> = {
  async add(args, io, git) {
    const { positionals, values } = parse(args, { priority: { type: 'string' } }, 1)
    const entry = positionals[0]!.trim()
    if (!entry) throw new Usage('the entry is empty')
    const priority = values.priority === undefined ? undefined : priorityArg(values.priority)
    await write(io.cwd, `queue add: ${entry}`, async dir => {
      const md = await readOr(dir, '')
      await writeQueue(dir, priority === undefined ? appendQueueEntry(md, entry) : insertQueueEntry(md, entry, priority))
    }, git)
    return { ok: true, entry, ...(priority === undefined ? {} : { priority }) }
  },

  async done(args, io, git) {
    const { positionals } = parse(args, {}, 1)
    const entry = positionals[0]!.trim()
    let found = false
    await write(io.cwd, `queue done: ${entry}`, async dir => {
      const md = await readOr(dir, '')
      found = parseQueueEntries(md).includes(entry)
      if (found) await writeQueue(dir, removeQueueEntry(md, entry))
    }, git)
    if (!found) throw new Refused({ ok: false, reason: 'no-entry', entry }, `no open queue entry reads "${entry}"`)
    return { ok: true, entry }
  },
}

/** The queue file inside a checkout, read as `fallback` when absent. */
async function readOr(dir: string, fallback: string): Promise<string> {
  return nodeBranchFileFs().read(join(dir, QUEUE_FILE)).catch(() => fallback)
}

async function writeQueue(dir: string, md: string): Promise<void> {
  await nodeBranchFileFs().write(join(dir, QUEUE_FILE), md)
}

/** The branch opened for reading, from wherever the command runs; outside a repo, a refusal. */
async function open(cwd: string, git: GitRunner): Promise<BranchReader> {
  await inRepo(() => checkoutRoot(cwd, git))
  return openBranchReader(cwd, DATA_BRANCH, { git })
}

/** One detached write, refusing where nothing can carry it. */
async function write(cwd: string, message: string, op: (dir: string) => Promise<void>, git: GitRunner): Promise<void> {
  await inRepo(() => checkoutRoot(cwd, git))
  const result = await writeFileBranchDetached(cwd, DATA_BRANCH, message, op, { git })
  if (!result.ok) throw new Refused({ ok: false, reason: result.reason }, 'the repository has no remote, so nothing can carry the change')
}

function priorityArg(value: string): number {
  if (!/^\d+$/.test(value) || Number(value) > 10) throw new Usage(`--priority takes 0 to 10, got ${value}`)
  return Number(value)
}

/**
 * Outside a repo, the commands have nothing to act on: said as a refusal, not a git failure.
 * Only git's own "not a git repository" reads as that; a timeout, a missing git, or a corrupt
 * repo stays the failure it is.
 */
async function inRepo<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read()
  } catch (err) {
    if (!/not a git repository/i.test(err instanceof Error ? err.message : String(err))) throw err
    throw new Refused({ ok: false, reason: 'not-a-repo' }, 'not inside a git repository')
  }
}

type Options = Record<string, { type: 'string' | 'boolean' }>

/** `parseArgs` with the positional count checked: too few or too many is a usage error. */
function parse<O extends Options>(args: string[], options: O, min: number, max: number = min) {
  try {
    const parsed = parseArgs({ args, options, allowPositionals: true, strict: true })
    if (parsed.positionals.length < min || parsed.positionals.length > max) throw new Usage(`expected ${max === min ? min : `${min} to ${max}`} argument(s), got ${parsed.positionals.length}`)
    return parsed
  } catch (err) {
    throw err instanceof Usage ? err : new Usage(err instanceof Error ? err.message : String(err))
  }
}
