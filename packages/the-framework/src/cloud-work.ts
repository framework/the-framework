import { nodeGitRunner, type GitRunner } from './project.js'
import { ghPrsForBranchOrThrow, pickAgentPr, type LinkedPr } from './dashboard/gh.js'
import { openRemoteBranchPullRequest, type HandoffResult } from './dashboard/agent-handoff.js'
import { agentBranchName } from './branch-names.js'
import { listAgents, startedAtFromAgentId, type AgentMeta, type ArchivePatch } from './store/index.js'
import { patchArchivedAgentOnDataBranch } from './archived-agent-patch.js'
import { errorMessage } from './error-message.js'

// Adopt the branch a cloud session actually worked on (#1601).
//
// A web run is a local wrapper that hands the task to claude.ai and ends; the cloud session does
// the work on a branch of its own naming (`claude/*`), never the designated run branch. Nothing
// ever told the run's record about that branch, so every surface keyed to it — the session row,
// the PR resolution, CI watch, merge — stared at an empty `tf-agent-*` branch, and the run read
// as "nothing committed" while its work sat on origin.
//
// The hand-off anchor (#1601) makes the match exact rather than guessed: the driver pushes an
// empty commit unique to the run as the ref the session clones at, so the session's branch — and
// only it — descends from that commit. This pass walks origin's `claude/*` heads, matches each
// waiting run by that ancestry, and records what it finds onto the run's archive as one commit
// on the data branch: the branch, the PR the session opened for it — and when the run was armed
// for a PR the session never opened, it opens the draft PR itself, which is the armed handoff
// finally resolving against the facts.
//
// Conservative on every unprovable case: a run matching no head (the session has not pushed, or
// did nothing) or more than one (ancestry alone cannot say which) is simply retried next pass,
// and a run older than the window stops being asked about at all.

/** How long after its start a run is still asked about: safely past any cloud session's life. */
export const CLOUD_ADOPTION_WINDOW_MS = 48 * 60 * 60 * 1000

/** What one adoption did, for the daemon to say out loud. */
export interface CloudAdoption {
  agentId: string
  branch: string
  /** The PR now on the run's record, when one was found or opened. */
  pr?: { number: number; url: string }
  /** True when the PR above was opened by this pass (the armed draft), not found. */
  opened?: boolean
}

/** What {@link adoptCloudWork} did to one project. */
export interface CloudWorkResult {
  adopted: CloudAdoption[]
  /** Failures worth a log line; unmatched runs are not one, they are the normal waiting state. */
  failed: { agentId: string; error: string }[]
}

/** Injectable seams so the pass is unit-testable off disk, off the network and off GitHub. */
export interface CloudWorkDeps {
  git?: GitRunner
  /** The branch's full PR history; a listing that fails must throw (default {@link ghPrsForBranchOrThrow}). */
  prs?: (cwd: string, branch: string) => Promise<LinkedPr[]>
  /** The project's run records (default {@link listAgents}). */
  agents?: (cwd: string) => Promise<AgentMeta[]>
  /** Record the adopted branch and PR on the run's archive (default {@link patchArchivedAgentOnDataBranch}). */
  patch?: (cwd: string, agentId: string, patch: ArchivePatch, message: string) => Promise<boolean>
  /** Open the armed draft PR for a remote-only branch (default {@link openRemoteBranchPullRequest}). */
  openPr?: (cwd: string, agent: AgentMeta, branch: string) => Promise<HandoffResult>
  /** The current time in ms (injected so tests can age runs deterministically). */
  now?: () => number
}

/** One `claude/*` branch on origin: its short name and the commit it points at. */
interface CloudHead {
  ref: string
  sha: string
}

/** Whether the run's record still carries the branch it was born on, i.e. no adoption happened. */
function onBirthBranch(meta: AgentMeta): boolean {
  return meta.branch === undefined || meta.branch === agentBranchName(meta.id)
}

/** Whether the run's handoff was armed to open a PR. Absent means armed, matching the agent. */
function prArmed(meta: AgentMeta): boolean {
  return meta.handoff?.pr !== false
}

