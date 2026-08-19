import { dirname, join } from 'node:path'
import { nodeGitRunner, type GitRunner } from './project.js'
import { FRAMEWORK_DIR, BRANCHES_DIR } from './store/index.js'
import { DATA_BRANCH } from './branch-names.js'
import { TICKETS_DIR, FLAT_TODO_FILE } from './tickets.js'
import { errorMessage } from './error-message.js'

export { DATA_BRANCH }

// The `tf-data` branch (#1582): every file The Framework itself writes — the tickets,
// the queue, the session archives — lives on one branch of the project repo, the way `gh-pages`
// holds a site's data. Main is 100% code, 0% framework data.
//
// What this buys, structurally: the branch is safe to push and pull *eagerly*, because nothing on
// it is anyone's working tree. That closes #1577 (an agent's stale queue copy clobbering the
// freshly-merged one — there is one queue, on one branch, with one local writer) and #1397 (run
// bookkeeping stranded on local main — data commits land on a branch whose whole job is to be
// pushed), and it gives every machine and cloud session the same view: fetch the branch, read the
// files, commit onto it, push.
//
// The daemon is the single LOCAL committer. Every local write funnels through
// {@link withDataBranch}, which serializes per project and runs the whole cycle — sync, apply,
// commit, push — so two ticks can never interleave half-written queue states. A data-writing
// *session* (triage, sync) is a remote writer like another machine: it commits onto this branch in
// its own checkout and pushes, and the race is settled by the push itself — whoever loses re-syncs
// and re-applies.
//
// The checkout lives at `.the-framework/branches/tf-data`, a plain git worktree in the
// #1580 branches dir, named as its branch like every checkout there. The repo root keeps a
// `tickets` symlink into it so the roadmap stays one `ls` away for humans.

/** The data branch's checkout under a project: `<repo>/.the-framework/branches/tf-data`. */
export function dataWorktreePath(cwd: string): string {
  return join(cwd, FRAMEWORK_DIR, BRANCHES_DIR, DATA_BRANCH)
}

/**
 * git's well-known empty tree, present in every repository without being written first. Committing
 * it is how the branch is born parentless with no working-tree gymnastics: `git commit-tree` +
 * `git branch` never touches any checkout, and no code commit is ever an ancestor of the data
 * history.
 */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

/** Injectable seams; production takes the defaults. */
export interface DataBranchDeps {
  git?: GitRunner
  /** Write one file, creating parents (default `node:fs/promises`). */
  write?: (path: string, content: string) => Promise<void>
  /** Whether anything (file, dir, or dangling link) sits at `path` (default `fs.lstat`). */
  lexists?: (path: string) => Promise<boolean>
  /** Create a symlink at `path` to `target` (default `node:fs/promises`). */
  symlink?: (target: string, path: string) => Promise<void>
  log?: (message: string) => void
}

/** The seams resolved, so every operation below reads the same way. */
interface Resolved {
  git: GitRunner
  write: (path: string, content: string) => Promise<void>
  lexists: (path: string) => Promise<boolean>
  symlink: (target: string, path: string) => Promise<void>
  log: (message: string) => void
}

function resolveDeps(deps: DataBranchDeps): Resolved {
  const fs = () => import('node:fs/promises')
  return {
    git: deps.git ?? nodeGitRunner(),
    write:
      deps.write ??
      (async (path, content) => {
        const f = await fs()
        await f.mkdir(dirname(path), { recursive: true })
        await f.writeFile(path, content, 'utf8')
      }),
    lexists: deps.lexists ?? (path => fs().then(f => f.lstat(path)).then(() => true, () => false)),
    symlink: deps.symlink ?? ((target, path) => fs().then(f => f.symlink(target, path))),
    log: deps.log ?? (() => {}),
  }
}

/** Whether the repo has any remote to sync the branch with. No remote is a local-only project, fine. */
async function hasRemote(cwd: string, git: GitRunner): Promise<boolean> {
  try {
    return (await git(['remote'], cwd)).trim().length > 0
  } catch {
    return false
  }
}

/** Whether a ref exists locally. */
async function refExists(cwd: string, ref: string, git: GitRunner): Promise<boolean> {
  return git(['rev-parse', '--verify', '--quiet', ref], cwd).then(
    () => true,
    () => false,
  )
}

/**
 * One serialized cycle per project, so a writer and the eager pull can never interleave: the
 * promise chain is the lock, and every public entry point below joins it.
 */
const chains = new Map<string, Promise<unknown>>()

function serialize<T>(cwd: string, task: () => Promise<T>): Promise<T> {
  const next = (chains.get(cwd) ?? Promise.resolve()).then(task, task)
  chains.set(
    cwd,
    next.catch(() => {}),
  )
  return next
}

/**
 * The unserialized ensure: branch, checkout, seed, symlink. Split from {@link ensureDataWorktree}
 * so the writer and the pull can run it inside the cycle they already hold the chain for.
 */
