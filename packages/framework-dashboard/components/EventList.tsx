import type { FrameworkEvent } from '@gemstack/the-framework'
import { formatFrameworkEvent } from '@gemstack/the-framework/client'
import { useState } from 'react'
import { eventKindLabel } from '../lib/event-labels.js'
import { receivedAt } from '../lib/event-times.js'
import { Markdown } from './Markdown.js'
import { Badge } from './ui/badge.js'
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

/** HH:MM:SS in the reader's locale, for the arrival-time column. */
function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString()
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
}: {
  events: FrameworkEvent[]
  stick?: boolean
  /** Where a non-following log opens; a replay opens at the outcome (#948), not page one. */
  openAt?: 'start' | 'end'
}) {
  return (
    <MessageScrollerProvider autoScroll={stick} defaultScrollPosition={openAt ?? (stick ? 'end' : 'start')}>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport aria-label="Session output">
          <MessageScrollerContent className="gap-1 p-4 font-mono text-xs">
            {events.map((e, i) => {
              const disclosable = disclosableText(e)
              const message = messageText(e)
              const prev = i > 0 ? events[i - 1] : undefined
              const chunkHead = !prev || rowGroup(prev) !== rowGroup(e)
              const at = receivedAt(e)
              return (
                <MessageScrollerItem key={i} messageId={String(i)} scrollAnchor={isTurnBoundary(e)} className="flex items-start gap-2">
                  {/* Fixed-width badge column so the text lines up whether or not this row repeats the badge. Wide enough for the longest common label ("system prompt") to sit on one line. */}
                  <span className="w-28 shrink-0">
                    {chunkHead && <Badge className="mt-0.5 text-[10px] uppercase text-muted-foreground">{rowLabel(e)}</Badge>}
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
                  ) : (
                    <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-foreground">{(formatFrameworkEvent(e) ?? '').trim()}</span>
                  )}
                  {chunkHead && at !== undefined && (
                    <span className="ml-auto shrink-0 pt-0.5 text-[10px] tabular-nums text-muted-foreground" title={new Date(at).toLocaleString()}>
                      {formatTime(at)}
                    </span>
                  )}
                </MessageScrollerItem>
              )
            })}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
