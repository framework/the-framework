import { cliRunner, type CliRunner } from '../cli-exec.js'
import { cachedRead, invalidate, type Cached } from './cache.js'

/**
 * The `gh` CLI, in one place: the JSON reads the dashboard makes of pull requests. Reads only:
 * pushing, opening and merging are the project's branches provider's (`../store/branches.ts`).
 *
 * There were four separate `gh` adapters across three modules. Three were reads that each
 * hand-rolled `execFile` + `JSON.parse` + a swallowed failure and each spelled the 8s timeout
 * again, and two of those differed only in whether a branch positional was passed.
 */

/** Runs `gh`, resolving stdout and rejecting with the CLI's own stderr on failure. */
export type GhRunner = CliRunner

/**
 * Reads are capped short and never surface an error: every caller is a panel that renders
 * whatever it got, and "gh is not installed" must cost a page load nothing.
 */
const readGh = cliRunner({ bin: 'gh', timeoutMs: 8_000 })

/** A forgiving `gh --json` read: resolves `empty` when gh is missing/unauthed, or its output is not JSON. */
export async function ghJson<T>(args: string[], cwd: string, empty: T, gh: GhRunner = readGh): Promise<T> {
  try {
    return JSON.parse(await gh(args, cwd)) as T
  } catch {
    return empty
  }
}

/** The PR opened for a branch, when there is one. */
export interface LinkedPr {
  number: number
  url: string
  /** OPEN / MERGED / CLOSED (as gh reports it). */
  state: string
  title: string
  /** ISO creation time, when the read included it: what tells one agent's PR from a predecessor's. */
  createdAt?: string
  /**
   * The head commit the PR covers, when the read included it (#1512): what tells "the branch's
   * PR already landed everything" from "the session kept working after its PR merged".
   */
  headRefOid?: string
}

/**
 * A best-effort PR lookup, for a named branch or for the checkout's current branch. One type for
 * both: the named-branch form is the general one, and "the current branch" is just omitting it.
 */
export type PrLookup = (cwd: string, branch?: string) => Promise<LinkedPr | undefined>

/**
 * The branch-addressed form, for a caller that always names one (#799): a finished session's
 * worktree may be gone, so "the current branch" would silently be the project's, not the
 * session's. Narrower than {@link PrLookup} on purpose, so that invariant is in the type.
 */
export type BranchPrLookup = (cwd: string, branch: string) => Promise<LinkedPr | undefined>

const PR_VIEW_FIELDS = 'number,url,state,title,createdAt,headRefOid'

/**
 * The PR for `branch`, or for whatever branch `cwd` is on when none is named. Resolves undefined
 * when gh is missing/unauthed or there is no PR.
 *
 * The named-branch form is what a finished session needs (#799): its worktree may be gone, so the
 * checkout's current branch is the project's, not the session's. The fields are copied out rather
 * than passed through, so a future `--json` addition cannot leak into what callers store.
 *
 * Every optional field {@link LinkedPr} declares must be both asked for and copied out here, or it
 * is silently absent for every caller of this path. `createdAt` was once neither, and it is what
 * tells an agent's own PR from a predecessor's on the same branch name ({@link pickAgentPr}).
 */
export async function ghPrView(cwd: string, branch?: string, gh: GhRunner = readGh): Promise<LinkedPr | undefined> {
  const args = ['pr', 'view', ...(branch ? [branch] : []), '--json', PR_VIEW_FIELDS]
  const pr = await ghJson<LinkedPr | undefined>(args, cwd, undefined, gh)
  return pr
    ? {
        number: pr.number,
        url: pr.url,
        state: pr.state,
        title: pr.title,
        ...(pr.createdAt ? { createdAt: pr.createdAt } : {}),
        ...(pr.headRefOid ? { headRefOid: pr.headRefOid } : {}),
      }
    : undefined
}

/**
 * The cached form of {@link ghPrView} (#1028), and what the dashboard's panels use.
 *
 * A PR lookup costs about 600ms where the git reads beside it cost ten, and the answer changes
 * about as often as someone opens a PR. Cached per checkout and branch, shared between the
 * worktree bar and the handoff summary, and refreshed behind whoever asks. `pending` says the
 * answer is not known yet rather than that there is no PR — the difference matters to a caller
 * deciding whether to offer "Open PR".
 */
export async function cachedPrView(cwd: string, branch?: string): Promise<Cached<LinkedPr | undefined>> {
  return cachedRead(prCacheKey(cwd, branch), () => ghPrView(cwd, branch))
}

/** Forget a branch's PR, after an action that changes whether it has one. */
export function forgetPr(cwd: string, branch?: string): void {
  invalidate(prCacheKey(cwd, branch))
}

function prCacheKey(cwd: string, branch?: string): string {
  return `pr\u0000${cwd}\u0000${branch ?? ''}`
}

/**
 * Every PR a branch name has ever had, newest first (#1251).
 *
 * `gh pr view <branch>` answers with the newest PR for that head *in any state*, so a session
 * whose prompt pins its branch name (`the-framework/triage-quick`) inherits a predecessor's
 * merged PR as its own. The list form keeps the whole history so {@link pickAgentPr} can decide
 * which entry, if any, belongs to the agent asking. Resolves `[]` when gh is missing/unauthed —
 * indistinguishable from "no PRs", which is what every caller would do with a failure anyway.
 */
