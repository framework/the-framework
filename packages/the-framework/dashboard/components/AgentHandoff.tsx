import { useEffect, useState, type ReactNode } from 'react'
import type { HandoffState, AgentHandoff } from '../../dist/index.js'
import { handoffFromStages, type HandoffLevel } from '../../dist/client.js'
import { GitMerge, GitPullRequest } from 'lucide-react'
import { sendMerge, sendOpenPullRequest, sendSetHandoff } from '../rpc/control.js'
import type { AgentHandoffState } from '../lib/use-agent-handoff.js'
import { cn } from '../lib/utils.js'
import { DiffStat } from './DiffView.js'
import { Button } from './ui/button.js'
import { Checkbox } from './ui/checkbox.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'

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

/** True when there is a commit list, a file list, or uncommitted work worth expanding the bar for. */
export function handoffExpandable(handoff: AgentHandoff | null): boolean {
  return Boolean(handoff && handoff.exists && (!handoff.empty || handoff.pendingFiles?.length))
}

/** The one-line verdict, in the action bar: what the session left behind, or that it left nothing. */
export function HandoffSummary({ handoff }: { handoff: AgentHandoff | null }) {
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
  agentId: agentId,
  state,
}: {
  projectId: string
  agentId: string
  state: HandoffState
}) {
  const [busy, setBusy] = useState(false)
  // The event stream is the truth, but it round-trips through a file the run tails, so a click
  // would visibly bounce back for a beat. `pending` holds what we last asked for until the events
  // agree, the same shape the quota slider needed for a polled value (#979).
  const [pending, setPending] = useState<HandoffLevel | null>(null)
  // The event spells the stages out; the ladder is what they mean (B5). Read as a rung here, so
  // this component never has to reason about a combination the rung cannot hold.
  const armed = handoffFromStages(state)
  const shown = pending ?? armed
  useEffect(() => {
    if (pending && pending === armed) setPending(null)
  }, [pending, armed])

  const set = (next: HandoffLevel): void => {
    setPending(next)
    setBusy(true)
    void sendSetHandoff(projectId, agentId, next)
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
  const pushOnly = shown === 'push'
  // Merge arming has no checkbox (#1216) but the label must own it (#1382): a box saying "Open PR"
  // on a run that will land on main by itself is the lie this component exists to not tell.
  const merges = shown === 'merge'
  return (
    <div className="flex items-center gap-x-3 whitespace-nowrap text-xs text-muted-foreground">
      <Arm
        label={pushOnly ? 'Push branch' : merges ? 'Open PR & merge' : 'Open PR'}
        title={
          pushOnly
            ? "Push this agent's branch to origin when it finishes. Set to push only, so no pull request is opened."
            : merges
              ? 'Open a pull request when this agent finishes and merge it once it is open, pushing the branch on the way.'
              : 'Open a draft pull request when this agent finishes, pushing the branch on the way.'
        }
        checked={shown !== 'local'}
        disabled={busy}
        // Unticking means "hand off nothing"; re-ticking lands on the zero-config rung rather than
        // restoring a merge the box never mentioned. The label always names the rung it is showing,
        // so the two agree either way.
        onChange={on => set(on ? 'pr' : 'local')}
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
    <Tooltip>
      <TooltipTrigger render={<label className="flex cursor-pointer items-center gap-x-1.5 select-none" />}>
        <Checkbox checked={checked} disabled={disabled} onCheckedChange={next => onChange(next === true)} />
        {label}
      </TooltipTrigger>
      <TooltipContent className="max-w-[22rem]">{title}</TooltipContent>
    </Tooltip>
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
  agentId: agentId,
  state,
}: {
  projectId: string
  agentId: string
  state: AgentHandoffState
}) {
  const { handoff, busy, pending, act } = state
  if (!handoff) return null
  // While the PR lookup is still out (#1028), nothing is offered: acting on "not known yet" is
  // how a second PR gets opened.
  if (handoff.prPending) return null
  // Once a PR exists the bar links it and the needs-you queue (#632) has it: offering to open one
  // again is the single mistake this must not make. What is still worth offering is the Merge
  // (#1391): an open, unmerged PR — the withheld-merge ending (#1363) leaves exactly this behind
  // when the agent never signalled — takes one human click to land.
  if (handoff.pr) {
    if (handoff.pr.state !== 'OPEN' || handoff.merged) return null
    return (
      <Button
        size="xs"
        disabled={busy}
        onClick={() => act('merge', () => sendMerge(projectId, agentId), 'Could not merge the pull request.')}
      >
        <GitMerge className="h-3.5 w-3.5" />
        {pending === 'merge' ? 'Merging…' : 'Merge PR'}
      </Button>
    )
  }
  // From here every branch says something. A session that has finished and shows no control at all
  // is #1173: the reason there is nothing to press is exactly what the reader came for.
  if (!handoff.exists) return <Reason>Branch gone — nothing to open a PR from.</Reason>
  // A branch with no diff never gets the button (#1173): there is nothing GitHub would accept a PR
  // for, and offering one that fails with "No commits between main and <branch>" is the dead end
  // this bar exists to prevent. When the tree holds uncommitted work, that work is named — the
  // reader's next step is to have the session commit it (the composer is right below), and an
  // unattended run commits it by itself on the way out.
  if (handoff.empty) {
    const pending = handoff.pendingFiles ?? []
    if (pending.length === 0) return <Reason>Nothing committed — no PR to open.</Reason>
    return <Reason title={pending.join('\n')}>Nothing committed — {namePending(pending)} left uncommitted.</Reason>
  }
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
      onClick={() => act('pr', () => sendOpenPullRequest(projectId, agentId), 'Could not open the pull request.')}
    >
      <GitPullRequest className="h-3.5 w-3.5" />
      {pending === 'pr' ? 'Opening PR…' : 'Open PR'}
    </Button>
  )
}

