import type { AutoHandoffSkip, FrameworkEvent } from './events.js'

// Derived run state for the dashboard's overview cards (#431): the production-grade
// loop status, the deploy plan, and the live session link — each a pure projection of
// the same FrameworkEvent stream the log renders, so the live dashboard and a past-run
// replay show the identical summary. Kept here (not in the dashboard) so it is
// unit-tested against the real event shapes. The bootstrap phase (checklist/deploy)
// carries the structured data; we surface it as cards.

/** The run's lifecycle progress (#326): the session name it chose and whether it is ready for merge. */
export interface AgentProgress {
  /** The `[a-z0-9-]` session name (also the branch), once the agent set one via `setSessionName()`. */
  sessionName?: string
  /** True once the agent signalled `setReadyForMerge()`: building (false) -> ready (true). */
  readyForMerge: boolean
}

/**
 * The run's lifecycle progress (#326): the latest `session-name` the agent set and whether
 * a `ready-for-merge` has fired. Drives the dashboard status label + dot (orange building,
 * green ready). Always returns a value — an untouched run is `{ readyForMerge: false }`.
 */
export function agentProgress(events: readonly FrameworkEvent[]): AgentProgress {
  const progress: AgentProgress = { readyForMerge: false }
  for (const event of events) {
    if (event.kind === 'session-name') progress.sessionName = event.name
    else if (event.kind === 'ready-for-merge') progress.readyForMerge = true
  }
  return progress
}

/** What a session will do with its work when it ends (#1102), and what it did. */
export interface HandoffState {
  /** Push the branch to `origin` on finish. */
  push: boolean
  /** Open a draft PR on finish. Implies {@link push}. */
  pr: boolean
  /**
   * Merge the PR once opened (#1216) — armed at launch, no checkbox, never changes mid-run.
   * Unlike the pair above this defaults to off: merging is opt-in, so a stream from before the
   * event carried it (#1382) must not read as a run that will land on main by itself.
   */
  merge: boolean
  /** How the handoff ended, once it has run. Absent while the session is still going. */
  result?: { outcome: 'skipped'; reason: AutoHandoffSkip } | { outcome: 'done'; url?: string } | { outcome: 'failed'; error: string }
}

/**
 * What the session is armed to hand back, folded from its own events (#1102).
 *
 * Both halves start armed, so a run from before this existed — which emits no `handoff-armed` —
 * reads as armed, which is what it will actually do once it is running new code. Latest wins: the
 * checkboxes re-emit on every change.
 *
 * `initial` seeds the armed pair for a reader whose event stream missed the opening
 * `handoff-armed` (#1376): the run writes it as its very first event, before the live channel has
 * attached, so a live tab can only learn the real state from the run record's mirror
 * (`AgentRecord.handoff`) — without it, a session the launcher armed push-only reads as "Open PR".
 * A `handoff-armed` event in the stream still wins: it is newer than any record snapshot.
 */
export function handoffState(
  events: readonly FrameworkEvent[],
  initial?: { push: boolean; pr: boolean; merge?: boolean },
): HandoffState {
  const state: HandoffState = { push: initial?.push ?? true, pr: initial?.pr ?? true, merge: initial?.merge ?? false }
  for (const event of events) {
    if (event.kind === 'handoff-armed') {
      state.push = event.push
      state.pr = event.pr
      // Absent on pre-#1382 events: keep the seed rather than flipping an armed merge off.
      if (event.merge !== undefined) state.merge = event.merge
    } else if (event.kind === 'handoff') {
      state.result =
        event.outcome === 'done'
          ? { outcome: 'done', ...(event.url ? { url: event.url } : {}) }
          : event.outcome === 'failed'
            ? { outcome: 'failed', error: event.error }
            : { outcome: 'skipped', reason: event.reason }
    }
  }
  return state
}

/** The wrapped agent session (#431): its id and a deep link, when one is known. */
export interface SessionInfo {
  driver?: string
  fake?: boolean
  sessionId?: string
  sessionLink?: string
  /**
   * The directory the agent ran in (#1195), from the opening `session` event.
   *
   * Taken from the event rather than the filesystem on purpose: a run that finishes cleanly has
   * its worktree removed (`tearDownWorktree`), so the event is the only surviving record of where
   * the session lived — and that path is exactly what `claude --resume` needs to find it again.
   */
  workspace?: string
  /**
   * The model id the current leg's agent was started with (#1438). Folded per leg like the
   * driver/workspace: the latest `session` event wins, and a leg that recorded none clears it.
   */
  model?: string
}

/**
 * The session behind the run (#431): the driver + workspace from the opening `session`
 * event, then the id and any deep link from the latest `session-update`. Null before the
 * session opens. The link is what the old dashboard surfaced as "open session".
 */
export function sessionInfo(events: readonly FrameworkEvent[]): SessionInfo | null {
  let info: SessionInfo | null = null
  for (const event of events) {
    if (event.kind === 'session') {
      info = {
        driver: event.driver,
        fake: event.fake,
        workspace: event.workspace,
        ...(event.sessionLink ? { sessionLink: event.sessionLink } : {}),
        ...(event.model ? { model: event.model } : {}),
      }
    } else if (event.kind === 'session-update') {
      info = { ...(info ?? {}), sessionId: event.sessionId, ...(event.sessionLink ? { sessionLink: event.sessionLink } : {}) }
    }
  }
  return info
}
