import { nodeGitRunner, pushBranch, type GitRunner } from '@gemstack/agent-data'
import { currentBranch, isWorktreeRoot, projectRoot, worktreeBranch, worktreeClean, worktreeDirEntries } from './worktree.js'
import { spawnMergeWatch } from './merge-watch.js'
import { dropHeldMerge, heldMergeRecorded, MERGE_HELD_NOTE, mergeHeld, recordHeldMerge, withHeldNote, withoutHeldNote } from './merge-hold.js'

/**
 * Publishing a checkout (#1774): the agent's own last step. Push the branch, open its pull
 * request with the title and body the agent wrote, and arm the merge when the agent was told
 * the work may land on its own. One rule before any of it: the tree is clean, since what is
 * published is what is committed, and nothing is committed on the agent's behalf.
 *
 * A branch that already has an open pull request gets no second one: the request is reported as
 * it is, and only the push and the merge arming happen.
 *
 * The merge is GitHub's auto-merge where the repository allows it. Where it does not, this tool's
 * own watcher waits for the checks and merges (`merge-watch.ts`); where the request is already
 * green, GitHub will not arm anything and the request is merged at once.
 *
 * A checkout under a hold (`merge-hold.ts`) arms nothing: the merge is recorded as wanted, the
 * request's body says it is held, and the caller who put the hold releases it (`releaseMerge`).
 *
 * A person publishes a finished agent's work through the same door (#1774), by branch
 * (`publishBranch`): the agent's checkout when one is still on the branch, under the same clean
 * rule; else the branch itself, pushed when this machine has it, as it is when only the remote
 * does. And lands its request (`mergePr`): a draft is marked ready first, then the merge is
 * armed exactly as `--merge` arms it.
 */

/** A `gh` runner: the standard output of one invocation; rejects with gh's own line on failure. */
export type GhRunner = (args: string[], cwd: string) => Promise<string>

/** `gh` on PATH, one minute per call: these talk to the network. */
export function nodeGhRunner(): GhRunner {
  return async (args, cwd) => {
    const { execFile } = await import('node:child_process')
    return new Promise<string>((resolve, reject) => {
      execFile('gh', args, { cwd, timeout: 60_000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(String(stderr).trim() || err.message))
        else resolve(String(stdout))
      })
    })
  }
}

export interface PublishOptions {
  /** The pull request's title: one line naming what the change does. */
  title: string
  /** The pull request's body: what changed and why. */
  body?: string
  /** Arm the merge: the request lands on its own once its checks pass. */
  merge?: boolean
  /** Start the merge watcher for a request (default {@link spawnMergeWatch}). For tests. */
  watch?: (repo: string, number: number) => Promise<void>
  /** Open the request as a draft. Not with `merge`: a draft cannot be merged. */
  draft?: boolean
  git?: GitRunner
  gh?: GhRunner
}

/** Why a checkout was not published. */
export type PublishRefusal =
  /** The directory is not a git worktree root. */
  | 'not-a-worktree'
  /** The checkout is on no branch. */
  | 'no-branch'
  /** The tree holds uncommitted work: commit or delete it first. */
  | 'dirty'
  /** The branch could not be pushed. */
  | 'push-failed'
  /** The pull request could not be opened. */
  | 'pr-failed'

export type PublishOutcome =
  | {
      ok: true
      branch: string
      pr: { number: number; url: string }
      /** Whether the request was open already. */
      existing: boolean
      /**
       * How the merge arming went, when asked for: GitHub's auto-merge armed, merged at once (the
       * request was already green), this tool's watcher started (the repository does not allow
       * auto-merge), or held (the checkout is under a hold; armed at its release).
       */
      merge?: MergeArming | { outcome: 'held' }
    }
  | { ok: false; reason: 'not-a-worktree' }
  /** The checkout is on no branch; or, published by name, neither this machine nor the remote has the branch. */
  | { ok: false; reason: 'no-branch'; branch?: string }
  | { ok: false; reason: 'dirty' | 'push-failed' | 'pr-failed'; branch: string; detail?: string }

/** How arming a merge went. */
export type MergeArming = { outcome: 'auto-armed' | 'merged' | 'watching' } | { outcome: 'failed'; error: string }

