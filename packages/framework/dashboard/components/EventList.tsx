import type { AgentMeta, ChoiceRequest, FrameworkEvent } from '../../src/index.js'
import { formatFrameworkEvent } from '../../src/client.js'
import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { eventKindLabel } from '../lib/event-labels.js'
import { pendingChoices } from '../lib/live-state.js'
import { startedBefore, subagentEnd, subagentStartedAt, type SubagentEnd } from '../lib/subagents.js'
import { AnsweredChoice } from './AnsweredChoice.js'
import { ChoicePanel } from './ChoicePanel.js'
import { InlineScreen, isLoopbackScreen } from './InlineScreen.js'
import { Markdown } from './Markdown.js'
import { SessionLine, type SessionSetup } from './SessionLine.js'
import { SubagentLine } from './SubagentLine.js'
import { LiveLine, ToolCalls, type ToolStep } from './ToolCalls.js'
import { Badge } from './ui/badge.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from './ui/message-scroller.js'

// Presentational event log, shared by the live stream and past-run replay. Most events render as
// their human-readable line (the same formatter the terminal uses, so a `driver` turn reads
// "· Read  src/app.ts" rather than raw JSON). Some things get special rows:
//   - The message text: the user's prompt (`driver` `start`) and the agent's reply (`driver` `text`)
//     render their raw text inline, truncated to one line when long and expanding in place on click
//     (#476/#520). The user's own prompt is a grey box on the right, as in a chat.
//   - The agent's steps between two messages (`driver` `action` and `thought`): one folded line
//     for the whole run of them (ToolCalls), opening to one line per step.
//   - Choice gates, when the log knows its project (#1455 item 6): an open gate renders the same
//     interactive ChoicePanel the rail used to hold, so the question is answered from the flow;
//     a resolved one collapses to the AnsweredChoice ✓ card and hides its "✓ chose" line.
//   - Screens: the newest open `screen` line at an address, before the run's end, is the live
//     screen itself (InlineScreen); an earlier one stays its one line, and an `ended` one is hidden.
//   - A turn's end and the spend so far are not rows, and neither is a clean end the run went on
//     after: the run's details count turns and spend, and "finished" between turns is not so.
//   - The reply a question follows is shown whole: it is what the question asks about.
//   - Subagents, when the log is given the run's: each has a SUBAGENT row where it was started,
//     read off its card, so the row of a working one says what it is doing now; and the prompt
//     that told the run a subagent ended is a SUBAGENT row too, not a YOU one.
// The kind badge shows once per agent of same-group rows — a 200-line driver turn used to be 200
// identical badges (#948). A driver `start` breaks out of the AGENT group: the user's turn has no
// badge, its box says whose it is. A row at a group boundary shows the time its diary line was written, the same
// live, reloaded or replayed; a line written with no time shows none. Scrolling rides shadcn's Base UI message-scroller (#712): live
// follows the edge (`autoScroll`) but yields the moment the reader scrolls up, replay renders static
// from the top, and the "Jump to latest" chip is the scroller's own inert-when-not-scrollable button.

// The conversation text — the user's prompt and the agent's reply (AGENT). Both are rendered
// as Markdown: the agent writes in Markdown, and a prompt may too.
function messageText(e: FrameworkEvent): string | null {
  if (e.kind !== 'driver') return null
  if (e.event.type === 'start') return e.event.prompt
  if (e.event.type === 'text') return e.event.text
  return null
}

// Long enough that an inline row truncates to one line and offers to expand. Mirrors terminal.ts's
// `truncate`: collapse whitespace, trim, compare to 100.
function isLong(text: string): boolean {
  return text.replace(/\s+/g, ' ').trim().length > 100
}

/** Grouping key for the once-per-agent badge: the user's prompt stands apart from the agent's work. */
function rowGroup(e: FrameworkEvent): string {
  if (e.kind === 'driver') return e.event.type === 'start' ? 'you' : 'agent'
  return e.kind
}

