import { parseArgs } from 'node:util'
import { join } from 'node:path'
import { checkoutRoot, gitReason, nodeBranchFileFs, nodeGitRunner, openBranchReader, writeFileBranchDetached, type BranchReader, type GitRunner, DATA_BRANCH } from '@gemstack/agent-data'
import { isTicketFile, isTicketPath, META_FILE, QUEUE_FILE, TICKETS_DIR, queuePriorityForTicket, ticketLockName, ticketPlanName, ticketStem } from './names.js'
import { readTicket, readTickets, type TicketsFs } from './tickets.js'
import { applyClaims, applyRelease, claimMessage, lockHolder, releaseMessage } from './locks.js'
import { appendQueueEntry, insertQueueEntry, parseQueueEntries, removeQueueEntry } from './queue.js'
import { holderOf } from './holder.js'

/**
 * The command line over the package: the same operations a daemon calls, for an agent (and a
 * person) in a shell, in any clone of the repository.
 *
 * The contract: JSON on stdout, one line for a person on stderr, and the exit code says how it
 * went — 0 for a result, 1 for a refusal or a git failure, 2 for a command that could not be
 * read. A refusal is a rule saying no (the ticket is someone else's, there is no such ticket); it
 * is reported on stdout as `{ ok: false, reason }` so a caller parsing the output learns why, and
 * on stderr so a person does.
 *
 * Reads go to origin's copy of the branch, fetched first, so a command sees what every writer
 * pushed — its own earlier writes included. Writes are a remote writer's: one commit each, on a
 * throwaway checkout of origin's tip, pushed straight to the branch; a rejected push is re-applied
 * on the new tip and pushed again. The persistent checkout a daemon keeps is never touched.
 */

export const USAGE = `usage: tickets <command>

  list                               every open ticket, as JSON
  show <file>                        one ticket: its text, its plan, who holds it
  queue                              the queue's open entries, in order of work
  queue add <text> [--priority N] [--ticket <file>]
                                     put an entry on the queue, in its priority section
  queue done <text>                  take an entry off the queue
  put <file>                         write one file under tickets/ from stdin (a ticket, a plan, meta.json)
  close <file>                       remove a ticket with its plan and lock (not while someone else holds it)
  claim <file>                       claim a ticket before planning or working it
  release <file>                     lift your own claim

JSON on stdout. Exit code 1 for a refusal or a git failure (the reason on stderr), 2 for a usage error.`

