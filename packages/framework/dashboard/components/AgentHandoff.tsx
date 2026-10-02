import type { ReactNode } from 'react'
import type { AgentHandoff } from '../../src/index.js'
import { ChevronDown, GitMerge, GitPullRequest, Upload } from 'lucide-react'
import { sendMerge, sendOpenPullRequest, sendPush } from '../rpc/control.js'
import type { AgentHandoffState } from '../lib/use-agent-handoff.js'
import { cn } from '../lib/utils.js'
import { DiffStat } from './DiffStat.js'
import { Button, buttonVariants } from './ui/button.js'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu.js'

// The end-of-session handoff (#799): what this session produced, and the next step offered rather
// than described. Before this, a finished session showed no branch, no commits and no diff, so
// finding out what it actually did meant leaving the dashboard for the command line.
//
// It used to be a panel of its own under the action bar, which repeated the bar's branch name and
// pushed the session output down even when the answer was "nothing changed". It is now split: the
// verdict and the next step ride in the action bar beside the branch they are about, and the
// commits and files are what the bar expands to (#1023).
//
// The read is branch-addressed, so it survives the checkout: a clean agent's worktree is removed
// when it ends.

const MAX_COMMITS = 6
const MAX_FILES = 10

/** True when there is a commit list, a file list, or uncommitted work worth expanding the bar for. */
export function handoffExpandable(handoff: AgentHandoff | null): boolean {
  return Boolean(handoff && handoff.exists && (!handoff.empty || handoff.pendingFiles?.length))
}

/**
 * The one-line verdict, in the action bar: what the session left behind, or that it left nothing.
 *
 * A subagent's work goes to its main agent's branch, never to the remote by a person's hand: its
 * line says what it changed, and whether it is landed is said where the next step would be
 * ({@link HandoffActions}).
 */
export function HandoffSummary({ handoff, subagent = false }: { handoff: AgentHandoff | null; subagent?: boolean }) {
  if (!handoff) return null
  // A landed run's branch is gone on purpose; what it held is read by its last commit, and when
  // this machine does not have that commit there is nothing to count: landed is said beside it.
  if (!handoff.exists && handoff.landed) return null
  // A branch that is gone and a branch that was never pushed are different facts, and the summary
  // is only useful if it tells them apart. Gone because the run changed nothing is no changes.
  if (!handoff.exists) return <span className="text-muted-foreground">{handoff.unchanged ? 'no changes' : 'branch gone'}</span>
  // A merged branch reads as empty too — its commits are all on the base, so `base..branch` lists
  // nothing — but "merged" and "no changes" are opposite verdicts, and only one of them is true.
  if (handoff.empty) return <span className="text-muted-foreground">{handoff.merged ? 'merged' : 'no changes'}</span>
  const commits = `${handoff.commits.length} commit${handoff.commits.length === 1 ? '' : 's'}`
  const files = `${handoff.files.length} file${handoff.files.length === 1 ? '' : 's'}`
  return (
    <span className="flex items-center gap-x-2 whitespace-nowrap text-muted-foreground">
      <span>{commits}</span>
      <span>·</span>
      <span>{files}</span>
      <DiffStat added={handoff.insertions} removed={handoff.deletions} className="text-xs" />
      {/* Whether the work is on the remote yet is the first handoff question — say it. The PR
          itself is not repeated here: the bar already links it. That it is not there yet is said
          beside the button that publishes it ({@link HandoffActions}), where it is always in view. */}
      {!subagent && handoff.pushed && !handoff.pr && <span>· pushed</span>}
    </span>
  )
}

/**
 * The next step, as a button, at the end of the action bar.
 *
 * What is left once a session has ended: its work is on this machine only, since an agent pushes
 * and opens its pull request only when its task or the person asks, and this is how a person
 * publishes it. Both put the agent's work on a shared remote under the user's name, so it is a
 * deliberate click, and "not published" beside the button says nothing left yet. They sit in the
 * bar rather than behind the disclosure, because the point of the handoff is to be offered without
 * being looked for. Once a PR exists neither shows — the bar links the PR, and the interventions
 * queue (#632) has picked it up by then.
 *
 * A subagent is offered none of them: it opens no pull request, and its branch is its main
 * agent's to land. In their place it says whether that happened, landed or not landed, at the end
 * of the bar where it is always in view. What it left uncommitted is still named, since nothing
 * lands that.
 */
