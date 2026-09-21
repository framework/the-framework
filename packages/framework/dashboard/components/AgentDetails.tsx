import type { FrameworkEvent } from '../../src/index.js'
import { DRIVER_LABELS, driverFromImpl, sessionInfo } from '../../src/client.js'

// The session-details strip behind the action bar's disclosure (always available now, so the
// chevron no longer pops in and out with the git/handoff data). It shows the "about this agent"
// facts the wrapped agent's own chat does not: which agent ran it, and what it has spent so far,
// added up from the run's record: one usage event per turn the coding agent priced (#322), one
// result per turn it answered. The record keeps no token counts, so none are shown. The git
// branch / PR / changes sit in the bar row right above this, so they are not repeated here.

/** What the record says the agent spent: the priced turns added up, and the turns it answered. */
function spend(events: FrameworkEvent[]): { costUsd?: number; turns: number } {
  let costUsd: number | undefined
  let turns = 0
  for (const event of events) {
    if (event.kind === 'usage') costUsd = (costUsd ?? 0) + event.costUsd
    else if (event.kind === 'driver' && event.event.type === 'result') turns++
  }
  return { ...(costUsd !== undefined ? { costUsd } : {}), turns }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </span>
  )
}

export function AgentDetails({ events }: { events: FrameworkEvent[] }) {
  const session = sessionInfo(events)
  const agent = driverFromImpl(session?.driver)
  const agentLabel = agent ? DRIVER_LABELS[agent] : (session?.driver ?? 'Agent')
  const { costUsd, turns } = spend(events)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2 text-xs">
      <Fact label="Agent" value={agentLabel} />
      {session?.model && <Fact label="Model" value={session.model} />}
      {costUsd !== undefined && <Fact label="Spent" value={`$${costUsd.toFixed(2)}`} />}
      {turns > 0 && <Fact label="Turns" value={String(turns)} />}
      {costUsd === undefined && turns === 0 && <span className="text-muted-foreground/70">No spend reported yet</span>}
    </div>
  )
}