/** The settled web runs this pass still owes an answer. */
function waitingRuns(agents: AgentMeta[], now: number): AgentMeta[] {
  return agents.filter(meta => {
    if (meta.target !== 'web' || meta.status === 'running' || !meta.cloudAnchor) return false
    const startedAt = meta.startedAt ?? startedAtFromAgentId(meta.id)
    const startedMs = startedAt === undefined ? NaN : Date.parse(startedAt)
    if (!Number.isFinite(startedMs) || now - startedMs > CLOUD_ADOPTION_WINDOW_MS) return false
    // Owed: the branch is not adopted yet, or it is and the armed PR is still unaccounted for.
    // An unarmed run stops being asked about once its branch is recorded — a PR someone opens
    // later is still found live, by branch name, by every surface that shows PRs.
    return onBirthBranch(meta) || (meta.pr === undefined && prArmed(meta) && meta.status === 'done')
  })
}

/** Parse `git ls-remote origin 'refs/heads/claude/*'`. */
function parseCloudHeads(listing: string): CloudHead[] {
  const heads: CloudHead[] = []
  for (const line of listing.split('\n')) {
    const head = /^([0-9a-f]{40,64})\t+refs\/heads\/(claude\/.+)$/.exec(line)
    if (head) heads.push({ ref: head[2]!, sha: head[1]! })
  }
  return heads
}

/**
 * Whether `head` descends from `anchor` — the proof the branch is this run's. The head's
 * objects may not be local (the cloud VM pushed them), so the ref is fetched once when needed;
 * the fetch also (re)supplies the anchor commit itself, being an ancestor. Unprovable reads as
 * "not this run's", retried next pass.
 */
async function descendsFrom(git: GitRunner, cwd: string, anchor: string, head: CloudHead): Promise<boolean> {
  const isAncestor = () =>
    git(['merge-base', '--is-ancestor', anchor, head.sha], cwd).then(
      () => true,
      () => false,
    )
  const present = await git(['cat-file', '-e', `${head.sha}^{commit}`], cwd).then(
    () => true,
    () => false,
  )
  if (present) return isAncestor()
  if (!(await git(['fetch', 'origin', `refs/heads/${head.ref}`], cwd).then(() => true, () => false))) return false
  return isAncestor()
}

/**
 * Adopt one project's cloud work (#1601): match each waiting web run to the `claude/*` head
 * descending from its hand-off anchor, and record the branch and its PR onto the run's archive —
 * opening the armed draft PR when the session never did. Never throws: a repo with no remote
 * (or offline) adopts nothing, and every unmatched run is retried next pass.
 */
export async function adoptCloudWork(cwd: string, deps: CloudWorkDeps = {}): Promise<CloudWorkResult> {
  const git = deps.git ?? nodeGitRunner()
  const prs = deps.prs ?? ghPrsForBranchOrThrow
  const agents = deps.agents ?? listAgents
  const patchArchive = deps.patch ?? patchArchivedAgentOnDataBranch
  const openPr = deps.openPr ?? openRemoteBranchPullRequest
  const now = deps.now ? deps.now() : Date.now()
  const result: CloudWorkResult = { adopted: [], failed: [] }

  const waiting = waitingRuns(await agents(cwd).catch((): AgentMeta[] => []), now)
  if (waiting.length === 0) return result

  let listing: string
  try {
    listing = await git(['ls-remote', 'origin', 'refs/heads/claude/*'], cwd)
  } catch {
    return result // no remote, or it cannot be reached: nothing to match against
  }
  const heads = parseCloudHeads(listing)
  if (heads.length === 0) return result

  for (const run of waiting) {
    const matches: CloudHead[] = []
    for (const head of heads) {
      if (await descendsFrom(git, cwd, run.cloudAnchor!, head)) matches.push(head)
    }
    // Exactly one, or nothing happens: zero is a session that has not pushed (or never will),
    // and two is a history this pass cannot arbitrate — both are the next pass's question.
    if (matches.length !== 1) continue
    const head = matches[0]!
    const branch = head.ref
    // A run whose record names some other branch — neither the one it was born on nor this head
    // — is not this pass's to answer: a PR opened here would be recorded against a branch it
    // does not live on.
    if (!onBirthBranch(run) && run.branch !== branch) continue

    // The PR the session opened for its branch, if any — filtered by the run's start so a
    // predecessor's PR on a reused name is never this run's, `latest` so the last PR that saw
    // the branch answers (#1512). "None" and "could not list" must not look alike here: a
    // listing that fails opens nothing this pass (a second draft PR on a branch that already
    // has one is the cost of guessing), and the run is asked again next time.
    const since = run.startedAt ?? startedAtFromAgentId(run.id)
    const listing = await prs(cwd, branch).then(
      found => ({ ok: true as const, pr: pickAgentPr(found, since, 'latest') }),
      (err: unknown) => ({ ok: false as const, error: errorMessage(err) }),
    )
    let pr = listing.ok ? listing.pr : undefined
    let opened = false
    if (!listing.ok) {
      result.failed.push({ agentId: run.id, error: `could not list the PRs of ${branch} (${listing.error}), so no draft PR was opened this pass` })
    } else if (!pr && prArmed(run) && run.status === 'done' && head.sha !== run.cloudAnchor) {
      // The armed handoff, finally resolving (#1601): the run was armed for a PR, the session
      // opened none, and the branch carries something beyond the hand-off itself — so the draft
      // PR the wrapper's epilogue could never open (it saw only the empty run branch) opens now.
      // A run whose PR arming was off gets its branch recorded and nothing else.
      const openedPr = await openPr(cwd, run, branch)
      if (openedPr.ok && openedPr.number !== undefined && openedPr.url) {
        pr = { number: openedPr.number, url: openedPr.url, state: 'OPEN', title: '' }
        opened = true
      } else if (!openedPr.ok) {
        result.failed.push({ agentId: run.id, error: `could not open the armed draft PR for ${branch}: ${openedPr.error}` })
      }
    }

    // One commit on the data branch carries whatever this pass learned: the branch (first time
    // only), the PR (once known). Nothing learned, nothing written — and nothing announced.
    const patch: ArchivePatch = {
      ...(onBirthBranch(run) ? { branch } : {}),
      ...(pr && run.pr === undefined ? { pr: { number: pr.number, url: pr.url } } : {}),
    }
    if (Object.keys(patch).length === 0) continue
    if (!(await patchArchive(cwd, run.id, patch, `[The Framework] adopt session ${run.id}'s cloud work`))) {
      result.failed.push({ agentId: run.id, error: `could not record ${branch} on the run's archive` })
      continue
    }
    result.adopted.push({
      agentId: run.id,
      branch,
      ...(pr ? { pr: { number: pr.number, url: pr.url } } : {}),
      ...(opened ? { opened: true } : {}),
    })
  }
  return result
}

