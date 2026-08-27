import { join } from 'node:path'
import { nodeGitRunner, type GitRunner } from '@superskill/branch-management'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'
import { frameworkGitignore, gitignorePath } from './framework-gitignore.js'
import { layoutMarker, layoutMarkerPath } from './layout.js'
import { nodeStoreFs, type StoreFs } from './store/index.js'
import { materializePresets } from './presets.js'
import { errorMessage } from './error-message.js'

/**
 * Install/activate a repo for The Framework (#391): create the `.the-framework/` marker and its
 * ignore file, committing pre-existing dirty changes first so the install commit is clean. Pure
 * core over the same {@link GitRunner} + {@link StoreFs} seams as project.ts.
 */

/** The outcome of {@link installProject}. Failures are values, never throws. */
export type InstallResult =
  | { ok: true; alreadyActivated?: boolean; initialized?: boolean }
  | { ok: false; error: string }

/** Injectable seams for {@link installProject}. */
export interface InstallDeps {
  git?: GitRunner
  fs?: StoreFs
}

/**
 * Activate the repo at `cwd`: create `.the-framework/` with
 * its ignore file and layout marker (#1575), and commit the install. A repo whose ignore file is
 * already there is a no-op (`alreadyActivated`) — the ignore file is the activation marker.
 * Forgiving: any git/fs failure surfaces as `{ ok: false, error }`.
 */
export async function installProject(cwd: string, deps: InstallDeps = {}): Promise<InstallResult> {
  const git = deps.git ?? nodeGitRunner()
  const fs = deps.fs ?? nodeStoreFs()

  if (await fs.exists(gitignorePath(cwd))) return { ok: true, alreadyActivated: true }

  try {
    // Auto-initialize a repo when the folder isn't one yet: The Framework treats
    // git as the source of truth, so `git init` it for the user rather than erroring.
    const insideRepo = await git(['rev-parse', '--is-inside-work-tree'], cwd)
      .then(out => out.trim() === 'true')
      .catch(() => false)
    if (!insideRepo) await git(['init'], cwd)

    await fs.mkdir(join(cwd, THE_FRAMEWORK_DIR))
    // Keep the transient agent state (events.jsonl / agent.json / agents/) out of git and the session
    // archive in it (#313/#1179). The early return above established the file is absent.
    await fs.write(gitignorePath(cwd), frameworkGitignore())
    // Record the bookkeeping layout this build writes (#1575), so a build whose layout differs —
    // a stale published one, say — refuses to run here instead of committing wrong-layout files.
    await fs.write(layoutMarkerPath(cwd), layoutMarker())

    // Materialize the quality presets so an on-before-mergeable TODO entry's filePath resolves to a
    // real file the agent can open (#326). The .the-framework/.gitignore above keeps them out
    // of git, so they are regenerated on install and track the installed framework version rather
    // than going stale in the repo's history.
    await materializePresets(cwd, fs)
    // The ticket-format spec is NOT materialized (#674): it ships inside the package and the
    // #683 context fragment points at its node_modules path, so it versions with the package.

    // Only The Framework's own directory (#1638): whatever the user has uncommitted stays theirs,
    // uncommitted. Nothing is ever swept into a commit on their behalf.
    await git(['add', THE_FRAMEWORK_DIR], cwd)
    await git(['commit', '-m', '[The Framework] install The Framework'], cwd)
    return insideRepo ? { ok: true } : { ok: true, initialized: true }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}