async function ensureCore(cwd: string, r: Resolved): Promise<void> {
  const path = dataWorktreePath(cwd)
  // Already checked out on the right branch: done. The common case, taken on every tick.
  const onBranch = await r.git(['rev-parse', '--abbrev-ref', 'HEAD'], path).then(
    out => out.trim() === DATA_BRANCH,
    () => false,
  )
  if (!onBranch) {
    if (!(await refExists(cwd, `refs/heads/${DATA_BRANCH}`, r.git))) {
      // Take origin's branch when there is one (the every-other-machine case); otherwise the
      // branch is born here, parentless.
      if (await hasRemote(cwd, r.git)) await r.git(['fetch', 'origin', DATA_BRANCH], cwd).catch(() => {})
      if (await refExists(cwd, `refs/remotes/origin/${DATA_BRANCH}`, r.git)) {
        await r.git(['branch', DATA_BRANCH, `origin/${DATA_BRANCH}`], cwd)
      } else {
        const commit = (await r.git(['commit-tree', EMPTY_TREE, '-m', '[The Framework] tf-data'], cwd)).trim()
        await r.git(['branch', DATA_BRANCH, commit], cwd)
      }
    }
    // A stale registration at this path (the dir was deleted by hand) blocks the add.
    await r.git(['worktree', 'prune'], cwd).catch(() => {})
    await r.git(['worktree', 'add', path, DATA_BRANCH], cwd)
  }
  // Seed the queue on a branch born empty, so readers and humans find the file, not a mystery.
  // Committed here, so the checkout is clean between cycles and no later write's message lies
  // about carrying the seed; the push is owed like any local commit and rides the next cycle.
  if (!(await r.lexists(join(path, FLAT_TODO_FILE)))) {
    await r.write(join(path, FLAT_TODO_FILE), '')
    await r.git(['add', '-A'], path)
    await r.git(['commit', '-m', '[The Framework] seed the queue'], path)
  }
  // The roadmap stays one `ls` away: `<repo>/tickets` links into the data checkout. Created only
  // over nothing — a real `tickets/` dir (pre-migration) or a user's own file is theirs.
  const rootLink = join(cwd, TICKETS_DIR)
  if (!(await r.lexists(rootLink))) {
    await r.symlink(join(FRAMEWORK_DIR, BRANCHES_DIR, DATA_BRANCH, TICKETS_DIR), rootLink).catch(() => {})
  }
}

/**
 * Bring the checkout up to date with origin: fetch, then rebase whatever local commits exist (a
 * push that could not land earlier) onto origin's tip. A conflict resolves toward origin — the
 * writer re-applies the local intent afterwards, which is the "re-run on conflict" rule the whole
 * cycle is built on.
 */
async function syncCore(cwd: string, r: Resolved): Promise<void> {
  if (!(await hasRemote(cwd, r.git))) return
  const path = dataWorktreePath(cwd)
  await r.git(['fetch', 'origin', DATA_BRANCH], cwd).catch(() => {})
  if (!(await refExists(cwd, `refs/remotes/origin/${DATA_BRANCH}`, r.git))) return
  try {
    await r.git(['rebase', `origin/${DATA_BRANCH}`], path)
  } catch {
    await r.git(['rebase', '--abort'], path).catch(() => {})
    await r.git(['reset', '--hard', `origin/${DATA_BRANCH}`], path)
  }
}

/**
 * Make sure the data branch and its checkout exist, the queue file is seeded, and the root
 * `tickets` symlink points into the checkout. Idempotent and cheap when everything is in place
 * (one `git rev-parse` against the checkout); never throws — a project this cannot be set up in
 * reports why and is left alone.
 */
export async function ensureDataWorktree(cwd: string, deps: DataBranchDeps = {}): Promise<{ ok: boolean; error?: string }> {
  const r = resolveDeps(deps)
  return serialize(cwd, async () => {
    try {
      await ensureCore(cwd, r)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: errorMessage(err) }
    }
  })
}

/**
 * What one funneled write did. `changed: false` is the clean no-op (the op wrote nothing new).
 * A failure says whether the change still landed as a local commit (`committed` — the push is
 * what failed, and the next cycle carries it out) or nothing survived at all.
 */
export type DataWriteResult =
  | { ok: true; changed: boolean; pushed: boolean }
  | { ok: false; committed: boolean; error: string }

/**
 * Apply one change to the data branch: sync with origin, run `op` against the checkout, commit
 * whatever it changed, push. The single funnel every local data write goes through (#1582).
 *
 * `op` must be re-runnable: when the push loses a race with another machine, the cycle re-syncs
 * and runs it again against the fresher state rather than force-fitting a stale commit — the op
 * *is* the intent, the commit is just its serialization. Two attempts; a push that still fails
 * (the network, most likely) keeps the commit local and reports the error — the next cycle's sync
 * rebases it onto whatever origin has by then, and the next push carries it.
 *
 * Never throws: callers run on background ticks with nothing to catch it.
 */
