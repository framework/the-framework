import { join } from 'node:path'
import {
  excludeFromGit,
  fileBranchPath,
  nodeBranchFileFs,
  nodeGitRunner,
  pullFileBranch,
  withFileBranch,
  type BranchFileFs,
  type CommitMessage,
  type FileBranchSync,
  type FileBranchWrite,
  type GitRunner,
} from '@gemstack/skill-branches'
import { QUEUE_FILE, TICKETS_BRANCH, TICKETS_CHECKOUT_DIR, TICKETS_DIR } from './names.js'

// Where the tickets live, bound to the branch: the `tickets` branch of the project's repository,
// checked out under `.branches/tickets` for a long-lived process, with a `tickets` link at the
// repository root so the roadmap is one listing away for a person.

/** The branch's persistent checkout under a project: `<root>/.branches/tickets`. */
export function ticketsCheckoutPath(root: string): string {
  return fileBranchPath(root, TICKETS_BRANCH)
}

/** The `tickets/` directory inside the persistent checkout: `<root>/.branches/tickets/tickets`. */
export function ticketsDir(root: string): string {
  return join(ticketsCheckoutPath(root), TICKETS_DIR)
}

/** The plain-file seams an operation on the branch's files needs. */
export type TicketFiles = BranchFileFs

/**
 * A caller's write funnel: apply `op` to a checkout of the branch, commit, push. The daemon's is
 * the persistent checkout's serialized cycle; a test's fake stands in.
 */
export type TicketsFunnel = (root: string, message: CommitMessage, op: (dir: string) => Promise<void>) => Promise<FileBranchWrite>

/** Injectable seams so every operation is unit-testable off disk and git; production takes the defaults. */
export interface TicketDeps extends Partial<TicketFiles> {
  funnel?: TicketsFunnel
  log?: (message: string) => void
}

/** The default funnel: the persistent checkout's write cycle, on the tickets branch. */
export const ticketsFunnel: TicketsFunnel = (root, message, op) => withFileBranch(root, TICKETS_BRANCH, message, op)

/** Fill in whatever a caller left out, so an operation reads the same way in tests and out. */
export function resolveTicketDeps(deps: TicketDeps): TicketFiles & { funnel: TicketsFunnel; log: (message: string) => void } {
  const fs = nodeBranchFileFs()
  return {
    read: deps.read ?? fs.read,
    write: deps.write ?? fs.write,
    remove: deps.remove ?? fs.remove,
    list: deps.list ?? fs.list,
    funnel: deps.funnel ?? ticketsFunnel,
    log: deps.log ?? (() => {}),
  }
}

/** The filesystem the root link needs; `node:fs/promises` in production. */
export interface LinkFs {
  /** Whether anything (file, dir, or dangling link) sits at `path`. */
  lexists: (path: string) => Promise<boolean>
  symlink: (target: string, path: string) => Promise<void>
}

function nodeLinkFs(): LinkFs {
  const fs = () => import('node:fs/promises')
  return {
    lexists: path => fs().then(f => f.lstat(path)).then(() => true, () => false),
    symlink: (target, path) => fs().then(f => f.symlink(target, path)),
  }
}

/**
 * Bring a long-lived process's view of the branch up to date: the branch and its persistent
 * checkout exist, the queue file is seeded on a branch born empty (so readers and people find a
 * file, not a mystery), the repository root links `tickets` into the checkout, and the checkout
 * converges with origin — reading what other machines and cloud sessions pushed, and pushing
 * anything an earlier cycle left stranded. Reports why it could not converge; never throws.
 *
 * The root link is created only over nothing — a real `tickets/` directory or a file of the
 * user's own is theirs — and hidden from git the moment it is made, as an uncommitted entry at
 * the root would ride any sweeping `git add -A` onto a code branch. Hiding it takes a pair of
 * rules, because the repository's exclude speaks for every worktree at once, the persistent
 * checkout included, whose root holds the real `tickets/` the branch exists to carry: `/tickets`
 * hides root entries of that name, and `!/tickets/` re-includes directories, which a link never
 * matches — so the link stays hidden while the checkout's directory keeps committing.
 */
export async function syncTickets(
  root: string,
  deps: TicketDeps & { git?: GitRunner; linkFs?: LinkFs } = {},
): Promise<FileBranchSync> {
  const r = resolveTicketDeps(deps)
  const git = deps.git ?? nodeGitRunner()
  const seeded = await r.funnel(root, 'seed the queue', async dir => {
    const queue = join(dir, QUEUE_FILE)
    if (!(await r.read(queue).then(() => true, () => false))) await r.write(queue, '')
  })
  if (!seeded.ok && !seeded.committed) return { ok: false, error: seeded.error }
  const linkFs = deps.linkFs ?? nodeLinkFs()
  const rootLink = join(root, TICKETS_DIR)
  if (!(await linkFs.lexists(rootLink))) {
    await linkFs.symlink(join(TICKETS_CHECKOUT_DIR, TICKETS_DIR), rootLink).catch(() => {})
    await excludeFromGit(root, '/' + TICKETS_DIR, undefined, git).catch(() => {})
    await excludeFromGit(root, '!/' + TICKETS_DIR + '/', undefined, git).catch(() => {})
  }
  return pullFileBranch(root, TICKETS_BRANCH, { git, log: r.log })
}