/** A running adoption pass, in the shape the daemon's other background services use. */
export interface CloudWorkAdoption {
  /** Run one pass now, awaiting it. Exposed for tests and for a caller that wants it on demand. */
  tick: () => Promise<void>
  stop: () => void
}

/** What {@link startCloudWorkAdoption} needs from the daemon. */
export interface CloudWorkAdoptionOptions {
  /** The registered projects to pass over. */
  projects: () => Promise<readonly { path: string }[]>
  log: (message: string) => void
  /** The per-project pass (default {@link adoptCloudWork}). */
  adopt?: (cwd: string) => Promise<CloudWorkResult>
}

/**
 * Adopt every registered project's cloud work (#1601), one turn per call.
 *
 * Adoptions and failures are said out loud, unmatched runs are not: a session that has not
 * pushed yet is the normal state of every run this watches, and a line per tick about it would
 * be noise. A run's row changing branch with no line explaining why would read as a bug.
 */
export function startCloudWorkAdoption(opts: CloudWorkAdoptionOptions): CloudWorkAdoption {
  const adopt = opts.adopt ?? adoptCloudWork
  let stopped = false

  const passAll = async (): Promise<void> => {
    for (const project of await opts.projects().catch(() => [])) {
      if (stopped) break
      const { adopted, failed } = await adopt(project.path).catch((): CloudWorkResult => ({ adopted: [], failed: [] }))
      for (const adoption of adopted) {
        const prLine = adoption.pr ? (adoption.opened ? `; opened its armed draft PR ${adoption.pr.url}` : `; its PR is ${adoption.pr.url}`) : ''
        opts.log(`[framework] session ${adoption.agentId}'s cloud work landed on ${adoption.branch} — adopted as its branch (#1601)${prLine}`)
      }
      for (const failure of failed) {
        opts.log(`[framework] cloud work adoption for session ${failure.agentId}: ${failure.error}`)
      }
    }
  }

  // Overlapping ticks join the pass already running rather than being dropped, so awaiting
  // `tick()` means the pass finished — same rule as the worktree sweep, for the same reason.
  let inflight: Promise<void> | undefined
  const tick = (): Promise<void> => {
    if (stopped) return Promise.resolve()
    inflight ??= passAll().finally(() => {
      inflight = undefined
    })
    return inflight
  }

  // No timer of its own (E4): the daemon's one clock calls `tick`.
  return {
    tick,
    stop: () => {
      stopped = true
    },
  }
}
