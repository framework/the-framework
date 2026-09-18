import { nodeGitRunner, pushBranch, type GitRunner } from '@gemstack/agent-data'
import { currentBranch, isWorktreeRoot, projectRoot, worktreeClean } from './worktree.js'
import { spawnMergeWatch } from './merge-watch.js'

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
       * request was already green), or this tool's watcher started (the repository does not
       * allow auto-merge).
       */
      merge?: { outcome: 'auto-armed' | 'merged' | 'watching' } | { outcome: 'failed'; error: string }
    }
  | { ok: false; reason: 'not-a-worktree' | 'no-branch' }
  | { ok: false; reason: 'dirty' | 'push-failed' | 'pr-failed'; branch: string; detail?: string }

export async function publishCheckout(path: string, opts: PublishOptions): Promise<PublishOutcome> {
  const git = opts.git ?? nodeGitRunner()
  const gh = opts.gh ?? nodeGhRunner()
  if (!(await isWorktreeRoot(path, git))) return { ok: false, reason: 'not-a-worktree' }
  const branch = await currentBranch(path, git)
  if (!branch) return { ok: false, reason: 'no-branch' }
  if (!(await worktreeClean(path, git).catch(() => false))) return { ok: false, reason: 'dirty', branch }

  const repo = await projectRoot(path, git)
  const pushed = await pushBranch(repo, branch, git)
  if (!pushed.ok) return { ok: false, reason: 'push-failed', branch, detail: pushed.error }

  let pr = await openPr(path, branch, gh)
  let existing = true
  if (!pr) {
    existing = false
    try {
      const args = ['pr', 'create', '--head', branch, '--title', opts.title, '--body', opts.body ?? '']
      if (opts.draft && !opts.merge) args.push('--draft')
      const out = await gh(args, path)
      const url = out.trim().split('\n').filter(Boolean).at(-1)
      const number = prNumber(url)
      pr = url && number !== undefined ? { number, url } : await openPr(path, branch, gh)
      if (!pr) return { ok: false, reason: 'pr-failed', branch, detail: 'gh printed no pull request URL' }
    } catch (err) {
      return { ok: false, reason: 'pr-failed', branch, detail: errorMessage(err) }
    }
  }

  const outcome: PublishOutcome = { ok: true, branch, pr, existing }
  if (opts.merge) outcome.merge = await armMerge(repo, pr.number, gh, opts.watch ?? spawnMergeWatch)
  return outcome
}

/**
 * GitHub's words for "auto-merge is not allowed in this repository" and for "this request is
 * already green, so there is nothing to wait for". Matched loosely on purpose: a rephrase on
 * GitHub's side lands in `failed`, said out loud, never in a wrong merge.
 */
const AUTO_MERGE_OFF = /auto[- ]?merge is not allowed/i
const ALREADY_GREEN = /clean status/i

async function armMerge(repo: string, number: number, gh: GhRunner, watch: (repo: string, number: number) => Promise<void>): Promise<NonNullable<(PublishOutcome & { ok: true })['merge']>> {
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
