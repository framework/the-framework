import { appendControl, type ControlEntry } from '../control.js'
import { bridgeQuestions } from '../dashboard/bridge-store.js'
import { openInApp, type OpenTarget, type OpenResult } from '../dashboard/open-in-app.js'
import { contextPreferences, contextStartRun, resolveProjectPath, resolveRunPath } from './context.js'
import { relayOr } from './relay-run.js'
import { appendFlatTodoEntry, ticketForPrompt } from '../todo-loop.js'
import { TICKETS_DIR, todoPriorityForTicket } from '../tickets.js'
import { isTicketFile } from '../dashboard/tickets.js'
import { releaseTicketLock } from '../ticket-locks.js'
import { findRun, isSafeRunId, recordRunPr, worktreePath, type RunMeta } from '../store/index.js'
import { withRunLock } from '../run-locks.js'
import { removeProjectWorktree, deleteProjectRun } from '../worktrees.js'
import { commitSessionWork, mergeSessionPr, openSessionPullRequest, pushRunBranch, runBranchFor, type HandoffResult } from '../dashboard/run-handoff.js'
import type { ChoiceBy } from '../events.js'
import { isHandoffLevel, type HandoffLevel } from '../handoff-level.js'
import type {
  DeleteSessionResult,
  RemoveWorktreeResult,
  StartRunKind,
  StartRunOptions,
  StartRunResult,
} from '../dashboard/types.js'
import type { DashboardContext } from '../dashboard/rpc-serve.js'
import type { Preferences } from '../registry.js'

// The write side behind the new dashboard (#405): steering a live run. The reverse of
// the event stream — events flow run -> events.jsonl -> Channel -> browser; steering
// flows browser -> here -> the run's `.the-framework/control.jsonl` -> run, which tails that
// file and aborts or resolves its gate. Same file-is-the-seam design as the daemon's legacy
// onStop/onChoice (#344/#393). Each steering call takes the run id (#749): a run tails the
// log inside its own worktree since #736, so the entry has to be written there. (Starting a run needs a spawn + the daemon's busy guard, so `sendStart`
// lands with the daemon-serves-the-bundle wiring, not here.)

/**
 * Resolve the checkout to steer and append one entry to its `control.jsonl`. A no-op when
 * there is no local path (the read-only relay), so the run channel is only ever written by a
 * host that owns the workspace.
 *
 * The `runId` is what makes steering land (#749): a run tails the control log inside its own
 * worktree, so an entry written to the project root reaches nothing. Absent, it addresses the
 * project root, which is still right for a run that has no worktree (the non-git fallback).
 */
async function appendControlFor(projectId: string, entry: ControlEntry, runId?: string): Promise<void> {
  const cwd = await resolveRunPath(projectId, runId)
  if (cwd) await appendControl(cwd, entry)
}

/** Stop a live run (the Stop button): append a stop entry to the run's control log. */
export async function sendStop(projectId: string, runId?: string): Promise<void> {
  return relayOr(runId, 'sendStop', [projectId, runId], async () => {
    await appendControlFor(projectId, { kind: 'stop' }, runId)
  }, undefined)
}

/**
 * Move a live session's end-of-session handoff (#1102): how far it publishes itself when it
 * finishes.
 *
 * Steering rather than a setting write, because it is about *this* session: the preference sets
 * where the ladder starts, and this is the user changing their mind for one run. The run echoes
 * what it applied back as an event, so the surface reads from the run's meta rather than from local
 * state that a reload would lose.
 *
 * One rung on the wire (B5), so there is nothing to normalise here: a surface offering the stages
 * as separate boxes resolves them on its own side, where an impossible answer settles *down* to the
 * rung actually asked for instead of being repaired upward into a push nobody ticked.
 */
export async function sendSetHandoff(projectId: string, runId: string, level: HandoffLevel): Promise<void> {
  return relayOr(runId, 'sendSetHandoff', [projectId, runId, level], async () => {
    if (!isHandoffLevel(level)) return
    await appendControlFor(projectId, { kind: 'handoff', level }, runId)
  }, undefined)
}

/**
 * Resolve the project's parked choice gate (#304/#332): `pick` is one option id for a
 * single-select, or the selected subset for a multi-select. `by` records who picked
 * (a human here, vs the autopilot countdown or a headless auto-accept).
 */
export async function sendChoice(
  projectId: string,
  id: string,
  pick: string | string[],
  by: ChoiceBy = 'user',
  runId?: string,
): Promise<void> {
  return relayOr(runId, 'sendChoice', [projectId, id, pick, by, runId], async () => {
    await appendControlFor(projectId, { kind: 'choice', id, pick, by }, runId)
  }, undefined)
}

