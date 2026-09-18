import { nodeGitRunner, type GitRunner, pushBranch } from '@gemstack/agent-data'
import { agentBranchName, sessionNameOf, repoHasRemote } from '@gemstack/skill-branches'
import { THE_FRAMEWORK_DIR } from '../framework-dir.js'
import {
  cachedPrView,
  cachedPrsForBranch,
  forgetBranchPrs,
  forgetPr,
  ghMergePr,
  nodeGhRunner,
  pickAgentPr,
  type GhRunner,
  type LinkedPr,
  type BranchPrLookup,
} from './gh.js'
import type { Cached } from './cache.js'
import { parseNumstat } from './file-diff.js'
import { parsePorcelain } from './file-status.js'
import { errorMessage } from '../error-message.js'
import type { AgentMeta } from '../store/index.js'
// What a finished session produced, and what is left to do with it (#799).
//
// Everything up to "the agent is done" was covered; the handoff back to the human was not. A
// clean run archives its history, commits what it was holding, removes its worktree and leaves
// the work on a branch. Nothing pushed, nothing opened, and the dashboard showed none of it.
//
// The read is deliberately *branch*-addressed, not worktree-addressed: the common end state has
// no worktree left, so a checkout-based read (`onAgentWorktree`) falls back to the project root and
// reports the project's own branch as if it were the session's. Here the branch is the subject and
// the project repo is only where it is read from, so a finished session reads the same whether or
// not its checkout still exists.
//
// Forgiving throughout: a project that is not a git repo, has no remote, or has no `gh` yields a
// handoff with less in it, never an error.

/** One commit a session put on its branch. */
export interface HandoffCommit {
  sha: string
  /** Short sha, for display. */
  short: string
  subject: string
}

/** One file the session changed, against the branch point. */
export interface HandoffFile {
  path: string
  insertions: number
  deletions: number
  /** True for a binary file, where line counts are meaningless. */
  binary: boolean
}

/** What a finished session produced and what can still be done with it. */
export interface AgentHandoff {
  /** The branch the work is on. */
  branch: string
  /** The branch still exists in the repo (a deleted or never-created one does not). */
  exists: boolean
  /** What the branch is measured against (the repo's default branch), when one was found. */
  base?: string
  commits: HandoffCommit[]
  files: HandoffFile[]
  insertions: number
  deletions: number
  /**
   * The session produced nothing to hand off: the branch exists but carries no commit the base
   * does not already have — or nothing beyond the framework's own bookkeeping (#1291), which is
   * committed for provenance, never as publishable work. Said out loud, rather than shown as an
   * empty branch.
   */
  empty: boolean
  /** The repo has a remote to push to at all. */
  hasRemote: boolean
  /** The branch is on the remote and the remote is at the same commit. */
  pushed: boolean
  /** The branch is already merged into the base. */
  merged: boolean
  /** The PR opened for this branch, when there is one. */
  pr?: LinkedPr
  /** The PR is not known yet, rather than absent (#1028): the lookup is still running. */
  prPending?: boolean
  /**
   * The files the session changed and never committed, read from its own checkout (#1173).
   *
   * The agent is told to commit its work, but one that ended without doing so holds its whole
   * output in an uncommitted tree, and nothing commits it on the agent's behalf (#1638). That work
   * is not on the branch yet, so it is
   * not in {@link commits} and it does not make {@link empty} false. Paths rather than a count,
   * because a no-diff branch must *name* what is waiting instead of offering an Open PR that
   * GitHub can only refuse. Absent when the caller did not say which checkout the session worked
   * in — "nobody asked" and "asked, tree clean" are different answers.
   */
  pendingFiles?: string[]
}

/** Injectable seams so the reader is unit-testable off disk, plus the checkout the session worked in. */
export interface AgentHandoffDeps {
  git?: GitRunner
  pr?: BranchPrLookup
  /**
   * The session's own checkout (#453), when it has one. The branch lives in the project repo and is
   * read from there; uncommitted work does not, it sits in the tree the agent actually edited.
   */
  checkout?: string
  /**
   * When the agent started (ISO), so the PR lookup can tell the agent's own PR from an earlier agent's
   * on the same branch name (#1251). Without it, only an open PR is trusted.
   */
  since?: string
  /**
   * Which of the run's own PRs answers, when it has more than one (#1512). Identity questions want
   * the first; a handoff decision comparing the branch tip against a PR's head wants the last one
   * that saw the branch, or work a later PR already landed reads as unlanded. See {@link pickAgentPr}.
   */
  order?: 'first' | 'latest'
}

