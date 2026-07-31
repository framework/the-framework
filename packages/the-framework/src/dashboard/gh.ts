import { cliRunner, type CliRunner } from '../cli-exec.js'
import { cachedRead, invalidate, type Cached } from './cache.js'
import { errorMessage } from '../error-message.js'
import type { AutoMergeOutcome } from '../events.js'

/**
 * The `gh` CLI, in one place: the two JSON reads the dashboard makes and the runner its write
 * actions use.
 *
 * There were four separate `gh` adapters across three modules. Three were reads that each
 * hand-rolled `execFile` + `JSON.parse` + a swallowed failure and each spelled the 8s timeout
 * again, and two of those differed only in whether a branch positional was passed; the fourth was
 * a generic runner for the write actions, which rejects with stderr and waits longer.
 */

/** Runs `gh`, resolving stdout and rejecting with the CLI's own stderr on failure. */
export type GhRunner = CliRunner

/**
 * A {@link GhRunner} for the write actions (push, open a PR). Longer timeout than a read: these
 * talk to the network and to git, and the user is waiting on a button they pressed.
 */
export function nodeGhRunner(): GhRunner {
  return cliRunner({ bin: 'gh', timeoutMs: 60_000, preferStderr: true })
}

/**
 * Reads are capped short and never surface an error: every caller is a panel that renders
 * whatever it got, and "gh is not installed" must cost a page load nothing.
 */
const readGh = cliRunner({ bin: 'gh', timeoutMs: 8_000 })

/**
 * The GitHub token an Actions run authenticates with (#1352).
 *
 * `GH_TOKEN` / `GITHUB_TOKEN` win, because CI sets them and must beat whatever `gh` happens to be
 * logged in as on the runner. With neither set, fall back to the `gh` CLI's own credential — the
 * same one every PR this framework opens is already authenticated by. A machine that can open a PR
 * could always have run an Actions session too; it just had no way to say so, and the run failed
 * with the credential sitting one `gh auth token` away.
 *
 * Undefined when there is no token to be had (gh missing, logged out, or refusing to hand it over),
 * which the caller turns into the run's stated reason for not starting. Deliberately quiet about
 * *why* gh declined: the caller's message names both ways to fix it, and a keyring prompt's stderr
 * is not something to put in front of someone who simply has not set GH_TOKEN.
 */
export async function githubToken(
  cwd: string,
  env: Record<string, string | undefined> = process.env,
  gh: GhRunner = readGh,
): Promise<string | undefined> {
  const fromEnv = env['GH_TOKEN'] ?? env['GITHUB_TOKEN']
  if (fromEnv) return fromEnv
  try {
    return (await gh(['auth', 'token'], cwd)).trim() || undefined
  } catch {
    return undefined
  }
}

