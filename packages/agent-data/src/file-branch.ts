import { dirname, join } from 'node:path'
import { BRANCHES_DIR } from './names.js'
import { nodeGitRunner, type GitRunner } from './git.js'
import { excludeFromGit } from './git-exclude.js'

// A branch used as a file store: a branch of the project's repository that holds files nobody
// edits in a working tree — the way `gh-pages` holds a site — read and written by programs, and
// safe to push and pull eagerly because nothing on it is anyone's checkout. The caller names the
// branch; this module knows git, not what the files mean.
//
// Two writers, one rule. A long-lived process (a daemon) keeps a persistent checkout of the
// branch under `.branches/<branch>` and writes through {@link withFileBranch}: one serialized
// cycle per branch — sync, apply, commit, push. A one-shot writer in any clone (a command an
// agent runs) writes through {@link writeFileBranchDetached}: a throwaway worktree on origin's
// tip, the same apply-commit-push, gone afterwards — it never touches the persistent checkout,
// which is another process's. Both treat the change as an intent: when the push loses a race,
// the cycle re-syncs and re-applies rather than force-fitting a stale commit.

/** The persistent checkout of `branch` under a project: `<repo>/.branches/<branch>`. */
export function fileBranchPath(repo: string, branch: string): string {
  return join(repo, BRANCHES_DIR, branch)
}

/**
 * git's well-known empty tree, present in every repository without being written first. Committing
 * it is how a branch is born parentless with no working-tree gymnastics: `git commit-tree` +
 * `git branch` never touches any checkout, and no code commit is ever an ancestor of the history.
 */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

/** Injectable seams; production takes the defaults. */
export interface FileBranchDeps {
  git?: GitRunner
  log?: (message: string) => void
}

interface Resolved {
  git: GitRunner
  log: (message: string) => void
}

function resolveDeps(deps: FileBranchDeps): Resolved {
  return { git: deps.git ?? nodeGitRunner(), log: deps.log ?? (() => {}) }
}

/** Whether the repo has any remote to sync the branch with. */
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

/** The message a failed git invocation carries, or the value itself as text. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * One serialized cycle per branch of a project, so a writer and the eager pull can never
 * interleave: the promise chain is the lock, and every public entry point below joins it.
 */
const chains = new Map<string, Promise<unknown>>()

function serialize<T>(repo: string, branch: string, task: () => Promise<T>): Promise<T> {
  const key = `${repo}\0${branch}`
  const next = (chains.get(key) ?? Promise.resolve()).then(task, task)
  chains.set(
    key,
    next.catch(() => {}),
  )
  return next
}

/** Make the branch exist locally: origin's copy when there is one, else born here, parentless. */
async function ensureBranchRef(repo: string, branch: string, git: GitRunner): Promise<void> {
  if (await refExists(repo, `refs/heads/${branch}`, git)) return
  if (await hasRemote(repo, git)) await git(['fetch', 'origin', branch], repo).catch(() => {})
  if (await refExists(repo, `refs/remotes/origin/${branch}`, git)) {
    await git(['branch', branch, `origin/${branch}`], repo)
  } else {
    const commit = (await git(['commit-tree', EMPTY_TREE, '-m', `create the ${branch} branch`], repo)).trim()
    await git(['branch', branch, commit], repo)
  }
}

/**
 * The unserialized ensure: branch and checkout. Split from {@link ensureFileBranch} so the
 * writer and the pull can run it inside the cycle they already hold the chain for.
 */
async function ensureCore(repo: string, branch: string, r: Resolved): Promise<void> {
  const path = fileBranchPath(repo, branch)
  // Already checked out on the right branch: done. The common case, taken on every tick.
  const onBranch = await r.git(['rev-parse', '--abbrev-ref', 'HEAD'], path).then(
    out => out.trim() === branch,
    () => false,
  )
  if (onBranch) return
  await ensureBranchRef(repo, branch, r.git)
  // A stale registration at this path (the dir was deleted by hand) blocks the add.
  await r.git(['worktree', 'prune'], repo).catch(() => {})
  await r.git(['worktree', 'add', path, branch], repo)
  // The checkout sits under `.branches/` like the agent checkouts, and is hidden the same way
  // (git's own exclude, no tracked file) — this may be the first checkout the project gets.
  await excludeFromGit(repo, '/' + BRANCHES_DIR, undefined, r.git).catch(() => {})
}

/**
 * Bring the checkout up to date with origin: fetch, then rebase whatever local commits exist (a
 * push that could not land earlier) onto origin's tip. A conflict resolves toward origin — the
 * writer re-applies the local intent afterwards, which is the "re-run on conflict" rule the whole
 * cycle is built on.
 */