export async function withDataBranch(
  cwd: string,
  message: string | (() => string),
  op: (dataDir: string) => Promise<void>,
  deps: DataBranchDeps = {},
): Promise<DataWriteResult> {
  const r = resolveDeps(deps)
  const path = dataWorktreePath(cwd)
  return serialize(cwd, async () => {
    try {
      await ensureCore(cwd, r)
      const remote = await hasRemote(cwd, r.git)
      for (let attempt = 0; ; attempt++) {
        await syncCore(cwd, r)
        await op(path)
        await r.git(['add', '-A'], path)
        const staged = (await r.git(['status', '--porcelain'], path)).trim()
        // The message is resolved after the op ran: a batch write only knows what it did then.
        if (staged) await r.git(['commit', '-m', typeof message === 'function' ? message() : message], path)
        if (!remote) return { ok: true, changed: Boolean(staged), pushed: false }
        // Unpushed commits — this cycle's, or an earlier cycle's that the sync just rebased. The
        // push is owed whenever any exist, even when this op itself wrote nothing new.
        const ahead = (await refExists(cwd, `refs/remotes/origin/${DATA_BRANCH}`, r.git))
          ? (await r.git(['rev-list', '--count', `origin/${DATA_BRANCH}..${DATA_BRANCH}`], cwd)).trim() !== '0'
          : true
        if (!ahead) return { ok: true, changed: false, pushed: false }
        try {
          await r.git(['push', 'origin', `${DATA_BRANCH}:${DATA_BRANCH}`], path)
          return { ok: true, changed: Boolean(staged), pushed: true }
        } catch (err) {
          if (attempt >= 1)
            return { ok: false, committed: true, error: `the data branch could not be pushed: ${errorMessage(err)}` }
        }
      }
    } catch (err) {
      // The op's half-written files must not ride a later, unrelated commit: put the checkout
      // back to its committed state before reporting.
      await r.git(['reset', '--hard'], path).catch(() => {})
      await r.git(['clean', '-fd'], path).catch(() => {})
      return { ok: false, committed: false, error: errorMessage(err) }
    }
  })
}

/**
 * The eager pull (#1582): sync the checkout with origin so this machine reads what other machines
 * and cloud sessions committed, without waiting for the next local write — and push anything a
 * failed cycle left stranded locally, via the same owed-push rule as the writer. Ensures the
 * checkout exists, so a fresh clone converges on its first tick. Never throws.
 */
export async function pullDataBranch(cwd: string, deps: DataBranchDeps = {}): Promise<void> {
  await withDataBranch(cwd, '[The Framework] data sync', async () => {}, deps).then(result => {
    if (!result.ok) resolveDeps(deps).log(`[framework] data branch sync: ${result.error}`)
  })
}

/**
 * The project root `cwd` belongs to: the directory holding the repo's real `.git`. From the main
 * checkout that is `cwd` itself; from an agent's worktree it is the repo the worktree was made
 * from — where the data checkout lives, and the address every data write funnels to. `undefined`
 * outside any repo.
 */
export async function dataProjectRoot(cwd: string, git: GitRunner = nodeGitRunner()): Promise<string | undefined> {
  try {
    const gitDir = (await git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd)).trim()
    return gitDir ? dirname(gitDir) : undefined
  } catch {
    return undefined
  }
}

/**
 * Read one file off the data branch, from anywhere in the repo: the checkout when this `cwd` has
 * one, else `git show` against the local branch (worktrees share the repo's refs, so an agent's
 * checkout reads the same data without holding any of it), else against `origin/…` (a fresh
 * clone that fetched but never branched — the cloud case). `undefined` when the file exists in
 * none of them. Never throws.
 *
 * `fresh: true` fetches first and prefers origin's copy — for a reader about to act on the queue
 * from a long-lived agent process, where the local ref may trail what other writers pushed.
 */
export async function readDataFile(
  cwd: string,
  rel: string,
  opts: { fresh?: boolean } = {},
  deps: DataBranchDeps = {},
): Promise<string | undefined> {
  const r = resolveDeps(deps)
  const remote = opts.fresh && (await hasRemote(cwd, r.git))
  if (remote) await r.git(['fetch', 'origin', DATA_BRANCH], cwd).catch(() => {})
  const sources = [
    ...(remote ? [`origin/${DATA_BRANCH}`] : []),
    DATA_BRANCH,
    ...(remote ? [] : [`origin/${DATA_BRANCH}`]),
  ]
  if (!opts.fresh) {
    const fromCheckout = await r.git(['rev-parse', '--abbrev-ref', 'HEAD'], dataWorktreePath(cwd)).then(
      out => out.trim() === DATA_BRANCH,
      () => false,
    )
    if (fromCheckout) {
      const { readFile } = await import('node:fs/promises')
      const md = await readFile(join(dataWorktreePath(cwd), rel), 'utf8').catch(() => undefined)
      if (md !== undefined) return md
    }
  }
  for (const ref of sources) {
    const md = await r.git(['show', `${ref}:${rel}`], cwd).catch(() => undefined)
    if (md !== undefined) return md
  }
  return undefined
}
