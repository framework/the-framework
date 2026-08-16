import { useEffect, useState } from 'react'
import { Check, Cloud, ExternalLink, Loader2, MessageCircleQuestion, TriangleAlert } from 'lucide-react'
import type { BridgeAnswer, BridgeEvent, BridgeQuestion, FrameworkEvent } from '../../dist/index.js'
import { onBridgeQuestion, onBridgeEvents, onBridgeAnswer } from '../rpc/reads.js'
import { sendBridgeAnswer, sendBridgeAnswerCancel } from '../rpc/control.js'
import { cloudSession } from '../lib/live-state.js'
import { CopyButton } from './ui/copy-button.js'

/** How often to ask the daemon whether the bridge reported a question. */
const POLL_MS = 4000

// The agent view's affordance for a Claude web target (#610). This target is a hand-off, not a
// streamed run: the session runs on Anthropic's infrastructure, does its own worktree and opens
// its own PR, and there is no read-back API we can use to follow it with, so the honest thing to
// show is where the work went and how to reach it rather than an empty feed that looks stalled.
// Renders nothing for any other target, so the agent view can mount it unconditionally.
export function CloudAgentNotice({
  target,
  events,
}: {
  target?: 'local' | 'actions' | 'remote' | 'web' | undefined
  events: readonly FrameworkEvent[]
}) {
  const session = target === 'web' ? cloudSession(events) : undefined
  const question = useBridgeQuestion(session?.id)
  const answer = useBridgeAnswer(session?.id)
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
      {question && session && (!answer || answer.state === 'failed') && (
        <ParkedQuestion question={question} url={session.url} sessionId={session.id} failure={answer?.state === 'failed' ? answer : undefined} />
      )}
      {answer && session && answer.state !== 'failed' && <AnswerState answer={answer} url={session.url} sessionId={session.id} />}
    </div>
  )
}

/**
 * The question the session is parked on, once the browser bridge has reported one (#1237).
 *
 * Answering is a two-step pick-then-send, unlike the one-click gates of a local agent: the send
 * has the extension type into the user's own claude.ai session, so the pick is confirmed
 * explicitly, and while it waits for delivery it can still be withdrawn. The link out stays as
 * the manual path for whoever prefers to answer over there.
 */