export async function publishCheckout(path: string, opts: PublishOptions): Promise<PublishOutcome> {
  const git = opts.git ?? nodeGitRunner()
  const gh = opts.gh ?? nodeGhRunner()
  if (!(await isWorktreeRoot(path, git))) return { ok: false, reason: 'not-a-worktree' }
  const branch = await currentBranch(path, git)
  if (!branch) return { ok: false, reason: 'no-branch' }
  if (!(await worktreeClean(path, git).catch(() => false))) return { ok: false, reason: 'dirty', branch }

  const repo = await projectRoot(path, git)
  const held = opts.merge === true && (await mergeHeld(path, git))
  const pushed = await pushBranch(repo, branch, git)
  if (!pushed.ok) return { ok: false, reason: 'push-failed', branch, detail: pushed.error }
  return openAndArm(repo, path, branch, opts, held, gh)
}

/**
 * Publish a branch by name, from the project (#1774): the caller's form, for a person landing a
 * finished agent's work. The checkout under `.branches/` that is on the branch, when one is,
 * is published as the agent would publish it, its clean rule included. Without one, the branch
 * itself: pushed when this machine has it; left as it is when only `origin` has it (a branch
 * pushed from elsewhere, with nothing here to push). Neither: `no-branch`. No hold applies
 * without a checkout: a hold is a checkout's.
 */