/**
 * The uncommitted paths, worded for a one-line bar: the first couple named, the rest counted.
 * The full list is one hover (the Reason's title) or one disclosure (the details pane) away.
 */
function namePending(paths: string[]): string {
  const shown = paths.slice(0, 2).join(', ')
  const rest = paths.length - Math.min(paths.length, 2)
  return rest > 0 ? `${shown} and ${rest} more` : shown
}

/** Why there is nothing to press. Reads as part of the bar, not as an error. */
function Reason({ children, title }: { children: ReactNode; title?: string }) {
  // Capped and truncated: the bar's actions never shrink, so a long file name must ellipsize here
  // rather than push the row wide.
  return (
    <span className="inline-block max-w-[24rem] truncate align-middle text-xs text-muted-foreground" {...(title ? { title } : {})}>
      {children}
    </span>
  )
}

/** What the branch holds, revealed by the bar's disclosure. Never rendered when there is nothing. */
export function AgentHandoffDetails({ handoff }: { handoff: AgentHandoff | null }) {
  if (!handoffExpandable(handoff) || !handoff) return null
  // A column with no rows is a heading over nothing: a session can commit all of its work and
  // leave the tree clean, and then "Changed files" has nothing to list.
  const pendingFiles = handoff.pendingFiles ?? []
  const sections = [handoff.commits.length > 0, handoff.files.length > 0, pendingFiles.length > 0].filter(Boolean).length
  return (
    <section
      className={cn('grid gap-3 border-b border-border px-4 py-3 text-xs', sections > 1 && 'sm:grid-cols-2')}
      aria-label="Agent handoff"
    >
      {handoff.commits.length > 0 && <Commits handoff={handoff} />}
      {handoff.files.length > 0 && <Files handoff={handoff} />}
      {pendingFiles.length > 0 && <PendingFiles paths={pendingFiles} />}
    </section>
  )
}

/** What the session committed. Capped, with the remainder counted rather than dropped silently. */
function Commits({ handoff }: { handoff: AgentHandoff }) {
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

/** The work the session never committed (#1173) — the full list behind the bar's one-line naming. */
function PendingFiles({ paths }: { paths: string[] }) {
  const shown = paths.slice(0, MAX_FILES)
  const rest = paths.length - shown.length
  return (
    <div>
      <h3 className="mb-1.5 text-muted-foreground">Uncommitted files</h3>
      <ul className="space-y-1">
        {shown.map(path => (
          <li key={path} className="truncate" title={path}>
            {path}
          </li>
        ))}
      </ul>
      {rest > 0 && <p className="mt-1 text-muted-foreground">and {rest} more</p>}
    </div>
  )
}

/** What the session changed. Same capping rule as the commits. */
function Files({ handoff }: { handoff: AgentHandoff }) {
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