async function syncCore(repo: string, branch: string, r: Resolved): Promise<void> {
  if (!(await hasRemote(repo, r.git))) return
  const path = fileBranchPath(repo, branch)
  await r.git(['fetch', 'origin', branch], repo).catch(() => {})
  if (!(await refExists(repo, `refs/remotes/origin/${branch}`, r.git))) return
  try {
    await r.git(['rebase', `origin/${branch}`], path)
  } catch {
    await r.git(['rebase', '--abort'], path).catch(() => {})
    await r.git(['reset', '--hard', `origin/${branch}`], path)
  }
}

/**
 * Make sure the branch and its persistent checkout exist. Idempotent and cheap when everything is
 * in place (one `git rev-parse` against the checkout); never throws — a project this cannot be
 * set up in reports why and is left alone.
 */
export async function ensureFileBranch(repo: string, branch: string, deps: FileBranchDeps = {}): Promise<{ ok: boolean; error?: string }> {
  const r = resolveDeps(deps)
  return serialize(repo, branch, async () => {
    try {
      await ensureCore(repo, branch, r)
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
export type FileBranchWrite =
  | { ok: true; changed: boolean; pushed: boolean }
  | { ok: false; committed: boolean; error: string }

/** A writer's message: fixed, or resolved after the op ran (a batch only knows what it did then). */
export type CommitMessage = string | (() => string)

function resolveMessage(message: CommitMessage): string {
  return typeof message === 'function' ? message() : message
}

/**
 * Apply one change to the branch through its persistent checkout: sync with origin, run `op`
 * against the checkout, commit whatever it changed, push. The single funnel a long-lived
 * process's writes go through.
 *
 * `op` must be re-runnable: when the push loses a race with another writer, the cycle re-syncs
 * and runs it again against the fresher state rather than force-fitting a stale commit — the op
 * *is* the intent, the commit is just its serialization. Two attempts; a push that still fails
 * (the network, most likely) keeps the commit local and reports the error — the next cycle's sync
 * rebases it onto whatever origin has by then, and the next push carries it.
 *
 * Never throws: callers run on background ticks with nothing to catch it.
 */
export async function withFileBranch(
  repo: string,
  branch: string,
  message: CommitMessage,
  op: (dir: string) => Promise<void>,
  deps: FileBranchDeps = {},
): Promise<FileBranchWrite> {
  const r = resolveDeps(deps)
  const path = fileBranchPath(repo, branch)
  return serialize(repo, branch, async () => {
    try {
      await ensureCore(repo, branch, r)
      const remote = await hasRemote(repo, r.git)
      for (let attempt = 0; ; attempt++) {
        await syncCore(repo, branch, r)
        // The tip before this op's commit: what a lost push winds back to before re-applying, so
        // the op's first serialization is dropped rather than rebased under its second run.
        const before = (await r.git(['rev-parse', 'HEAD'], path)).trim()
        await op(path)
        await r.git(['add', '-A'], path)
        const staged = (await r.git(['status', '--porcelain'], path)).trim()
        if (staged) await r.git(['commit', '-m', resolveMessage(message)], path)
        if (!remote) return { ok: true, changed: Boolean(staged), pushed: false }
        // Unpushed commits — this cycle's, or an earlier cycle's that the sync just rebased. The
        // push is owed whenever any exist, even when this op itself wrote nothing new.
        const ahead = (await refExists(repo, `refs/remotes/origin/${branch}`, r.git))
          ? (await r.git(['rev-list', '--count', `origin/${branch}..${branch}`], repo)).trim() !== '0'
          : true
        if (!ahead) return { ok: true, changed: false, pushed: false }
        try {
          await r.git(['push', 'origin', `${branch}:${branch}`], path)
          return { ok: true, changed: Boolean(staged), pushed: true }
        } catch (err) {
          if (attempt >= 1) return { ok: false, committed: true, error: `the ${branch} branch could not be pushed: ${errorMessage(err)}` }
          if (staged) await r.git(['reset', '--hard', before], path)
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

/** How a pull went: converged with origin, or why it could not. */
export type FileBranchSync = { ok: true } | { ok: false; error: string }

/**
 * The eager pull: sync the persistent checkout with origin so this machine reads what other
 * machines and cloud sessions committed, without waiting for the next local write — and push
 * anything a failed cycle left stranded locally, via the same owed-push rule as the writer.
 * Ensures the checkout exists, so a fresh clone converges on its first tick. Never throws.
 *
 * Reports why it could not converge: a push origin rejects, or no origin to converge with at
 * all. The writer treats a remote-less repo as fine — the commit is safe locally — but a sync's
 * whole job is to meet the other machines, and a repo nothing can reach is an error state the
 * caller has to surface, not a mode this supports.
 */
export async function pullFileBranch(repo: string, branch: string, deps: FileBranchDeps = {}): Promise<FileBranchSync> {
  const r = resolveDeps(deps)
  const result = await withFileBranch(repo, branch, 'sync', async () => {}, deps)
  const outcome: FileBranchSync = !result.ok
    ? { ok: false, error: result.error }
    : (await hasRemote(repo, r.git))
      ? { ok: true }
      : { ok: false, error: `the repository has no remote, so the ${branch} branch cannot be shared with other machines` }
  if (!outcome.ok) r.log(`[branches] ${branch}: ${outcome.error}`)
  return outcome
}

/**
 * The repository `cwd` belongs to: the directory holding the repo's real `.git`. From the main
 * checkout that is `cwd` itself; from an agent's worktree it is the repo the worktree was made
 * from — where the persistent checkout lives, and the address every funneled write goes to.
 * `undefined` outside any repo.
 */
export async function fileBranchRepo(cwd: string, git: GitRunner = nodeGitRunner()): Promise<string | undefined> {
  try {
    const gitDir = (await git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd)).trim()
    return gitDir ? dirname(gitDir) : undefined
  } catch {
    return undefined
  }
}

/**
 * The refs a read looks at, in order. `fresh` fetches first and prefers origin's copy — for a
 * reader about to act on the files from a long-lived process, where the local ref may trail what
 * other writers pushed. Otherwise the local branch first, then origin's copy (a fresh clone that
 * fetched but never branched — the cloud case).
 */
async function readRefs(repo: string, branch: string, fresh: boolean | undefined, git: GitRunner): Promise<string[]> {
  const remote = fresh && (await hasRemote(repo, git))
  if (remote) await git(['fetch', 'origin', branch], repo).catch(() => {})
  return remote ? [`origin/${branch}`, branch] : [branch, `origin/${branch}`]
}

/**
 * Read one file off the branch, from anywhere in the repo: the persistent checkout when this
 * `cwd`'s repo has one, else `git show` against the local branch (worktrees share the repo's
 * refs, so an agent's checkout reads the same files without holding any of them), else against
 * `origin/…`. `undefined` when the file exists in none of them. Never throws.
 */
export async function readBranchFile(
  cwd: string,
  branch: string,
  rel: string,
  opts: { fresh?: boolean } = {},
  deps: FileBranchDeps = {},
): Promise<string | undefined> {
  const r = resolveDeps(deps)
  const repo = (await fileBranchRepo(cwd, r.git)) ?? cwd
  if (!opts.fresh) {
    const path = fileBranchPath(repo, branch)
    const fromCheckout = await r.git(['rev-parse', '--abbrev-ref', 'HEAD'], path).then(
      out => out.trim() === branch,
      () => false,
    )
    if (fromCheckout) {
      const { readFile } = await import('node:fs/promises')
      const md = await readFile(join(path, rel), 'utf8').catch(() => undefined)
      if (md !== undefined) return md
    }
  }
  for (const ref of await readRefs(repo, branch, opts.fresh, r.git)) {
    const md = await r.git(['show', `${ref}:${rel}`], cwd).catch(() => undefined)
    if (md !== undefined) return md
  }
  return undefined
}

/**
 * The entries of one directory on the branch, by name — a read off the ref, like
 * {@link readBranchFile}, for a reader that holds no checkout. `[]` for a directory the branch
 * does not have. Never throws.
 */
export async function listBranchDir(
  cwd: string,
  branch: string,
  dir: string,
  opts: { fresh?: boolean } = {},
  deps: FileBranchDeps = {},
): Promise<string[]> {
  const r = resolveDeps(deps)
  const repo = (await fileBranchRepo(cwd, r.git)) ?? cwd
  for (const ref of await readRefs(repo, branch, opts.fresh, r.git)) {
    const out = await r.git(['ls-tree', '--name-only', `${ref}:${dir}`], cwd).catch(() => undefined)
    if (out !== undefined) return out.split('\n').map(line => line.trim()).filter(Boolean)
  }
  return []
}

/** Reads off one ref of the branch, for a reader that opens many files: fetched once, up front. */
export interface BranchReader {
  /** The ref every read goes to: origin's copy when the repo has a remote, else the local branch. */
  ref: string
  /** One file's content, or `undefined` when the ref has no such file. */
  read: (rel: string) => Promise<string | undefined>
  /** One directory's entries by name; `[]` when the ref has no such directory. */
  list: (dir: string) => Promise<string[]>
}

/**
 * Open the branch for reading from any clone, holding no checkout: fetch origin's copy once and
 * read that (a one-shot reader — a command an agent runs — must see what other writers pushed,
 * its own detached write included, which the local ref never moves for), else the local branch
 * when there is no remote. Every read then goes to that one ref; nothing is fetched again.
 */
export async function openBranchReader(cwd: string, branch: string, deps: FileBranchDeps = {}): Promise<BranchReader> {
  const r = resolveDeps(deps)
  const repo = (await fileBranchRepo(cwd, r.git)) ?? cwd
  const [ref] = await readRefs(repo, branch, true, r.git)
  const at = (await refExists(repo, `refs/remotes/origin/${branch}`, r.git)) ? ref! : branch
  return {
    ref: at,
    read: rel => r.git(['show', `${at}:${rel}`], cwd).catch(() => undefined),
    list: dir =>
      r
        .git(['ls-tree', '--name-only', `${at}:${dir}`], cwd)
        .then(out => out.split('\n').map(line => line.trim()).filter(Boolean))
        .catch((): string[] => []),
  }
}

/** What a detached write did, or why it could not: the repo has no remote to carry it. */
export type DetachedWrite =
  | { ok: true; changed: boolean }
  | { ok: false; reason: 'no-remote' }

/**
 * Apply one change to the branch as a one-shot remote writer, from any clone: fetch origin's
 * tip, check it out in a throwaway worktree, run `op` against it, commit, push straight to the
 * branch, remove the worktree. A push that loses a race re-fetches, resets to origin's tip and
 * re-runs the op, twice, the same intent rule as the funnel; a push that still fails throws with
 * git's reason.
 *
 * Never the persistent checkout: that is a long-lived process's, whose funnel sweeps its
 * checkout with `git add -A` and resets it on failure, so a second writer inside it would be
 * committed under the wrong message or wiped. The local branch ref is not moved either — the
 * persistent checkout, when there is one, converges on its own next pull.
 *
 * A branch origin does not have yet is born by the write itself, parentless. A repo with no
 * remote refuses: a change nothing can reach is the caller's error state, not a mode.
 */
export async function writeFileBranchDetached(
  cwd: string,
  branch: string,
  message: CommitMessage,
  op: (dir: string) => Promise<void>,
  deps: FileBranchDeps = {},
): Promise<DetachedWrite> {
  const r = resolveDeps(deps)
  if (!(await hasRemote(cwd, r.git))) return { ok: false, reason: 'no-remote' }
  const { mkdtemp, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const dir = await mkdtemp(join(tmpdir(), `${branch}-write-`))
  // The remote's tip, or a parentless start for a branch origin does not have yet.
  const tip = async (): Promise<string> => {
    await r.git(['fetch', 'origin', branch], cwd).catch(() => {})
    if (await refExists(cwd, `refs/remotes/origin/${branch}`, r.git)) return `origin/${branch}`
    return (await r.git(['commit-tree', EMPTY_TREE, '-m', `create the ${branch} branch`], cwd)).trim()
  }
  try {
    await r.git(['worktree', 'add', '--detach', dir, await tip()], cwd)
    for (let attempt = 0; ; attempt++) {
      await op(dir)
      await r.git(['add', '-A'], dir)
      const staged = (await r.git(['status', '--porcelain'], dir)).trim()
      if (!staged) return { ok: true, changed: false }
      await r.git(['commit', '-m', resolveMessage(message)], dir)
      try {
        await r.git(['push', 'origin', `HEAD:refs/heads/${branch}`], dir)
        return { ok: true, changed: true }
      } catch (err) {
        if (attempt >= 1) throw err
        await r.git(['reset', '--hard', await tip()], dir)
      }
    }
  } finally {
    await r.git(['worktree', 'remove', '--force', dir], cwd).catch(() => {})
    await r.git(['worktree', 'prune'], cwd).catch(() => {})
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * The file seams an operation inside a funneled write needs — read, write, delete and list plain
 * files under the directory the funnel hands it. Injectable so an operation is unit-testable off
 * disk and git; production takes the defaults. Parents are created on write because the
 * directory itself is not a given: retiring the last file removes it (git keeps no empty dirs),
 * and a branch is born without it.
 */
export interface BranchFileFs {
  /** Read one file; rejects when it cannot — a caller reads the rejection as "absent". */
  read: (path: string) => Promise<string>
  /** Write one file, creating parents. */
  write: (path: string, content: string) => Promise<void>
  /** Delete one file. */
  remove: (path: string) => Promise<void>
  /** The files under a directory, by filename; a missing directory reads as none. */
  list: (dir: string) => Promise<string[]>
}

/** {@link BranchFileFs} over `node:fs/promises`. */
export function nodeBranchFileFs(): BranchFileFs {
  const fs = () => import('node:fs/promises')
  return {
    read: path => fs().then(f => f.readFile(path, 'utf8')),
    write: async (path, content) => {
      const f = await fs()
      await f.mkdir(dirname(path), { recursive: true })
      await f.writeFile(path, content, 'utf8')
    },
    remove: path => fs().then(f => f.rm(path)),
    list: dir => fs().then(f => f.readdir(dir)).catch((): string[] => []),
  }
}
