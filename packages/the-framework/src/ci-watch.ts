import { listRuns, readLiveMetas, type RunMeta } from './store/index.js'
import { mergeSessionPr, resolveRunPr, type HandoffResult, type RunPrRun } from './dashboard/run-handoff.js'
import { ghPrCiStatus, type LinkedPr, type PrCiStatus } from './dashboard/gh.js'
import type { Cached } from './dashboard/cache.js'

// Watch the PRs the framework is waiting to land, and act on what their CI says (#1418).
//
// The merge half (#1417's ask): a session armed for auto-merge on a repo without GitHub's native
// auto-merge used to get the direct fallback — merged seconds after opening, before its first
// check ran (#1406). Since #1418 that path answers `watched` instead, and this sweep is the other
// half of the promise: poll the watched PR's checks (~1 min, the latency agreed on the issue) and
// merge it once they pass. The repo setting stops mattering: merge-on-green works everywhere.
//
// The fix half (#1418's first use case): a watched or auto-armed PR whose checks go *red* is work
// the framework produced and then abandoned to a human. The sweep starts one unattended fix
// session per failing head commit, told to land its fix on the PR's own branch — the checks rerun,
// and the merge half finishes the job if they come back green.
//
// Polling rather than webhooks on purpose: a local daemon has no public URL for GitHub to call.
// Every decision this sweep takes starts from what `gh` answers, so a hosted deployment can later
// feed the same handlers from a webhook receiver and only the trigger changes.

/**
 * How long a run's watched PR stays on the sweep's list: long enough to survive a weekend of the
 * daemon being off, short enough that the sweep's `gh` spend cannot grow with the archive. A PR
 * older than this is a human's to land — it has been red or unmergeable for a week.
 */
export const CI_WATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * How old a check-less PR must be before "no checks" is believed to mean "this repo has no CI"
 * rather than "the suite has not attached yet" — GitHub takes seconds to attach one after a push,
 * and merging inside that window is the #1406 hazard wearing a different face.
 */
export const NO_CHECKS_GRACE_MS = 3 * 60 * 1000

/**
 * How many fix sessions one PR may consume before the sweep stands down. Each attempt only
 * re-arms on a new head commit, so two attempts means: the original failure, and one more after
 * a fix that did not take. Past that the failure is evidently not agent-shaped.
 */
const MAX_CI_FIX_ATTEMPTS = 2

/**
 * The marker a CI-fix run's prompt opens with, so attempts are discoverable from run metas. The
 * `@` is always there, sha or not: it is what stops "PR #12" reading as a prefix of "PR #123"
 * when the metas are scanned for prior attempts.
 */
export function ciFixMarker(number: number, headSha = ''): string {
  return `[ci-fix] PR #${number} @${headSha}`
}

/** What the fix agent needs to know, distilled from the PR and its checks read. */
export interface CiFixRequest {
  number: number
  title: string
  url: string
  branch: string
  headSha: string
  failed: string[]
}

/**
 * The prompt a CI-fix session runs (#1418). Explicit about the git mechanics because the run gets
 * an ordinary session worktree on its own scratch branch: the PR's branch may be checked out in a
 * retained worktree elsewhere, so `push origin HEAD:<branch>` is the one spelling that always
 * lands the fix without fighting over who holds the branch.
 */
export function ciFixPrompt(fix: CiFixRequest): string {
  return [
    ciFixMarker(fix.number, fix.headSha),
    '',
    `CI is red on PR #${fix.number} ("${fix.title}"): ${fix.failed.join(', ') || 'checks failed'}.`,
    `The PR's branch is \`${fix.branch}\` and its failing head commit is ${fix.headSha}.`,
    '',
    'Fix the failure so the checks go green:',
    `1. \`git fetch origin ${fix.branch}\` and put your worktree on that exact state: \`git reset --hard origin/${fix.branch}\` (your worktree’s own branch is scratch — nothing on it is worth keeping).`,
    `2. Read the failing checks (\`gh pr checks ${fix.number}\`, then \`gh run view --log-failed <run-id>\` for the failed workflow runs) and diagnose the failure.`,
    '3. Fix it, and run the relevant tests/build locally to confirm.',
    `4. Push the fix back onto the PR: \`git push origin HEAD:${fix.branch}\`.`,
    '',
    `Do NOT open a new PR and do not merge anything: the fix belongs on PR #${fix.number} (${fix.url}), and the merge happens elsewhere once the checks pass.`,
  ].join('\n')
}

/** One PR the sweep merged. */
export interface CiMerged {
  runId: string
  number: number
  url?: string
}

/** One fix session the sweep started, or why it stood down. */
export interface CiFixOutcome {
  number: number
  /** The started session, when one was. */
  runId?: string
  /** Why no session was started: the wiring declined (gate/quota), or the attempts cap is spent. */
  reason?: 'declined' | 'attempts-exhausted'
}

/** What one project's sweep did. */
export interface CiSweepResult {
  merged: CiMerged[]
  /** Merges that should have happened and did not, with the refusal. */
  failed: { runId: string; number: number; error: string }[]
  fixes: CiFixOutcome[]
}

