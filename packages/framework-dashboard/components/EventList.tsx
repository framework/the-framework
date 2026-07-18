import { useEffect, useRef, useState } from 'react'
import type { FrameworkEvent } from '@gemstack/framework'
import { formatFrameworkEvent } from '@gemstack/framework/client'
import { Badge } from './ui/badge.js'

// Presentational event log, shared by the live stream and past-run replay. Each
// FrameworkEvent is a kind badge + its human-readable line (the same formatter the
// terminal uses, so a `driver` turn reads "· Read" / "‹ turn complete" rather than raw
// JSON); the pane sticks to the bottom as events arrive (live), replay renders at once.
// The prompt-disclosure surface (#476/#520): the full text rides on the event, but the
// one-line formatter reduces it to a char count (a driver `start`'s prompt) or drops it (a
// system prompt). So the "see every prompt without a script" block renders it here; every
// other event renders as its formatted line. Returns null for the non-disclosable events.
function disclosableText(e: FrameworkEvent): { text: string; label: string } | null {
  if (e.kind === 'system-prompt') return { text: e.text, label: 'system prompt sent' }
  if (e.kind === 'driver' && e.event.type === 'start') return { text: e.event.prompt, label: '› prompt sent' }
  return null
}

export function EventList({ events, stick = true }: { events: FrameworkEvent[]; stick?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Stick to the bottom only while the reader is already there (#695/U19): scrolling up to read
  // an earlier line must not get yanked back down by the next event. `atBottom` tracks that, and
  // a "Jump to latest" chip appears while it's false so the bottom is one click away.
  const [atBottom, setAtBottom] = useState(true)

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48)
  }

  useEffect(() => {
    if (stick && atBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length, stick, atBottom])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-4">
        <ol className="space-y-1 font-mono text-xs">
          {events.map((e, i) => {
            const disclosable = disclosableText(e)
            return (
              <li key={i} className="flex items-start gap-2">
                <Badge className="mt-0.5 shrink-0 text-[10px] uppercase text-muted-foreground">{e.kind}</Badge>
                {disclosable ? (
                  <details className="min-w-0 flex-1">
                    <summary className="cursor-pointer text-foreground marker:text-muted-foreground">
                      {disclosable.label} ({disclosable.text.length.toLocaleString()} chars) — click to expand
                    </summary>
                    <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-foreground">{disclosable.text}</pre>
                  </details>
                ) : (
                  <span className="whitespace-pre-wrap break-words text-foreground">{(formatFrameworkEvent(e) ?? '').trim()}</span>
                )}
              </li>
            )
          })}
        </ol>
        <div ref={bottomRef} />
      </div>
      {stick && !atBottom && (
        <button
          type="button"
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            setAtBottom(true)
          }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background/90 px-3 py-1 text-xs text-foreground shadow-sm backdrop-blur hover:bg-accent"
        >
          Jump to latest ↓
        </button>
      )}
    </div>
  )
}
