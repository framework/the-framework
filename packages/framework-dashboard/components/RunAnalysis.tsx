import type { RunAnalysis as Analysis } from '@gemstack/the-framework'
import { onRunAnalysis } from '../server/reads.telefunc.js'
import { usePolled } from '../lib/use-async.js'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.js'

// The prompt analysis the agent wrote at its worktree root (#1180): the framework's first visible
// "thinking" about a request — how big it judged the work, how settled the approach, whether a
// plan or new tickets came out of it. Surfacing it confirms the prompt was understood, before any
// code has changed. Self-hiding: a run without the file (another agent, an older run, a clean
// finished run whose worktree is gone) renders nothing and costs no space.

/** A `label value` pair in the SessionDetails facts idiom, with the ticket's long label as a hint. */
function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const pair = (
    <>
      <span className="text-muted-foreground/70">{label}</span>
      <span className="text-foreground">{value}</span>
    </>
  )
  if (!hint) return <span className="flex items-baseline gap-1.5">{pair}</span>
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex items-baseline gap-1.5" />}>{pair}</TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}

export function RunAnalysisStrip({ projectId, runId }: { projectId: string; runId: string }) {
  // Polled at the handoff's resting cadence: the file appears a little into the run, once the
  // agent finishes analyzing the prompt, and this is how the strip shows up without a reload.
  const { value: analysis } = usePolled<Analysis | null>(
    () => onRunAnalysis(projectId, runId),
    null,
    15_000,
    [projectId, runId],
  )
  if (!analysis) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2 text-xs">
      <span className="font-medium text-muted-foreground">Prompt analysis</span>
      {analysis.scope && <Fact label="Scope" value={analysis.scope} />}
      {analysis.variability && <Fact label="Variability" value={analysis.variability} />}
      {analysis.plan && <Fact label="Plan" value={analysis.plan} hint="Whether the work includes a plan" />}
      {analysis.newTickets && (
        <Fact label="New tickets" value={analysis.newTickets} hint="Whether the work spans over new tickets" />
      )}
    </div>
  )
}
