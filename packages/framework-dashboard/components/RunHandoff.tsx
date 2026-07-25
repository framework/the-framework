import { useEffect, useState, type ReactNode } from 'react'
import type { HandoffState, RunHandoff } from '@gemstack/the-framework'
import { GitPullRequest } from 'lucide-react'
import { sendOpenPullRequest, sendSetHandoff } from '../server/control.telefunc.js'
import type { RunHandoffState } from '../lib/use-run-handoff.js'
import { cn } from '../lib/utils.js'
import { DiffStat } from './DiffView.js'
import { Button } from './ui/button.js'
import { Checkbox } from './ui/checkbox.js'

// The end-of-session handoff (#799): what this session produced, and the next step offered rather
// than described. Before this, a finished session showed no branch, no commits and no diff, so
// finding out what it actually did meant leaving the dashboard for the command line.
//
// It used to be a panel of its own under the action bar, which repeated the bar's branch name and
// pushed the session output down even when the answer was "nothing changed". It is now split: the
// verdict and the next step ride in the action bar beside the branch they are about, and the
// commits and files are what the bar expands to (#1023).
//
// The read is branch-addressed, so it survives the checkout: a clean run's worktree is removed
// when it ends.

const MAX_COMMITS = 6
const MAX_FILES = 10

/** True when there is a commit list and a file list worth expanding the bar for. */
export function handoffExpandable(handoff: RunHandoff | null): boolean {
  return Boolean(handoff && handoff.exists && !handoff.empty)
}

/** The one-line verdict, in the action bar: what the session left behind, or that it left nothing. */
export function HandoffSummary({ handoff }: { handoff: RunHandoff | null }) {
  if (!handoff) return null
  // A branch that is gone and a branch that was never pushed are different facts, and the summary
  // is only useful if it tells them apart.
  if (!handoff.exists) return <span className="text-muted-foreground">branch gone</span>
  if (handoff.empty) return <span className="text-muted-foreground">no changes</span>
  const commits = `${handoff.commits.length} commit${handoff.commits.length === 1 ? '' : 's'}`
  const files = `${handoff.files.length} file${handoff.files.length === 1 ? '' : 's'}`
  return (
    <span className="flex items-center gap-x-2 whitespace-nowrap text-muted-foreground">
      <span>{commits}</span>
      <span>·</span>
      <span>{files}</span>
      <DiffStat added={handoff.insertions} removed={handoff.deletions} className="text-xs" />
      {/* Whether the work is on the remote yet is the first handoff question — say it. The PR
          itself is not repeated here: the bar already links it. */}
      {handoff.pushed && !handoff.pr && <span>· pushed</span>}
      {handoff.merged && <span>· merged</span>}
    </span>
  )
}

/**
 * What this session will do with its work when it ends (#1102), as two checkboxes in the bar.
 *
 * Pre-commitments, not buttons: whatever is still ticked when the session settles happens by
 * itself. Both start ticked, which is the whole point — the common case costs nothing, and the
 * work stops arriving on a local branch nobody was told about (#860). Unticking either one is how
 * a session opts out, and after that the old button is what is left.
 *
 * Shown only while the session is live, because once it has settled the decision has been taken
 * and what matters is what happened, which the summary says.
 */
export function HandoffArm({
  projectId,
  runId,
  state,
}: {
  projectId: string
  runId: string
  state: HandoffState
}) {
  const [busy, setBusy] = useState(false)
  // The event stream is the truth, but it round-trips through a file the run tails, so a click
  // would visibly bounce back for a beat. `pending` holds what we last asked for until the events
  // agree, the same shape the quota slider needed for a polled value (#979).
  const [pending, setPending] = useState<{ push: boolean; pr: boolean } | null>(null)
  const shown = pending ?? state
  useEffect(() => {
    if (pending && pending.push === state.push && pending.pr === state.pr) setPending(null)
  }, [pending, state.push, state.pr])

  const set = (next: { push: boolean; pr: boolean }): void => {
    setPending(next)
    setBusy(true)
    void sendSetHandoff(projectId, runId, next.push, next.pr)
      .catch(() => setPending(null))
      .finally(() => setBusy(false))
  }

  // One box, labelled with what this session will actually do (#1173).
  //
  // It was two, "Push branch" and "Open PR", sitting as equals — and pushing without opening a PR
  // is a thing neither Rom nor Suleiman could put a purpose to. A pair also has a state that reads
  // as a contradiction (PR ticked, push not) that the code then has to keep quietly repairing.
  //
  // So: opening a PR is the outcome, pushing is how it gets there, and the label says whichever
  // this session is set to. A push-only session still says "Push branch" rather than showing an
  // unticked "Open PR" while pushing behind it — the box never describes something other than what
  // will happen. Ticking it takes the full step; unticking it means the session hands off nothing.
  const pushOnly = shown.push && !shown.pr
  return (
    <div className="flex items-center gap-x-3 whitespace-nowrap text-xs text-muted-foreground">
      <Arm
        label={pushOnly ? 'Push branch' : 'Open PR'}
        title={
          pushOnly
            ? "Push this session's branch to origin when it finishes. Set to push only, so no pull request is opened."
            : 'Open a draft pull request when this session finishes, pushing the branch on the way.'
        }
        checked={shown.pr || pushOnly}
        disabled={busy}
        onChange={on => set(on ? { push: true, pr: true } : { push: false, pr: false })}
      />
    </div>
  )
}