// A driver `start` opens a fresh prompt turn — the natural anchor the scroller keeps in view.
// Only the newest one is handed to the scroller as its anchor (see `anchor` in EventList).
function isTurnBoundary(e: FrameworkEvent): boolean {
  return e.kind === 'driver' && e.event.type === 'start'
}

/**
 * Whether a row reports a failure, which reads in red (#1199). Two shapes say it: the agent (or
 * its transport) erroring mid-run, and the agent settling badly. A *stopped* run is neither, since
 * the user asked for that, and neither is a run *waiting* on the question it ended on (#1774): both
 * stay neutral rather than being coloured like a fault.
 */
function isFailure(e: FrameworkEvent): boolean {
  if (e.kind === 'driver') return e.event.type === 'error'
  // An error the agent reported itself (#1500) is a failure like any other: the log already has
  // one red lane, and a second vocabulary for the same thing would only make both quieter.
  if (e.kind === 'error') return true
  return e.kind === 'end' && !e.ok && !e.stopped && !e.waiting
}

/** The row's colour: a failure is red (#1199), and everything else keeps the muted log tone. */
function rowTone(e: FrameworkEvent): string {
  return isFailure(e) ? 'text-danger' : ''
}

/**
 * The BADGE's colour: a navigation aid for scanning the log by kind (#1455 follow-up), on top of
 * {@link rowTone}'s semantics (failure red, which wins). Only the
 * high-signal kinds get a colour; the bulk of the log stays muted, or every row shouting means
 * none do. The body keeps rowTone: colour the *marker*, not the text.
 *
 *   - your decisions (`choice`/`choice-resolved`) — amber, the rows the log most wants found
 *   - milestones (a CLEAN `end`) — green, how far the agent got; a stopped or failed end is not
 *     a milestone (failure is already red, stopped stays neutral)
 *   - pushed surfaces (`view`, `screen`) — primary, the agent showing you something
 */
function badgeTone(e: FrameworkEvent): string {
  const semantic = rowTone(e)
  if (semantic) return semantic
  if (e.kind === 'choice' || e.kind === 'choice-resolved') return 'text-warning'
  if (e.kind === 'end' && e.ok) return 'text-success'
  if (e.kind === 'view' || e.kind === 'screen') return 'text-primary'
  return ''
}

/**
 * The row's BACKGROUND wash (#1508), the layer above {@link badgeTone}'s markers: a tint across
 * the whole line, findable from the scrollbar's distance where a coloured badge word is not.
 * Only the rows the eye actually hunts for get one — failures, and the agent landing cleanly (the
 * reader's own turns are boxes already) — and at a whisper of alpha, so the
 * text keeps the contrast and the bulk of the log stays plain canvas.
 */
function rowWash(e: FrameworkEvent): string {
  if (isFailure(e)) return 'bg-danger/10'
  if (e.kind === 'end' && e.ok) return 'bg-success/10'
  return ''
}

/**
 * Hoist the agent's first prompt to the top of the log (#1170).
 *
 * It is emitted after the `session` event, so the one line the reader wrote themselves opened
 * under a row they did not write.
 * Only the *first* prompt moves: a later turn is part of the conversation and belongs where it
 * happened. The rows it jumps keep their order, so the log reads as "what I asked, then
 * everything that followed".
 */
function promptFirst(events: FrameworkEvent[]): FrameworkEvent[] {
  const at = events.findIndex(isTurnBoundary)
  if (at <= 0) return events
  return [events[at]!, ...events.slice(0, at), ...events.slice(at + 1)]
}

/** HH:MM:SS in the reader's locale, for the column that says when each line was written. */
function formatTime(at: string): string {
  return new Date(at).toLocaleTimeString()
}

/** How a special `choice` row renders (#1455 item 6): the still-open gate is the interactive
 *  panel, a resolved one the collapsed ✓ card. Rows not in the map keep the formatter's text. */
type ChoiceRow =
  | { render: 'open'; choice: ChoiceRequest; active: boolean }
  | { render: 'answered'; choice: ChoiceRequest; pick: string | readonly string[] }