/**
 * Queue the user's pick for the question a Claude web session is parked on (#1237).
 *
 * Not a control-log write like {@link sendChoice}: a cloud run has no live local session to
 * steer, so the pick goes to the bridge store, where the browser extension collects it, types
 * it into the session's composer and submits. Only a label of the currently parked question is
 * accepted, so this can never put arbitrary text in front of another product's agent. Local
 * only, no relay: the bridge lives on the daemon the extension talks to.
 */
export async function sendBridgeAnswer(sessionId: string, label: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof sessionId !== 'string' || !/^session_[A-Za-z0-9]{1,128}$/.test(sessionId)) return { ok: false, error: 'unknown session' }
  if (typeof label !== 'string' || !label.trim()) return { ok: false, error: 'an answer label is required' }
  const queued = bridgeQuestions().queueAnswer(sessionId, label)
  return typeof queued === 'string' ? { ok: false, error: queued } : { ok: true }
}

/** Withdraw a queued bridge answer (#1237). A no-op once the extension has delivered it. */
export async function sendBridgeAnswerCancel(sessionId: string): Promise<void> {
  if (typeof sessionId !== 'string' || !/^session_[A-Za-z0-9]{1,128}$/.test(sessionId)) return
  bridgeQuestions().cancelAnswer(sessionId)
}

/**
 * Send a live-chat message to the project's running run (#714): append a `message` entry
 * that the run drains between turns, continuing the same session via `--resume`. Empty
 * messages are dropped.
 */
export async function sendMessage(projectId: string, text: string, runId?: string): Promise<void> {
  const message = text.trim()
  if (!message) return
  return relayOr(runId, 'sendMessage', [projectId, text, runId], async () => {
    await appendControlFor(projectId, { kind: 'message', text: message }, runId)
  }, undefined)
}

/**
 * Remove a retained worktree (#737). A run that failed or was stopped keeps its checkout so you
 * can inspect it; this is the explicit cleanup for one, since nothing removes them on a timer.
 *
 * The checks and the commit-first removal are {@link removeProjectWorktree}'s, shared with the
 * removal path (#982) so the surfaces cannot drift again. All this adds is
 * the daemon-only step: a retained worktree can still be serving (#797), and that dev server
 * holds the tree being removed, so it is stopped rather than having the directory pulled out
 * from under it.
 */
export async function sendRemoveWorktree(projectId: string, runId: string): Promise<RemoveWorktreeResult> {
  return withWorktreeRemoval(projectId, runId, (cwd, opts) => removeProjectWorktree(cwd, runId, opts))
}

/**
 * Shared body of the two worktree-removing writes (#982/#1032): resolve the local checkout and
 * refuse when there is none. Only the removal action and its result shape differ.
 */
async function withWorktreeRemoval<T>(
  projectId: string,
  runId: string,
  remove: (cwd: string, opts: { beforeRemove: (id: string) => Promise<void> }) => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return { ok: false, error: 'this project has no local path on this server' }
  // Under the run lock: a Remove/Delete clicked the moment a run ends races teardown's own
  // archive-commit-remove of the same checkout; serialized, whichever runs second finds the
  // state the first one left and acts on that.
  return withRunLock(worktreePath(cwd, runId), () => remove(cwd, { beforeRemove: async () => {} }))
}

/**
 * Delete a session (#1032): remove it from the dashboard, records and all — the sibling of
 * {@link sendRemoveWorktree}, and the one destructive-of-history action, so its surface confirms
 * first. The checks, the worktree removal and what it leaves behind (the branch, the committed
 * `LOGS.md` line, the conversation record) are all {@link deleteProjectRun}'s; this adds only the
 * daemon step of stopping a preview that may be serving the worktree before it comes off disk.
 */
export async function sendDeleteSession(projectId: string, runId: string): Promise<DeleteSessionResult> {
  return withWorktreeRemoval(projectId, runId, (cwd, opts) => deleteProjectRun(cwd, runId, opts))
}

/**
 * Start a run in the project (#405, #345): the one write that needs the daemon, since
 * spawning goes through the daemon's own `startRun` closure (with its one-run-per-
 * project busy guard). The daemon provides `startRun` on the Telefunc request context,
 * so this runs in-process. `kind` defaults to a plain build run; a `build`/`prompt`
 * needs a non-empty prompt, `research` may be empty (its "what" defaults server-side).
 * Returns the daemon's {@link StartRunResult} — `busy` when a run is already active.
 */