/**
 * The branch an agent's work is on.
 *
 * What was recorded while the worktree existed (#799/#1277): the agent renames its branch itself
 * (#1725), so anything but the record is a guess. The birth branch stays as the one fallback, for
 * an archive that never recorded a branch.
 */
export function agentBranchFor(agent: { id: string; branch?: string }): string {
  return agent.branch ?? agentBranchName(agent.id)
}

/**
 * The branch's PR as it applies to *this* run: the injected seam when the caller gave one, else
 * the cached history filtered through {@link pickAgentPr} with the agent's start time (#1251).
 */
async function lookupAgentPr(cwd: string, branch: string, deps: AgentHandoffDeps): Promise<Cached<LinkedPr | undefined>> {
  if (deps.pr) return { value: await deps.pr(cwd, branch).catch(() => undefined), pending: false }
  const prs = await cachedPrsForBranch(cwd, branch).catch(() => ({ value: undefined, pending: false }))
  return { value: prs.value ? pickAgentPr(prs.value, deps.since, deps.order) : undefined, pending: prs.pending }
}

/** The cached single-PR read {@link resolveAgentPr} asks for the recorded PR's current state. */
export type CachedBranchPrLookup = (cwd: string, branch?: string) => Promise<Cached<LinkedPr | undefined>>

/** What {@link resolveAgentPr} needs to know about an agent: structurally satisfied by {@link AgentMeta}. */
export interface PrAgent {
  id: string
  branch?: string
  /** The pull request the agent recorded when one was opened for it (E6). */
  pr?: { number: number; url: string }
}

/**
 * The pull request that belongs to an agent: the one it recorded (E6), read live for its state.
 *
 * The number is a fact about the agent, so the agent writes it down — at the moment its handoff opens
 * the PR, or when the dashboard's button does after the process is gone. Every surface then reads
 * the same integer instead of re-deriving it.
 *
 * What that replaced: a three-way branch-name ladder (the recorded branch, then a branch built from
 * the session name, then the run-id branch, because a hands-off web agent's checkout is gone and its
 * session name may be a reused pin) plus a timestamp heuristic on top of it, so that a predecessor's PR on
 * a shared branch name was not mistaken for this agent's. Three sources and a guess, standing in for
 * one integer nobody had written down — the same lesson the `branch` event (#1277) already learned.
 *
 * The *state* is still read live, because it changes without this agent doing anything: a PR merges,
 * a human closes it. That read rides the PR-lookup cache (#1028), and `pending` while it is warming means the
 * caller can ask again rather than render "no PR".
 */
export async function resolveAgentPr(
  cwd: string,
  agent: PrAgent,
  prs: CachedBranchPrLookup = cachedPrView,
): Promise<Cached<LinkedPr | undefined>> {
  if (!agent.pr) return { value: undefined, pending: false }
  const branch = agentBranchFor(agent)
  const read = await prs(cwd, branch).catch((): Cached<LinkedPr | undefined> => ({ value: undefined, pending: false }))
  // The live read is about the recorded PR's *state*; a different number on the branch is some
  // other PR and never this agent's answer.
  if (read.value && read.value.number === agent.pr.number) return { value: read.value, pending: false }
  // Nothing live to say, so the recorded fact stands on its own: an agent whose PR is on a branch this
  // machine cannot see still has a PR, and its number and URL are what the surfaces need.
  return { value: { ...agent.pr, state: read.pending ? 'OPEN' : 'UNKNOWN', title: '' }, pending: read.pending }
}

/**
 * Merge a finished session's open PR (#1391): the Merge action, pressed by a human.
 *
 * The direct answer to the withheld-merge ending (#1363): a session whose agent never signalled
 * ready-for-merge leaves a draft PR behind, and this is the human saying "it's good, land it".
 * `ghMergePr` marks a draft ready on the way, for exactly that case. Refuses when the agent has no
 * PR or it is no longer open — "already merged" is an answer, not an action.
 */