/**
 * A transcript entry that represents an interaction should BE the interaction (#1455 item 6):
 * fold the log's choice traffic into per-row render states.
 *
 * Only the LAST firing of a gate id is special — `pendingChoices` replaces a re-fired gate in
 * place, so an earlier firing is history and keeps its text. An open gate (no resolution, no
 * `end` after it) renders the same ChoicePanel the rail rendered; a resolved one collapses to
 * the ✓ card, and the `choice-resolved` line that told its story is hidden — the card says it
 * better. A gate closed by `end` without an answer (#1359: its audience is gone) stays text —
 * a control nobody reads must not look answerable. Earlier firings' "✓ chose" lines stay put:
 * they are the only record of a superseded decision.
 */
function foldChoiceRows(events: FrameworkEvent[]): {
  rows: Map<FrameworkEvent, ChoiceRow>
  hidden: Set<FrameworkEvent>
} {
  const rows = new Map<FrameworkEvent, ChoiceRow>()
  const hidden = new Set<FrameworkEvent>()
  const lastFiring = new Map<string, { e: FrameworkEvent; at: number }>()
  const lastResolved = new Map<string, { e: Extract<FrameworkEvent, { kind: 'choice-resolved' }>; at: number }>()
  events.forEach((e, at) => {
    if (e.kind === 'choice') lastFiring.set(e.id, { e, at })
    else if (e.kind === 'choice-resolved') lastResolved.set(e.id, { e, at })
  })
  const open = new Set(pendingChoices(events).map(c => c.id))
  let newestOpen: FrameworkEvent | undefined
  for (const [id, firing] of lastFiring) if (open.has(id)) newestOpen = firing.e
  for (const [id, firing] of lastFiring) {
    const { kind: _kind, ...choice } = firing.e as { kind: 'choice' } & ChoiceRequest
    const resolved = lastResolved.get(id)
    if (open.has(id)) {
      rows.set(firing.e, { render: 'open', choice, active: firing.e === newestOpen })
    } else if (resolved && resolved.at > firing.at) {
      // A resolution from BEFORE this firing answered an earlier gate, not this one — a gate
      // re-fired and then closed by `end` must not wear a pick it never received.
      rows.set(firing.e, { render: 'answered', choice, pick: resolved.e.picked })
      hidden.add(resolved.e)
    }
  }
  return { rows, hidden }
}

/**
 * Which `screen` rows are live and which are hidden. Live: the newest line at its address with no
 * `ended` line for it after, no run `end` after it other than one waiting on an answer, and a
 * loopback address. Every `ended` line is hidden: the live row going back to its one line says
 * the screen has gone.
 */
export function foldScreenRows(events: readonly FrameworkEvent[]): { live: Set<FrameworkEvent>; hidden: Set<FrameworkEvent> } {
  const hidden = new Set<FrameworkEvent>()
  const newest = new Map<string, number>()
  let lastEnd = -1
  events.forEach((e, at) => {
    // A run waiting on an answer keeps its screens: the page is what its question is about.
    if (e.kind === 'end' && !e.waiting) lastEnd = at
    if (e.kind !== 'screen') return
    if (e.ended) {
      hidden.add(e)
      newest.delete(e.url)
    } else newest.set(e.url, at)
  })
  const live = new Set<FrameworkEvent>()
  for (const [url, at] of newest) if (at > lastEnd && isLoopbackScreen(url)) live.add(events[at]!)
  return { live, hidden }
}

/**
 * The ends that are not the run's end: a clean one, or one waiting on an answer, that a later
 * prompt follows (the run went on), and the last clean one while the run's subagents still work
 * (`going`). They are not rows: "finished" between two turns or over working subagents, and
 * "waiting for an answer" above the answer, say what is not so. A failed or stopped end stays
 * where it happened: it says why the next prompt was needed.
 */
