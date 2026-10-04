import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { callsSummary, toolCall } from '../lib/tool-calls.js'
import { cn } from '../lib/utils.js'
import { Markdown } from './Markdown.js'

/** One step of the coding agent between two messages: a tool call, or what it thought. */
export type ToolStep = { type: 'action'; label: string; detail?: string } | { type: 'thought'; text: string }

// How long ago `since` was, counted up every second: "9s", then "1m 5s".
function Seconds({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000))
  return <span className="shrink-0 tabular-nums">{seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`}</span>
}

// Three dots moving in a wave: the agent is at it.
function Dots() {
  return (
    <span className="dot-wave shrink-0" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  )
}

// One tool call: the verb in grey, what it was done to in dark, on one line. With a detail it
// opens, on a click, to the detail whole. A call still going on (`live`) reads in the present
// ("Running"), shimmers, and counts the seconds since it began when it says when that was.
function CallLine({ label, detail, live }: { label: string; detail?: string; live?: { since: string | undefined } }) {
  const [open, setOpen] = useState(false)
  const call = toolCall(label, detail)
  const words = (
    <>
      <span className={cn('shrink-0', live && 'text-shimmer')}>{live ? call.doing : call.verb}</span>
      {call.target !== undefined && <span className={cn('truncate', live ? 'text-shimmer' : 'text-foreground')}>{call.target}</span>}
      {live?.since !== undefined && <Seconds since={live.since} />}
    </>
  )
  if (call.detail === undefined) return <div className="flex min-w-0 items-center gap-1.5">{words}</div>
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={[live ? call.doing : call.verb, call.target].filter(Boolean).join(' ')}
        className="flex max-w-full min-w-0 items-center gap-1.5 text-left hover:text-foreground"
      >
        {words}
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} aria-hidden />
      </button>
      {open && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground">{call.detail}</pre>}
    </div>
  )
}

// What the agent thought between two calls: no row of the chat, one line inside an opened group.
function ThoughtLine({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-w-0">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex items-center gap-1.5 hover:text-foreground">
        <span>Thought</span>
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} aria-hidden />
      </button>
      {open && (
        <div className="mt-1 italic">
          <Markdown text={text} compact />
        </div>
      )}
    </div>
  )
}

// The last line of the chat while the agent works, in place of a spinner: the call going on now
// ("Running pnpm test 9s"), or, between calls, a word saying it is at it ("Working…"). Moving dots
// in front, the text shimmering, the seconds counting.
export function LiveLine({ call, word, since }: { call?: { label: string; detail?: string } | undefined; word: string; since?: string | undefined }) {
  return (
    <div role="status" className="flex min-w-0 flex-1 items-center gap-2 font-sans text-sm text-muted-foreground">
      <Dots />
      {call ? (
        <CallLine label={call.label} {...(call.detail !== undefined ? { detail: call.detail } : {})} live={{ since }} />
      ) : (
        <>
          <span className="text-shimmer">{word}</span>
          {since !== undefined && <Seconds since={since} />}
        </>
      )}
    </div>
  )
}

// The agent's steps between two messages, as Claude Code on the web draws them: one grey line for
// the whole run ("Ran 2 commands"), opening to a bordered box with one line per step, each opening
// further. A lone call is its own line ("Read AGENTS.md"). A run with no call in it draws nothing.
export function ToolCalls({ steps }: { steps: readonly ToolStep[] }) {
  const [open, setOpen] = useState(false)
  const calls = steps.flatMap(step => (step.type === 'action' ? [toolCall(step.label, step.detail)] : []))
  if (calls.length === 0) return null
  const only = steps.length === 1 ? steps[0] : undefined
  if (only?.type === 'action') {
    return (
      <div className="min-w-0 flex-1 font-sans text-sm text-muted-foreground">
        <CallLine label={only.label} {...(only.detail !== undefined ? { detail: only.detail } : {})} />
      </div>
    )
  }
  return (
    <div className="min-w-0 flex-1 font-sans text-sm text-muted-foreground">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex items-center gap-1.5 hover:text-foreground">
        <span>{callsSummary(calls)}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2">
          {steps.map((step, at) =>
            step.type === 'action' ? (
              <CallLine key={at} label={step.label} {...(step.detail !== undefined ? { detail: step.detail } : {})} />
            ) : (
              <ThoughtLine key={at} text={step.text} />
            ),
          )}
        </div>
      )}
    </div>
  )
}