/** One armed step: a checkbox whose whole label is the hit target. */
function Arm({
  label,
  title,
  checked,
  disabled,
  onChange,
}: {
  label: string
  title: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-x-1.5 select-none" title={title}>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={next => onChange(next === true)} />
      {label}
    </label>
  )
}

/**
 * The next step, as a button, at the end of the action bar.
 *
 * What is left once a session has settled without handing itself off: it opted out of the
 * checkboxes above, or the automatic attempt failed. Both publish the agent's work to a shared
 * remote under the user's name, so the button stays the way to do it deliberately. They sit in the
 * bar rather than behind the disclosure, because the point of the handoff is to be offered without
 * being looked for. Once a PR exists neither shows — the bar links the PR, and the interventions
 * queue (#632) has picked it up by then.
 */
export function HandoffActions({
  projectId,
  runId,
  state,
}: {
  projectId: string
  runId: string
  state: RunHandoffState
}) {
  const { handoff, busy, pending, act } = state
  if (!handoff) return null
  // Once a PR exists the bar links it and the needs-you queue (#632) has it: offering to open one
  // again is the single mistake this must not make. Same while the lookup is still out (#1028).
  if (handoff.pr || handoff.prPending) return null
  // From here every branch says something. A session that has finished and shows no control at all
  // is #1173: the reason there is nothing to press is exactly what the reader came for.
  if (!handoff.exists) return <Reason>Branch gone — nothing to open a PR from.</Reason>
  // A branch with no commits and nothing waiting in the tree: the session genuinely produced
  // nothing. Said plainly, rather than shown as a button that could only fail (#1173).
  //
  // Uncommitted work is the other half of that case and is not a dead end: the agent commits what
  // it found before it starts and nothing at the end, so its whole output routinely sits in the
  // tree. Opening the PR commits it first, so the button is offered rather than explained away.
  if (handoff.empty && !handoff.pending) return <Reason>Nothing committed — no PR to open.</Reason>
  if (!handoff.hasRemote) return <Reason>No remote to push to.</Reason>
  // One button, not two (#1173). "Push branch" and "Open PR" sat side by side as equals, and
  // nobody could say what pushing without a PR was for — a control nobody can
  // explain is a control nobody should have to read. Opening a PR pushes the branch on the way,
  // so the one that names the outcome is the one that stays. Pushing alone is still reachable as
  // a session setting for anyone who wants it, it just no longer competes here.
  return (
    <Button
      size="xs"
      disabled={busy}
      onClick={() => act('pr', () => sendOpenPullRequest(projectId, runId), 'Could not open the pull request.')}
    >
      <GitPullRequest className="h-3.5 w-3.5" />
      {pending === 'pr' ? 'Opening PR…' : 'Open PR'}
    </Button>
  )
}

/** Why there is nothing to press. Reads as part of the bar, not as an error. */
function Reason({ children }: { children: ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>
}

/** What the branch holds, revealed by the bar's disclosure. Never rendered when there is nothing. */
export function RunHandoffDetails({ handoff }: { handoff: RunHandoff | null }) {
  if (!handoffExpandable(handoff) || !handoff) return null
  // A column with no rows is a heading over nothing: a session can commit all of its work and
  // leave the tree clean, and then "Changed files" has nothing to list.
  const both = handoff.commits.length > 0 && handoff.files.length > 0
  return (
    <section
      className={cn('grid gap-3 border-b border-border px-4 py-3 text-xs', both && 'sm:grid-cols-2')}
      aria-label="Session handoff"
    >
      {handoff.commits.length > 0 && <Commits handoff={handoff} />}
      {handoff.files.length > 0 && <Files handoff={handoff} />}
    </section>
  )
}

/** What the session committed. Capped, with the remainder counted rather than dropped silently. */
function Commits({ handoff }: { handoff: RunHandoff }) {
  const shown = handoff.commits.slice(0, MAX_COMMITS)
  const rest = handoff.commits.length - shown.length
  return (
    <div>
      <h3 className="mb-1.5 text-muted-foreground">Commits</h3>
      <ul className="space-y-1">
        {shown.map(commit => (
          <li key={commit.sha} className="flex gap-2">
            <code className="shrink-0 text-muted-foreground">{commit.short}</code>
            <span className="truncate" title={commit.subject}>
              {commit.subject}
            </span>
          </li>
        ))}
      </ul>
      {rest > 0 && <p className="mt-1 text-muted-foreground">and {rest} more</p>}
    </div>
  )
}

/** What the session changed. Same capping rule as the commits. */
function Files({ handoff }: { handoff: RunHandoff }) {
  const shown = handoff.files.slice(0, MAX_FILES)
  const rest = handoff.files.length - shown.length
  return (
    <div>
      <h3 className="mb-1.5 text-muted-foreground">Changed files</h3>
      <ul className="space-y-1">
        {shown.map(file => (
          <li key={file.path} className="flex items-center gap-2">
            <span className="truncate" title={file.path}>
              {file.path}
            </span>
            <span className="ml-auto shrink-0 text-muted-foreground">
              {file.binary ? 'binary' : <DiffStat added={file.insertions} removed={file.deletions} className="text-xs" />}
            </span>
          </li>
        ))}
      </ul>
      {rest > 0 && <p className="mt-1 text-muted-foreground">and {rest} more</p>}
    </div>
  )
}