export async function ghPrsForBranch(cwd: string, branch: string): Promise<LinkedPr[]> {
  return linkedPrs(await ghJson<LinkedPr[]>(prListArgs(branch), cwd, []))
}

/**
 * {@link ghPrsForBranch} for a caller about to *open* a PR (#1601): a listing that fails throws
 * instead of reading as "no PRs", because "none" and "could not tell" must not look alike there —
 * the difference is a second draft PR on a branch that already has one.
 */
export async function ghPrsForBranchOrThrow(cwd: string, branch: string): Promise<LinkedPr[]> {
  return linkedPrs(JSON.parse(await readGh(prListArgs(branch), cwd)) as LinkedPr[])
}

function prListArgs(branch: string): string[] {
  return ['pr', 'list', '--head', branch, '--state', 'all', '--limit', '20', '--json', 'number,url,state,title,createdAt,headRefOid']
}

function linkedPrs(prs: LinkedPr[]): LinkedPr[] {
  return prs.map(pr => ({
    number: pr.number,
    url: pr.url,
    state: pr.state,
    title: pr.title,
    ...(pr.createdAt ? { createdAt: pr.createdAt } : {}),
    ...(pr.headRefOid ? { headRefOid: pr.headRefOid } : {}),
  }))
}

/** The cached form of {@link ghPrsForBranch}, shared through the same read-through cache (#1028). */
export async function cachedPrsForBranch(cwd: string, branch: string): Promise<Cached<LinkedPr[]>> {
  return cachedRead(branchPrsCacheKey(cwd, branch), () => ghPrsForBranch(cwd, branch))
}

/** Forget a branch's PR history, after an action that changes it (opening one). */
export function forgetBranchPrs(cwd: string, branch: string): void {
  invalidate(branchPrsCacheKey(cwd, branch))
}

/** Same unprintable separator idea as `prCacheKey`, spelled so paths cannot collide with it. */
const KEY_SEP = String.fromCharCode(0)

function branchPrsCacheKey(cwd: string, branch: string): string {
  return ['prs', cwd, branch].join(KEY_SEP)
}

/**
 * The PR that belongs to an agent, out of every PR its branch name has had (#1251/#1255).
 *
 * An OPEN PR always counts: GitHub allows one open PR per head branch, so whatever is open on the
 * run's branch is where its pushed commits land. A closed one counts only when it was created
 * after the agent started (`since`, the agent's `startedAt`) — the oldest such entry, which is the one
 * this agent's handoff opened. Anything older is a previous agent's PR wearing the same branch name,
 * which is exactly what showed a merged two-day-old PR as a fresh session's own. Without `since`
 * only an open PR is trusted.
 *
 * `order` exists for the one caller asking a different question (#1512). `'first'` answers
 * identity — which PR did *this agent* open, so a later agent's must not be the answer. `'latest'`
 * answers the handoff decision — which PR last saw the branch, so "did the session keep working
 * past it" is readable off that PR's `headRefOid`; there the oldest entry would call work that a
 * second PR already landed unlanded.
 */
export function pickAgentPr(prs: LinkedPr[], since?: string, order: 'first' | 'latest' = 'first'): LinkedPr | undefined {
  const open = prs.find(pr => pr.state === 'OPEN')
  if (open) return open
  if (!since) return undefined
  const closed = prs
    .filter(pr => pr.createdAt && pr.createdAt >= since)
    .sort((a, b) => ((a.createdAt ?? '') < (b.createdAt ?? '') ? -1 : 1))
  return order === 'latest' ? closed.at(-1) : closed[0]
}

/** An open PR on the interventions queue (#632). */
export interface OpenPr {
  number: number
  title: string
  url: string
  /**
   * Draft PRs are generally left off the queue: a draft is not asking for review.
   *
   * The exception is a draft the framework opened for itself (#1102), which {@link headRefName}
   * is what tells apart.
   */
  isDraft: boolean
  /** The branch the PR is from, so a session's own PR can be recognised as ours (#1102). */
  headRefName?: string
  createdAt?: string
}

/**
 * A checkout's open PRs. Unlike the other reads here it *rejects* when gh could not answer — no
 * remote, not authenticated, GitHub unreachable — instead of resolving `[]`.
 *
 * "No PRs are open" and "I could not look" are different answers, and its caller keeps a baseline
 * of what it has already announced (#1623): taking the second for the first makes the next
 * successful read announce every already-open PR as new. The caller decides what a failure costs;
 * it cannot decide what it never hears about.
 */
export async function ghPrList(cwd: string, gh: GhRunner = readGh): Promise<OpenPr[]> {
  const fields = 'number,title,url,isDraft,headRefName,createdAt'
  const args = ['pr', 'list', '--state', 'open', '--limit', '50', '--json', fields]
  return JSON.parse(await gh(args, cwd)) as OpenPr[]
}

/** Lists a checkout's open PRs; rejects when there is no remote / gh is unavailable. */
export type PrLister = (cwd: string) => Promise<OpenPr[]>

