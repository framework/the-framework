import { cachedPrView, cachedPrsForBranch, forgetBranchPrs, forgetPr, pickAgentPr, type LinkedPr, type BranchPrLookup } from './pull-requests.js'
import type { Cached } from './cache.js'
import type { AgentMeta } from '../store/index.js'
import { projectBranches, type BranchesFor } from '../store/branches.js'
import { projectGitHost, type GitHostFor } from '../store/git-host.js'
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
// The branch's git facts and its push are the project's branches provider's (#1774), and every
// pull request, opened or landed, is the project's git host provider's (#1820): the framework asks the
// packages the project picked, through the commands they declare (`store/branches.ts`,
// `store/git-host.ts`), and never runs git or a git host tool itself. Opening a pull request is the two
// composed: the push, then the open. What stays here is what is about the *run*: which of the
// branch's pull requests is this run's, when an existing pull request is the answer and when a new
// one is, and what the pull request says.
//
// Forgiving throughout: a project with no branches provider, no git host, or no remote yields a
// handoff with less in it, never an error. Without a git host the run's last step is the push.

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
  /** The name the agent gave its work, as the branches provider answers it; absent while the run has not named it. */
  name?: string
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
  /** The project has a git host package (#1820): a pull request is a next step at all. Without one, the last step is the push. */
  gitHost: boolean
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
   * the git host can only refuse. Absent when no checkout is on the branch any more — "no checkout"
   * and "a checkout, tree clean" are different answers.
   */
  pendingFiles?: string[]
}

