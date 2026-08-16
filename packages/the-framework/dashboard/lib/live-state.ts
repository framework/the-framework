import type { FrameworkEvent, ChoiceRequest, AgentMeta } from '../../dist/index.js'

// Live-run state derived from the event stream — kept pure so it can be driven and
// tested on its own, away from React. The dashboard is a projection of the same
// events.jsonl the run writes; the interactive gate and the Stop button read that
// projection rather than any extra state.

/** The `choice` event carries the full request; strip the `kind` discriminant. */
type ChoiceEvent = { kind: 'choice' } & ChoiceRequest

/**
 * Every choice gate the run is currently parked on, in fire order. A `choice` event
 * opens a gate; a matching `choice-resolved` (same id) closes it. A re-fired gate (a new
 * `choice` with an id already open) replaces the earlier one in place; a resolved gate
 * never lingers. The run can park on several gates at once (#440 shows them all at once
 * in the right rail), so this returns the list rather than just the latest.
 *
 * An `end` event closes every open gate — the same "a finished run is not awaiting anything"
 * rule the run's own meta fold applies. This is what expires a dead run's question (#1359):
 * a run that died mid-gate never wrote `choice-resolved`, and the store's surrogate end is
 * the only signal that the question's audience is gone, so rendering past it left the panel
 * answerable forever while its picks were read by nobody.
 */
export function pendingChoices(events: readonly FrameworkEvent[]): ChoiceRequest[] {
  const open = new Map<string, ChoiceRequest>()
  for (const event of events) {
    if (event.kind === 'choice-resolved') {
      open.delete(event.id)
      continue
    }
    if (event.kind === 'end') {
      open.clear()
      continue
    }
    if (event.kind === 'choice') {
      const { kind: _kind, ...request } = event as ChoiceEvent
      open.set(event.id, request)
    }
  }
  return [...open.values()]
}

/**
 * One ad-hoc markdown view the agent pushed to the right rail (#441): the `view` event
 * minus its discriminant, derived so a field added to the event carries through here on
 * its own — the same way {@link ChoiceEvent} tracks the `choice` event.
 */
type ViewEvent = Extract<FrameworkEvent, { kind: 'view' }>
export type AgentView = Omit<ViewEvent, 'kind'>

/**
 * Every markdown view the agent has shown this run (#441), in first-seen order. A `view`
 * event with an id already seen updates it in place (the agent re-showed the same title),
 * so the rail keeps one entry per view rather than stacking duplicates.
 */
export function agentViews(events: readonly FrameworkEvent[]): AgentView[] {
  const byId = new Map<string, AgentView>()
  for (const event of events) {
    // Strip the discriminant and keep the rest, like pendingChoices — a new field on the
    // view event is then carried without touching this.
    if (event.kind === 'view') {
      const { kind: _kind, ...view } = event
      byId.set(event.id, view)
    }
  }
  return [...byId.values()]
}

/**
 * Whether the run is still going, i.e. worth showing a Stop button. A run ends with a
 * single `end` event; until one arrives (and once anything has streamed) it is live.
 */
export function isRunActive(events: readonly FrameworkEvent[]): boolean {
  // Asked of the CURRENT segment, not the whole feed: a resumed session (#762) appends a second
  // `session` boundary after its `end` to the same journal, and "was there ever an end" read a
  // resumed-live run as inactive — hiding Stop and settling the pill while the agent worked.
  const current = currentRunEvents(events)
  return current.length > 0 && !current.some(event => event.kind === 'end')
}

/**
 * Whether the agent has stopped working and parked on you (#785), rather than the run's process
 * having exited.
 *
 * The two are not the same and the difference is the whole of #1173. A settled session stays
 * alive as a conversation (#714) so it can take your next message, which means its status is
 * still `running` long after the agent has finished. Anything that asks "is there anything more
 * coming?" — whether to offer the handoff, whether to read the branch — has to ask this rather
 * than whether the process is up, or a session that is plainly done offers nothing to do with it.
 *
 * A new turn un-settles it, the same rule the run's own meta folds (`settled` sets it, a driver
 * `start` clears it), so this is that rule read off the stream rather than a second opinion.
 */
export function agentSettled(events: readonly FrameworkEvent[]): boolean {
  let settled = false
  for (const event of events) {
    if (event.kind === 'settled') settled = true
    else if (event.kind === 'driver' && event.event.type === 'start') settled = false
    else if (event.kind === 'end') settled = false // it ended outright; `live` already says so
  }
  return settled
}

/** How a run ended, off its single `end` event. */
export interface RunOutcome {
  ok: boolean
  stopped: boolean
  detail?: string
}

/**
 * The run's ending, or undefined while it is still going (#948). The most important bit
 * about a finished run used to live only in one small `✗ failed` feed line — the overview
 * pill said "finished" for a crash and a clean pass alike.
 */
