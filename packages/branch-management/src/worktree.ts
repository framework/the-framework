import { basename, dirname, join } from 'node:path'
import { realpath } from 'node:fs/promises'
import { nodeGitRunner, checkoutRoot, type GitRunner } from './git.js'
import { FRAMEWORK_DIR, BRANCHES_DIR, AGENT_BRANCH_PREFIX, isSafeAgentId, isRunBranch, worktreeDirName, agentIdFromWorktreeDir, isWorktreeDirName } from './branch-names.js'

/**
 * Git-worktree lifecycle for concurrent agents (#453/#735): give each agent its own
 * checkout so N runs on one repo never fight over the working tree. Pure plumbing
 * over the existing {@link GitRunner} seam; no daemon wiring, no concurrency, no
 * dashboard changes (those are the sibling #453 slices). This module only knows
 * how to add, list, remove, and prune worktrees.
 */

/** The path an agent's worktree gets (#1580): `<repo>/.the-framework/branches/<run branch name>`. */
export function worktreePath(repo: string, agentId: string): string {
  return join(repo, FRAMEWORK_DIR, BRANCHES_DIR, worktreeDirName(agentId))
}

/** One checkout on disk: where it is, and whose it is. */
export interface WorktreeDirEntry {
  path: string
  agentId: string
}

/** Lists a directory's entry names. A missing or unreadable directory yields `[]`. */
export type DirReader = (path: string) => Promise<string[]>

async function nodeReaddir(path: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises')
  return readdir(path).catch(() => [])
}

/**
 * Every checkout directory on disk (#1580). Only the run branch spelling counts — the same
 * directory holds the rename links (#1589), which are views, not checkouts. Forgiving: a missing
 * root yields nothing.
 */
export async function worktreeDirEntries(repo: string, readdir: DirReader = nodeReaddir): Promise<WorktreeDirEntry[]> {
  const root = join(repo, FRAMEWORK_DIR, BRANCHES_DIR)
  const entries: WorktreeDirEntry[] = []
  for (const name of await readdir(root).catch((): string[] => [])) {
    const agentId = agentIdFromWorktreeDir(name)
    if (isWorktreeDirName(name) && isSafeAgentId(agentId)) entries.push({ path: join(root, name), agentId })
  }
  return entries
}

/**
 * The agent ids that have a worktree directory (#737/#1580). Forgiving — a project that never ran
 * concurrently has no such dir and yields `[]`.
 */
export async function listWorktreeDirs(repo: string, readdir: DirReader = nodeReaddir): Promise<string[]> {
  return [...new Set((await worktreeDirEntries(repo, readdir)).map(entry => entry.agentId))]
}

/** One entry parsed from `git worktree list --porcelain`. */
export interface WorktreeInfo {
  /** Absolute worktree path (the main checkout included). */
  path: string
  /** The checked-out commit. */
  head: string
  /** The checked-out branch (short name), or absent when detached. */
  branch?: string
}

/** Inputs to {@link addWorktree}. The caller owns branch naming (#736). */
export interface AddWorktreeOptions {
  agentId: string
  /** The branch to create for the agent. */
  branch: string
  /** Base ref to branch from; defaults to the repo's current HEAD. */
  base?: string
}

/** The worktree {@link addWorktree} created. */
export interface AddedWorktree {
  path: string
  branch: string
}

/**
 * Create a worktree for an agent on a fresh branch: `git worktree add -b <branch>
 * <path> [base]`. Git makes the leaf dir (and any missing parents) itself. The
 * `agentId` is validated as path-safe first so a caller can never traverse out of
 * `.the-framework/branches/`. Rejects on any git failure (a caller that wants a
 * run needs its checkout, so failure must surface, not be swallowed).
 */
