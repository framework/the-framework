import { useState } from 'react'
import type { AgentMeta } from '../../src/index.js'
import { cn } from '../lib/utils.js'
import { formatDuration } from '../lib/format-date.js'
import { STATUS_TONE } from '../lib/status-tone.js'
import { taskLabel } from '../lib/subagents.js'
import { DisclosureToggle } from './DisclosureToggle.js'

// One subagent on its main agent's page, on one line: its task, which opens the subagent, then
// how it stands. Drawn from the subagent's card each time the runs are read, so the line of a
// working subagent changes in place: what it is doing now while it works, how long it took once
// it has ended. Given an `end`, the line is the moment the subagent ended instead, as the main
// agent was told it: it says `ended <status>` and never changes.
export function SubagentLine({
  agent,
  doing,
  end,
  onOpen,
}: {
  agent: AgentMeta
  /** What the subagent is doing now, while it works. */
  doing?: string | undefined
  /** How the subagent ended, when the line is its end rather than its state now. */
  end?: { status: string; detail?: string } | undefined
  /** Open the subagent's own page. */
  onOpen?: ((agentId: string) => void) | undefined
}) {
  const status = end?.status ?? agent.status
  const working = !end && agent.status === 'running'
  const took = !end && agent.endedAt !== undefined ? formatDuration(Date.parse(agent.endedAt) - Date.parse(agent.startedAt)) : undefined
  const tail = end ? end.detail : working ? doing : took
  return (
    <span className="flex min-w-0 flex-1 items-baseline gap-2">
      <button
        type="button"
        onClick={() => onOpen?.(agent.id)}
        // A long task keeps to half the line, so how the subagent stands is never pushed off it.
        className="min-w-0 max-w-[55%] shrink truncate text-left text-foreground hover:underline"
        aria-label={`Open the subagent: ${taskLabel(agent)}`}
      >
        ↳ {taskLabel(agent)}
      </button>
      <span className={cn('flex shrink-0 items-center gap-1.5', status === 'waiting' ? 'text-muted-foreground' : (STATUS_TONE[status] ?? 'text-muted-foreground'))}>
        {working && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />}
        {end ? `ended ${status}` : status}
      </span>
      {tail && <span className="min-w-0 flex-1 truncate text-muted-foreground">{tail}</span>}
    </span>
  )
}

// The line above the message box while any of the run's subagents is working: how many of them
// are, so it is known once their rows have scrolled out of view. Opened, it lists every subagent
// as its row in the chat does. Gone once none is working: the rows in the chat stay.
export function SubagentsBar({
  subagents,
  doing,
  onOpen,
}: {
  subagents: readonly AgentMeta[]
  doing: Record<string, string>
  onOpen?: ((agentId: string) => void) | undefined
}) {
  const [open, setOpen] = useState(false)
  const working = subagents.filter(agent => agent.status === 'running').length
  if (working === 0) return null
  return (
    <div className="border-t border-border px-4 py-1.5">
      <DisclosureToggle open={open} onToggle={() => setOpen(o => !o)}>
        Subagents · {working} of {subagents.length} running
      </DisclosureToggle>
      {open && (
        <div className="mt-1 flex flex-col gap-0.5 pl-4 font-mono text-xs">
          {subagents.map(agent => (
            <SubagentLine key={agent.id} agent={agent} doing={doing[agent.id]} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}
