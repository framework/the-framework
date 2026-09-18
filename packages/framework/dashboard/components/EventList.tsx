import type { ChoiceRequest, FrameworkEvent } from '../../src/index.js'
import { formatFrameworkEvent } from '../../src/client.js'
import { useMemo, useState, type ReactNode } from 'react'
import { eventKindLabel } from '../lib/event-labels.js'
import { receivedAt } from '../lib/event-times.js'
import { pendingChoices } from '../lib/live-state.js'
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
//   - Open choice gates, when the log knows its project (#1455 item 6): an open gate renders the
//     same interactive ChoicePanel the rail used to hold, so the question is answered from the flow.
// The kind badge shows once per agent of same-group rows — a 200-line driver turn used to be 200
// identical badges (#948). A driver `start` breaks out of the AGENT group so the user's turn gets
// its own YOU badge. Live rows carry their arrival time at each group boundary; replayed events were
// never live, so they show none. Scrolling rides shadcn's Base UI message-scroller (#712): live
// follows the edge (`autoScroll`) but yields the moment the reader scrolls up, replay renders static
// from the top, and the "Jump to latest" chip is the scroller's own inert-when-not-scrollable button.

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

/** Grouping key for the once-per-agent badge: the user's prompt stands apart from the agent's work. */
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
 * its transport) erroring mid-run, and the agent settling badly. A *stopped* run is neither, since
 * the user asked for that, and neither is a run *waiting* on the question it ended on (#1774): both
 * stay neutral rather than being coloured like a fault.
 */
function isFailure(e: FrameworkEvent): boolean {
  if (e.kind === 'driver') return e.event.type === 'error'
  return e.kind === 'end' && !e.ok && !e.stopped && !e.waiting
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
 *   - your decisions (`choice`) — amber, the rows the log most wants found
 *   - the milestone (a CLEAN `end`) — green, how far the agent got; a stopped or failed end is not
 *     a milestone (failure is already red, stopped stays neutral)
 */
function badgeTone(e: FrameworkEvent): string {
  const semantic = rowTone(e)
  if (semantic) return semantic
  if (e.kind === 'choice') return 'text-warning'
  if (e.kind === 'end' && e.ok) return 'text-success'
  return ''
}

/**
 * The row's BACKGROUND wash (#1508), the layer above {@link badgeTone}'s markers: a tint across
 * the whole line, findable from the scrollbar's distance where a coloured badge word is not.
 * Only the rows the eye actually hunts for get one — the reader's own turns (the log's natural
 * chapter marks), failures, and the agent landing cleanly — and at a whisper of alpha, so the
 * text keeps the contrast and the bulk of the log stays plain canvas.
 */
function rowWash(e: FrameworkEvent): string {
  if (isFailure(e)) return 'bg-danger/10'
  if (e.kind === 'driver' && e.event.type === 'start') return 'bg-info/10'
  if (e.kind === 'end' && e.ok) return 'bg-success/10'
  return ''
}

/**
 * Hoist the agent's first prompt to the top of the log (#1170).
 *
 * It can be emitted after other events, so the one line the reader wrote themselves opened rows
 * down.
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

/**
 * A transcript entry that represents an interaction should BE the interaction (#1455 item 6): the
 * `choice` rows still open, as `pendingChoices` reads them, each with whether it is the newest one.
 *
 * Only the LAST firing of a gate id is special — `pendingChoices` replaces a re-fired gate in
 * place, so an earlier firing is history and keeps its text. A gate closed by the agent going on,
 * or by `end` without an answer (#1359: its audience is gone), stays text — a control nobody reads
 * must not look answerable.
 */
function openChoiceRows(events: FrameworkEvent[]): Map<FrameworkEvent, { choice: ChoiceRequest; active: boolean }> {
  const rows = new Map<FrameworkEvent, { choice: ChoiceRequest; active: boolean }>()
  const lastFiring = new Map<string, FrameworkEvent>()
  for (const e of events) if (e.kind === 'choice') lastFiring.set(e.id, e)
  const open = new Set(pendingChoices(events).map(c => c.id))
  let newestOpen: FrameworkEvent | undefined
  for (const [id, firing] of lastFiring) if (open.has(id)) newestOpen = firing
  for (const [id, firing] of lastFiring) {
    if (!open.has(id)) continue
    const { kind: _kind, ...choice } = firing as { kind: 'choice' } & ChoiceRequest
    rows.set(firing, { choice, active: firing === newestOpen })
  }
  return rows
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
  agentId: agentId,
}: {
  events: FrameworkEvent[]
  stick?: boolean
  /** Where a non-following log opens; a replay opens at the outcome (#948), not page one. */
  openAt?: 'start' | 'end'
  /** Pinned after the last row, inside the scroller (#1265): the log's "and then…" — a web agent's
   *  live mirror box — that must scroll (and stick) with the log rather than float over it. */
  tail?: ReactNode
  /** The log's own project (#1455 item 6): with it, an open `choice` row IS the interaction — the
   *  inline ChoicePanel. Without it, every row keeps the formatter's text. */
  projectId?: string | undefined
  /** Which run an inline pick resolves (#749), forwarded to the panel with projectId. */
  agentId?: string | null | undefined
}) {
  const choiceRows = useMemo(() => (projectId ? openChoiceRows(events) : undefined), [projectId, events])
  const shown = promptFirst(events)
  return (
    <MessageScrollerProvider autoScroll={stick} defaultScrollPosition={openAt ?? (stick ? 'end' : 'start')}>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport aria-label="Agent output">
          <MessageScrollerContent className="gap-1 p-4 font-mono text-xs">
            {shown.map((e, i, rows) => {
              const message = messageText(e)
              const choiceRow = choiceRows?.get(e)
              const prev = i > 0 ? rows[i - 1] : undefined
              const chunkHead = !prev || rowGroup(prev) !== rowGroup(e)
              const at = receivedAt(e)
              return (
                // Every row carries the same -mx/px pair so a washed row's band and a plain row's
                // text share the exact same columns; only the background differs.
                <MessageScrollerItem key={i} messageId={String(i)} scrollAnchor={isTurnBoundary(e)} className={`-mx-1.5 flex items-start gap-2 rounded-sm px-1.5 ${rowWash(e)}`}>
                  {/* Fixed-width badge column so the text lines up whether or not this row repeats the badge. */}
                  <span className="w-28 shrink-0">
                    {chunkHead && (
                      <Badge className={`mt-0.5 text-[10px] uppercase ${badgeTone(e) || 'text-muted-foreground'}`}>{rowLabel(e)}</Badge>
                    )}
                  </span>
                  {message !== null ? (
                    // A prompt (YOU) or a reply (AGENT): compact Markdown, collapsed to its first line when long.
                    <Message text={message} />
                  ) : choiceRow && projectId ? (
                    // The interaction itself, in the flow (#1455 item 6). font-sans: these are
                    // controls, not log text, so they drop the log's mono.
                    <div className="min-w-0 flex-1 font-sans">
                      <ChoicePanel
                        key={choiceRow.choice.id}
                        inline
                        projectId={projectId}
                        agentId={agentId}
                        choice={choiceRow.choice}
                        active={choiceRow.active}
                      />
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