/** Injectable seams so the sweep is unit-testable off disk and off `gh`. */
export interface CiSweepDeps {
  /** Every run meta worth scanning — live and archived (default: both stores). */
  runs?: (cwd: string) => Promise<RunMeta[]>
  /** The PR that belongs to a run (default {@link resolveRunPr}, which rides the #1028 cache). */
  pr?: (cwd: string, run: RunPrRun) => Promise<Cached<LinkedPr | undefined>>
  /** A PR's combined check state (default {@link ghPrCiStatus}). */
  ci?: (cwd: string, number: number) => Promise<PrCiStatus>
  /** Merge a run's open PR (default {@link mergeSessionPr}, which also forgets the PR caches). */
  merge?: (cwd: string, run: RunPrRun) => Promise<HandoffResult>
  /**
   * Start a CI-fix session for a red PR (#1418's fix half), resolving the run id or undefined
   * when the wiring declined (preference off, no quota headroom, start failed). Absent = the fix
   * half is off and red PRs are only left for the merge half to keep ignoring.
   */
  fix?: (cwd: string, request: CiFixRequest) => Promise<string | undefined>
  /**
   * Merge attempts that already failed (`<cwd>\0<number>\0<headSha>`), fed and consulted by the
   * sweep so a persistently refused merge (branch protection demanding a review, say) costs one
   * `gh` write per head, not one per tick for a week. The head sha is part of the key (#1484):
   * a push that changes the head — a conflict resolved, say — re-arms exactly one more attempt,
   * the same re-arm rule the CI-fix half applies. Before, a PR that arrived unmergeable was
   * skipped for the daemon's lifetime even after its branch was fixed and its checks went green.
   * In-memory on purpose: a daemon restart retries once.
   */
  attemptedMerges?: Set<string>
  now?: () => number
}

/** Both stores' metas: the live runs (their conversation is still going) and the archive. */
async function allRunMetas(cwd: string): Promise<RunMeta[]> {
  const [live, archived] = await Promise.all([
    readLiveMetas(cwd).catch((): RunMeta[] => []),
    listRuns(cwd).catch((): RunMeta[] => []),
  ])
  return [...live, ...archived]
}

/** Whether a meta is one of this sweep's candidates: an ended run with a merge the CI decides. */
function watchable(meta: RunMeta, now: number): boolean {
  if (meta.status === 'running') return false
  if (meta.mergeOutcome !== 'watched' && meta.mergeOutcome !== 'auto-armed') return false
  const updated = Date.parse(meta.updatedAt ?? '')
  return Number.isFinite(updated) && now - updated <= CI_WATCH_WINDOW_MS
}

/**
 * Sweep one project's watched PRs (#1418): merge the green ones the repo could not arm GitHub
 * auto-merge for, and start a fix session for the red ones.
 *
 * Conservative wherever the answer is unclear: a PR that is not OPEN is done (merged or a
 * human's rejection — neither is this sweep's to touch), `pending` checks wait for the next
 * tick, and a check-less PR only counts as green once it has been check-less for longer than a
 * suite takes to attach ({@link NO_CHECKS_GRACE_MS}). An `auto-armed` PR is never merged here —
 * GitHub holds that promise — but its checks going red still starts a fix.
 */
export async function sweepProjectCi(cwd: string, deps: CiSweepDeps = {}): Promise<CiSweepResult> {
  const runs = deps.runs ?? allRunMetas
  const pr = deps.pr ?? resolveRunPr
  const ci = deps.ci ?? ghPrCiStatus
  const merge = deps.merge ?? mergeSessionPr
  const now = deps.now ?? Date.now

  const result: CiSweepResult = { merged: [], failed: [], fixes: [] }
  const metas = await runs(cwd).catch((): RunMeta[] => [])
  const candidates = metas.filter(meta => watchable(meta, now()))
  if (candidates.length === 0) return result

  const seen = new Set<number>()
  for (const meta of candidates) {
    const linked = (await pr(cwd, meta).catch((): Cached<LinkedPr | undefined> => ({ value: undefined, pending: false }))).value
    // No PR, or one that is no longer open: nothing left to watch. CLOSED stays closed on
    // purpose — an unmerged close is a human's rejection of the work.
    if (!linked || linked.state !== 'OPEN' || seen.has(linked.number)) continue
    seen.add(linked.number)

    const status = await ci(cwd, linked.number).catch((): PrCiStatus => ({ checks: 'none', failed: [] }))
    if (status.checks === 'pending') continue
    if (status.checks === 'failing') {
      const fix = await requestFix(cwd, metas, linked, status, deps)
      if (fix) result.fixes.push(fix)
      continue
    }
    // Green — but the merge is only ours where GitHub could not take it (#1418): an auto-armed
    // PR lands by GitHub's own hand, and a check-less one must outlive the attach window first.
    if (meta.mergeOutcome !== 'watched') continue
    if (status.checks === 'none' && !pastNoChecksGrace(linked, now())) continue
    const attemptKey = `${cwd}\u0000${linked.number}\u0000${status.headSha ?? ''}`
    if (deps.attemptedMerges?.has(attemptKey)) continue
    const outcome = await merge(cwd, meta)
    if (outcome.ok) result.merged.push({ runId: meta.id, number: linked.number, ...(outcome.url ? { url: outcome.url } : {}) })
    else {
      deps.attemptedMerges?.add(attemptKey)
      result.failed.push({ runId: meta.id, number: linked.number, error: outcome.error })
    }
  }
  return result
}

