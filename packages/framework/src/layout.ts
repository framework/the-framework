import { join } from 'node:path'
import { DATA_BRANCH, BRANCHES_DIR } from '@superskill/branch-management'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'
import { ARCHIVE_DIR, EVENTS_FILE, META_FILE, nodeStoreFs, type StoreFs } from './store/index.js'
import { FLAT_TODO_FILE, TICKETS_DIR } from './tickets.js'

/**
 * The layout gate (#1575): a build refuses to run in a repo whose recorded bookkeeping layout
 * differs from its own.
 *
 * The failure this closes was caught live (#1574): the cloud environment installs the framework
 * from npm, the last published build predated the `sessions/` → `agents/` rename, and the web
 * run's bookkeeping landed under the old name — a wrong-layout commit that main's guard test
 * rejects, hours after the session could have said it will not work. Same philosophy as the
 * extension gate (#1519): a skewed build half-works, so it is refused outright with both sides
 * named, no degraded mode.
 *
 * The repo's half is a tracked marker file whose content is *derived from the build's own layout
 * constants*, so a rename changes the derivation by itself and the lockstep test fails the rename
 * PR until the checked-in marker is regenerated — nothing to remember to bump. A repo without the
 * marker is ungated, the way an absent `expectedExtensionVersion` leaves the bridge ungated:
 * install writes it, so every newly activated repo is gated from the start.
 */

/** The marker's name under `.the-framework/`. Tracked, so every worktree and clone carries it. */
export const LAYOUT_FILE = 'LAYOUT'

/** The marker path under `cwd`'s `.the-framework/`. */
export function layoutMarkerPath(cwd: string): string {
  return join(cwd, THE_FRAMEWORK_DIR, LAYOUT_FILE)
}

/**
 * The layout this build writes, as one comparable string: every name a committed artifact's path
 * hangs off. Pure data — a comment line would put message wording into the equality.
 */
export function layoutMarker(): string {
  return [
    `framework-dir: ${THE_FRAMEWORK_DIR}`,
    `data-branch: ${DATA_BRANCH}`,
    `archive-dir: ${ARCHIVE_DIR}`,
    `branches-dir: ${BRANCHES_DIR}`,
    `events-file: ${EVENTS_FILE}`,
    `meta-file: ${META_FILE}`,
    `tickets-dir: ${TICKETS_DIR}`,
    `queue-file: ${FLAT_TODO_FILE}`,
    '',
  ].join('\n')
}

/** The outcome of {@link checkLayout}. A failure is a value carrying the refusal, never a throw. */
export type LayoutCheck = { ok: true } | { ok: false; error: string }

/**
 * Compare the repo's recorded layout against this build's. A missing marker passes (an unmarked
 * repo is ungated); a present-but-different one refuses with both sides named and the fix for
 * each direction — the stale-published-build case this exists for, and the older-repo case.
 */
export async function checkLayout(cwd: string, fs: StoreFs = nodeStoreFs()): Promise<LayoutCheck> {
  const path = layoutMarkerPath(cwd)
  if (!(await fs.exists(path))) return { ok: true }
  const recorded = await fs.read(path)
  if (recorded === layoutMarker()) return { ok: true }
  return {
    ok: false,
    error:
      `this framework build's bookkeeping layout does not match what the repo records in ` +
      `${THE_FRAMEWORK_DIR}/${LAYOUT_FILE}, so running it here would commit files under names ` +
      `the repo does not use (#1575).\n\nthis build writes:\n${layoutMarker()}\nthe repo records:\n${recorded}\n` +
      `A published build that predates a repo-side rename does this: update ` +
      `framework to a build matching the repo, or — if this build is the newer ` +
      `side — rewrite the marker with its layout and land that as the rename's own commit.`,
  }
}
