import type { ChoiceRequest, FrameworkEvent } from '@gemstack/the-framework'
import { formatFrameworkEvent } from '@gemstack/the-framework/client'
import { useMemo, useState, type ReactNode } from 'react'
import { eventKindLabel } from '../lib/event-labels.js'
import { receivedAt } from '../lib/event-times.js'
import { pendingChoices } from '../lib/live-state.js'
import { AnsweredChoice } from './AnsweredChoice.js'
import { ChoicePanel } from './ChoicePanel.js'
import { Markdown } from './Markdown.js'
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
// "· Read" / "‹ turn complete" rather than raw JSON). Two things get special rows:
//   - The message text: the user's prompt (`driver` `start`) and the agent's reply (`driver` `text`)
//     render their raw text inline, truncated to one line when long and expanding in place on click
//     (#476/#520). The prompt carries its own YOU badge so the log reads like a conversation.
//   - The system prompt keeps a char-count summary with the full text behind a click.
//   - Choice gates, when the log knows its project (#1455 item 6): an open gate renders the same
//     interactive ChoicePanel the rail used to hold, so the question is answered from the flow;
//     a resolved one collapses to the AnsweredChoice ✓ card and hides its "✓ chose" line.
// The kind badge shows once per run of same-group rows — a 200-line driver turn used to be 200
// identical badges (#948). A driver `start` breaks out of the AGENT group so the user's turn gets
// its own YOU badge. Live rows carry their arrival time at each group boundary; replayed events were
// never live, so they show none. Scrolling rides shadcn's Base UI message-scroller (#712): live
// follows the edge (`autoScroll`) but yields the moment the reader scrolls up, replay renders static
// from the top, and the "Jump to latest" chip is the scroller's own inert-when-not-scrollable button.

/** The system prompt: a char-count summary with the full text behind a click. */
function disclosableText(e: FrameworkEvent): { text: string; label: string } | null {
  if (e.kind === 'system-prompt') return { text: e.text, label: 'system prompt sent' }
  return null
}

// The conversation text — the user's prompt (YOU) and the agent's reply (AGENT). Both are rendered
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

/** Grouping key for the once-per-run badge: the user's prompt stands apart from the agent's work. */
function rowGroup(e: FrameworkEvent): string {
  if (e.kind === 'driver') return e.event.type === 'start' ? 'you' : 'agent'
  return e.kind
}

/** The badge word for a row: the user's prompt reads YOU, everything else its kind label. */
function rowLabel(e: FrameworkEvent): string {
  if (e.kind === 'driver' && e.event.type === 'start') return 'you'
  return eventKindLabel(e.kind)
}

// A driver `start` opens a fresh prompt turn — the natural anchor the scroller keeps in view.
function isTurnBoundary(e: FrameworkEvent): boolean {
  return e.kind === 'driver' && e.event.type === 'start'
}

/**
 * Whether a row reports a failure, which reads in red (#1199). Two shapes say it: the agent (or
 * its transport) erroring mid-run, and the run settling badly. A *stopped* run is neither, since
 * the user asked for that, so it stays neutral rather than being coloured like a fault.
 */
function isFailure(e: FrameworkEvent): boolean {
  if (e.kind === 'driver') return e.event.type === 'error'
  return e.kind === 'end' && !e.ok && !e.stopped
}

/**
 * The row's colour. The user's own turn is blue so it stands out from the agent's work (#1170), a
 * failure is red (#1199), and everything else keeps the muted log tone.
 */
function rowTone(e: FrameworkEvent): string {
  if (isFailure(e)) return 'text-danger'
  if (e.kind === 'driver' && e.event.type === 'start') return 'text-info'
  return ''
}

/**
 * The BADGE's colour: a navigation aid for scanning the log by kind (#1455 follow-up), on top of
 * {@link rowTone}'s semantics (failure red, the reader's own turn blue — those win). Only the
 * high-signal kinds get a colour; the bulk of the log stays muted, or every row shouting means
 * none do. The body keeps rowTone: colour the *marker*, not the text.
 *
 *   - your decisions (`choice`/`choice-resolved`) — amber, the rows the log most wants found
 *   - milestones (a CLEAN `end`, `ready-for-merge`) — green, how far the run got; a stopped or
 *     failed end is not a milestone (failure is already red, stopped stays neutral), and
 *     `handoff` stays muted because its body reports per-rung outcomes that may be mixed
 *   - pushed surfaces (`view`, `browser-stream`, `preview`) — primary, the agent showing you something
 */
function badgeTone(e: FrameworkEvent): string {
  const semantic = rowTone(e)
  if (semantic) return semantic
  if (e.kind === 'choice' || e.kind === 'choice-resolved') return 'text-warning'
  if ((e.kind === 'end' && e.ok) || e.kind === 'ready-for-merge') return 'text-success'
  if (e.kind === 'view' || e.kind === 'browser-stream' || e.kind === 'preview') return 'text-primary'
  return ''
}