export async function mergeAgentPr(
  cwd: string,
  agent: PrAgent,
  deps: { gh?: GhRunner; prs?: CachedBranchPrLookup } = {},
): Promise<HandoffResult> {
  const pr = (await resolveAgentPr(cwd, agent, deps.prs)).value
  if (!pr) return { ok: false, error: 'this session has no pull request to merge' }
  if (pr.state !== 'OPEN') return { ok: false, error: `this session's PR is already ${pr.state.toLowerCase()}` }
  const merged = await ghMergePr(cwd, pr.number, deps.gh)
  if (merged.outcome === 'failed') return { ok: false, error: merged.error }
  // The PR's cached state just changed, so the branch's cached read must go or the bar keeps
  // offering a merge for a PR that landed (#1028).
  const branch = agentBranchFor(agent)
  forgetPr(cwd, branch)
  forgetBranchPrs(cwd, branch)
  return { ok: true, url: pr.url, number: pr.number }
}

/** `git` that resolves to '' instead of rejecting, for reads where "no answer" is a fine answer. */
function soft(git: GitRunner, cwd: string): (args: string[]) => Promise<string> {
  return args => git(args, cwd).catch(() => '')
}

/** The repo's default branch: what the remote points HEAD at, else the first local conventional one. */
async function detectBase(agent: (args: string[]) => Promise<string>): Promise<string | undefined> {
  const head = (await agent(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])).trim()
  if (head) return head
  for (const name of ['main', 'master']) {
    if ((await agent(['rev-parse', '--verify', '--quiet', `refs/heads/${name}`])).trim()) return name
  }
  return undefined
}

/** A subject can hold anything, so the fields are unit-separated rather than space-split. */
const SEP = String.fromCharCode(31)

/** Parse `git log --format=%H%x1f%s`. */
function parseCommits(out: string): HandoffCommit[] {
  return out
    .split('\n')
    .filter(line => line.includes(SEP))
    .map(line => {
      const [sha = '', subject = ''] = line.split(SEP)
      return { sha, short: sha.slice(0, 7), subject }
    })
}

/** `git diff --numstat` as {@link HandoffFile}s, via the shared parser in file-diff.ts. */
function parseHandoffFiles(out: string): HandoffFile[] {
  return parseNumstat(out).map(({ path, added, removed, binary }) => ({ path, insertions: added, deletions: removed, binary }))
}

/** The framework's own paper trail (#1291): the agent archive, plus pre-B3 records (conversations, LOGS.md). */
function isBookkeepingPath(path: string): boolean {
  return path === THE_FRAMEWORK_DIR || path.startsWith(`${THE_FRAMEWORK_DIR}/`)
}

/**
 * Read what a finished session left behind, from the project repo, for `branch`.
 *
 * Returns undefined only when `cwd` is not a git repo at all. A branch that no longer exists
 * still returns a handoff (with `exists: false`), because "that branch is gone" is itself the
 * answer the dashboard needs to show.
 */
