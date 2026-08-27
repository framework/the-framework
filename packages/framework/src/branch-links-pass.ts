import { reconcileBranchLinks } from '@superskill/branch-management'
import { startProjectPass, type ProjectPass, type ProjectsSource } from './project-pass.js'

/** What {@link startBranchLinksPass} needs from the daemon. */
export interface BranchLinksOptions {
  projects: ProjectsSource
  /** The per-project reconcile (default {@link reconcileBranchLinks}). */
  reconcile?: (cwd: string) => Promise<void>
}

/**
 * Keep every registered project's branch links current (#1580), one turn per call. Runs on the
 * daemon's clock; renames and reclaimed worktrees settle within a tick, and a freshly-allocated
 * worktree gets its link immediately because allocation calls the reconcile too. Quiet on
 * purpose: links are presentation, and narrating every rename would drown the log.
 */
export function startBranchLinksPass(opts: BranchLinksOptions): ProjectPass {
  const reconcile = opts.reconcile ?? reconcileBranchLinks
  return startProjectPass(opts.projects, cwd => reconcile(cwd).catch(() => {}))
}