export async function addWorktree(
  repo: string,
  opts: AddWorktreeOptions,
  agent: GitRunner = nodeGitRunner(),
): Promise<AddedWorktree> {
  if (!isSafeAgentId(opts.agentId)) throw new Error(`unsafe run id: ${opts.agentId}`)
  const path = worktreePath(repo, opts.agentId)
  await agent(['worktree', 'add', '-b', opts.branch, path, ...(opts.base ? [opts.base] : [])], repo)
  return { path, branch: opts.branch }
}

/**
 * Check an *existing* branch out into an agent's worktree (#762): `git worktree add <path> <branch>`,
 * no `-b`. Continuing an agent puts it back on the branch its work is already on, rather than
 * branching again from HEAD and stranding what it did last time.
 *
 * A branch that is gone is recreated from HEAD (#1650): the only branch the framework deletes is
 * one that held nothing past a commit the remote already had, so HEAD is where its work was.
 * Anything else git refuses — the branch checked out elsewhere, say — still rejects, like
 * {@link addWorktree}: a continued agent needs its checkout.
 */
export async function attachWorktree(
  repo: string,
  opts: { agentId: string; branch: string },
  agent: GitRunner = nodeGitRunner(),
): Promise<AddedWorktree> {
  if (!isSafeAgentId(opts.agentId)) throw new Error(`unsafe run id: ${opts.agentId}`)
  const path = worktreePath(repo, opts.agentId)
  try {
    await agent(['worktree', 'add', path, opts.branch], repo)
  } catch (err) {
    // `worktree add <path> <name>` also resolves a remote-only `origin/<name>`, so the existence
    // check comes after the attempt, not before it.
    const exists = await agent(['show-ref', '--verify', '--quiet', `refs/heads/${opts.branch}`], repo).then(
      () => true,
      () => false,
    )
    if (exists) throw err
    await agent(['worktree', 'add', '-b', opts.branch, path], repo)
  }
  return { path, branch: opts.branch }
}

/**
 * Every worktree registered for the repo (the main checkout included). Forgiving:
 * a non-repo / git failure yields `[]` so a reconcile scan never throws.
 */
export async function listWorktrees(repo: string, agent: GitRunner = nodeGitRunner()): Promise<WorktreeInfo[]> {
  try {
    return parseWorktreeList(await agent(['worktree', 'list', '--porcelain'], repo))
  } catch {
    return []
  }
}

/**
 * Parse `git worktree list --porcelain`: blank-line-separated records, each with
 * a `worktree <path>` line, a `HEAD <sha>` line, and either `branch refs/heads/...`
 * or `detached`. Extra attributes (bare/locked/prunable) are ignored. Exported so
 * the parsing is unit-testable without a real repo.
 */