export function HandoffActions({
  projectId,
  agentId: agentId,
  state,
  subagent = false,
}: {
  projectId: string
  agentId: string
  state: AgentHandoffState
  subagent?: boolean
}) {
  const { handoff, busy, pending, act } = state
  if (!handoff) return null
  if (subagent) {
    if (handoff.landed) return <Reason>landed</Reason>
    return handoff.empty ? <Uncommitted paths={handoff.pendingFiles ?? []} /> : <Reason>not landed</Reason>
  }
  // While the PR lookup is still out (#1028), nothing is offered: acting on "not known yet" is
  // how a second PR gets opened.
  if (handoff.prPending) return null
  // Once a PR exists the bar links it and the needs-you queue (#632) has it: offering to open one
  // again is the single mistake this must not make. What is still worth offering is the Merge
  // (#1391): an open, unmerged PR takes one human click to land.
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
  // A run that changed nothing shows nothing here: there is nothing to do, and a finished run with
  // work always shows its button, so silence already says it. A reason is written only where
  // something was left behind the user may act on.
  // A branch the run's own tool deleted because it held nothing is no loss, so it too is silent.
  if (!handoff.exists) return handoff.unchanged ? null : <Reason>Branch gone — nothing to open a PR from.</Reason>
  // A branch with no diff never gets the button (#1173): there is nothing the git host would accept a PR
  // for, and offering one that fails with "No commits between main and <branch>" is the dead end
  // this bar exists to prevent. When the tree holds uncommitted work, that work is named — the
  // reader's next step is to have the session commit it (the composer is right below).
  if (handoff.empty) return <Uncommitted paths={handoff.pendingFiles ?? []} />
  if (!handoff.hasRemote) return <Reason>No remote to push to.</Reason>
  const push = () => act('push', () => sendPush(projectId, agentId), 'Could not push the branch.')
  // No git host package (#1820): nothing opens a pull request for this project, so the last step is
  // the push, and a pushed branch is where the handoff ends.
  if (!handoff.gitHost) {
    if (handoff.pushed) return <Reason>Pushed — no git host package to open a pull request with.</Reason>
    return (
      <>
        <NotPublished />
        <Button size="xs" disabled={busy} onClick={push}>
          <Upload className="h-3.5 w-3.5" />
          {pending === 'push' ? 'Publishing…' : 'Publish branch'}
        </Button>
      </>
    )
  }
  // A split button: "Open PR" names the outcome and pushes the branch on the way, and the menu
  // beside it holds the push alone, for work that should reach the remote with no pull request
  // yet. Once the branch is pushed the menu has nothing left to offer, so the button stands alone.
  return (
    <>
      {!handoff.pushed && <NotPublished />}
      <span className="inline-flex">
        <Button
          size="xs"
          className={cn(!handoff.pushed && 'rounded-r-none')}
          disabled={busy}
          onClick={() => act('pr', () => sendOpenPullRequest(projectId, agentId), 'Could not open the pull request.')}
        >
          <GitPullRequest className="h-3.5 w-3.5" />
          {pending === 'pr' ? 'Opening PR…' : pending === 'push' ? 'Publishing…' : 'Open PR'}
        </Button>
        {!handoff.pushed && (
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              aria-label="More ways to publish"
              disabled={busy}
              className={cn(
                buttonVariants({ size: 'xs' }),
                'rounded-l-none border-l border-[var(--color-primary-foreground)]/30 px-1 data-[popup-open]:bg-[var(--color-primary)] data-[popup-open]:text-[var(--color-primary-foreground)] data-[popup-open]:opacity-90',
              )}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              <DropdownMenuItem onClick={push}>
                <Upload className="h-3.5 w-3.5" />
                Publish branch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>
    </>
  )
}

/**
 * The work is on this machine only. A run publishes nothing by itself, so this is the usual answer
 * of a finished run, and it must not read as silence: said beside the button that publishes, at
 * the end of the bar, where it is in view at every width.
 */
function NotPublished() {
  return <Reason>not published</Reason>
}

/** The work an empty branch's checkout holds uncommitted, named; nothing when the tree is clean. */
function Uncommitted({ paths }: { paths: string[] }) {
  if (paths.length === 0) return null
  return <Reason title={paths.join('\n')}>Nothing committed — {namePending(paths)} left uncommitted.</Reason>
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
