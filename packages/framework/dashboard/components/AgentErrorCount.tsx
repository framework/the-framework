import { TriangleAlert } from 'lucide-react'
import type { FrameworkEvent } from '../../src/index.js'
import { agentErrors } from '../../src/client.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'

// How many errors the agent reported, said in the session's header (#1500) — on the run page's
// action bar and on the project page's overview, the two places that stay put while the log
// scrolls. The errors themselves stay in the log, at the point in the run where they happened;
// this is only the count, plus the last headline so it says *what* without being opened.
export function AgentErrorCount({ events, headline = false }: { events: FrameworkEvent[]; headline?: boolean }) {
  const errors = agentErrors(events)
  if (errors.length === 0) return null
  const latest = errors[errors.length - 1]!
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          // Never shrinks: a count clipped to "1 erro" is worse than no count at all, and this row
          // fills up with the branch and its summary long before it runs out of width.
          <span role="alert" className="flex shrink-0 items-center gap-1.5 text-danger">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="font-medium">
              {errors.length} {errors.length === 1 ? 'error' : 'errors'}
            </span>
            {/* Only where the row has room for it: in a tight bar the headline is the hover. */}
            {headline && <span className="min-w-0 truncate text-muted-foreground">· {latest.headline}</span>}
          </span>
        }
      />
      {/* Every headline, so a run with several says which — the detail stays in the log. */}
      <TooltipContent className="whitespace-pre-line">{errors.map(e => e.headline).join('\n')}</TooltipContent>
    </Tooltip>
  )
}
