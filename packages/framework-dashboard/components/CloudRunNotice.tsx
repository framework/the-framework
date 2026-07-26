import { useEffect, useState } from 'react'
import { Cloud, ExternalLink, MessageCircleQuestion } from 'lucide-react'
import type { BridgeEvent, BridgeQuestion, FrameworkEvent } from '@gemstack/the-framework'
import { onBridgeQuestion, onBridgeEvents } from '../server/reads.telefunc.js'
import { cloudSession } from '../lib/live-state.js'
import { CopyButton } from './ui/copy-button.js'

/** How often to ask the daemon whether the bridge reported a question. */
const POLL_MS = 4000

// The run view's affordance for a Claude web target (#610). This target is a hand-off, not a
// streamed run: the session runs on Anthropic's infrastructure, does its own worktree and opens
// its own PR, and there is no read-back API we can use to follow it with, so the honest thing to
// show is where the work went and how to reach it rather than an empty feed that looks stalled.
// Renders nothing for any other target, so the run view can mount it unconditionally.
export function CloudRunNotice({
  target,
  events,
}: {
  target?: 'local' | 'actions' | 'remote' | 'web' | undefined
  events: readonly FrameworkEvent[]
}) {
  const session = target === 'web' ? cloudSession(events) : undefined
  const question = useBridgeQuestion(session?.id)
  const transcript = useBridgeEvents(session?.id)
  if (target !== 'web') return null
  return (
    <div className="border-b border-border bg-muted/40">
      <div role="status" className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
        <Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          {session
            ? 'Running as a Claude Code cloud session. It asks its questions and opens its own pull request over there, not here.'
            : 'Starting a Claude Code cloud session…'}
        </span>
        {session && (
          <>
            <span className="inline-flex shrink-0 items-center gap-1">
              <code className="rounded bg-muted px-1 py-0.5">claude --teleport {session.id}</code>
              <CopyButton text={`claude --teleport ${session.id}`} label="Copy the command that continues this session here" />
            </span>
            <a
              href={session.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
            >
              Open the session
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </>
        )}
      </div>
      {transcript.length > 0 && <CloudTranscript events={transcript} />}
      {question && session && <ParkedQuestion question={question} url={session.url} />}
    </div>
  )
}

/**
 * The question the session is parked on, once the browser bridge has reported one (#1237).
 *
 * Read only in this slice, and the copy says so rather than offering buttons that do nothing:
 * showing the question is the whole win here, and the pick travelling back is a separate
 * decision. So the options are listed as text and the link is the way to answer.
 */
function ParkedQuestion({ question, url }: { question: BridgeQuestion; url: string }) {
  return (
    <div className="flex gap-2 border-t border-border px-4 py-2.5 text-xs">
      <MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{question.title}</p>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {question.options.map(option => (
            <li key={option.label}>
              <span className={option.label === question.recommended ? 'text-foreground' : undefined}>{option.label}</span>
              {option.label === question.recommended && <span className="ml-1 text-[10px] uppercase tracking-wide text-primary">recommended</span>}
              {option.detail && <span className="ml-1 opacity-70">{option.detail}</span>}
            </li>
          ))}
        </ul>
        <a href={url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-primary hover:underline">
          Answer it in the session
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>
    </div>
  )
}

/**
 * What the cloud session has said, as the bridge scraped it.
 *
 * Deliberately not styled as our own live feed. It is a mirror of another product's page, read
 * through a browser extension, and presenting it as a first-class run log would overstate how
 * much we actually know: there are no tool calls, no timings, and nothing arrives at all when
 * the tab is closed.
 */
function CloudTranscript({ events }: { events: readonly BridgeEvent[] }) {
  return (
    <div className="max-h-80 space-y-2 overflow-y-auto border-t border-border px-4 py-2.5 text-xs">
      {events.map(event => (
        <div key={event.seq} className="whitespace-pre-wrap break-words text-muted-foreground">
          {event.text}
        </div>
      ))}
    </div>
  )
}

/** Poll the daemon for this session's transcript, on the same cadence as the question. */
function useBridgeEvents(sessionId: string | undefined): BridgeEvent[] {
  const [events, setEvents] = useState<BridgeEvent[]>([])
  useEffect(() => {
    if (!sessionId) {
      setEvents([])
      return
    }
    let live = true
    const read = () => {
      void onBridgeEvents(sessionId)
        .then(next => {
          if (live) setEvents(next)
        })
        .catch(() => {})
    }
    read()
    const timer = setInterval(read, POLL_MS)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [sessionId])
  return events
}

/**
 * Poll the daemon for this session's parked question. Polled rather than streamed because the
 * bridge writes over HTTP from a browser extension and never touches the run's event log, so
 * there is no event for the live channel to carry.
 */
function useBridgeQuestion(sessionId: string | undefined): BridgeQuestion | undefined {
  const [question, setQuestion] = useState<BridgeQuestion | undefined>(undefined)
  useEffect(() => {
    if (!sessionId) {
      setQuestion(undefined)
      return
    }
    let live = true
    const read = () => {
      void onBridgeQuestion(sessionId)
        .then(next => {
          if (live) setQuestion(next ?? undefined)
        })
        // A daemon with the bridge off answers null; a transport failure is not worth a banner.
        .catch(() => {})
    }
    read()
    const timer = setInterval(read, POLL_MS)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [sessionId])
  return question
}
