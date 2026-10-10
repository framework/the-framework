import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { gitReason, nodeGitRunner, type GitRunner } from '@openagt/agent-data'

/**
 * The one commit `init` offers (#2023): only the skill files it just wrote or deleted, on the
 * branch the person is on, and nothing else they have open. Never a push: the person pushes, or
 * opens a pull request where the default branch is protected.
 */

export type CommitOutcome = { ok: true; committed: boolean; commit?: string } | { ok: false; error: string }

/** Commit what stands at `paths` (from the project's root) under `message`: a file written, a file deleted. Nothing changed there is no commit. */
export async function commitPaths(root: string, paths: readonly string[], message: string, git: GitRunner = nodeGitRunner()): Promise<CommitOutcome> {
  try {
    // A path that is neither on disk nor known to git is nothing to commit, and git refuses to be handed one.
    const tracked = new Set((await git(['ls-files', '-z', '--', ...paths], root)).split('\0').filter(Boolean))
    const real: string[] = []
    for (const path of new Set(paths)) {
      if (tracked.has(path) || (await lstat(join(root, path)).then(() => true, () => false))) real.push(path)
    }
    if (real.length === 0) return { ok: true, committed: false }
    await git(['add', '-A', '--', ...real], root)
    const staged = (await git(['diff', '--cached', '--name-only', '-z', '--', ...real], root)).split('\0').filter(Boolean)
    if (staged.length === 0) return { ok: true, committed: false }
    // With paths, git commits those paths alone and leaves whatever else is staged where it was.
    await git(['commit', '-q', '-m', message, '--', ...real], root)
    return { ok: true, committed: true, commit: (await git(['rev-parse', '--short', 'HEAD'], root)).trim() }
  } catch (err) {
    return { ok: false, error: gitReason(err) }
  }
}