/**
 * Hoist the run's first prompt to the top of the log (#1170).
 *
 * It is emitted after the `session` and `system-prompt` events, so the one line the reader wrote
 * themselves opened three rows down, under a char-count summary of a prompt they did not write.
 * Only the *first* prompt moves: a later turn is part of the conversation and belongs where it
 * happened. The rows it jumps keep their order, so the log reads as "what I asked, then
 * everything that followed".
 */
function promptFirst(events: FrameworkEvent[]): FrameworkEvent[] {
  const at = events.findIndex(isTurnBoundary)
  if (at <= 0) return events
  return [events[at]!, ...events.slice(0, at), ...events.slice(at + 1)]
}

/** HH:MM:SS in the reader's locale, for the arrival-time column. */
function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString()
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

// A conversation message (a prompt or a reply), rendered as compact Markdown. A short one renders
// as-is. A long one clamps to its first line with a chevron beside it and expands in place on click —
// the chevron stays on that first line (never a lone chevron on its own row), and the same rendered
// Markdown just unclamps, so the opening is never shown twice.
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
        onClick={() => setOpen(o => !o)}
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

export function EventList({
  events,
  stick = true,
  openAt,
  tail,
  projectId,
  runId,
}: {
  events: FrameworkEvent[]
  stick?: boolean
  /** Where a non-following log opens; a replay opens at the outcome (#948), not page one. */
  openAt?: 'start' | 'end'
  /** Pinned after the last row, inside the scroller (#1265): the log's "and then…" — a web run's
   *  live mirror box — that must scroll (and stick) with the log rather than float over it. */
  tail?: ReactNode
  /** The log's own project (#1455 item 6): with it, a `choice` row IS the interaction — an open
   *  gate renders the inline ChoicePanel, a resolved one the collapsed ✓ card. Absent (the
   *  read-only relay watch), every row keeps the formatter's text. */
  projectId?: string | undefined
  /** Which run an inline pick resolves (#749), forwarded to the panel with projectId. */
  runId?: string | null | undefined
}) {
  const choiceRows = useMemo(() => (projectId ? foldChoiceRows(events) : undefined), [projectId, events])
  const shown = choiceRows ? promptFirst(events).filter(e => !choiceRows.hidden.has(e)) : promptFirst(events)
  return (
    <MessageScrollerProvider autoScroll={stick} defaultScrollPosition={openAt ?? (stick ? 'end' : 'start')}>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport aria-label="Session output">
          <MessageScrollerContent className="gap-1 p-4 font-mono text-xs">
            {shown.map((e, i, rows) => {
              const disclosable = disclosableText(e)
              const message = messageText(e)
              const choiceRow = choiceRows?.rows.get(e)
              const prev = i > 0 ? rows[i - 1] : undefined
              const chunkHead = !prev || rowGroup(prev) !== rowGroup(e)
              const at = receivedAt(e)
              return (
                <MessageScrollerItem key={i} messageId={String(i)} scrollAnchor={isTurnBoundary(e)} className="flex items-start gap-2">
                  {/* Fixed-width badge column so the text lines up whether or not this row repeats the badge. Wide enough for the longest common label ("system prompt") to sit on one line. */}
                  <span className="w-28 shrink-0">
                    {chunkHead && (
                      <Badge className={`mt-0.5 text-[10px] uppercase ${badgeTone(e) || 'text-muted-foreground'}`}>{rowLabel(e)}</Badge>
                    )}
                  </span>
                  {disclosable ? (
                    <details className="min-w-0 flex-1">
                      <summary className="cursor-pointer text-foreground marker:text-muted-foreground">
                        {disclosable.label} ({disclosable.text.length.toLocaleString()} chars)
                      </summary>
                      <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-foreground">{disclosable.text}</pre>
                    </details>
                  ) : message !== null ? (
                    // A prompt (YOU) or a reply (AGENT): compact Markdown, collapsed to its first line when long.
                    <Message text={message} />
                  ) : choiceRow && projectId ? (
                    // The interaction itself, in the flow (#1455 item 6). font-sans: these are
                    // controls, not log text, so they drop the log's mono.
                    <div className="min-w-0 flex-1 font-sans">
                      {choiceRow.render === 'open' ? (
                        <ChoicePanel
                          key={choiceRow.choice.id}
                          inline
                          projectId={projectId}
                          runId={runId}
                          choice={choiceRow.choice}
                          active={choiceRow.active}
                        />
                      ) : (
                        <AnsweredChoice choice={choiceRow.choice} pick={choiceRow.pick} />
                      )}
                    </div>
                  ) : (
                    <span className={`min-w-0 flex-1 whitespace-pre-wrap break-words ${rowTone(e) || 'text-foreground'}`}>
                      {(formatFrameworkEvent(e) ?? '').trim()}
                    </span>
                  )}
                  {chunkHead && at !== undefined && (
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
              )
            })}
            {tail}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