export function parseWorktreeList(porcelain: string): WorktreeInfo[] {
  const entries: WorktreeInfo[] = []
  for (const block of porcelain.split(/\n\s*\n/)) {
    let path: string | undefined
    let head = ''
    let branch: string | undefined
    for (const line of block.split('\n')) {
      if (line.startsWith('worktree ')) path = line.slice('worktree '.length).trim()
      else if (line.startsWith('HEAD ')) head = line.slice('HEAD '.length).trim()
      else if (line.startsWith('branch ')) branch = line.slice('branch '.length).trim().replace(/^refs\/heads\//, '')
    }
    if (path) entries.push({ path, head, ...(branch ? { branch } : {}) })
  }
  return entries
}

/**
 * Remove an agent's worktree. Tolerant of an already-gone / never-registered path so
 * teardown stays idempotent (the agent child is detached; the daemon only holds its pid).
 *
 * Plain removal first: it refuses a checkout git considers unclean, which after the
 * caller's {@link worktreeClean} check means a state we did not anticipate. Falling back to
 * `--force` keeps teardown working (an ignored build artifact must not strand a
 * worktree forever), but it says so, because forcing past unknown state is exactly
 * how uncommitted work got deleted in the first place.
 */
export async function removeWorktree(repo: string, path: string, agent: GitRunner = nodeGitRunner()): Promise<void> {
  try {
    await agent(['worktree', 'remove', path], repo)
    return
  } catch {
    // Unclean by git's reckoning, already removed, or never registered: try forcing.
  }
  try {
    await agent(['worktree', 'remove', '--force', path], repo)
    console.log(`[framework] forced removal of worktree ${path} (git called it unclean)`)
  } catch {
    // Already removed, or never registered: nothing to do.
  }
}

/**
 * Delete a branch that holds nothing (#1650). `-D`, because "merged" in git's eyes is the wrong
 * test: the caller proved the tip is a commit the remote already has, which is the stronger fact.
 * Forgiving: the checkout is already gone by the time this runs, and a branch that would not
 * delete is a leftover name, not lost work.
 */
export async function deleteBranch(repo: string, branch: string, agent: GitRunner = nodeGitRunner()): Promise<void> {
  await agent(['branch', '-D', branch], repo).catch(() => undefined)
}

/**
 * Whether `path` is the root of a git worktree — the main checkout's or a linked one (#1654).
 *
 * Git answers for any directory *inside* a repository, so a `branches/<run>` directory that is
 * no longer a worktree (a checkout removed by hand, a marker written after teardown) makes every
 * git command run in it act on the enclosing repo: the user's own checkout, on the user's own
 * branch. The one question that tells the two apart is whether git's top level is this very
 * directory. False on any failure, and the caller leaves the directory alone.
 */
export async function isWorktreeRoot(path: string, agent: GitRunner = nodeGitRunner()): Promise<boolean> {
  try {
    const top = (await agent(['rev-parse', '--show-toplevel'], path)).trim()
    if (!top) return false
    // Both sides resolved: macOS's tmpdir sits behind the /var -> /private/var link, and git
    // reports the resolved path.
    return (await realpath(top)) === (await realpath(path))
  } catch {
    return false
  }
}

/**
 * The branch checked out at `path` when `path` is a worktree root (#1654), else `undefined` —
 * the read every consumer of a `branches/<run>` directory wants, so none of them can take the
 * enclosing repo's branch for the run's.
 */
export async function worktreeBranch(path: string, agent: GitRunner = nodeGitRunner()): Promise<string | undefined> {
  return (await isWorktreeRoot(path, agent)) ? currentBranch(path, agent) : undefined
}

/**
 * The branch checked out at `path`, or `undefined` when detached / not a repo.
 * Forgiving, like {@link listWorktrees}: callers use it to decide, not to fail.
 */
export async function currentBranch(path: string, agent: GitRunner = nodeGitRunner()): Promise<string | undefined> {
  try {
    const name = (await agent(['rev-parse', '--abbrev-ref', 'HEAD'], path)).trim()
    return name && name !== 'HEAD' ? name : undefined
  } catch {
    return undefined
  }
}

/**
 * The project a directory belongs to (#1725): the checkout whose `.the-framework/branches/`
 * holds the agent checkouts. From inside an agent's checkout that is three levels up, by the
 * layout every checkout is created with; from anywhere else it is the checkout itself. Read from
 * the layout rather than from git's common dir, so a project that is itself a linked worktree,
 * or a submodule, answers with the directory the daemon registered. Rejects outside a repo.
 */
export async function projectRoot(cwd: string, agent: GitRunner = nodeGitRunner()): Promise<string> {
  const checkout = await checkoutRoot(cwd, agent)
  const parent = dirname(checkout)
  const nested = basename(parent) === BRANCHES_DIR && basename(dirname(parent)) === FRAMEWORK_DIR
  return nested ? dirname(dirname(parent)) : checkout
}

/** A session name as the agent picks it: the charset the system prompt asks for. */
export function isSessionName(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name)
}

/** Why {@link nameBranch} left the branch as it was. */
export type NameBranchRefusal =
  /** Not `[a-z0-9-]+`. */
  | 'invalid-name'
  /** `tf-<name>` would be the data branch or a checkout directory's spelling: the framework's own. */
  | 'reserved-name'
  /** The directory is not a git worktree root: nothing was run in it. */
  | 'not-a-worktree'
  /** The checkout is on no branch (detached). */
  | 'no-branch'
  /** The checkout is on a branch the framework did not mint — the user's own, or the data branch. */
  | 'not-a-run-branch'