export async function publishBranch(repo: string, branch: string, opts: PublishOptions): Promise<PublishOutcome> {
  const git = opts.git ?? nodeGitRunner()
  const gh = opts.gh ?? nodeGhRunner()
  for (const entry of await worktreeDirEntries(repo)) {
    if ((await worktreeBranch(entry.path, git)) === branch) return publishCheckout(entry.path, opts)
  }
  const local = await git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], repo).then(out => out.trim() !== '', () => false)
  if (local) {
    const pushed = await pushBranch(repo, branch, git)
    if (!pushed.ok) return { ok: false, reason: 'push-failed', branch, detail: pushed.error }
  } else {
    const remote = await git(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`], repo).then(out => out.trim() !== '', () => false)
    if (!remote) return { ok: false, reason: 'no-branch', branch }
  }
  return openAndArm(repo, repo, branch, opts, false, gh)
}

/** The half after the push: the open request or a new one, then the merge arming, the hold honored. */
async function openAndArm(repo: string, cwd: string, branch: string, opts: PublishOptions, held: boolean, gh: GhRunner): Promise<PublishOutcome> {
  let pr = await openPr(cwd, branch, gh)
  let existing = true
  if (!pr) {
    existing = false
    try {
      const args = ['pr', 'create', '--head', branch, '--title', opts.title, '--body', held ? withHeldNote(opts.body ?? '') : (opts.body ?? '')]
      if (opts.draft && !opts.merge) args.push('--draft')
      const out = await gh(args, cwd)
      const url = out.trim().split('\n').filter(Boolean).at(-1)
      const number = prNumber(url)
      pr = url && number !== undefined ? { number, url } : await openPr(cwd, branch, gh)
      if (!pr) return { ok: false, reason: 'pr-failed', branch, detail: 'gh printed no pull request URL' }
    } catch (err) {
      return { ok: false, reason: 'pr-failed', branch, detail: errorMessage(err) }
    }
  }

  const outcome: PublishOutcome = { ok: true, branch, pr, existing }
  if (held) {
    await recordHeldMerge(repo, pr.number)
    if (existing) await noteHeld(cwd, pr.number, gh)
    outcome.merge = { outcome: 'held' }
  } else if (opts.merge) {
    outcome.merge = await armMerge(repo, pr.number, gh, opts.watch ?? spawnMergeWatch)
  }
  return outcome
}

/** What landing a request for a person did: armed as `--merge` arms, or why not. */
export type MergePrOutcome = MergeArming | { outcome: 'not-open'; state: string }

export interface MergePrOptions {
  gh?: GhRunner
  /** Start the merge watcher for a request (default {@link spawnMergeWatch}). For tests. */
  watch?: (repo: string, number: number) => Promise<void>
}

/**
 * Land a pull request for a person (#1774): "it is good, land it". A draft is marked ready
 * first, since asking for the merge is the statement that its review happened; then the merge
 * is armed exactly as `publish --merge` arms it. A request that is not open is `not-open` with
 * its state: already merged is an answer, not an action.
 */
export async function mergePr(repo: string, number: number, opts: MergePrOptions = {}): Promise<MergePrOutcome> {
  const gh = opts.gh ?? nodeGhRunner()
  let view: { state?: unknown; isDraft?: unknown }
  try {
    view = JSON.parse(await gh(['pr', 'view', String(number), '--json', 'state,isDraft'], repo)) as typeof view
  } catch (err) {
    return { outcome: 'failed', error: errorMessage(err) }
  }
  const state = typeof view.state === 'string' ? view.state : 'OPEN'
  if (state !== 'OPEN') return { outcome: 'not-open', state }
  if (view.isDraft === true) {
    try {
      await gh(['pr', 'ready', String(number)], repo)
    } catch (err) {
      return { outcome: 'failed', error: errorMessage(err) }
    }
  }
  return armMerge(repo, number, gh, opts.watch ?? spawnMergeWatch)
}

/** An open request's body gains the held note, once. The note is for a person: an edit gh refuses never fails the publish. */
async function noteHeld(cwd: string, number: number, gh: GhRunner): Promise<void> {
  try {
    const body = String((JSON.parse(await gh(['pr', 'view', String(number), '--json', 'body'], cwd)) as { body?: unknown }).body ?? '')
    if (!body.includes(MERGE_HELD_NOTE)) await gh(['pr', 'edit', String(number), '--body', withHeldNote(body)], cwd)
  } catch {
    // The record is written; only the line for a person is missing.
  }
}

export type ReleaseOutcome = MergeArming | { outcome: 'not-held' } | { outcome: 'closed'; state: string }

export interface ReleaseOptions {
  gh?: GhRunner
  /** Start the merge watcher for a request (default {@link spawnMergeWatch}). For tests. */
  watch?: (repo: string, number: number) => Promise<void>
}

/**
 * Release a held merge: the request's merge is armed the way `publish --merge` arms it, and then
 * the held note leaves its body. A request with no held merge is `not-held` (its publish never asked
 * to merge), one no longer open is `closed` and its record dropped. A failed arming keeps the
 * record and the note, so the release can be tried again and the request still says it is held.
 */
export async function releaseMerge(repo: string, number: number, opts: ReleaseOptions = {}): Promise<ReleaseOutcome> {
  const gh = opts.gh ?? nodeGhRunner()
  if (!(await heldMergeRecorded(repo, number))) return { outcome: 'not-held' }
  let view: { state?: unknown; body?: unknown }
  try {
    view = JSON.parse(await gh(['pr', 'view', String(number), '--json', 'state,body'], repo)) as typeof view
  } catch (err) {
    return { outcome: 'failed', error: errorMessage(err) }
  }
  const state = typeof view.state === 'string' ? view.state : 'OPEN'
  if (state !== 'OPEN') {
    await dropHeldMerge(repo, number)
    return { outcome: 'closed', state }
  }
  const merge = await armMerge(repo, number, gh, opts.watch ?? spawnMergeWatch)
  if (merge.outcome === 'failed') return merge
  await dropHeldMerge(repo, number)
  const body = typeof view.body === 'string' ? view.body : ''
  if (body.includes(MERGE_HELD_NOTE)) await gh(['pr', 'edit', String(number), '--body', withoutHeldNote(body)], repo).catch(() => {})
  return merge
}

/**
 * GitHub's words for "auto-merge is not allowed in this repository" and for "this request is
 * already green, so there is nothing to wait for". Matched loosely on purpose: a rephrase on
 * GitHub's side lands in `failed`, said out loud, never in a wrong merge.
 */
const AUTO_MERGE_OFF = /auto[- ]?merge is not allowed/i
const ALREADY_GREEN = /clean status/i

async function armMerge(repo: string, number: number, gh: GhRunner, watch: (repo: string, number: number) => Promise<void>): Promise<MergeArming> {
  try {
    await gh(['pr', 'merge', String(number), '--squash', '--auto'], repo)
    return { outcome: 'auto-armed' }
  } catch (err) {
    const refusal = errorMessage(err)
    try {
      if (ALREADY_GREEN.test(refusal)) {
        await gh(['pr', 'merge', String(number), '--squash'], repo)
        return { outcome: 'merged' }
      }
      if (AUTO_MERGE_OFF.test(refusal)) {
        await watch(repo, number)
        return { outcome: 'watching' }
      }
    } catch (next) {
      return { outcome: 'failed', error: errorMessage(next) }
    }
    return { outcome: 'failed', error: refusal }
  }
}

/** The open pull request of a branch, or `undefined`. */
async function openPr(cwd: string, branch: string, gh: GhRunner): Promise<{ number: number; url: string } | undefined> {
  try {
    const list = JSON.parse(await gh(['pr', 'list', '--head', branch, '--state', 'open', '--limit', '1', '--json', 'number,url'], cwd)) as { number?: unknown; url?: unknown }[]
    const first = list[0]
    return first && typeof first.number === 'number' && typeof first.url === 'string' ? { number: first.number, url: first.url } : undefined
  } catch {
    return undefined
  }
}

function prNumber(url: string | undefined): number | undefined {
  const match = url?.match(/\/pull\/(\d+)(?:$|[/?#])/)
  return match ? Number(match[1]) : undefined
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