export function runOutcome(events: readonly FrameworkEvent[]): RunOutcome | undefined {
  // The ending of the CURRENT segment: a resumed session (#762) carries its stopped segment's
  // `end` in the same journal, and the first-end-wins read kept a resumed run "stopped" for
  // ever — while it was live again, and even after it later finished clean. Mid-resume there is
  // no end in the newest segment yet, and "undefined while it is still going" is the truth.
  const end = currentRunEvents(events).find(event => event.kind === 'end')
  if (!end || end.kind !== 'end') return undefined
  return { ok: end.ok, stopped: end.stopped === true, ...(end.detail !== undefined ? { detail: end.detail } : {}) }
}

/**
 * Whether the run has ended clean and its armed handoff has not reported back yet (#1431):
 * the seconds after `end` while the epilogue is still pushing the branch, opening the PR,
 * merging. The pill said "finished" through that window, which reads as done-with-nothing-
 * coming while the PR link is moments away.
 *
 * The window is the CURRENT segment's: open after its clean `end`, closed by its `handoff`
 * event (every handoff reports — done, skipped, or failed). A resumed session's earlier
 * segment carries its own `handoff`, which must not hide the new window (#1450), so the
 * closing check does not look past the segment boundary. Arming, though, is run-level
 * config, not segment state — the latest `handoff-armed` wins wherever it sits in the feed.
 * And it must be a real arming event with the push rung on: treating the absent-means-armed
 * default as armed would leave archives from before the handoff mechanism "publishing…"
 * for ever.
 */
export function isPublishing(events: readonly FrameworkEvent[]): boolean {
  const current = currentRunEvents(events)
  const end = current.find(event => event.kind === 'end')
  if (end?.kind !== 'end' || !end.ok) return false
  if (current.some(event => event.kind === 'handoff')) return false
  let armedPush: boolean | undefined
  for (const event of events) {
    if (event.kind === 'handoff-armed') armedPush = event.push
  }
  return armedPush === true
}

/**
 * {@link isPublishing}, but off a run's meta snapshot instead of its event log — for the list
 * surfaces (the Recent-sessions rail) that only ever hold a {@link AgentMeta} (#1455). The rail
 * said "done" while the session's own pill still said "publishing…": `status` flips to `done`
 * the moment `end` lands, and until the `handoff` fold (meta version 2) the report never
 * reached the meta, so a list could not know the epilogue was still pushing.
 *
 * The version gate is the old-records guard: a meta from before the fold has no
 * `handoffReport` even though its handoff reported long ago, so only a version ≥ 2 record —
 * one whose writer folds the event — may read the field's absence as "still in flight".
 * `handoff.push` must be affirmatively on, the same rule as the event-side check: nothing to
 * wait for when the epilogue was never armed to push.
 */
export function isMetaPublishing(meta: AgentMeta): boolean {
  return meta.version >= 2 && meta.status === 'done' && meta.handoff?.push === true && meta.handoffReport === undefined
}

/**
 * The GitHub Actions run's live URL, from the `action` event the ActionsDriver emits once it
 * finds its workflow run (#1053): its label is `run <html_url>`. Lets the run view link through
 * to the live Actions run while the transcript is still burst-replaying at the end. The last
 * match wins, so a multi-turn session points at its most recent run. Absent until the driver has
 * found the run (and for any non-Actions target).
 */
export function actionsRunUrl(events: readonly FrameworkEvent[]): string | undefined {
  let url: string | undefined
  for (const event of events) {
    if (event.kind !== 'driver' || event.event.type !== 'action') continue
    const match = /^run (https?:\/\/\S+)$/.exec(event.event.label)
    if (match) url = match[1]
  }
  return url
}

/**
 * The Claude Code cloud session a `web` run was handed to (#610), from the `action` event the
 * CloudDriver emits once the session exists: its label is `cloud <url>`. Read from the event
 * stream rather than from the run's meta for the same reason the Actions link is — the events
 * are what a tab opened mid-run replays. The last match wins, so a session that handed off more
 * than once points at its most recent cloud session. Absent until the hand-off has landed.
 */
export function cloudSession(events: readonly FrameworkEvent[]): { url: string; id: string } | undefined {
  let found: { url: string; id: string } | undefined
  for (const event of events) {
    if (event.kind !== 'driver' || event.event.type !== 'action') continue
    const match = /^cloud (https:\/\/claude\.ai\/code\/(session_[A-Za-z0-9]+)\S*)$/.exec(event.event.label)
    if (match) found = { url: match[1]!, id: match[2]! }
  }
  return found
}

/**
 * The current run's slice of an accumulated live feed. The dashboard's live channel keeps
 * one long-lived subscription per project and appends every streamed event, but each run
 * truncates `events.jsonl` on disk and opens with exactly one `session` event
 * (`emitSessionStart`). So a subscription that spans a run boundary ends up holding the
 * previous run's log followed by the new one. Keep only the tail from the last `session`
 * event — that is the run in progress; a feed with no `session` yet is returned whole. This
 * stops a fresh run's live view (and the right-rail choices/views) from showing the prior run.
 */
export function currentRunEvents(events: readonly FrameworkEvent[]): FrameworkEvent[] {
  let start = 0
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]?.kind === 'session') {
      start = i
      break
    }
  }
  return events.slice(start)
}
