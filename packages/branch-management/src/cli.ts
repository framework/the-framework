import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { stat } from 'node:fs/promises'
import { nodeGitRunner, checkoutRoot, gitReason, type GitRunner } from './git.js'
import { agentBranchName, isSafeAgentId } from './branch-names.js'
import {
  branchPushed,
  currentBranch,
  isWorktreeRoot,
  nameBranch,
  projectRoot,
  type NameBranchRefusal,
  worktreeBranch,
  worktreeClean,
  worktreeDirEntries,
  worktreePath,
  worktreeSize,
} from './worktree.js'
import { createCheckout, attachCheckout } from './checkout.js'
import { reconcileBranchLinks } from './branch-links.js'
import { reclaimWorktree, type ReclaimOutcome, type ReclaimRefusal } from './reclaim.js'

/**
 * The command line over the package (#1725): the same functions a daemon calls, for an agent
 * (and a person) in a shell. One implementation, every surface a caller.
 *
 * The contract: JSON on stdout, one line for a person on stderr, and the exit code says how it
 * went — 0 for a result, 1 for a refusal or a git failure, 2 for a command that could not be
 * read. A refusal is a rule saying no (a dirty tree, a name that is not a session name); it is
 * reported on stdout as `{ ok: false, reason }` so a caller parsing the output learns why, and
 * on stderr so a person does.
 *
 * Where the project is comes from the working directory: for every command that acts on the
 * project (`create`, `attach`, `list`, `remove`, `prune`) it is the checkout whose `.branches/`
 * the working directory is under, else the checkout itself — so the
 * same command works from inside an agent's checkout; the commands that act on one checkout
 * (`name`, `status`) act on the one the working directory is in.
 */