/** Injectable seams so the reader is unit-testable off disk and off the provider. */
export interface AgentHandoffDeps {
  pr?: BranchPrLookup
  /** The project's checkouts and branches (default the project's provider, {@link projectBranches}). */
  branches?: BranchesFor
  /** The project's git host (default the project's provider, {@link projectGitHost}). */
  gitHost?: GitHostFor
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
 * The branch an agent's work is on: what was recorded while the checkout existed (#799/#1277).
 * The agent renames its branch itself (#1725), so anything but the record is a guess, and a run
 * whose record carries no branch has none to hand off.
 */
export function agentBranchFor(agent: { id: string; branch?: string }): string | undefined {
  return agent.branch
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
 * Merge a finished session's open PR (#1391): the Merge action, pressed by a human saying "it's
 * good, land it". The landing itself is the git host provider's (`merge <number>`): armed to merge on
 * green, merged at once where it is already green, or watched by the provider where the
 * repository allows no auto-merge; a draft is marked ready on the way. Refuses when the agent has
 * no PR or it is no longer open — "already merged" is an answer, not an action.
 */
export async function mergeAgentPr(
  cwd: string,
  agent: PrAgent,
  deps: { gitHost?: GitHostFor; prs?: CachedBranchPrLookup } = {},
): Promise<HandoffResult> {
  const pr = (await resolveAgentPr(cwd, agent, deps.prs)).value
  if (!pr) return { ok: false, error: 'this session has no pull request to merge' }
  if (pr.state !== 'OPEN') return { ok: false, error: `this session's PR is already ${pr.state.toLowerCase()}` }
  const gitHost = await (deps.gitHost ?? projectGitHost)(cwd).catch(() => undefined)
  if (!gitHost) return { ok: false, error: 'this project has no git host package to merge with' }
  const merged = await gitHost.merge(pr.number)
  if (!merged.ok) return { ok: false, error: merged.error }
  // The PR's cached state just changed, so the branch's cached read must go or the bar keeps
  // offering a merge for a PR that landed (#1028).
  const branch = agentBranchFor(agent)
  forgetPr(cwd, branch)
  if (branch !== undefined) forgetBranchPrs(cwd, branch)
  return { ok: true, url: pr.url, number: pr.number }
}

/**
 * Read what a finished session left behind, for `branch`: the branch's git facts from the
 * project's branches provider, and the run's own pull request from the framework's lookup.
 *
 * Returns undefined only when the project has no branches provider, or the provider did not
 * answer for the branch. A branch that no longer exists still returns a handoff (with
 * `exists: false`), because "that branch is gone" is itself the answer the dashboard needs to
 * show — and its PR is a remote question, still answerable (#1255).
 */
export async function readAgentHandoff(
  cwd: string,
  branch: string,
  deps: AgentHandoffDeps = {},
): Promise<AgentHandoff | undefined> {
  const branches = await (deps.branches ?? projectBranches)(cwd).catch(() => undefined)
  if (!branches) return undefined
  const [state] = await branches.show([branch])
  if (!state) return undefined
  const gitHost = await (deps.gitHost ?? projectGitHost)(cwd).catch(() => undefined)
  // Read through the cache and allowed to arrive late (#1028): the branch's facts are local
  // git, and none of them should wait on the git host.
  const pr = await lookupAgentPr(cwd, branch, deps)
  const commits = state.commits.map(commit => ({ sha: commit.sha, short: commit.sha.slice(0, 7), subject: commit.subject }))
  const files = state.files.map(file => ({ path: file.path, insertions: file.insertions, deletions: file.deletions, binary: file.binary }))
  return {
    branch,
    ...(state.name ? { name: state.name } : {}),
    exists: state.exists,
    ...(state.base ? { base: state.base } : {}),
    commits,
    files,
    insertions: files.reduce((sum, f) => sum + f.insertions, 0),
    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
    // A session that changed nothing is a real outcome, not an error: it gets said, not shown as
    // an empty branch with buttons that would push nothing. The files decide as well as the
    // commits: commits that net to no change leave nothing to hand off.
    empty: commits.length === 0 || files.length === 0,
    hasRemote: state.hasRemote,
    pushed: state.pushed,
    merged: state.merged,
    gitHost: gitHost !== undefined,
    ...(pr.value ? { pr: pr.value } : {}),
    ...(pr.pending ? { prPending: true } : {}),
    ...(state.pendingFiles ? { pendingFiles: state.pendingFiles } : {}),
  }
}

/**
 * What a handoff action did. The PR's `number` rides along with its `url` (E6), because the number
 * is the fact worth *recording* — every surface that wants an agent's PR then reads it off the agent
 * rather than re-deriving it later.
 */
export type HandoffResult = { ok: true; url?: string; number?: number } | { ok: false; error: string }

/**
 * Open a PR for a branch: the two providers composed (#1820). The branches provider pushes the
 * branch (`push --branch`), then the git host provider opens its request (`open --branch`); the
 * request's base is the git host's. A branch that already has an open request is answered as it is.
 * The branch has a PR now, so the cached "no PR" must go or the bar would keep offering to open
 * one for the next minute (#1028) — both caches: the single-PR view and the history.
 */
async function publishBranch(cwd: string, branch: string, draft: { title: string; body: string; draft?: boolean }, branches: BranchesFor, gitHost: GitHostFor): Promise<HandoffResult> {
  const source = await branches(cwd).catch(() => undefined)
  if (!source) return { ok: false, error: 'this project has no branches provider to push with' }
  const gitHostSource = await gitHost(cwd).catch(() => undefined)
  if (!gitHostSource) return { ok: false, error: 'this project has no git host package to open a pull request with' }
  const pushed = await source.push(branch)
  if (!pushed.ok) return { ok: false, error: pushed.error }
  const opened = await gitHostSource.open(branch, { title: draft.title, body: draft.body, ...(draft.draft ? { draft: true } : {}) })
  if (!opened.ok) return { ok: false, error: opened.error }
  forgetPr(cwd, branch)
  forgetBranchPrs(cwd, branch)
  return { ok: true, url: opened.request.url, number: opened.request.number }
}

/**
 * Push a finished session's branch (#1820): the last step where the project has no git host, or the
 * step a person wants on its own. The branches provider pushes it under its clean rule; a branch
 * only the remote has is already there. Refuses a session that recorded no branch.
 */
export async function pushAgentBranch(cwd: string, agent: Pick<AgentMeta, 'id' | 'branch'>, deps: { branches?: BranchesFor } = {}): Promise<HandoffResult> {
  const branch = agentBranchFor(agent)
  if (branch === undefined) return { ok: false, error: 'this session recorded no branch to push' }
  const source = await (deps.branches ?? projectBranches)(cwd).catch(() => undefined)
  if (!source) return { ok: false, error: 'this project has no branches provider to push with' }
  const pushed = await source.push(branch)
  return pushed.ok ? { ok: true } : { ok: false, error: pushed.error }
}

/**
 * Open a draft PR for a branch that exists only on the remote (#1601): a cloud session's own
 * `claude/*` branch was pushed from a VM this machine never sees, so there is nothing to push
 * here — the provider publishes the branch as the remote has it. Draft because a PR the
 * framework opens by itself must not put a review request in anyone's inbox, and the
 * interventions queue keeps listing a session's draft.
 */
export async function openRemoteBranchPullRequest(
  cwd: string,
  agent: HandoffAgent,
  branch: string,
  deps: { branches?: BranchesFor; gitHost?: GitHostFor } = {},
): Promise<HandoffResult> {
  return publishBranch(cwd, branch, { title: agentPrTitle(agent), body: agentPrBody(agent), draft: true }, deps.branches ?? projectBranches, deps.gitHost ?? projectGitHost)
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
 * returns that one. Title is the agent's own, else its branch, else the id; body is the agent's
 * description, else the intent, plus which session did it. This is the handoff decision the
 * dashboard's open-PR button offers; the RPC layer only resolves which run it is about, and the
 * two providers do the pushing and the opening.
 */
export async function openAgentPullRequest(
  cwd: string,
  agent: AgentMeta,
  options: { draft?: boolean; branches?: BranchesFor; gitHost?: GitHostFor; pr?: BranchPrLookup } = {},
): Promise<HandoffResult> {
  const branch = agentBranchFor(agent)
  if (branch === undefined) return { ok: false, error: 'this session recorded no branch to open a PR from' }
  const branches = options.branches ?? projectBranches
  const gitHost = options.gitHost ?? projectGitHost
  // `latest` order (#1512), because the `movedPastPr` decision below compares the branch tip
  // against a PR's head: against the *first* PR, work a second one already landed reads as
  // unlanded and this opens a third for it.
  const handoff = await readAgentHandoff(cwd, branch, { since: agent.startedAt, order: 'latest', branches, gitHost, ...(options.pr ? { pr: options.pr } : {}) }).catch(() => undefined)
  // The agent's PR first, even when its branch is gone locally: a hands-off web agent's branch only
  // ever existed on the remote, and its PR is the answer the button exists to give (#1255).
  // Unless the session demonstrably kept committing after that PR merged or closed (#1512) —
  // then the old PR is not the answer, the new work needs its own.
  if (handoff?.pr && !movedPastPr(handoff)) return { ok: true, url: handoff.pr.url, number: handoff.pr.number }
  if (handoff && !handoff.exists) return { ok: false, error: `branch ${branch} no longer exists` }
  // Refuse rather than open an empty PR: a session that changed nothing has nothing to hand off.
  if (handoff?.empty) return { ok: false, error: 'this session produced no commits to open a PR for' }
  return publishBranch(cwd, branch, { title: agentPrTitle(agent, handoff?.name), body: agentPrBody(agent), ...(options.draft ? { draft: true } : {}) }, branches, gitHost)
}

/**
 * The little a handoff needs to know about the agent it is for: which branch, and what to say on
 * the PR. Narrower than {@link AgentMeta} so a caller cannot quietly start depending on the rest
 * of the agent's state. The optional fields below are honored when given; no caller gives them today.
 */
export type HandoffAgent = Pick<AgentMeta, 'id' | 'branch' | 'intent'> &
  Partial<Pick<AgentMeta, 'startedAt'>> & {
    /**
     * The tracker's issue the agent's ticket tracks (`#42`), when it implements one (#1334). Carried
     * into the PR title as `(fix #42)` so the squash-merge commit — which inherits the title —
     * closes the issue; without it an auto-merged quick-win leaves its ticket open.
     */
    fixes?: string
    /**
     * The agent's own name for the work (#1618): the PR title when given. Absent, the title falls back to the branch.
     */
    prTitle?: string
    /**
     * The agent's own description of the work (#1567): the PR body when given. Absent, the body describes what was asked for instead — which is all
     * the framework knows on its own.
     */
    description?: string
  }

/**
 * The PR title for a session (#1102), with the ticket's issue reference riding along (#1334).
 *
 * Three rungs, each a name for the work the session did: what the agent called it (#1618), else
 * the branch the agent named its work with (#1725), else the session id — which says little, but
 * says it honestly.
 *
 * The prompt the session was given is not among them. It used to be, cut to 72 characters, and a
 * squash merge made that permanent: `main` ended up carrying instructions truncated mid-sentence
 * as commit subjects, which describe neither what changed nor even a whole thought (#1618).
 */
function agentPrTitle(agent: Pick<HandoffAgent, 'id' | 'branch' | 'prTitle' | 'fixes'>, name?: string): string {
  // The name the branches provider answers for the branch comes before the branch itself: the
  // framework draws the name it is given and never cuts the package's prefix off a branch.
  const title = agent.prTitle ?? name ?? agent.branch ?? `Session ${agent.id}`
  return agent.fixes ? `${title} (fix ${agent.fixes})` : title
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
  lines.push(`Opened from The Framework session \`${agent.id}\`.`)
  return lines.join('\n')
}