function ParkedQuestion({
  question,
  url,
  sessionId,
  failure,
}: {
  question: BridgeQuestion
  url: string
  sessionId: string
  failure?: BridgeAnswer | undefined
}) {
  const [picked, setPicked] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const send = () => {
    if (!picked) return
    void sendBridgeAnswer(sessionId, picked)
      .then(result => {
        if (!result.ok) setError(result.error ?? 'could not queue the answer')
      })
      .catch(() => setError('could not reach the daemon'))
  }
  return (
    <div className="flex gap-2 border-t border-border px-4 py-2.5 text-xs">
      <MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{question.title}</p>
        <div className="mt-1.5 flex flex-col items-start gap-1">
          {question.options.map(option => (
            <button
              key={option.label}
              type="button"
              onClick={() => setPicked(option.label)}
              aria-pressed={picked === option.label}
              className={`rounded border px-2 py-1 text-left transition-colors ${
                picked === option.label
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {option.label}
              {option.label === question.recommended && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wide text-primary">recommended</span>
              )}
              {option.detail && <span className="ml-1.5 opacity-70">{option.detail}</span>}
            </button>
          ))}
        </div>
        {failure && (
          <p className="mt-1.5 flex items-center gap-1 text-destructive">
            <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
            Sending “{failure.label}” failed{failure.note ? `: ${failure.note}` : ''}. Pick again, or answer in the session.
          </p>
        )}
        {error && <p className="mt-1.5 text-destructive">{error}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={send}
            disabled={!picked}
            className="rounded bg-primary px-2.5 py-1 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {picked ? `Send “${picked}”` : 'Pick an answer'}
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            Answer it in the session
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      </div>
    </div>
  )
}

/**
 * Where a sent answer stands (#1237). Queued means the extension has not collected it yet,
 * which is the window where withdrawing it still means something; sent means it was typed
 * into the session and submitted.
 */
function AnswerState({ answer, url, sessionId }: { answer: BridgeAnswer; url: string; sessionId: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
      {answer.state === 'queued' ? (
        <>
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            Sending “{answer.label}” through your Claude web tab… It goes out the next time the extension checks in.
          </span>
          <button
            type="button"
            onClick={() => void sendBridgeAnswerCancel(sessionId).catch(() => {})}
            className="shrink-0 rounded border border-border px-2 py-1 hover:border-primary/50 hover:text-foreground"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            Answered “{answer.label}”. The session continues over there and its transcript above follows along.
          </span>
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline">
            Open the session
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </>
      )}
    </div>
  )
}

/**
 * Lines of claude.ai UI chrome the tail scrape drags in (#1265). The mirror is `main`'s rendered
 * text, so tile-focus hints, per-message action affordances and the bare model name ride along
 * with the conversation. Matched per line, anchored, so a message that merely mentions a model
 * is untouched.
 */
const MIRROR_CHROME = [
  /^Arrow keys move the tile/i,
  /^Show message actions$/i,
  /^(Claude\s+)?(Fable|Opus|Sonnet|Haiku)(\s+\d[\d.]*)?$/i,
]

/** Drop the scraped-in UI chrome from a mirror block, collapsing the holes it leaves. */
export function scrubMirrorText(text: string): string {
  return text
    .split('\n')
    .filter(line => !MIRROR_CHROME.some(chrome => chrome.test(line.trim())))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * The one live boxed row at the tail of a web agent's log (#1265): the log itself dead-ends at
 * "Handed off: …", and this is what happens after — the bridge mirror streaming in place, with a
 * connecting placeholder so a web agent never shows dead air.
 *
 * Deliberately a single clearly-labelled box rather than ordinary log rows: `events.jsonl` is
 * durable provenance-clean data, the mirror is a best-effort tab scrape read through a browser
 * extension — no tool calls, no timings, nothing at all when the tab is closed — and one visible
 * boundary keeps the two from being confused. Renders nothing for any other target (or before the
 * hand-off names a session), so the feed can mount it unconditionally.
 */
export function CloudMirrorRow({
  target,
  events,
}: {
  target?: 'local' | 'actions' | 'remote' | 'web' | undefined
  events: readonly FrameworkEvent[]
}) {
  const session = target === 'web' ? cloudSession(events) : undefined
  const transcript = useBridgeEvents(session?.id)
  if (target !== 'web' || !session) return null
  const blocks = transcript.map(event => scrubMirrorText(event.text)).filter(Boolean)
  return (
    <div role="status" aria-label="Cloud session mirror" className="mt-2 rounded-md border border-border bg-muted/40 font-sans">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        <Cloud className="h-3 w-3 shrink-0 text-primary" aria-hidden />
        <span className="font-medium uppercase tracking-wide">Cloud session mirror</span>
        <span className="opacity-70">a best-effort view of the Claude tab, not the run's own log</span>
      </div>
      {blocks.length > 0 ? (
        <div className="max-h-80 space-y-2 overflow-y-auto px-3 py-2 text-xs">
          {blocks.map((text, i) => (
            <div key={i} className="whitespace-pre-wrap break-words text-muted-foreground">
              {text}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden />
          Connecting to the cloud session…
        </div>
      )}
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

/** Poll the daemon for where this session's answer stands, on the question's cadence. */
function useBridgeAnswer(sessionId: string | undefined): BridgeAnswer | undefined {
  const [answer, setAnswer] = useState<BridgeAnswer | undefined>(undefined)
  useEffect(() => {
    if (!sessionId) {
      setAnswer(undefined)
      return
    }
    let live = true
    const read = () => {
      void onBridgeAnswer(sessionId)
        .then(next => {
          if (live) setAnswer(next ?? undefined)
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
  return answer
}

/**
 * Poll the daemon for this session's parked question. Polled rather than streamed because the
 * bridge writes over HTTP from a browser extension and never touches the agent's event log, so
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