export async function readAgentHandoff(
  cwd: string,
  branch: string,
  deps: AgentHandoffDeps = {},
): Promise<AgentHandoff | undefined> {
  const git = deps.git ?? nodeGitRunner()
  const agent = soft(git, cwd)

  // Not a repo (or git is unusable): nothing here is answerable.
  if (!(await git(['rev-parse', '--git-dir'], cwd).then(() => true).catch(() => false))) return undefined

  const tip = (await agent(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])).trim()
  const hasRemote = await repoHasRemote(cwd, git)
  const pending = await countPendingWork(git, deps.checkout)
  if (!tip) {
    // The branch being gone locally does not mean the work is: a hands-off web agent pushes its
    // branch and opens its PR remotely, and a merged branch gets deleted. The PR is a remote
    // question, so it is still answerable — and it is the one thing left worth showing (#1255).
    const pr = await lookupAgentPr(cwd, branch, deps)
    return {
      branch,
      exists: false,
      commits: [],
      files: [],
      insertions: 0,
      deletions: 0,
      empty: true,
      hasRemote,
      pushed: false,
      merged: false,
      ...(pr.value ? { pr: pr.value } : {}),
      ...(pr.pending ? { prPending: true } : {}),
      ...pending,
    }
  }

  const base = await detectBase(agent)
  // Two ranges, because git's two spellings mean opposite things here and only one is right for
  // each question (#1164/#1173).
  //
  // `base..branch` is the branch's OWN commits, which is what "what did this session produce"
  // asks. `base...branch` in `git log` is the SYMMETRIC difference, so it also lists commits that
  // are only on the base — exactly the thing the comment below says not to count. A session whose
  // work is already merged then reported commits it did not make, `empty` stayed false, and the
  // dashboard offered an Open PR that GitHub refuses with "No commits between main and <branch>".
  //
  // For the diff the three-dot form IS the right one: it is the change since the branch point,
  // rather than a comparison against a base that has moved on since.
  const logRange = base ? `${base}..${branch}` : undefined
  const diffRange = base ? `${base}...${branch}` : undefined

  const [commitsOut, numstatOut, remoteTip, mergedOut] = await Promise.all([
    logRange ? agent(['log', '--format=%H%x1f%s', logRange]) : Promise.resolve(''),
    diffRange ? agent(['diff', '--numstat', diffRange]) : Promise.resolve(''),
    hasRemote ? agent(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`]) : Promise.resolve(''),
    base ? agent(['branch', '--list', '--merged', base, branch]) : Promise.resolve(''),
  ])

  const commits = parseCommits(commitsOut)
  const files = parseHandoffFiles(numstatOut)
  // Read through the cache and allowed to arrive late (#1028): the commits, the files and
  // whether the branch is pushed are all local git, and none of them should wait on `gh`.
  const pr = await lookupAgentPr(cwd, branch, deps)

  return {
    branch,
    exists: true,
    ...(base ? { base } : {}),
    commits,
    files,
    insertions: files.reduce((sum, f) => sum + f.insertions, 0),
    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
    // A session that changed nothing is a real outcome, not an error: it gets said, not shown as
    // an empty branch with buttons that would push nothing. Bookkeeping-only counts as nothing
    // (#1291): every agent's branch carries the framework's own records — the pre-work (#326) commit
    // sweeps in the conversation file the daemon just wrote — and publishing those alone produced
    // junk PRs of pure paper trail. The files decide, not the commits: a branch of bookkeeping
    // sweeps has commits and still nothing to hand off.
    empty: commits.length === 0 || files.every(file => isBookkeepingPath(file.path)),
    hasRemote,
    pushed: remoteTip.trim() === tip,
    merged: mergedOut.trim().length > 0,
    ...(pr.value ? { pr: pr.value } : {}),
    ...(pr.pending ? { prPending: true } : {}),
    ...pending,
  }
}

/**
 * The files the session left uncommitted in its own checkout, as a spreadable field.
 *
 * Absent rather than `[]` when no checkout was given (or git could not answer): "nobody asked" and
 * "asked, nothing pending" are different answers, and only the second one may be shown as a clean
 * tree.
 */
async function countPendingWork(git: GitRunner, checkout: string | undefined): Promise<{ pendingFiles?: string[] }> {
  if (!checkout) return {}
  const status = await git(['status', '--porcelain'], checkout).catch(() => undefined)
  if (status === undefined) return {}
  return { pendingFiles: parsePorcelain(status).map(entry => entry.path) }
}

/** The outcome of a handoff action, in the `{ ok }` shape the dashboard's `useAction` understands. */
/**
 * What a handoff action did. The PR's `number` rides along with its `url` (E6), because the number
 * is the fact worth *recording* — every surface that wants an agent's PR then reads it off the agent
 * rather than re-deriving it from branch names and timestamps.
 */
export type HandoffResult = { ok: true; url?: string; number?: number } | { ok: false; error: string }

/**
 * {@link AgentHandoff.base} as a base a PR can actually be opened against.
 *
 * The field holds a git ref, because that is what every other use of it needs: `detectBase` reads
 * `refs/remotes/origin/HEAD`, so it is `origin/main`, and the log range and merged check are both
 * asking git a question about a remote-tracking ref. `gh pr create --base` is asking GitHub for a
 * *branch on the remote*, and rejects `origin/main` with "Base ref must be a branch".
 *
 * So the conversion belongs at the `gh` boundary rather than in the field. Stripping `origin/`
 * matches what the rest of this module already assumes: the remote is `origin` (`pushBranch`
 * pushes there, `detectBase` reads its HEAD).
 */
export function prBaseName(base: string): string {
  return base.startsWith('origin/') ? base.slice('origin/'.length) : base
}

/** What to put on the PR. */
export interface PullRequestDraft {
  title: string
  body: string
  base?: string
  /**
   * Open it as a GitHub draft (#1102). What auto-handoff uses: opening a PR by itself at the end
   * of every session should not put a review request in anyone's inbox.
   *
   * Safe to do only because the interventions queue was taught to keep listing a draft on a
   * session branch. Left off, a draft would be invisible in both places at once.
   */
  draft?: boolean
}

/**
 * Open a PR for a finished session's branch, pushing it first when the remote does not have it.
 *
 * The button opens it ready for review, because a PR a human asked for by name is asking for
 * review. {@link PullRequestDraft.draft} is the auto-handoff case, which is not.
 */
export async function openBranchPullRequest(
  cwd: string,
  branch: string,
  draft: PullRequestDraft,
  deps: { git?: GitRunner; gh?: GhRunner } = {},
): Promise<HandoffResult> {
  const git = deps.git ?? nodeGitRunner()
  const gh = deps.gh ?? nodeGhRunner()
  // gh refuses to open a PR for a branch the remote has never seen, so the push is part of the
  // action rather than a thing the user has to remember to do first.
  const pushed = await pushBranch(cwd, branch, git)
  if (!pushed.ok) return pushed
  try {
    const args = ['pr', 'create', '--head', branch, '--title', draft.title, '--body', draft.body]
    if (draft.base) args.push('--base', prBaseName(draft.base))
    if (draft.draft) args.push('--draft')
    return createdPr(await gh(args, cwd), cwd, branch)
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

/**
 * What a `gh pr create` left behind. gh prints the new PR's URL as its last line, and the number is
 * that URL's last path segment; an output with no URL still reports success, since the PR is open.
 *
 * The branch has a PR now, so the cached "no PR" must go or the bar would keep offering to open one
 * for the next minute (#1028) — both caches: the single-PR view and the history.
 */
function createdPr(out: string, cwd: string, branch: string): HandoffResult {
  forgetPr(cwd, branch)
  forgetBranchPrs(cwd, branch)
  const url = out.trim().split('\n').filter(Boolean).at(-1)
  if (!url) return { ok: true }
  const number = prNumberFromUrl(url)
  return { ok: true, url, ...(number !== undefined ? { number } : {}) }
}

/**
 * Open a draft PR for a branch that exists only on the remote (#1601): a cloud session's own
 * `claude/*` branch was pushed from a VM this machine never sees, so there is nothing to push
 * here — `gh pr create --head` against the remote branch is the whole action, and gh's default
 * base (the repo's default branch) is the right one. Draft for the same reason the auto-handoff
 * opens drafts: a PR the framework opens by itself must not put a review request in anyone's
 * inbox, and the interventions queue keeps listing a session's draft.
 */
export async function openRemoteBranchPullRequest(
  cwd: string,
  agent: HandoffAgent,
  branch: string,
  deps: { gh?: GhRunner } = {},
): Promise<HandoffResult> {
  const gh = deps.gh ?? nodeGhRunner()
  try {
    const args = ['pr', 'create', '--head', branch, '--title', agentPrTitle(agent), '--body', agentPrBody(agent), '--draft']
    return createdPr(await gh(args, cwd), cwd, branch)
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

/**
 * Whether the session kept committing after its PR merged or closed (#1512): the PR carries a
 * head, the branch has a tip, and they disagree. False for an open PR (pushed commits still land
 * on it), for a headless read (an older cache or injected lookup — never risk a duplicate PR on
 * a guess), and for a gone branch (no tip to compare; the PR stays the best answer, #1255).
 */
function movedPastPr(state: Pick<AgentHandoff, 'pr' | 'commits'>): boolean {
  if (!state.pr || state.pr.state === 'OPEN') return false
  const tip = state.commits[0]?.sha
  return Boolean(state.pr.headRefOid && tip && state.pr.headRefOid !== tip)
}

/**
 * Open a PR for a finished session, deciding from what the agent recorded which cases should not
 * open one. Reads the branch's handoff first: a branch that no longer exists, or a session that
 * changed nothing, is a clear error rather than an empty PR, and a branch that already has a PR
 * returns that one. Title is the session name (else the intent's first line, else the id); body
 * is the intent plus which session did it. This is the handoff decision the dashboard's
 * open-PR button offers; the RPC layer only resolves which run it is about.
 */
export async function openAgentPullRequest(
  cwd: string,
  agent: AgentMeta,
  options: { draft?: boolean } = {},
): Promise<HandoffResult> {
  const branch = agentBranchFor(agent)
  // `latest` order (#1512), because the `movedPastPr` decision below compares the branch tip
  // against a PR's head: against the *first* PR, work a second one already landed reads as
  // unlanded and this opens a third for it. The same reason the automatic handoff picks latest.
  const handoff = await readAgentHandoff(cwd, branch, { since: agent.startedAt, order: 'latest' }).catch(() => undefined)
  // The agent's PR first, even when its branch is gone locally: a hands-off web agent's branch only
  // ever existed on the remote, and its PR is the answer the button exists to give (#1255).
  // Unless the session demonstrably kept committing after that PR merged or closed (#1512) —
  // then the old PR is not the answer, the new work needs its own.
  if (handoff?.pr && !movedPastPr(handoff)) return { ok: true, url: handoff.pr.url, number: handoff.pr.number }
  if (handoff && !handoff.exists) return { ok: false, error: `branch ${branch} no longer exists` }
  // Refuse rather than open an empty PR: a session that changed nothing has nothing to hand off.
  if (handoff?.empty) return { ok: false, error: 'this session produced no commits to open a PR for' }
  return openBranchPullRequest(cwd, branch, {
    title: agentPrTitle(agent),
    body: agentPrBody(agent),
    ...(handoff?.base ? { base: handoff.base } : {}),
    ...(options.draft ? { draft: true } : {}),
  })
}

/**
 * The little a handoff needs to know about the agent it is for: which branch, and what to say on
 * the PR. Narrower than {@link AgentMeta} so the agent process can call this before its meta is
 * final, and so a caller cannot quietly start depending on the rest of the agent's state.
 */
export type HandoffAgent = Pick<AgentMeta, 'id' | 'branch' | 'intent'> &
  Partial<Pick<AgentMeta, 'startedAt'>> & {
    /**
     * The GitHub issue the agent's ticket tracks (`#42`), when it implements one (#1334). Carried
     * into the PR title as `(fix #42)` so the squash-merge commit — which inherits the title —
     * closes the issue; without it an auto-merged quick-win leaves its ticket open.
     */
    fixes?: string
    /**
     * The agent's own name for the work (#1618), from an `open-pr` block's first line: the PR
     * title when it wrote one. Absent, the title falls back to the session's name.
     */
    prTitle?: string
    /**
     * The agent's own description of the work (#1567), from an `open-pr` block: the PR body
     * when it wrote one. Absent, the body describes what was asked for instead — which is all
     * the framework knows on its own.
     */
    description?: string
  }

/**
 * The PR title for a session (#1102), with the ticket's issue reference riding along (#1334).
 *
 * Three rungs, each a name for the work the session did: what the agent called it in its
 * `open-pr` block (#1618), else the session's own name (its branch minus the prefix, #1725), else
 * the session id — which says little, but says it honestly.
 *
 * The prompt the session was given is not among them. It used to be, cut to 72 characters, and a
 * squash merge made that permanent: `main` ended up carrying instructions truncated mid-sentence
 * as commit subjects, which describe neither what changed nor even a whole thought (#1618).
 */
function agentPrTitle(agent: Pick<HandoffAgent, 'id' | 'branch' | 'prTitle' | 'fixes'>): string {
  const title = agent.prTitle ?? sessionNameOf(agent.branch, agent.id) ?? `Session ${agent.id}`
  return agent.fixes ? `${title} (fix ${agent.fixes})` : title
}

/**
 * The PR number out of the URL `gh pr create` prints, e.g. `…/pull/123` (#1216).
 *
 * Parsed rather than asked for in a second `gh` call: the create already told us, and E6 is about
 * recording the number we were told rather than re-deriving it later.
 */
function prNumberFromUrl(url: string | undefined): number | undefined {
  const match = url?.match(/\/pull\/(\d+)(?:$|[/?#])/)
  return match ? Number(match[1]) : undefined
}

/**
 * The PR body: what the agent said about the work, else what was asked for — and which session
 * did it either way.
 *
 * The agent's own description wins where it wrote one (#1567), because it describes what the
 * change turned out to be; the intent only says what was asked at the start, which is the best
 * the framework can do by itself.
 */
function agentPrBody(agent: HandoffAgent): string {
  const lines: string[] = []
  const opening = agent.description?.trim() || agent.intent?.trim()
  if (opening) lines.push(opening, '')
  lines.push(`Opened from The Framework session \`${sessionNameOf(agent.branch, agent.id) ?? agent.id}\`.`)
  return lines.join('\n')
}
