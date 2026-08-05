import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GitRunner } from './project.js'
import { nodeGitRunner } from './project.js'
import { FLAT_TODO_FILE } from './tickets.js'
import { errorMessage } from './error-message.js'

/**
 * Promoting the agent queue out of a finished run's branch and into the project checkout (#852).
 *
 * Runs happen in their own git worktree (#736), which is right for code and wrong for the queue:
 * `TODO_AGENTS.md` is shared mutable state, and a worktree forks it. So a quick-wins run (#773)
 * wrote a perfectly good queue onto a branch nobody reads, auto PM kept seeing an empty checkout,
 * and it re-derived the same entries every cooldown, forever, spending real quota each time.
 *
 * Rom settled the destination on #624: the queue is a durable global `TODO_AGENTS.md` the session
 * writes directly, unlike a *proposal* (a ticket), which is a PR for a human to accept. So the
 * queue belongs in the checkout, and nothing should have to be merged by hand for the loop to turn.
 *
 * The daemon does this, not the agent. The agent stays sandboxed in its worktree with no write
 * access to the project checkout; the daemon copies one known file across, and commits only that
 * pathspec. Narrow enough to audit in a single log line.
 *
 * Conservative everywhere it is not certain: anything unexpected skips with a reason and leaves the
 * checkout untouched. A skipped promotion costs one idle cycle; a wrong one touches a repo a human
 * is working in.
 */

/** Why a promotion did not happen, or that it did. */
export type QueuePromotion =
  | { promoted: true; branch: string }
  | {
      promoted: false
      reason: string
      /**
       * Worth trying again next tick: the queue file is mid-edit in the checkout, and the human's
       * work outranks an unattended tidy-up only until they commit it. Every other skip is final
       * for this run. The callee owns this call — the daemon used to decide it by string-matching
       * the prose `reason`, where a one-word copyedit would have silently turned "retry next
       * tick" into "settled forever".
       */
      retry?: true
    }

/** The commit message a promotion writes. Names the run so the history says where it came from. */
export function promotionMessage(runId: string): string {
  return `[The Framework] queue updates from ${runId}`
}

/**
 * Copy `TODO_AGENTS.md` from a finished run's branch into the project checkout and commit it.
 *
 * Skips, rather than forcing, when:
 * - the run recorded no branch (nothing to read from)
 * - the branch has no queue file, or it matches the checkout already (nothing to do)
 * - the checkout has uncommitted changes to the queue file — a human is mid-edit, and their work
 *   outranks an unattended tidy-up
 *
 * Never throws: this runs on a background tick with nothing to catch it.
 */
export async function promoteQueue(
  projectCwd: string,
  run: { id: string; branch?: string | undefined; entry?: string | undefined },
  git: GitRunner = nodeGitRunner(),
  write: (path: string, content: string) => Promise<void> = (path, content) => writeFile(path, content, 'utf8'),
): Promise<QueuePromotion> {
  const branch = run.branch
  if (!branch) return { promoted: false, reason: 'the run recorded no branch' }

  try {
    // The queue as the run left it. A run that never touched it has no such path on the branch.
    const fromBranch = await git(['show', `${branch}:${FLAT_TODO_FILE}`], projectCwd).catch(() => undefined)
    if (fromBranch === undefined) return { promoted: false, reason: 'the run left no queue file on its branch' }

    const inCheckout = await git(['show', `HEAD:${FLAT_TODO_FILE}`], projectCwd).catch(() => '')
    if (fromBranch === inCheckout) return { promoted: false, reason: 'the queue is already up to date' }

    // A dirty queue file means someone is editing it by hand right now. Leave it alone; the next
    // tick will try again, and until then auto PM simply does not start more work.
    const dirty = (await git(['status', '--porcelain', '--', FLAT_TODO_FILE], projectCwd)).trim()
    if (dirty) return { promoted: false, reason: 'the checkout has uncommitted queue changes', retry: true }

    // A run pinned to one entry (#1204) lands that entry, not its whole file: with several drains
    // in flight the wholesale copy below would carry each run's stale view of every *other* entry,
    // and the last promotion of the tick would un-check whatever the earlier ones had just retired.
    if (run.entry !== undefined) {
      // The queue where the run forked, so an entry it *added* can be told from one somebody
      // *removed* while it worked. Both look alike from the branch alone — present there, absent
      // here — and `todo_format.md` makes removal the way to retire an entry, so guessing wrong
      // resurrects work a human deliberately struck off. No merge base (a rewritten history, say)
      // means no additions land: the check-off is the part that must not be lost.
      const mergeBase = (await git(['merge-base', branch, 'HEAD'], projectCwd).catch(() => '')).trim()
      const atBase = mergeBase
        ? await git(['show', `${mergeBase}:${FLAT_TODO_FILE}`], projectCwd).catch(() => undefined)
        : undefined
      const landed = landPinnedEntry(inCheckout, fromBranch, run.entry, atBase)
      if (landed === inCheckout) return { promoted: false, reason: 'the run left nothing to land on the queue' }
      await write(join(projectCwd, FLAT_TODO_FILE), landed)
      await git(['add', '--', FLAT_TODO_FILE], projectCwd)
      await git(['commit', '-m', promotionMessage(run.id), '--', FLAT_TODO_FILE], projectCwd)
      return { promoted: true, branch }
    }

    // `checkout <branch> -- <path>` writes the file and stages it in one step, touching nothing
    // else in the tree. The commit is pathspec-scoped for the same reason: whatever else is
    // staged in the user's checkout is theirs and must not ride along.
    await git(['checkout', branch, '--', FLAT_TODO_FILE], projectCwd)
    await git(['commit', '-m', promotionMessage(run.id), '--', FLAT_TODO_FILE], projectCwd)
    return { promoted: true, branch }
  } catch (err) {
    return { promoted: false, reason: errorMessage(err) }
  }
}

