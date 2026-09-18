import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BRANCHES_DIR, type GitRunner } from '@gemstack/agent-data'

/**
 * A held merge: whoever started the agent has more work coming on its branch after it, so the
 * merge its publish asks for waits until the last of it is done. The caller puts the hold on the
 * checkout before the agent starts; a publish asked to merge under it opens the pull request as
 * always, arms nothing, and records that the merge is wanted; the caller releases it once the rest
 * is done. Names no command and no caller: a hold is only "not yet".
 *
 * Two files, both out of git's sight. The hold is the checkout's own, in its private git
 * directory, so it goes with the checkout. The record of a wanted merge is the pull request's,
 * under `.branches/` beside the merge watcher's logs, so it outlives the checkout: the caller
 * releases it after the checkout the agent published from is gone.
 */

/** The hold's file, in the checkout's private git directory. */
const HOLD_FILE = 'branches-merge-hold'

/** Under `.branches/`: one file per pull request whose merge is wanted and held. Not a checkout name, so nothing lists it. */
export const HELD_DIR = 'merge-held'

/** The line a held pull request's body carries, for the person who reads it; the release takes it out. */
export const MERGE_HELD_NOTE = '**Merge held:** more work comes on this branch first; the merge is armed once it is done.'

/** Put the hold on a checkout: a publish from it asked to merge arms nothing until the release. */
export async function holdMerge(checkout: string, git: GitRunner): Promise<void> {
  await writeFile(await holdPath(checkout, git), '')
}

/** Whether a checkout is under a hold. */
export async function mergeHeld(checkout: string, git: GitRunner): Promise<boolean> {
  return stat(await holdPath(checkout, git)).then(() => true, () => false)
}

/** Record that a pull request's merge is wanted and held. */
export async function recordHeldMerge(repo: string, number: number): Promise<void> {
  await mkdir(join(repo, BRANCHES_DIR, HELD_DIR), { recursive: true })
  await writeFile(heldPath(repo, number), '')
}

/** Whether a pull request's merge is recorded as wanted and held. */
export async function heldMergeRecorded(repo: string, number: number): Promise<boolean> {
  return stat(heldPath(repo, number)).then(() => true, () => false)
}

/** Drop the record: the merge was armed, or the pull request is no longer open. */
export async function dropHeldMerge(repo: string, number: number): Promise<void> {
  await rm(heldPath(repo, number), { force: true })
}

/** A body with the held note at its end, once. */
export function withHeldNote(body: string): string {
  if (body.split('\n').some(line => line.trim() === MERGE_HELD_NOTE)) return body
  return body.trim() === '' ? MERGE_HELD_NOTE : `${body.trimEnd()}\n\n${MERGE_HELD_NOTE}`
}

/** A body without the held note. */
export function withoutHeldNote(body: string): string {
  return body
    .split('\n')
    .filter(line => line.trim() !== MERGE_HELD_NOTE)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
}

async function holdPath(checkout: string, git: GitRunner): Promise<string> {
  return join((await git(['rev-parse', '--absolute-git-dir'], checkout)).trim(), HOLD_FILE)
}

function heldPath(repo: string, number: number): string {
  return join(repo, BRANCHES_DIR, HELD_DIR, String(number))
}