export function passedEnds(events: readonly FrameworkEvent[], going: boolean, sent = false): Set<FrameworkEvent> {
  const passed = new Set<FrameworkEvent>()
  let pending: FrameworkEvent | undefined
  for (const e of events) {
    if (e.kind === 'end') pending = e.ok || e.waiting ? e : undefined
    else if (pending && isTurnBoundary(e)) {
      passed.add(pending)
      pending = undefined
    }
  }
  // A message just sent (`sent`) is a prompt on its way: the end above it is passed already.
  if (pending?.kind === 'end' && (sent || (going && pending.ok))) passed.add(pending)
  return passed
}

/**
 * The replies a question follows: the agent's last message before each question it stopped on.
 * It is what the question is about (a plan to approve), so it is shown whole, not folded.
 */
export function askedReplies(events: readonly FrameworkEvent[]): Set<FrameworkEvent> {
  const asked = new Set<FrameworkEvent>()
  let reply: FrameworkEvent | undefined
  for (const e of events) {
    if (isTurnBoundary(e)) reply = undefined
    else if (e.kind === 'driver' && e.event.type === 'text') reply = e
    else if (e.kind === 'choice' && reply) asked.add(reply)
  }
  return asked
}

/**
 * A reply without the block its question is written in (the fenced `await-choices` block, JSON):
 * the question's card, the row under the reply, shows the question. A block still being written
 * has no closing fence yet and goes too, so the JSON never scrolls by while the agent types it.
 */
export function withoutQuestionBlock(text: string): string {
  return text.replace(/```await-choices\b[\s\S]*?(```|$)/g, '').trim()
}

// The agent's reply: whole, as Markdown, in the page's own font rather than the log's. The message
// being written is drawn the same way, so the finished message takes its place without a jump: a
// reply used to grow tall as it was written and fold to one line the moment it was done.
function Reply({ text }: { text: string }) {
  return (
    <div className="min-w-0 flex-1 font-sans text-foreground">
      <Markdown text={text} />
    </div>
  )
}

// More than this many lines, or this many characters, and the user's own message is cut short
// behind "Show more".
const PROMPT_LINES = 8
const PROMPT_CHARS = 600

function isTall(text: string): boolean {
  return text.length > PROMPT_CHARS || text.trim().split('\n').length > PROMPT_LINES
}