/** One markdown list item, by the grammar `parseTodoEntries` reads. */
const ENTRY_LINE = /^(\s*(?:[-*]|\d+\.)\s+)(?:\[([ xX])\]\s*)?(.*)$/

/** Every entry the document names, checked or not, so a re-add can tell "new" from "already there". */
function entryTexts(md: string): Set<string> {
  const texts = new Set<string>()
  for (const line of md.split('\n')) {
    const text = ENTRY_LINE.exec(line)?.[3]?.trim()
    if (text) texts.add(text)
  }
  return texts
}

/**
 * Land what a drain run pinned to one entry actually did (#1204): retire that entry, and keep any
 * follow-ups it queued.
 *
 * Additive by construction, which is what makes it safe to run concurrently: it only ever checks a
 * box or appends a line. It never unchecks, never removes, and never reorders, so two drains
 * landing in either order compose, and the worst a wrong guess can do is leave a duplicate line
 * for a human to delete rather than silently send an agent to redo finished work.
 *
 * A follow-up is an entry the run's branch has that `atBase` did not: written during the run. The
 * fork point is what tells that from an entry somebody *removed* meanwhile, which looks identical
 * from the branch alone and which `todo_format.md` makes the ordinary way to retire an entry. With
 * no fork point to compare against, nothing is added -- resurrecting struck-off work is worse than
 * leaving a follow-up on the branch, and the check-off still lands either way.
 */
export function landPinnedEntry(
  inCheckout: string,
  fromBranch: string,
  entry: string,
  atBase: string | undefined,
): string {
  const lines = inCheckout.split('\n').map(line => {
    const item = ENTRY_LINE.exec(line)
    // Retire any *open* entry that matches — an empty `[ ]` box or a no-checkbox bullet alike,
    // the same "open" grammar `entriesRetiredByPatch` and `parseTodoEntries` use (#1164/#1297).
    // Skipping the no-checkbox form left it open, so the sweep re-drained it after the PR closed.
    if (!item || item[3]?.trim() !== entry || item[2] === 'x' || item[2] === 'X') return line
    return `${item[1]}[x] ${item[3]!.trim()}`
  })

  if (atBase === undefined) return lines.join('\n')
  const known = entryTexts(inCheckout)
  const base = entryTexts(atBase)
  const added = [...entryTexts(fromBranch)].filter(text => !known.has(text) && !base.has(text))
  if (!added.length) return lines.join('\n')

  const body = lines.join('\n')
  const separator = body === '' || body.endsWith('\n') ? '' : '\n'
  return `${body}${separator}${added.map(text => `- [ ] ${text}`).join('\n')}\n`
}

/** A queue-file diff carried by one open PR (#1313). Structurally `OpenPrFilePatch`. */
export interface QueuePatch {
  patch: string
}