/** A forgiving `gh --json` read: resolves `empty` when gh is missing/unauthed, or its output is not JSON. */
export async function ghJson<T>(args: string[], cwd: string, empty: T): Promise<T> {
  try {
    return JSON.parse(await readGh(args, cwd)) as T
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
  /** ISO creation time, when the read included it: what tells one run's PR from a predecessor's. */
  createdAt?: string
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

const PR_VIEW_FIELDS = 'number,url,state,title'

/**
 * The PR for `branch`, or for whatever branch `cwd` is on when none is named. Resolves undefined
 * when gh is missing/unauthed or there is no PR.
 *
 * The named-branch form is what a finished session needs (#799): its worktree may be gone, so the
 * checkout's current branch is the project's, not the session's. The fields are copied out rather
 * than passed through, so a future `--json` addition cannot leak into what callers store.
 */
export async function ghPrView(cwd: string, branch?: string): Promise<LinkedPr | undefined> {
  const args = ['pr', 'view', ...(branch ? [branch] : []), '--json', PR_VIEW_FIELDS]
  const pr = await ghJson<LinkedPr | undefined>(args, cwd, undefined)
  return pr ? { number: pr.number, url: pr.url, state: pr.state, title: pr.title } : undefined
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
 * merged PR as its own. The list form keeps the whole history so {@link pickRunPr} can decide
 * which entry, if any, belongs to the run asking. Resolves `[]` when gh is missing/unauthed —
 * indistinguishable from "no PRs", which is what every caller would do with a failure anyway.
 */
export async function ghPrsForBranch(cwd: string, branch: string): Promise<LinkedPr[]> {
  const fields = 'number,url,state,title,createdAt'
  const args = ['pr', 'list', '--head', branch, '--state', 'all', '--limit', '20', '--json', fields]
  const prs = await ghJson<LinkedPr[]>(args, cwd, [])
  return prs.map(pr => ({
    number: pr.number,
    url: pr.url,
    state: pr.state,
    title: pr.title,
    ...(pr.createdAt ? { createdAt: pr.createdAt } : {}),
  }))
}

/**
 * The refusals that mean "auto-merge is not available here, merge directly instead" (#1216).
 *
 * gh surfaces GitHub's GraphQL errors verbatim: `Pull request Auto merge is not allowed for this
 * repository` where the repo setting is off, and `Pull request is in clean status` where nothing
 * blocks the PR — auto-merge is *only* for PRs that cannot land yet, so a green PR gets the same
 * refusal and the direct merge is exactly what was meant. Matched loosely (both carry the
 * `enablePullRequestAutoMerge` marker) so a rephrase on GitHub's side degrades to a reported
 * failure, never a wrong merge.
 */
const DIRECT_MERGE_FALLBACK = /auto[- ]?merge is not allowed|clean status|enablePullRequestAutoMerge|protected branch/i

/**
 * Merge a PR the handoff just opened (#1216): GitHub auto-merge first, so the PR lands when its
 * checks pass rather than before them; merged directly where the repo does not allow auto-merge.
 * Squash in both forms — a session's branch is working history, not a story worth preserving.
 *
 * Never throws: the caller reports the outcome alongside the handoff's, and a merge that could
 * not happen must not turn a successful handoff into a failed one.
 */
export async function ghMergePr(cwd: string, number: number, gh: GhRunner = nodeGhRunner()): Promise<AutoMergeOutcome> {
  try {
    await gh(['pr', 'merge', String(number), '--squash', '--auto'], cwd)
    return { outcome: 'auto-armed' }
  } catch (err) {
    const refusal = errorMessage(err)
    // A draft cannot be merged or auto-merged. The armed handoff opens its PR ready, but the
    // already-open path can find a draft a *previous* run left behind — mark it ready and try
    // once more, because an armed merge is the statement that its review already happened.
    if (/draft/i.test(refusal)) {
      try {
        await gh(['pr', 'ready', String(number)], cwd)
        await gh(['pr', 'merge', String(number), '--squash', '--auto'], cwd)
        return { outcome: 'auto-armed' }
      } catch (retry) {
        const readyRefusal = errorMessage(retry)
        if (!DIRECT_MERGE_FALLBACK.test(readyRefusal)) return { outcome: 'failed', error: readyRefusal }
        return directMerge(cwd, number, gh)
      }
    }
    if (!DIRECT_MERGE_FALLBACK.test(refusal)) return { outcome: 'failed', error: refusal }
    return directMerge(cwd, number, gh)
  }
}

/** The direct-merge half of {@link ghMergePr}, shared by its two ways of getting there. */
async function directMerge(cwd: string, number: number, gh: GhRunner): Promise<AutoMergeOutcome> {
  try {
    await gh(['pr', 'merge', String(number), '--squash'], cwd)
    return { outcome: 'merged' }
  } catch (direct) {
    return { outcome: 'failed', error: errorMessage(direct) }
  }
}

/** Whether the repo lets PRs use GitHub auto-merge (#1417); `known: false` when `gh` could not say. */
export interface RepoAutoMerge {
  known: boolean
  allowed: boolean
}

/**
 * Whether this repo allows GitHub auto-merge (#1417).
 *
 * An armed merge on a repo that does not silently degrades to an immediate direct merge (the
 * {@link DIRECT_MERGE_FALLBACK} half of #1216) — the PR lands before CI has run (#1406) — so the
 * launcher warns with the fix instead of leaving the degradation silent. `known: false` (gh
 * missing, unauthenticated, not a GitHub repo) is "could not say", which renders nothing: no
 * crying wolf, same stance as the #1318 trust read.
 */
export async function ghRepoAutoMerge(cwd: string, gh: GhRunner = readGh): Promise<RepoAutoMerge> {
  try {
    const parsed = JSON.parse(await gh(['repo', 'view', '--json', 'autoMergeAllowed'], cwd)) as { autoMergeAllowed?: unknown }
    if (typeof parsed.autoMergeAllowed !== 'boolean') return { known: false, allowed: false }
    return { known: true, allowed: parsed.autoMergeAllowed }
  } catch {
    return { known: false, allowed: false }
  }
}

/** The cached form of {@link ghRepoAutoMerge} (#1028): the launcher polls, the setting barely changes. */
export async function cachedRepoAutoMerge(cwd: string): Promise<Cached<RepoAutoMerge>> {
  return cachedRead(['auto-merge-allowed', cwd].join(KEY_SEP), () => ghRepoAutoMerge(cwd), { ttlMs: 5 * 60_000 })
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
 * The PR that belongs to a run, out of every PR its branch name has had (#1251/#1255).
 *
 * An OPEN PR always counts: GitHub allows one open PR per head branch, so whatever is open on the
 * run's branch is where its pushed commits land. A closed one counts only when it was created
 * after the run started (`since`, the run's `startedAt`) — the oldest such entry, which is the one
 * this run's handoff opened. Anything older is a previous run's PR wearing the same branch name,
 * which is exactly what showed a merged two-day-old PR as a fresh session's own. Without `since`
 * only an open PR is trusted.
 */
export function pickRunPr(prs: LinkedPr[], since?: string): LinkedPr | undefined {
  const open = prs.find(pr => pr.state === 'OPEN')
  if (open) return open
  if (!since) return undefined
  return prs
    .filter(pr => pr.createdAt && pr.createdAt >= since)
    .sort((a, b) => ((a.createdAt ?? '') < (b.createdAt ?? '') ? -1 : 1))[0]
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

/** A checkout's open PRs; resolves `[]` when there is no remote or gh is unavailable. */
export async function ghPrList(cwd: string): Promise<OpenPr[]> {
  const fields = 'number,title,url,isDraft,headRefName,createdAt'
  const args = ['pr', 'list', '--state', 'open', '--limit', '50', '--json', fields]
  return ghJson<OpenPr[]>(args, cwd, [])
}

/** Lists a checkout's open PRs; resolves `[]` when there is no remote / gh is unavailable. */
export type PrLister = (cwd: string) => Promise<OpenPr[]>

/** One open PR's diff of a single file (#1313). */
export interface OpenPrFilePatch {
  number: number
  patch: string
}

/**
 * The `file` diff of every open PR that touches it (#1313). One `gh api` read per open PR, so
 * callers go through {@link cachedOpenPrFilePatches}. The files endpoint belongs to the base
 * repo, so cross-fork PRs answer too. First 100 changed files per PR only — a PR burying the
 * queue file deeper than that simply contributes no claim, which is today's behavior anyway.
 * Resolves `[]` when gh is missing/unauthed.
 */
export async function ghOpenPrFilePatches(cwd: string, file: string, prs?: OpenPr[]): Promise<OpenPrFilePatch[]> {
  const open = prs ?? (await ghPrList(cwd))
  const patches: OpenPrFilePatch[] = []
  for (const pr of open) {
    const files = await ghJson<{ filename: string; patch?: string }[]>(
      ['api', `repos/{owner}/{repo}/pulls/${pr.number}/files?per_page=100`],
      cwd,
      [],
    )
    const patch = files.find(f => f.filename === file)?.patch
    if (patch) patches.push({ number: pr.number, patch })
  }
  return patches
}

/**
 * The cached form of {@link ghOpenPrFilePatches} (#1028). The cold budget is generous where the
 * PR caches' is not: the one caller is the sweep's claim check, and a drain the user just clicked
 * should wait a few seconds for the real answer rather than stand down for a whole tick.
 */
export async function cachedOpenPrFilePatches(cwd: string, file: string): Promise<Cached<OpenPrFilePatch[]>> {
  const key = ['pr-file-patches', cwd, file].join(KEY_SEP)
  return cachedRead(key, () => ghOpenPrFilePatches(cwd, file), { ttlMs: 60_000, budgetMs: 5_000 })
}