/** The streams and the working directory a run of the CLI sees. */
export interface CliIo {
  cwd: string
  /** Everything on standard input, for `put`. */
  stdin: () => Promise<string>
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
  const run = command && Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined
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

const COMMANDS: Record<string, Command> = {
  async list(args, io, git) {
    parse(args, {}, 0)
    const reader = await open(io.cwd, git)
    return readTickets(TICKETS_DIR, ticketsFsOver(reader))
  },

  async show(args, io, git) {
    const { positionals } = parse(args, {}, 1)
    const file = ticketArg(positionals[0]!)
    const reader = await open(io.cwd, git)
    const ticket = await readTicket(TICKETS_DIR, file, ticketsFsOver(reader))
    if (!ticket) throw noTicket(file)
    const plan = await reader.read(`${TICKETS_DIR}/${ticketPlanName(file)}`)
    return { ok: true, ticket, ...(plan === undefined ? {} : { plan }), ...(ticket.lockedBy === undefined ? {} : { holder: ticket.lockedBy }) }
  },

  async queue(args, io, git) {
    const [sub, ...rest] = args
    if (sub === 'add') {
      const { positionals, values } = parse(rest, { priority: { type: 'string' }, ticket: { type: 'string' } }, 1)
      const text = positionals[0]!.trim()
      if (!text) throw new Usage('the entry is empty')
      const priority = values.priority === undefined ? undefined : priorityArg(values.priority)
      const reader = await open(io.cwd, git)
      // A ticket named turns the entry into a link back to it, placed by the ticket's own
      // priority unless one was given — the same entry a dashboard writes when it queues a ticket.
      let entry = text
      let at = priority
      if (values.ticket !== undefined) {
        const file = ticketArg(values.ticket)
        const ticket = await readTicket(TICKETS_DIR, file, ticketsFsOver(reader))
        if (!ticket) throw noTicket(file)
        entry = `[${text}](${TICKETS_DIR}/${file})`
        at ??= queuePriorityForTicket(ticket.priority)
      }
      await write(io.cwd, `queue add: ${entry}`, async dir => {
        const md = await readOr(dir, '')
        await writeQueue(dir, at === undefined ? appendQueueEntry(md, entry) : insertQueueEntry(md, entry, at))
      }, git)
      return { ok: true, entry, ...(at === undefined ? {} : { priority: at }) }
    }
    if (sub === 'done') {
      const { positionals } = parse(rest, {}, 1)
      const entry = positionals[0]!.trim()
      let found = false
      await write(io.cwd, `queue done: ${entry}`, async dir => {
        const md = await readOr(dir, '')
        found = parseQueueEntries(md).includes(entry)
        if (found) await writeQueue(dir, removeQueueEntry(md, entry))
      }, git)
      if (!found) throw new Refused({ ok: false, reason: 'no-entry', entry }, `no open queue entry reads "${entry}"`)
      return { ok: true, entry }
    }
    if (sub !== undefined) throw new Usage(`unknown queue command: ${sub}`)
    const reader = await open(io.cwd, git)
    return parseQueueEntries((await reader.read(QUEUE_FILE)) ?? '')
  },

  async put(args, io, git) {
    const { positionals } = parse(args, {}, 1)
    const file = positionals[0]!
    // A ticket, its plan, or the meta file — never a lock: claims go through `claim`.
    if (!(isTicketFile(file) || (isTicketFile(file.replace(/\.plan\.md$/, '.md')) && file.endsWith('.plan.md')) || file === META_FILE))
      throw new Refused({ ok: false, reason: 'invalid-path', file }, `${file} is not a file under ${TICKETS_DIR}/ this command writes: a ticket, its .plan.md, or ${META_FILE}`)
    const content = await io.stdin()
    await write(io.cwd, `put ${TICKETS_DIR}/${file}`, async dir => {
      await nodeBranchFileFs().write(join(dir, TICKETS_DIR, file), content)
    }, git)
    return { ok: true, file: `${TICKETS_DIR}/${file}` }
  },

  async close(args, io, git) {
    const { positionals } = parse(args, {}, 1)
    const file = ticketArg(positionals[0]!)
    const holder = await identity(io.cwd, git)
    type CloseOutcome = { ok: true } | { ok: false; reason: 'no-ticket' } | { ok: false; reason: 'not-holder'; holder?: string }
    let outcome = { ok: true } as CloseOutcome
    await write(io.cwd, `close ${TICKETS_DIR}/${ticketStem(file)}`, async dir => {
      const fs = nodeBranchFileFs()
      if (!(await fs.read(join(dir, TICKETS_DIR, file)).then(() => true, () => false))) {
        outcome = { ok: false, reason: 'no-ticket' }
        return
      }
      // Someone else's claim outranks the close: closing takes their lock with the ticket.
      const lock = await fs.read(join(dir, TICKETS_DIR, ticketLockName(file))).catch(() => undefined)
      const other = lock === undefined ? undefined : lockHolder(lock)
      if (lock !== undefined && other !== holder) {
        outcome = { ok: false, reason: 'not-holder', ...(other === undefined ? {} : { holder: other }) }
        return
      }
      outcome = { ok: true }
      for (const name of [file, ticketPlanName(file), ticketLockName(file)]) await fs.remove(join(dir, TICKETS_DIR, name)).catch(() => {})
    }, git)
    if (!outcome.ok) {
      if (outcome.reason === 'no-ticket') throw noTicket(file)
      throw new Refused({ ...outcome, file }, `${TICKETS_DIR}/${file} is claimed by ${outcome.holder ?? 'someone else'}, not by you`)
    }
    return { ok: true, file: `${TICKETS_DIR}/${file}` }
  },

  async claim(args, io, git) {
    const { positionals } = parse(args, {}, 1)
    const file = ticketArg(positionals[0]!)
    const holder = await identity(io.cwd, git)
    type ClaimOutcome = { ok: true } | { ok: false; reason: 'no-ticket' } | { ok: false; reason: 'claimed'; holder?: string }
    // Assigned inside the op, which a lost race re-runs: typed wide so the read below sees every case.
    let outcome = { ok: true } as ClaimOutcome
    await write(io.cwd, claimMessage([{ ticket: file, holder }]), async dir => {
      const fs = nodeBranchFileFs()
      if (!(await fs.read(join(dir, TICKETS_DIR, file)).then(() => true, () => false))) {
        outcome = { ok: false, reason: 'no-ticket' }
        return
      }
      // A claim to plan or to work: an existing plan is not in the way, only someone's lock is.
      const locked = await applyClaims(dir, [{ ticket: file, holder }], 'drain', fs)
      if (locked.length) {
        outcome = { ok: true }
        return
      }
      // The holder as the lock names it; a lock that names nobody readable is still a claim.
      const existing = lockHolder((await fs.read(join(dir, TICKETS_DIR, ticketLockName(file))).catch(() => '')) ?? '')
      outcome = { ok: false, reason: 'claimed', ...(existing === undefined ? {} : { holder: existing }) }
    }, git)
    if (!outcome.ok) {
      if (outcome.reason === 'no-ticket') throw noTicket(file)
      throw new Refused({ ...outcome, file }, `${TICKETS_DIR}/${file} is claimed by ${outcome.holder ?? 'someone else'}: pick another ticket`)
    }
    return { ok: true, file: `${TICKETS_DIR}/${file}`, holder }
  },

  async release(args, io, git) {
    const { positionals } = parse(args, {}, 1)
    const file = ticketArg(positionals[0]!)
    const holder = await identity(io.cwd, git)
    let outcome = 'released' as 'released' | 'no-lock' | 'not-holder'
    let other: string | undefined
    await write(io.cwd, releaseMessage(file), async dir => {
      const fs = nodeBranchFileFs()
      outcome = await applyRelease(dir, file, holder, fs)
      if (outcome === 'not-holder') other = lockHolder((await fs.read(join(dir, TICKETS_DIR, ticketLockName(file))).catch(() => '')) ?? '')
    }, git)
    if (outcome === 'no-lock') throw new Refused({ ok: false, reason: 'no-lock', file }, `${TICKETS_DIR}/${file} is not claimed`)
    if (outcome === 'not-holder') throw new Refused({ ok: false, reason: 'not-holder', file, holder: other }, `${TICKETS_DIR}/${file} is claimed by ${other ?? 'someone else'}, not by you`)
    return { ok: true, file: `${TICKETS_DIR}/${file}`, holder }
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

/** The ticket reader over a branch read: paths are branch-relative (`tickets/<file>`). */
function ticketsFsOver(reader: BranchReader): TicketsFs {
  return { list: dir => reader.list(dir), read: path => reader.read(path) }
}

/** One detached write, refusing where nothing can carry it. */
async function write(cwd: string, message: string, op: (dir: string) => Promise<void>, git: GitRunner): Promise<void> {
  await inRepo(() => checkoutRoot(cwd, git))
  const result = await writeFileBranchDetached(cwd, DATA_BRANCH, message, op, { git })
  if (!result.ok) throw new Refused({ ok: false, reason: result.reason }, 'the repository has no remote, so nothing can carry the change')
}

/** Who this command claims as; a checkout on no branch has no identity to claim with. */
async function identity(cwd: string, git: GitRunner): Promise<string> {
  const holder = await inRepo(() => holderOf(cwd, git))
  if (!holder.ok) throw new Refused({ ok: false, reason: holder.reason }, 'this checkout is on no branch, so there is nothing to claim as')
  return holder.holder
}

function noTicket(file: string): Refused {
  return new Refused({ ok: false, reason: 'no-ticket', file }, `no ticket ${TICKETS_DIR}/${file}`)
}

/** A ticket named by its bare filename, or by its `tickets/<file>` path. */
function ticketArg(arg: string): string {
  const file = isTicketPath(arg) ? arg.slice(TICKETS_DIR.length + 1) : arg
  if (!isTicketFile(file)) throw new Refused({ ok: false, reason: 'invalid-path', file: arg }, `${arg} is not a ticket filename`)
  return file
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