/** Whether a check-less PR has been open longer than a check suite takes to attach. */
function pastNoChecksGrace(pr: LinkedPr, now: number): boolean {
  const created = Date.parse(pr.createdAt ?? '')
  // No creation time on the record: age unknowable, so never merge on its absence.
  return Number.isFinite(created) && now - created > NO_CHECKS_GRACE_MS
}

/**
 * The fix half's own restraint (#1418), applied before the wiring's gates: one session per
 * failing head commit — the marker in the prompt is the durable record, scanned off the same
 * metas — at most one in flight per PR, and {@link MAX_CI_FIX_ATTEMPTS} per PR ever.
 */
async function requestFix(
  cwd: string,
  metas: RunMeta[],
  pr: LinkedPr,
  status: PrCiStatus,
  deps: CiSweepDeps,
): Promise<CiFixOutcome | undefined> {
  if (!deps.fix) return undefined
  // No head to pin the attempt to (or no branch to land it on): a retry could not be told from a
  // loop, so stand down rather than guess.
  if (!status.headSha || !status.branch) return undefined
  const attempts = metas.filter(meta => meta.intent?.startsWith(ciFixMarker(pr.number)))
  if (attempts.some(meta => meta.intent?.startsWith(ciFixMarker(pr.number, status.headSha)))) return undefined
  if (attempts.some(meta => meta.status === 'running')) return undefined
  if (attempts.length >= MAX_CI_FIX_ATTEMPTS) return { number: pr.number, reason: 'attempts-exhausted' }
  const runId = await deps.fix(cwd, {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    branch: status.branch,
    headSha: status.headSha,
    failed: status.failed,
  })
  return runId ? { number: pr.number, runId } : { number: pr.number, reason: 'declined' }
}

/** A running watch, in the shape the daemon's other background services use. */
export interface CiWatch {
  /** Run one sweep now, awaiting it. Exposed for tests and on-demand callers. */
  tick: () => Promise<void>
  stop: () => void
}

/** What {@link startCiWatch} needs from the daemon. */
export interface CiWatchOptions {
  /** The registered projects to sweep. */
  projects: () => Promise<readonly { path: string }[]>
  log: (message: string) => void
  /** The per-project sweep's seams, {@link CiSweepDeps.fix} included — the daemon wires the gates. */
  deps?: CiSweepDeps
  /** The per-project sweep (default {@link sweepProjectCi}). */
  sweep?: (cwd: string, deps: CiSweepDeps) => Promise<CiSweepResult>
}

/**
 * Watch every registered project's armed PRs on a timer (#1418).
 *
 * Same lifecycle contract as the merged-worktree sweep: an immediate start-up tick (the case is a
 * daemon that was off while checks went green), overlapping ticks join the sweep in flight, the
 * timer is unref'd, and everything it does is logged — a PR merging with no line explaining why
 * reads as a bug even when it is the feature.
 */
export function startCiWatch(opts: CiWatchOptions): CiWatch {
  const sweep = opts.sweep ?? sweepProjectCi
  const deps: CiSweepDeps = { attemptedMerges: new Set(), ...opts.deps }
  let stopped = false

  // A red or unmergeable PR stays a candidate for a week, and its line does not get truer with
  // repetition: each distinct line is said once per daemon lifetime.
  const said = new Set<string>()
  const sayOnce = (line: string) => {
    if (said.has(line)) return
    said.add(line)
    opts.log(line)
  }

  const sweepAll = async (): Promise<void> => {
    for (const project of await opts.projects().catch(() => [])) {
      if (stopped) break
      const result = await sweep(project.path, deps).catch(
        (): CiSweepResult => ({ merged: [], failed: [], fixes: [] }),
      )
      for (const item of result.merged) {
        opts.log(`[framework] CI watch: checks passed on PR #${item.number}, merged it${item.url ? ` (${item.url})` : ''} (session ${item.runId})`)
      }
      for (const item of result.failed) {
        sayOnce(`[framework] CI watch: could not merge PR #${item.number}: ${item.error}`)
      }
      for (const item of result.fixes) {
        if (item.runId) opts.log(`[framework] CI watch: checks failed on PR #${item.number}, started fix session ${item.runId}`)
        else if (item.reason === 'attempts-exhausted') sayOnce(`[framework] CI watch: PR #${item.number} is still red after ${MAX_CI_FIX_ATTEMPTS} fix sessions; leaving it for a human`)
      }
    }
  }

  let inflight: Promise<void> | undefined
  const tick = (): Promise<void> => {
    if (stopped) return Promise.resolve()
    inflight ??= sweepAll().finally(() => {
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