export type NameBranchOutcome =
  | {
      ok: true
      /** The name the branch ends up with: `tf-<name>`, suffixed when that was taken. */
      branch: string
    }
  | { ok: false; reason: NameBranchRefusal }

/** How often a rename lost to a sibling naming the same thing at the same moment is retried. */
const NAME_ATTEMPTS = 3

/**
 * Name the session (#1725): rename the checkout's branch to `tf-<name>`. A rename, not a new
 * branch, so the branch the checkout was born on is the branch it ends on and nothing is left
 * behind to clean up. Only a branch the framework minted is ever renamed — an agent that somehow
 * runs in the user's own checkout must not rename `main` — and only to a name that is not the
 * framework's own: `tf-data` is the data branch, and `tf-agent-<x>` is how checkout directories
 * are spelled, so a branch link of that name would read as a phantom checkout.
 *
 * A taken name gets a numeric suffix (`tf-<name>-2`, `-3`, …) rather than a refusal: the agent
 * asked for a name, and the caller reads back the one it got. Taken means any local branch or
 * any remote-tracking branch, so the later push does not land on someone else's branch — except
 * the checkout's own branch, pushed or not, which is why asking again for the name the checkout
 * already carries (suffixed or not) changes nothing. Two checkouts naming the same thing at the
 * same moment race on the rename itself; the loser reads the branches again and takes the next
 * free suffix.
 */
export async function nameBranch(path: string, name: string, agent: GitRunner = nodeGitRunner()): Promise<NameBranchOutcome> {
  if (!isSessionName(name)) return { ok: false, reason: 'invalid-name' }
  const wanted = `${AGENT_BRANCH_PREFIX}${name}`
  if (!isRunBranch(wanted) || isWorktreeDirName(wanted)) return { ok: false, reason: 'reserved-name' }
  if (!(await isWorktreeRoot(path, agent))) return { ok: false, reason: 'not-a-worktree' }
  const current = await currentBranch(path, agent)
  if (!current) return { ok: false, reason: 'no-branch' }
  if (!isRunBranch(current)) return { ok: false, reason: 'not-a-run-branch' }
  for (let attempt = 1; ; attempt++) {
    const taken = await branchNames(path, agent)
    taken.delete(current)
    let branch = wanted
    for (let n = 2; taken.has(branch); n++) branch = `${wanted}-${n}`
    if (branch === current) return { ok: true, branch }
    try {
      await agent(['branch', '-m', current, branch], path)
      return { ok: true, branch }
    } catch (err) {
      if (attempt >= NAME_ATTEMPTS || !/already exists/.test(err instanceof Error ? err.message : String(err))) throw err
    }
  }
}

/** Every branch name the repo knows, local and remote-tracking, without the remote's prefix. */
async function branchNames(path: string, agent: GitRunner): Promise<Set<string>> {
  const out = await agent(['for-each-ref', '--format=%(refname)', 'refs/heads/', 'refs/remotes/'], path)
  const names = new Set<string>()
  for (const ref of out.split('\n')) {
    const heads = ref.match(/^refs\/heads\/(.+)$/)
    if (heads?.[1]) names.add(heads[1])
    const remotes = ref.match(/^refs\/remotes\/[^/]+\/(.+)$/)
    if (remotes?.[1]) names.add(remotes[1])
  }
  return names
}

/**
 * `git worktree prune`: drop administrative entries for worktree dirs a crash left
 * behind. Never removes a live worktree, so it is always safe. Forgiving.
 */
export async function pruneWorktrees(repo: string, agent: GitRunner = nodeGitRunner()): Promise<void> {
  try {
    await agent(['worktree', 'prune'], repo)
  } catch {
    // Not a repo / nothing to prune: no-op.
  }
}

