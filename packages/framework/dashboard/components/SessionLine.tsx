import { useState } from 'react'
import { ChevronRight, CircleCheck } from 'lucide-react'
import type { AgentMeta } from '../../src/index.js'
import { DRIVER_LABELS, driverFromImpl } from '../../src/client.js'
import { modelName, useModels } from '../lib/models.js'
import { cn } from '../lib/utils.js'
import { Dots, Seconds } from './ToolCalls.js'

/** What was set up for the agent before it read its prompt, as its card says it. */
export type SessionSetup = { [K in 'workspace' | 'branch' | 'base' | 'driver' | 'model']?: AgentMeta[K] | undefined } & {
  /** True for an agent that runs elsewhere (GitHub Actions, the cloud, another device): no checkout is made for it on this machine. */
  elsewhere?: boolean | undefined
}

// One step that was done: a green check, what was done, and what it made.
function Step({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <CircleCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
      <span className="shrink-0 text-foreground">{label}</span>
      {value !== undefined && (
        <span className="truncate" title={value}>
          {value}
        </span>
      )}
    </div>
  )
}

// The chat's first line under the prompt, as Claude Code on the web opens a session.
//
// While the session is being set up (`live`), it is one moving line naming the step going on now,
// with the seconds since the prompt: "Starting session" until the agent has a card, "Making the
// checkout" until the card names its branch or its checkout, then "Starting Claude Code" until the
// first row after the prompt. The steps are read off the card, which the runner writes as it
// goes. An agent that runs elsewhere has no checkout made here: it says "Starting session" until
// its card names a branch.
//
// Once set up, it is one grey folded line, "Session set up", opening to the steps that were done,
// a green check each: the checkout, the branch, the coding agent that was started. An agent told
// to start from a branch other than the main one says so, in a sentence: a person's local branch,
// or, for a subagent, its main agent's. A card that says none of them yet draws nothing.
export function SessionLine({ setup, live }: { setup: SessionSetup; live?: { since?: string | undefined } | undefined }) {
  const [open, setOpen] = useState(false)
  const picked = driverFromImpl(setup.driver)
  const models = useModels()
  const agent = picked ? DRIVER_LABELS[picked] : setup.driver
  const model = setup.model && modelName(picked ? models?.[picked] : undefined, setup.model)
  if (live) {
    const step = setup.branch !== undefined || setup.workspace !== undefined ? `Starting ${agent ?? 'the coding agent'}` : agent !== undefined && !setup.elsewhere ? 'Making the checkout' : 'Starting session'
    return (
      <div role="status" className="flex min-w-0 flex-1 items-center gap-2 font-sans text-sm text-muted-foreground">
        <Dots />
        <span className="text-shimmer">{step}</span>
        {live.since !== undefined && <Seconds since={live.since} />}
      </div>
    )
  }
  if (setup.workspace === undefined && setup.branch === undefined && agent === undefined) return null
  return (
    <div className="min-w-0 flex-1 font-sans text-sm text-muted-foreground">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex items-center gap-1.5 hover:text-foreground">
        <span>Session set up</span>
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} aria-hidden />
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2">
          {setup.workspace !== undefined && <Step label="Made the checkout" value={setup.workspace} />}
          {setup.branch !== undefined && <Step label="Made the branch" value={setup.branch} />}
          {setup.base !== undefined && (
            <div className="min-w-0 truncate" title={setup.base}>
              Started from the branch <span className="text-foreground">{setup.base}</span>, not from the main branch.
            </div>
          )}
          {agent !== undefined && <Step label={`Started ${agent}`} {...(model ? { value: model } : {})} />}
        </div>
      )}
    </div>
  )
}
