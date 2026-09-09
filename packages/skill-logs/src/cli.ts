import { parseArgs } from 'node:util'
import { checkoutRoot, gitReason, nodeGitRunner, openBranchReader, type BranchReader, type GitRunner, DATA_BRANCH } from '@gemstack/agent-data'
import { RUNS_DIR } from './names.js'
import { agentLines, isRunId, newestFirst, parseDiary, parseRunCard, publicCard, runCardFile, runDiaryFile, runIdOfFile, workedTicket, type RunCard } from './run.js'

/**
 * The command line over the package: the reads a daemon's pages do, for an agent (and a person)
 * in a shell, in any clone of the repository. Read-only: an agent's run is recorded by the
 * process that ran it, not by the agent.
 *
 * The contract: JSON on stdout, one line for a person on stderr, and the exit code says how it
 * went — 0 for a result, 1 for a refusal or a git failure, 2 for a command that could not be
 * read. A refusal is a rule saying no (there is no such run); it is reported on stdout as
 * `{ ok: false, reason }` so a caller parsing the output learns why, and on stderr so a person does.
 *
 * Reads go to origin's copy of the branch, fetched once, so a command sees every run every
 * machine pushed. The persistent checkout a daemon keeps is never touched.
 */

/** How many runs the bare command prints unless told otherwise: enough to see what happened lately, not the whole history. */
export const DEFAULT_LIMIT = 20

export const USAGE = `usage: logs [command]

  (no command) [--ticket <file>] [--branch <name>] [--limit N]
                                     the runs, newest first (the newest ${DEFAULT_LIMIT} unless --limit says
                                     otherwise); --ticket keeps the runs that worked one ticket,
                                     --branch the runs on one branch
  show <id>                          one run: its card, and what the agent said, its result,
                                     how it ended, what it cost

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
  const run = command === undefined || command.startsWith('--') ? list : Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined
  const args = command === undefined || command.startsWith('--') ? argv : rest
  if (!run) {
    io.stderr(USAGE)
    return 2
  }
  try {
    io.stdout(JSON.stringify(await run(args, io, git)))
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

/** The bare command: the runs, newest first, filtered and capped. */
const list: Command = async (args, io, git) => {
  const { values } = parse(args, { ticket: { type: 'string' }, branch: { type: 'string' }, limit: { type: 'string' } }, 0)
  const limit = values.limit === undefined ? DEFAULT_LIMIT : limitArg(values.limit)
  const reader = await open(io.cwd, git)
  const cards: RunCard[] = []
  // Newest first, and no further than the cap: the cards past it are never read.
  for (const { person, id } of await runEntries(reader)) {
    if (cards.length >= limit) break
    const card = parseRunCard((await reader.read(`${RUNS_DIR}/${person}/${runCardFile(id)}`)) ?? '')
    if (!card) continue
    if (values.ticket !== undefined && !workedTicket(card, values.ticket)) continue
    if (values.branch !== undefined && card.branch !== values.branch) continue
    cards.push(card)
  }
  return cards.map(publicCard)
}

const COMMANDS: Record<string, Command> = {
  async show(args, io, git) {
    const { positionals } = parse(args, {}, 1)
    const id = positionals[0]!
    if (!isRunId(id)) throw new Usage(`not a run id: ${id}`)
    const reader = await open(io.cwd, git)
    const entry = (await runEntries(reader)).find(e => e.id === id)
    const card = entry ? parseRunCard((await reader.read(`${RUNS_DIR}/${entry.person}/${runCardFile(id)}`)) ?? '') : undefined
    if (!entry || !card) throw new Refused({ ok: false, reason: 'no-run', id }, `no run is named ${id}`)
    const diary = parseDiary((await reader.read(`${RUNS_DIR}/${entry.person}/${runDiaryFile(id)}`)) ?? '')
    return { ...publicCard(card), diary: agentLines(diary) }
  },
}

/** Every run on the branch by person and id, newest first, from the directory listings alone. */
async function runEntries(reader: BranchReader): Promise<Array<{ person: string; id: string }>> {
  const entries: Array<{ person: string; id: string }> = []
  for (const person of await reader.list(RUNS_DIR)) {
    for (const name of await reader.list(`${RUNS_DIR}/${person}`)) {
      const id = runIdOfFile(name)
      if (id !== undefined) entries.push({ person, id })
    }
  }
  return newestFirst(entries)
}

/** The branch opened for reading, from wherever the command runs; outside a repo, a refusal. */
async function open(cwd: string, git: GitRunner): Promise<BranchReader> {
  await inRepo(() => checkoutRoot(cwd, git))
  return openBranchReader(cwd, DATA_BRANCH, { git })
}

function limitArg(value: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 1) throw new Usage(`--limit takes a whole number above 0, got ${value}`)
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
