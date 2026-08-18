import { nodeGitRunner, type GitRunner } from './project.js'
import { ghPrsForBranch, type LinkedPr } from './dashboard/gh.js'

// Release a pinned routine branch its closed PR left behind (#1293).
//
// The triage prompts pin their session name, so every firing wants the same branch
// (`tf-triage-quick`) and aborts when it already exists: a triage still in flight owns
// the branch, and the next firing must not triage twice. But nothing ever released the name. The
// first triage PR that got closed or merged without its branch being deleted jammed the routine
// forever: every later firing found the branch, followed the scripted abort, and reported a
// pending triage that did not exist.
//
// A branch existing is not evidence of a pending triage; an open PR is. So the sweep asks the
// branch's PR history before firing a pinned job and releases the leftover copies only when the
// history proves the work is over: some PR existed and none is open. Deleting is safe exactly
// then, because the closed PR itself preserves the diff on GitHub — the branch is a leftover
// name, not the last copy of anything a human still needs.

/** What became of one pinned branch: gone already, genuinely busy, unprovable, or released. */
export type StaleBranchOutcome = 'absent' | 'pending' | 'unproven' | 'released'

/** Injectable seams so the release is unit-testable off disk and off GitHub. */
export interface StaleBranchDeps {
  git?: GitRunner
  /** The branch's full PR history (default {@link ghPrsForBranch}). */
  prs?: (cwd: string, branch: string) => Promise<LinkedPr[]>
}

/**
 * Delete a pinned routine branch whose PR is closed or merged, so the next firing proceeds.
 *
 * Deliberately conservative on the two unprovable cases: an open PR keeps the branch (that is a
 * triage genuinely pending), and a branch with no PR history at all keeps it too — that is either
 * an agent still working toward its handoff or a `gh` that could not answer, and deleting on a
 * hiccup would discard work. Never throws: a release that could not happen leaves the routine
 * exactly as jammed as it was, which the next tick retries.
 */
export async function releaseStalePinnedBranch(
  cwd: string,
  branch: string,
  deps: StaleBranchDeps = {},
): Promise<StaleBranchOutcome> {
  const git = deps.git ?? nodeGitRunner()
  const prs = deps.prs ?? ghPrsForBranch

  const local = await git(['show-ref', '--verify', `refs/heads/${branch}`], cwd).then(
    () => true,
    () => false,
  )
  const remote = await git(['ls-remote', '--heads', 'origin', branch], cwd).then(
    out => out.trim() !== '',
    () => false,
  )
  if (!local && !remote) return 'absent'

  const history = await prs(cwd, branch).catch(() => [])
  if (history.some(pr => pr.state === 'OPEN')) return 'pending'
  if (history.length === 0) return 'unproven'

  if (remote) await git(['push', 'origin', '--delete', branch], cwd).catch(() => undefined)
  // -D, not -d: a squash merge leaves the branch unmerged in git's eyes. And git refusing because
  // a worktree still has the branch checked out is the in-flight guard working, not a failure.
  if (local) await git(['branch', '-D', branch], cwd).catch(() => undefined)
  return 'released'
}
