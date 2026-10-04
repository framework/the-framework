import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { callsSummary, toolCall } from '../lib/tool-calls.js'
import { cn } from '../lib/utils.js'
import { Markdown } from './Markdown.js'

/** One step of the coding agent between two messages: a tool call, or what it thought. */
export type ToolStep = { type: 'action'; label: string; detail?: string } | { type: 'thought'; text: string }

// One tool call: the verb in grey, what it was done to in dark, on one line. With a detail it
// opens, on a click, to the detail whole.
function CallLine({ label, detail }: { label: string; detail?: string }) {
  const [open, setOpen] = useState(false)
  const call = toolCall(label, detail)
  const words = (
    <>
      <span className="shrink-0">{call.verb}</span>
      {call.target !== undefined && <span className="truncate text-foreground">{call.target}</span>}
    </>
  )
  if (call.detail === undefined) return <div className="flex min-w-0 items-center gap-1.5">{words}</div>
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={call.target === undefined ? call.verb : `${call.verb} ${call.target}`}
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