// The user's own message: a grey box on the right, as Markdown in the page's font. No label says
// whose it is; the place and the box do. A long one is cut short with "Show more" under it. The
// time it was sent sits under the box and shows while the pointer is on the message; its line is
// always there, so nothing moves when it shows.
function Prompt({ text, at }: { text: string; at: string | undefined }) {
  const [open, setOpen] = useState(false)
  const tall = isTall(text)
  return (
    <div className="group/prompt flex min-w-0 flex-1 flex-col items-end font-sans text-foreground">
      <div role="group" aria-label="Your message" className="max-w-[85%] min-w-0 rounded-xl bg-muted px-3.5 py-2">
        <div className={tall && !open ? 'max-h-40 overflow-hidden' : ''}>
          <Markdown text={text} />
        </div>
        {tall && (
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="mt-1 text-xs text-muted-foreground hover:text-foreground">
            {open ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
      <time
        dateTime={at}
        title={at === undefined ? undefined : new Date(at).toLocaleString()}
        className="h-4 pr-1 text-[10px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover/prompt:opacity-100"
      >
        {at === undefined ? '' : formatTime(at)}
      </time>
    </div>
  )
}

// What a run was told about a subagent's end, rendered as compact Markdown. A short one renders as-is. A long one clamps to its
// first line with a chevron beside it and expands in place on click — the chevron stays on that
// first line (never a lone chevron on its own row), and the same rendered Markdown just unclamps,
// so the opening is never shown twice.
function Message({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  if (!isLong(text)) {
    return (
      <div className="min-w-0 flex-1">
        <Markdown text={text} compact />
      </div>
    )
  }
  return (
    <div className="flex min-w-0 flex-1 items-start gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? 'Collapse message' : 'Expand message'}
        className={`shrink-0 select-none text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
      >
        ›
      </button>
      <div
        className={open ? 'min-w-0 flex-1' : 'max-h-[1.35rem] min-w-0 flex-1 cursor-pointer overflow-hidden'}
        onClick={open ? undefined : () => setOpen(true)}
      >
        <Markdown text={text} compact />
      </div>
    </div>
  )
}

/** A tool call or a thought of the coding agent: a step between two of its messages. */
function stepOf(e: FrameworkEvent): ToolStep | undefined {
  return e.kind === 'driver' && (e.event.type === 'action' || e.event.type === 'thought') ? e.event : undefined
}

/**
 * Fold each run of the agent's steps (tool calls and thoughts with no other row between them)
 * into its first row, which stands for the whole run. A run with no call in it, thoughts alone,
 * is no row at all: the chat has no thinking row. While the agent works (`live`), a call that is
 * the last event is the call going on now (`current`): it is not in its run yet, the chat's last
 * line says it.
 */
export function foldSteps(
  events: readonly FrameworkEvent[],
  live = false,
): { rows: FrameworkEvent[]; steps: Map<FrameworkEvent, ToolStep[]>; current?: Extract<ToolStep, { type: 'action' }> } {
  const last = events[events.length - 1]
  const going = live && last !== undefined ? stepOf(last) : undefined
  if (going?.type === 'action') return { ...foldSteps(events.slice(0, -1)), current: going }
  const rows: FrameworkEvent[] = []
  const steps = new Map<FrameworkEvent, ToolStep[]>()
  let run: { head: FrameworkEvent; steps: ToolStep[] } | undefined
  const close = (): void => {
    if (run?.steps.some(step => step.type === 'action')) {
      rows.push(run.head)
      steps.set(run.head, run.steps)
    }
    run = undefined
  }
  for (const e of events) {
    const step = stepOf(e)
    if (step === undefined) {
      close()
      rows.push(e)
    } else if (run) run.steps.push(step)
    else run = { head: e, steps: [step] }
  }
  close()
  return { rows, steps }
}

/** The badge word, and the grouping key, of a row about one of the run's subagents. */
const SUBAGENT = 'subagent'
const NO_SUBAGENTS: readonly AgentMeta[] = []
const NOTHING_DOING: Record<string, string> = {}

/**
 * Whether an event is a row at all. The agent's session id is plumbing, not conversation: the
 * run's ⋮ menu reads it from the events. A turn's end and what the run has spent are not rows
 * either: the run's details count the turns and total the spend. A quota reading is worth a row
 * only when the quota is running low or used up; the agent reports it after every turn,
 * "allowed" included.
 */
function shownAsRow(e: FrameworkEvent): boolean {
  if (e.kind === 'session-update' || e.kind === 'usage') return false
  if (e.kind === 'driver' && e.event.type === 'result') return false
  if (e.kind === 'driver' && e.event.type === 'rate-limit') return e.event.limit.status !== 'allowed'
  return true
}

export function EventList({
  events,
  writing = '',
  sending,
  working = false,
  stick = true,
  openAt,
  tail,
  projectId,
  agentId: agentId,
  subagents = NO_SUBAGENTS,
  doing = NOTHING_DOING,
  going = false,
  setup,
  onOpenAgent,
}: {
  events: FrameworkEvent[]
  /** The message the agent is writing, as far as it has got: an AGENT row after the last, drawn
   *  as a finished reply is. Never an event: its whole message's row replaces it. */
  writing?: string
  /** A message just sent to an ended agent: the last prompt row, until the prompt's own line
   *  arrives and takes the same row. Being a prompt, the scroller brings it into view. */
  sending?: string | undefined
  /** The agent is working: while it writes nothing, a moving line closes the feed: the call going
   *  on now, else "Starting…" when the last row is a prompt and "Working…" after, so a quiet agent
   *  never looks stalled. */
  working?: boolean
  stick?: boolean
  /** Where a non-following log opens; a replay opens at the outcome (#948), not page one. */
  openAt?: 'start' | 'end'
  /** Pinned after the last row, inside the scroller (#1265): the log's "and then…" — a web agent's
   *  live mirror box — that must scroll (and stick) with the log rather than float over it. */
  tail?: ReactNode
  /** The log's own project (#1455 item 6): with it, a `choice` row IS the interaction — an open
   *  gate renders the inline ChoicePanel, a resolved one the collapsed ✓ card. Without it, every
   *  row keeps the formatter's text. */
  projectId?: string | undefined
  /** Which run an inline pick resolves (#749), forwarded to the panel with projectId. */
  agentId?: string | null | undefined
  /** The runs started for this run, oldest first: each gets a row where it was started. */
  subagents?: readonly AgentMeta[]
  /** What each working subagent is doing now, by id. */
  doing?: Record<string, string>
  /** The run's job is not over (its subagents still work): its last clean end is not shown as the end. */
  going?: boolean
  /** What was set up for the agent before it began: the "Session set up" line under the first
   *  prompt (the first row when the log has no prompt). Without it, no such line. */
  setup?: SessionSetup | undefined
  /** Open another run's page: what a subagent's row does on a click. */
  onOpenAgent?: ((agentId: string) => void) | undefined
}) {
  const choiceRows = useMemo(() => (projectId ? foldChoiceRows(events) : undefined), [projectId, events])
  const screenRows = useMemo(() => foldScreenRows(events), [events])
  const passed = useMemo(() => passedEnds(events, going, sending !== undefined), [events, going, sending])
  const rowIds = useMemo(() => new Map(events.map((e, at) => [e, String(at)])), [events])
  const asked = useMemo(() => askedReplies(events), [events])
  const logged = promptFirst(events).filter(e => shownAsRow(e) && !choiceRows?.hidden.has(e) && !screenRows.hidden.has(e))
  // Every row and every passed end, in order, a message just sent last; `shown` is the rows alone.
  const kept: FrameworkEvent[] = sending === undefined ? logged : [...logged, { kind: 'driver', event: { type: 'start', prompt: sending } }]
  // The text of a row's message: the reply a question follows, without the question's block.
  const textOf = (e: FrameworkEvent): string | null => {
    const text = messageText(e)
    return text !== null && asked.has(e) ? withoutQuestionBlock(text) : text
  }
  // A reply that was only its question's block is no row: the card under it is the question.
  // A run of the agent's steps is one row, its first.
  const written = withoutQuestionBlock(writing)
  const unfolded = kept.filter(e => !passed.has(e) && textOf(e) !== '')
  const { rows: shown, steps, current } = foldSteps(unfolded, working && !written)
  // Nothing has come since the prompt, not even a thought that is no row: the agent is starting.
  const starting = unfolded.length > 0 && isTurnBoundary(unfolded[unfolded.length - 1]!)
  // The prompts that told this run one of its subagents ended: SUBAGENT rows, not the reader's own.
  const ends = new Map<FrameworkEvent, SubagentEnd>()
  for (const e of shown) {
    const end = e.kind === 'driver' && e.event.type === 'start' ? subagentEnd(e.event.prompt, subagents) : undefined
    if (end) ends.set(e, end)
  }
  // A row is known by its event's place in the whole log, not among the rows shown: a row that
  // stops being shown (an end the run went on after) then changes no other row's identity, and
  // the scroller keeps its place. A message just sent has no place yet.
  const idOf = (e: FrameworkEvent): string => rowIds.get(e) ?? 'sending'
  // The scroller's anchor is the newest prompt alone. It brings an anchor it has not yet brought
  // into view to the top whenever one row takes another's place, and it starts with the oldest:
  // with every prompt an anchor, a log opened with several turns in it jumped to its first prompt
  // the moment the agent went on (the message being written giving way to the whole message, an
  // end giving way to the next prompt).
  const anchor = [...shown].reverse().find(isTurnBoundary)
  // An end that is no longer a row keeps an empty place in the list, where it was. The scroller
  // brings a new prompt to the top only when it finds it past the rows it already had: with the
  // end gone from the list, the prompt that follows it would sit at the end's old place, unseen.
  const passedAbove = new Map<FrameworkEvent, FrameworkEvent[]>()
  const passedLast: FrameworkEvent[] = []
  for (let at = 0, waiting: FrameworkEvent[] = []; at <= kept.length; at++) {
    const e = kept[at]
    if (e === undefined) passedLast.push(...waiting)
    else if (passed.has(e)) waiting.push(e)
    else if (waiting.length > 0) {
      passedAbove.set(e, waiting)
      waiting = []
    }
  }
  const placeOf = (e: FrameworkEvent): ReactNode => <MessageScrollerItem key={`passed-${idOf(e)}`} messageId={idOf(e)} hidden />
  const groupOf = (e: FrameworkEvent): string => (ends.has(e) ? SUBAGENT : rowGroup(e))
  const started = startedBefore(shown, subagents)
  // One badge for a run of SUBAGENT rows: a started row right under the row of a subagent's end shows none.
  const afterEnd = (at: number): boolean => at > 0 && ends.has(shown[at - 1]!)
  const startedRows = (at: number): ReactNode =>
    started.get(at)?.map((agent, n) => (
      <MessageScrollerItem key={`subagent-${agent.id}`} messageId={`subagent-${agent.id}`} className="-mx-1.5 flex items-start gap-2 rounded-sm px-1.5">
        <span className="w-28 shrink-0">{n === 0 && !afterEnd(at) && <Badge className="mt-0.5 text-[10px] uppercase text-muted-foreground">{SUBAGENT}</Badge>}</span>
        <SubagentLine agent={agent} doing={doing[agent.id]} onOpen={onOpenAgent} />
        <Tooltip>
          <TooltipTrigger render={<span className="ml-auto shrink-0 pt-0.5 text-[10px] tabular-nums text-muted-foreground" />}>{formatTime(subagentStartedAt(agent))}</TooltipTrigger>
          <TooltipContent>{new Date(subagentStartedAt(agent)).toLocaleString()}</TooltipContent>
        </Tooltip>
      </MessageScrollerItem>
    ))
  // The "Session set up" line: under the first prompt, which opens the log; above everything when
  // the log has no prompt. It breaks the run of rows like a subagent's row: the row after it
  // shows its badge.
  const setupAt = setup === undefined ? -1 : shown.length > 0 && isTurnBoundary(shown[0]!) ? 1 : 0
  const setupRow = setup !== undefined && (
    <MessageScrollerItem key="setup" messageId="setup" className="-mx-1.5 flex items-start gap-2 rounded-sm px-1.5 empty:hidden">
      <SessionLine setup={setup} />
    </MessageScrollerItem>
  )
  return (
    <MessageScrollerProvider autoScroll={stick} defaultScrollPosition={openAt ?? (stick ? 'end' : 'start')}>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport aria-label="Agent output">
          <MessageScrollerContent className="gap-1 p-4 font-mono text-xs">
            {shown.map((e, i, rows) => {
              const message = textOf(e)
              const choiceRow = choiceRows?.rows.get(e)
              const prev = i > 0 ? rows[i - 1] : undefined
              const end = ends.get(e)
              // A subagent's row above this one breaks the run of same-kind rows, so the badge shows
              // again; the row of a subagent's end goes on that run of SUBAGENT rows instead.
              const chunkHead = !prev || (started.has(i) ? !end : groupOf(prev) !== groupOf(e))
              const at = e.at
              // The user's own message: a prompt that is not a subagent's end.
              const own = isTurnBoundary(e) && !end
              return (
                <Fragment key={idOf(e)}>
                {passedAbove.get(e)?.map(placeOf)}
                {i === setupAt && setupRow}
                {startedRows(i)}
                {/* Every row carries the same -mx/px pair so a washed row's band and a plain row's
                    text share the exact same columns; only the background differs. */}
                <MessageScrollerItem messageId={idOf(e)} scrollAnchor={e === anchor} className={`-mx-1.5 flex items-start gap-2 rounded-sm px-1.5 ${end ? '' : rowWash(e)}`}>
                  {/* Fixed-width badge column so the text lines up whether or not this row repeats the badge. Wide enough for the longest common label ("choice resolved") to sit on one line. The user's own message has none: its box takes the row. */}
                  {!own && (
                    <span className="w-28 shrink-0">
                      {chunkHead && (
                        <Badge className={`mt-0.5 text-[10px] uppercase ${(end ? '' : badgeTone(e)) || 'text-muted-foreground'}`}>{end ? SUBAGENT : eventKindLabel(e.kind)}</Badge>
                      )}
                    </span>
                  )}
                  {own && message !== null ? (
                    <Prompt text={message} at={at} />
                  ) : end ? (
                    // A subagent ended: which one and how, then what the run was told about it.
                    <div className="flex min-w-0 flex-1 flex-col">
                      <SubagentLine agent={end.agent} end={end} onOpen={onOpenAgent} />
                      {end.rest && <Message text={end.rest} />}
                    </div>
                  ) : message !== null ? (
                    // A reply (AGENT), shown whole.
                    <Reply text={message} />
                  ) : steps.has(e) ? (
                    <ToolCalls steps={steps.get(e)!} />
                  ) : choiceRow && projectId ? (
                    // The interaction itself, in the flow (#1455 item 6). font-sans: these are
                    // controls, not log text, so they drop the log's mono.
                    <div className="min-w-0 flex-1 font-sans">
                      {choiceRow.render === 'open' ? (
                        <ChoicePanel
                          key={choiceRow.choice.id}
                          inline
                          projectId={projectId}
                          agentId={agentId}
                          choice={choiceRow.choice}
                          active={choiceRow.active}
                        />
                      ) : (
                        <AnsweredChoice choice={choiceRow.choice} pick={choiceRow.pick} />
                      )}
                    </div>
                  ) : e.kind === 'screen' && screenRows.live.has(e) ? (
                    <div className="min-w-0 flex-1 font-sans">
                      <InlineScreen url={e.url} label={e.label} />
                    </div>
                  ) : (
                    <span className={`min-w-0 flex-1 whitespace-pre-wrap break-words ${rowTone(e) || 'text-foreground'}`}>
                      {(formatFrameworkEvent(e) ?? '').trim()}
                    </span>
                  )}
                  {!own && chunkHead && at !== undefined && (
                    <Tooltip>
                      <TooltipTrigger
                        render={<span className="ml-auto shrink-0 pt-0.5 text-[10px] tabular-nums text-muted-foreground" />}
                      >
                        {formatTime(at)}
                      </TooltipTrigger>
                      <TooltipContent>{new Date(at).toLocaleString()}</TooltipContent>
                    </Tooltip>
                  )}
                </MessageScrollerItem>
                </Fragment>
              )
            })}
            {passedLast.map(placeOf)}
            {shown.length === setupAt && setupRow}
            {startedRows(shown.length)}
            {written && (
              <MessageScrollerItem messageId="writing" className="-mx-1.5 flex items-start gap-2 rounded-sm px-1.5">
                <span className="w-28 shrink-0">
                  {shown.length === 0 || started.has(shown.length) || groupOf(shown[shown.length - 1]!) !== 'agent' ? (
                    <Badge className="mt-0.5 text-[10px] uppercase text-muted-foreground">{eventKindLabel('driver')}</Badge>
                  ) : null}
                </span>
                <Reply text={written} />
              </MessageScrollerItem>
            )}
            {working && !written && (
              <MessageScrollerItem messageId="working" className="-mx-1.5 flex items-center gap-2 rounded-sm px-1.5">
                <span className="w-28 shrink-0" />
                <LiveLine call={current} word={starting ? 'Starting…' : 'Working…'} since={unfolded[unfolded.length - 1]?.at} />
              </MessageScrollerItem>
            )}
            {tail}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