export async function sendStart(
  projectId: string,
  prompt: string,
  kind: StartRunKind = 'build',
  options: StartRunOptions = {},
): Promise<StartRunResult> {
  const startRun = contextStartRun()
  if (!startRun) return { ok: false, error: 'starting a session is not enabled on this server' }
  const text = prompt.trim()
  if (!text && kind !== 'research') return { ok: false, error: 'a non-empty prompt is required' }
  // A drain fired by hand is the same work the sweep does, so it says the same thing about itself
  // (#1117). Resolved here rather than sent by the caller: the value lands on the run's meta and is
  // rendered, so it is read off the queue on this side instead of trusted from a browser. An
  // explicit ticket on the options wins, since a caller that names one knows better than a guess.
  const ticket = options.ticket ?? (await ticketForStart(projectId, text))
  return startRun(text, kind, ticket ? { ...options, ticket } : options, projectId)
}

/** The queue entry a hand-fired drain is about to work, or undefined for any other prompt (#1117). */
async function ticketForStart(projectId: string, prompt: string): Promise<string | undefined> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return undefined
  return ticketForPrompt(prompt, cwd).catch(() => undefined)
}

/**
 * Open a project in the OS file manager or an editor (#490). Localhost-only: the daemon
 * spawns a local command against the project's own registered path. A public host has no
 * local path to resolve, so it returns an error rather than spawning anything.
 *
 * With a `runId` it opens that session's own checkout instead (#798) — the whole point of
 * opening it is to look at what the agent is doing, which is not in the project's tree.
 */
export async function sendOpenInApp(projectId: string, target: OpenTarget, runId?: string): Promise<OpenResult> {
  const cwd = runId ? await resolveRunPath(projectId, runId) : await resolveProjectPath(projectId)
  if (!cwd) return { ok: false, error: 'this project has no local path on this server' }
  // #727: honour the stored editor preference; absent falls back to $FRAMEWORK_EDITOR, then `code`.
  const editor =
    target === 'editor' ? (await contextPreferences()?.read().catch((): Preferences => ({})))?.editor : undefined
  return openInApp(cwd, target, undefined, editor)
}

/**
 * The session's own branch, or undefined when the run/project is unknown. Shared by the two
 * handoff actions so they address exactly what {@link onRunHandoff} reports on.
 */
async function handoffTargetFor(
  projectId: string,
  runId: string,
): Promise<{ cwd: string; run: RunMeta; checkout: string } | undefined> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd || !isSafeRunId(runId)) return undefined
  const run = await findRun(cwd, runId).catch(() => undefined)
  // The branch is read from the project repo; the tree the agent edited is its own checkout (#453),
  // and for a session that has not committed, that is the only place its work exists.
  const checkout = (await resolveRunPath(projectId, runId)) ?? cwd
  return run ? { cwd, run, checkout } : undefined
}

/**
 * Push a finished session's branch to `origin` (#799).
 *
 * A click rather than something the run does on its way out: pushing publishes the agent's work
 * to a shared remote under the user's name, which is the user's call.
 */
export async function sendPushBranch(projectId: string, runId: string): Promise<HandoffResult> {
  return relayOr(runId, 'sendPushBranch', [projectId, runId], async () => {
    const target = await handoffTargetFor(projectId, runId)
    if (!target) return { ok: false, error: 'unknown session' }
    const branch = runBranchFor(target.run)
    // The commit step holds the run lock: clicked the moment a session flips `done`, this used
    // to commit against the checkout teardown was committing in and lose. Serialized, whichever
    // side runs first commits everything pending; the other finds a clean tree — or no checkout
    // at all, which commitSessionWork already reads as "the branch is authoritative".
    if (!(await withRunLock(target.checkout, () => commitSessionWork(target.checkout, target.cwd, branch)))) {
      return { ok: false, error: 'could not commit the work this session left uncommitted' }
    }
    return pushRunBranch(target.cwd, branch)
  }, { ok: false, error: 'could not reach the device' })
}

/**
 * Open a PR for a finished session's branch (#799), pushing it first if the remote lacks it.
 *
 * The title and body come from what the run already recorded: the session name the agent chose
 * and the intent the user asked for. Nothing new is invented and nothing extra is asked of the
 * user, which is the point of "offer the next step rather than describe it".
 */
