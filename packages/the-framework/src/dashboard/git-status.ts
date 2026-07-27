import { nodeGitRunner, type GitRunner } from '../project.js'
import { cachedPrView, cachedPrsForBranch, pickRunPr, type LinkedPr, type PrLookup } from './gh.js'

// The project panel's git status (#491, part of #488): the active branch, whether the tree is
// dirty, and the linked PR. Branch + dirty are a local git read; the PR is a best-effort gh
// lookup that simply degrades to nothing when gh is missing/unauthed or there is no PR. Safe
// anywhere — the relay has no local checkout, so it resolves to nothing there.

/** A project's git status for the panel. */
export interface GitStatus {
  branch: string
  /** Uncommitted changes present. */
  dirty: boolean
  pr?: LinkedPr
  /** The PR is not known yet, rather than absent (#1028): the lookup is still running. */
  prPending?: boolean
}

/** Injectable seams so {@link readGitStatus} is unit-testable off disk. */
export interface GitStatusDeps {
  git?: GitRunner
  pr?: PrLookup
  /**
   * The run's start, when the status is read for a run's checkout (#1255). The default lookup is
   * `gh pr view`, which answers the newest PR for the branch *in any state* — so a run on a reused
   * pinned branch (`the-framework/triage-quick`) wears a predecessor's merged PR as its own badge.
   * With `since` set the PR is picked from the branch's whole history by {@link pickRunPr}
   * instead: an open PR, or a closed one no older than the run itself.
   */
  since?: string
  /** The branch's full PR history, for the {@link GitStatusDeps.since} path (default {@link cachedPrsForBranch}). */
  prs?: (cwd: string, branch: string) => Promise<LinkedPr[]>
}

/**
 * Read a project's git status: the current branch and dirty flag (from git), plus the linked
 * PR (best-effort). Returns undefined when the path is not a git repo. Forgiving — a failed
 * `git status` reads as clean, and a failed PR lookup simply omits the PR.
 */
export async function readGitStatus(cwd: string, deps: GitStatusDeps = {}): Promise<GitStatus | undefined> {
  const git = deps.git ?? nodeGitRunner()
  let branch: string
  try {
    branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)).trim()
  } catch {
    return undefined // not a git repo (or git failed)
  }
  const dirty = (await git(['status', '--porcelain'], cwd).catch(() => '')).trim().length > 0
  // The branch and the dirty flag are what this row is for, and they are ten milliseconds of git.
  // The PR is a `gh` call an order of magnitude slower, so it is read through the cache and is
  // allowed to arrive late (#1028) rather than holding the whole row back on every poll.
  const pr = await linkedPr(cwd, branch, deps)
  return { branch, dirty, ...(pr.value ? { pr: pr.value } : {}), ...(pr.pending ? { prPending: true } : {}) }
}

/** The PR half of the status: the injected seam, the run-scoped history pick, or the plain view. */
async function linkedPr(
  cwd: string,
  branch: string,
  deps: GitStatusDeps,
): Promise<{ value: LinkedPr | undefined; pending: boolean }> {
  if (deps.pr) return { value: await deps.pr(cwd).catch(() => undefined), pending: false }
  if (deps.since === undefined) return cachedPrView(cwd).catch(() => ({ value: undefined, pending: false }))
  if (deps.prs) return { value: pickRunPr(await deps.prs(cwd, branch).catch(() => []), deps.since), pending: false }
  return cachedPrsForBranch(cwd, branch).then(
    read => ({ value: pickRunPr(read.value ?? [], deps.since), pending: read.pending }),
    () => ({ value: undefined, pending: false }),
  )
}