/** Runs `du`, resolving its stdout. Injectable so the size read can be tested without a real tree. */
export type SizeRunner = (path: string) => Promise<string>

/** A {@link SizeRunner} over `du -sk`: one process, and it does not follow the symlinked deps (#736). */
export function nodeSizeRunner(): SizeRunner {
  return path =>
    new Promise((resolvePromise, rejectPromise) => {
      void import('node:child_process').then(({ execFile }) => {
        execFile('du', ['-sk', path], { timeout: 5_000 }, (err, stdout) =>
          err ? rejectPromise(err) : resolvePromise(stdout),
        )
      })
    })
}

/**
 * A worktree's size on disk in bytes, or undefined when it cannot be read (#798). Best-effort by
 * design: this only ever labels a "remove this" button, so a missing number costs nothing while a
 * throw or a hang would cost the panel it sits in. `du` is absent on Windows, which reads as
 * unknown like any other failure.
 */
export async function worktreeSize(path: string, agent: SizeRunner = nodeSizeRunner()): Promise<number | undefined> {
  try {
    const kb = Number.parseInt((await agent(path)).trim().split(/\s+/)[0] ?? '', 10)
    return Number.isFinite(kb) ? kb * 1024 : undefined
  } catch {
    return undefined
  }
}

/**
 * Whether a branch is on the remote, with the local tip already there (E5).
 *
 * The one predicate the whole retention story is built on: nothing local is ever the last copy of
 * work, so anything the remote has may be deleted and anything it does not have stays. It replaced
 * three interacting rules — a clean finish removes the checkout, a failure keeps it, a merged
 * branch reclaims it later — each of which asked *what state did this session end in* rather than
 * *is this recoverable*.
 *
 * `git rev-parse` of the remote-tracking ref, then a merge-base check: the ref existing is not
 * enough, because a branch pushed and then committed to again has a tip the remote has never seen.
 * Reads only local refs (no fetch), so it is cheap enough to ask on every teardown — the remote ref
 * is written by the push this is checking for, which is what makes that sound.
 *
 * Anything unreadable answers `false`. A repo with no remote configured therefore keeps every
 * checkout, which is the honest outcome: there is nowhere for the work to be recoverable from.
 */
export async function branchPushed(
  repo: string,
  branch: string,
  agent: GitRunner = nodeGitRunner(),
): Promise<boolean> {
  try {
    const local = (await agent(['rev-parse', '--verify', `refs/heads/${branch}`], repo)).trim()
    const remote = (await agent(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], repo)).trim()
    if (!local || !remote) return false
    if (local === remote) return true
    // The remote may be ahead (someone pushed on top): what matters is that our tip is in it.
    await agent(['merge-base', '--is-ancestor', local, remote], repo)
    return true
  } catch {
    return false
  }
}

/**
 * Whether the checkout has nothing uncommitted. A read, never a commit (#1638): the framework
 * commits nothing on an agent's behalf, so a checkout holding uncommitted work is one the caller
 * keeps. Throws when git cannot answer, so the caller keeps the checkout rather than guessing.
 */
export async function worktreeClean(path: string, agent: GitRunner = nodeGitRunner()): Promise<boolean> {
  return !(await agent(['status', '--porcelain'], path)).trim()
}

/**
 * Whether the repo has any remote configured at all. What the sweep asks once per project: with
 * no remote, {@link branchPushed} is false for every checkout and the push cannot land, so the
 * whole per-checkout probe-and-push cycle is doomed before it starts — and that answer cannot
 * change between two rows of the same sweep. Anything unreadable answers `false`, like
 * {@link branchPushed}: keeping a checkout is the safe direction.
 */
export async function repoHasRemote(repo: string, agent: GitRunner = nodeGitRunner()): Promise<boolean> {
  try {
    return (await agent(['remote'], repo)).trim().length > 0
  } catch {
    return false
  }
}