export async function sendOpenPullRequest(projectId: string, runId: string): Promise<HandoffResult> {
  return relayOr(runId, 'sendOpenPullRequest', [projectId, runId], async () => {
    const target = await handoffTargetFor(projectId, runId)
    if (!target) return { ok: false, error: 'unknown session' }
    // Same run lock as sendPushBranch, for the same click-at-`done` race.
    const committed = await withRunLock(target.checkout, () =>
      commitSessionWork(target.checkout, target.cwd, runBranchFor(target.run)),
    )
    if (!committed) {
      return { ok: false, error: 'could not commit the work this session left uncommitted' }
    }
    const opened = await openSessionPullRequest(target.cwd, target.run)
    // Record it on the run (E6). The session's own process is gone by now, so there is no event
    // stream to carry the fact — but it is the same fact, and every surface reads it from the same
    // place either way rather than re-deriving it from branch names.
    if (opened.ok && opened.number !== undefined && opened.url) {
      await recordRunPr(target.cwd, runId, { number: opened.number, url: opened.url })
    }
    return opened
  }, { ok: false, error: 'could not reach the device' })
}

/**
 * The user's Merge action (#1391): one button, two states of the session it addresses.
 *
 * A live run gets a `merge` control entry — the run arms the full publish ladder, records the
 * human authorization (which the human-authorized merge gate (#1363) honors instead of demanding the agent's signal), and
 * merges at its own natural end (#1390). A finished run has no process to steer, so its open PR
 * is merged directly — the answer to the withheld-merge ending, where an agent that never
 * signalled left a draft behind. If the run ends between the check and the write, the entry lands
 * unread; the ended view then offers the direct merge, so the second click still gets there.
 */
export async function sendMerge(projectId: string, runId: string): Promise<HandoffResult> {
  return relayOr(runId, 'sendMerge', [projectId, runId], async () => {
    const target = await handoffTargetFor(projectId, runId)
    if (!target) return { ok: false, error: 'unknown session' }
    if (target.run.status === 'running') {
      await appendControlFor(projectId, { kind: 'merge' }, runId)
      return { ok: true }
    }
    return mergeSessionPr(target.cwd, target.run)
  }, { ok: false, error: 'could not reach the device' })
}

/** What {@link sendQueueTicket} did: the backlog file written, or why it could not be. */
export interface QueueTicketResult {
  ok: boolean
  /** The workspace-relative backlog the entry landed in, when it landed. */
  file?: string
  error?: string
}

/** Which ticket a queued entry came from (#1164), so the entry can point back at it. */
export interface QueuedTicket {
  /** The ticket's filename inside `tickets/`, which is its identity. */
  file: string
  /** Its own `priority:` key, when it has one, which decides the section the entry lands in. */
  priority?: string
}

/**
 * Put a ticket on the project's agent queue (#697), so the next drain run works it.
 *
 * A direct write rather than a run: the queue is a plain file the dashboard already reads,
 * and asking an agent to append one line would cost a turn and could do anything else besides.
 * It writes the project checkout's flat backlog specifically, which is the durable queue #624
 * settled on and the one a worktree run's queue is promoted into (#852).
 *
 * Given a `ticket`, the entry is placed in the matching `## Priority N` section rather than
 * appended to the end of the file, and it links back to the ticket it came from. Both halves of
 * #1164: the entry used to land last in a file the drain preset works front to back, and it
 * carried nothing but a title, so the ticket it came from was lost the moment it was queued.
 */
/**
 * Release a ticket's `.lock.md` claim by hand (#1420): the dashboard's answer to a dead agent,
 * since no timer frees locks anymore. Deletes the lock in the project checkout, commits, and
 * pushes best-effort ({@link releaseTicketLock}) — a release only this machine can see would
 * leave the ticket claimed everywhere the claim matters.
 */
export async function sendReleaseTicketLock(projectId: string, ticket: string): Promise<{ ok: boolean; error?: string }> {
  if (!isTicketFile(ticket)) return { ok: false, error: 'not a ticket filename' }
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return { ok: false, error: 'no such project' }
  const outcome = await releaseTicketLock(cwd, ticket)
  if (outcome === 'released') return { ok: true }
  return { ok: false, error: outcome === 'no-lock' ? 'this ticket holds no lock' : 'the release could not be committed' }
}

export async function sendQueueTicket(
  projectId: string,
  entry: string,
  ticket?: QueuedTicket,
): Promise<QueueTicketResult> {
  const trimmed = entry.trim()
  if (!trimmed) return { ok: false, error: 'a ticket is required' }
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return { ok: false, error: 'no such project' }
  // A markdown link, so the file reads well and the agent draining it has the ticket to open.
  // `parseTodoEntries` keeps the line verbatim, so the reference travels with the entry.
  const text = ticket ? `[${trimmed}](${TICKETS_DIR}/${ticket.file})` : trimmed
  const file = await appendFlatTodoEntry(cwd, text, ticket ? todoPriorityForTicket(ticket.priority) : undefined)
  return file ? { ok: true, file } : { ok: false, error: 'the queue could not be written' }
}