/**
 * Which of `candidates` a unified diff retires (#1313): the patch adds the entry checked, or
 * removes its open form without re-adding it open.
 *
 * Diff lines are exact about what the PR itself changed, which is what makes this safe: an entry
 * merely *absent* on a branch that forked before the entry was added never counts, and that
 * failure mode is what ruled out comparing whole files. A remove-and-re-add-open pair (a
 * formatting shuffle) cancels out. "Open" follows the sweep's grammar: any list item is open
 * unless its checkbox is ticked (#1164/#1297).
 */
export function entriesRetiredByPatch(patch: string, candidates: readonly string[]): string[] {
  const addedChecked = new Set<string>()
  const addedOpen = new Set<string>()
  const removedOpen = new Set<string>()
  for (const raw of patch.split('\n')) {
    const sign = raw[0]
    if ((sign !== '+' && sign !== '-') || raw.startsWith('+++') || raw.startsWith('---')) continue
    const item = ENTRY_LINE.exec(raw.slice(1))
    const text = item?.[3]?.trim()
    if (!text) continue
    const open = item![2] === undefined || item![2] === ' '
    if (sign === '+') (open ? addedOpen : addedChecked).add(text)
    else if (open) removedOpen.add(text)
  }
  return candidates.filter(text => addedChecked.has(text) || (removedOpen.has(text) && !addedOpen.has(text)))
}

/** The little {@link claimedQueueEntries} needs to know about a run. Structurally a `RunMeta`. */
export interface QueueClaimRun {
  id: string
  status: string
  startedAt?: string
  branch?: string
  sessionName?: string
  queueEntry?: string
}

/** Injectable seams for {@link claimedQueueEntries}: the runs on disk, and a run's PR. */
export interface QueueClaimDeps {
  runs(path: string): Promise<readonly QueueClaimRun[]>
  pr(path: string, run: QueueClaimRun): Promise<{ value?: { state: string } | undefined; pending: boolean }>
  /**
   * The queue-file diffs of the repo's open PRs (#1313), whoever opened them. Absent = claims
   * stay local-only, as before — the graceful shape for a repo with no remote or no gh.
   */
  queuePatches?(path: string): Promise<{ value?: readonly QueuePatch[] | undefined; pending: boolean }>
}

/**
 * Which of `candidates` are claimed by a run's meta rather than the sweep's memory (#1253).
 *
 * The in-memory pin dies with the daemon, and a hands-off web run's local process ends at the
 * hand-off while the cloud session still works its entry — both put the entry back on the market
 * and fan it out to a second agent. The meta is what survives: a live run claims its entry
 * outright, and a finished one keeps the claim while its PR is open, because the work (including
 * the entry's own check-off) travels in that PR and the merge is what closes the entry. A
 * closed-unmerged PR releases the claim, as do failed and stopped runs: that work was abandoned,
 * and the entry should be offered again. A PR lookup still warming counts as claimed — handing
 * the entry out because the answer was slow is the exact double-assignment this prevents, and the
 * next tick knows.
 */
export async function claimedQueueEntries(
  path: string,
  candidates: readonly string[],
  deps: QueueClaimDeps,
): Promise<string[]> {
  const wanted = new Set(candidates)
  const runs = (await deps.runs(path).catch((): QueueClaimRun[] => [])).filter(
    run => run.queueEntry !== undefined && wanted.has(run.queueEntry),
  )
  const claimed = new Set<string>()
  for (const run of runs) {
    const entry = run.queueEntry
    if (entry === undefined || claimed.has(entry)) continue
    if (run.status === 'running') claimed.add(entry)
    else if (run.status === 'done') {
      const pr = await deps.pr(path, run).catch(() => ({ value: undefined, pending: false }))
      if (pr.pending || pr.value?.state === 'OPEN') claimed.add(entry)
    }
  }

  // The cross-machine leg (#1313): another daemon's drain — or a cloud session — is invisible to
  // this machine's run metas, but its open PR is not, and the PR's queue diff carries the entry's
  // check-off or removal. A lookup still warming claims everything for one tick, for the same
  // reason a pending PR lookup does above: handing an entry out because the answer was slow is
  // the exact double-assignment this exists to prevent.
  if (deps.queuePatches && claimed.size < wanted.size) {
    const patches = await deps.queuePatches(path).catch(() => undefined)
    if (patches?.pending) return [...wanted]
    for (const { patch } of patches?.value ?? []) {
      for (const text of entriesRetiredByPatch(patch, candidates)) claimed.add(text)
    }
  }
  return [...claimed]
}
