import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { AgentMeta } from '../../src/index.js'
import { DRIVER_LABELS, driverFromImpl } from '../../src/client.js'
import { modelName, useModels } from '../lib/models.js'
import { cn } from '../lib/utils.js'

/** What was set up for the agent before it read its prompt, as its card says it. */
export type SessionSetup = { [K in 'workspace' | 'branch' | 'driver' | 'model']?: AgentMeta[K] | undefined }

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0">{label}</span>
      <span className="truncate text-foreground" title={value}>
        {value}
      </span>
    </div>
  )
}

// The chat's first line under the prompt, as Claude Code on the web opens a session: one grey
// folded line, "Session set up", opening to what was made for the agent before it began: its
// checkout, its branch, the coding agent that was started. A card that says none of them yet
// draws nothing.
export function SessionLine({ setup }: { setup: SessionSetup }) {
  const [open, setOpen] = useState(false)
  const picked = driverFromImpl(setup.driver)
  const models = useModels()
  const agent = picked ? DRIVER_LABELS[picked] : setup.driver
  const model = setup.model && modelName(picked ? models?.[picked] : undefined, setup.model)
  if (setup.workspace === undefined && setup.branch === undefined && agent === undefined) return null
  return (
    <div className="min-w-0 flex-1 font-sans text-sm text-muted-foreground">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex items-center gap-1.5 hover:text-foreground">
        <span>Session set up</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2">
          {setup.workspace !== undefined && <Fact label="Checkout made" value={setup.workspace} />}
          {setup.branch !== undefined && <Fact label="Branch" value={setup.branch} />}
          {agent !== undefined && <Fact label="Coding agent started" value={model ? `${agent} · ${model}` : agent} />}
        </div>
      )}
    </div>
  )
}