export const USAGE = `usage: branch-management <command>

  create <id> [--base <ref>]   a checkout for agent <id>, on a fresh branch agent-<id>
  attach <id> <branch>         a checkout for agent <id>, on an existing branch
  name <name>                  rename this checkout's branch to agent-<name>; prints the name it got
  status [path]                the checkout's branch, whether it is clean, whether it is on the remote
  list [--sizes]               every agent checkout under .branches/
  remove <id> [--no-push]      reclaim agent <id>'s checkout, once the remote has everything it holds
  prune [--no-push]            remove, for every checkout

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
  constructor(readonly outcome: CliRefusal, readonly line: string) {
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
    io.stdout(JSON.stringify(await run(rest, io.cwd, git)))
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

type Command = (args: string[], cwd: string, git: GitRunner) => Promise<unknown>

const COMMANDS: Record<string, Command> = {
  async create(args, cwd, git) {
    const { positionals, values } = parse(args, { base: { type: 'string' } }, 1)
    const agentId = agentIdArg(positionals[0]!)
    const repo = await project(cwd, git)
    return { ok: true, ...(await createCheckout(repo, { agentId, ...(values.base ? { base: values.base } : {}) }, git)) }
  },

  async attach(args, cwd, git) {
    const { positionals } = parse(args, {}, 2)
    const [agentId, branch] = [agentIdArg(positionals[0]!), positionals[1]!]
    const repo = await project(cwd, git)
    return { ok: true, ...(await attachCheckout(repo, { agentId, branch }, git)) }
  },

  async name(args, cwd, git) {
    const { positionals } = parse(args, {}, 1)
    const name = positionals[0]!
    const checkout = await inRepo(() => checkoutRoot(cwd, git))
    const outcome = await nameBranch(checkout, name, git)
    if (!outcome.ok) throw new Refused(outcome, NAME_REFUSALS[outcome.reason](name, checkout))
    // The `.branches/<name>` link follows the rename now, not at a daemon's next pass.
    await reconcileBranchLinks(await projectRoot(checkout, git), { git })
    return outcome
  },

  async status(args, cwd, git) {
    const { positionals } = parse(args, {}, 0, 1)
    const path = positionals[0] ? resolve(cwd, positionals[0]) : await inRepo(() => checkoutRoot(cwd, git))
    if (!(await isWorktreeRoot(path, git))) throw new Refused({ ok: false, reason: 'not-a-worktree', path }, `${path} is not a git worktree`)
    const branch = await currentBranch(path, git)
    const clean = await worktreeClean(path, git)
    const onRemote = branch ? await branchPushed(await projectRoot(path, git), branch, git) : false
    return { ok: true, path, ...(branch ? { branch } : {}), clean, onRemote }
  },

  async list(args, cwd, git) {
    const { values } = parse(args, { sizes: { type: 'boolean' } }, 0)
    const repo = await project(cwd, git)
    const rows = []
    for (const entry of await worktreeDirEntries(repo)) {
      const branch = await worktreeBranch(entry.path, git)
      const sizeBytes = values.sizes ? await worktreeSize(entry.path) : undefined
      rows.push({ ...entry, ...(branch ? { branch } : {}), ...(sizeBytes === undefined ? {} : { sizeBytes }) })
    }
    return rows
  },

  async remove(args, cwd, git) {
    const { positionals, values } = parse(args, { 'no-push': { type: 'boolean' } }, 1)
    const agentId = agentIdArg(positionals[0]!)
    const repo = await project(cwd, git)
    const outcome = await reclaim(repo, agentId, !values['no-push'], git)
    if (!outcome.ok) throw new Refused(outcome, refusalLine(agentId, outcome))
    // A link named after a branch that just went with its checkout is stale from this moment.
    await reconcileBranchLinks(repo, { git })
    return outcome
  },

  async prune(args, cwd, git) {
    const { values } = parse(args, { 'no-push': { type: 'boolean' } }, 0)
    const repo = await project(cwd, git)
    const removed: string[] = []
    const skipped: { agentId: string; reason: string; detail: string }[] = []
    for (const { agentId } of await worktreeDirEntries(repo)) {
      const outcome = await reclaim(repo, agentId, !values['no-push'], git)
      if (outcome.ok) removed.push(agentId)
      else skipped.push({ agentId, reason: outcome.reason, detail: refusalLine(agentId, outcome) })
    }
    // Once for the whole pass: a reconcile reads every checkout that is left.
    if (removed.length) await reconcileBranchLinks(repo, { git })
    return { ok: true, removed, skipped }
  },
}

/** A refusal `remove` and `prune` can add to the reclaim rule's own: there is no such checkout. */
type RemoveRefusal = { ok: false; reason: 'no-checkout'; agentId: string }

/** One agent's checkout under the reclaim rule; a missing checkout is its own refusal. */
async function reclaim(repo: string, agentId: string, mayPush: boolean, git: GitRunner): Promise<ReclaimOutcome | RemoveRefusal> {
  const path = worktreePath(repo, agentId)
  if (!(await stat(path).then(s => s.isDirectory(), () => false))) return { ok: false, reason: 'no-checkout', agentId }
  return reclaimWorktree(repo, path, { birthBranch: agentBranchName(agentId), mayPush, git })
}

/** Why a checkout stayed, as one line for a person. */
function refusalLine(agentId: string, outcome: (ReclaimOutcome & { ok: false }) | RemoveRefusal): string {
  const reason: ReclaimRefusal | 'no-checkout' = outcome.reason
  switch (reason) {
    case 'no-checkout':
      return `no checkout for agent ${agentId}`
    case 'not-a-worktree':
      return `agent ${agentId}'s directory is not a git worktree; left alone`
    case 'no-branch':
      return `agent ${agentId}'s checkout is on no branch; kept`
    case 'dirty':
      return `${branchOf(outcome)} has uncommitted work; the checkout was kept`
    case 'not-on-remote':
      return `${branchOf(outcome)} is not on the remote (${detailOf(outcome) ?? 'not pushed'}); the checkout was kept`
  }
}

const branchOf = (outcome: object): string => String((outcome as { branch?: string }).branch)
const detailOf = (outcome: object): string | undefined => (outcome as { detail?: string }).detail

const NAME_REFUSALS: Record<NameBranchRefusal, (name: string, checkout: string) => string> = {
  'invalid-name': name => `${name} is not a session name: use [a-z0-9-]+`,
  'not-a-worktree': (_, checkout) => `${checkout} is not a git worktree`,
  'no-branch': (_, checkout) => `${checkout} is on no branch`,
  'not-an-agent-branch': (_, checkout) => `${checkout} is not on an agent branch; only agent-* branches are renamed`,
}

/** An agent id is path-safe, or the command has nothing to name a checkout with. */
function agentIdArg(agentId: string): string {
  if (!isSafeAgentId(agentId)) throw new Refused({ ok: false, reason: 'invalid-id', agentId }, `${agentId} is not an agent id`)
  return agentId
}

/** The project the working directory belongs to. */
async function project(cwd: string, git: GitRunner): Promise<string> {
  return inRepo(() => projectRoot(cwd, git))
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
