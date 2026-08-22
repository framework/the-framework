import { useState } from 'react'
import type { AutoPmJob, AutoPmOutcome, ProjectSummary } from '../../src/index.js'
import {
  AUTO_PM_ROUTINES,
  DEFAULT_AUTO_PM_CONCURRENCY,
  MAX_AUTO_PM_CONCURRENCY,
  agentOptionsFromPreferences,
} from '../../src/client.js'
import { CalendarClock, ChevronDown, Play } from 'lucide-react'
import { onProjects } from '../rpc/projects.js'
import { sendAutoPmSweep } from '../rpc/quota.js'
import { useAutoPm } from '../lib/quota.js'
import { usePreferences, updatePreferences } from '../lib/preferences.js'
import { useStartAgent } from '../lib/use-start-agent.js'
import { useLoaded } from '../lib/use-async.js'
import { formatUntil } from '../lib/format-date.js'
import { stashPendingDraft } from '../lib/draft-handoff.js'
import { describeAgentSettings } from '../lib/agent-settings.js'
import { cn } from '../lib/utils.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { Button, buttonVariants } from './ui/button.js'
import { Checkbox } from './ui/checkbox.js'
import { OptionLabel } from './ui/option-label.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './ui/dropdown-menu.js'

// The Overview's "Routine work" card (#1159): the jobs the idle sweep fires on a schedule, each with
// a Run now button that starts it against a project immediately.
//
// The list is `AUTO_PM_ROUTINES` itself, straight off the browser-safe client entry, so what is on
// screen is what the daemon runs rather than a second copy of it: no read of its own, and no way
// for the two to drift. Run now takes the same path the launcher does (`sendStart` with the job's
// prompt verbatim), so it starts the work now instead of asking the sweep to come round sooner.
//
// Two tiers of checkbox, and they control different things (#1209). The one at the foot is the
// `autoPm` preference (#685): whether the schedule runs at all. The one on each row is that
// routine's place *in* the schedule, held as `autoPmOptOut` — so a row box no longer has to lie
// about flipping the global switch, which is the reason the card first shipped without them.
//
// Opting *out* is what gets recorded, never opting in: every routine is on until it is unticked,
// so a routine added by a later version runs for someone who saved the setting before it existed.

/** Captured once: `useLoaded` treats a fresh `[]` literal as a new value on every render. */
const NO_PROJECTS: ProjectSummary[] = []

/**
 * The triggered sweep's answer as one card line (#1433): a single project speaks its message
 * plainly, several are prefixed with the folder name so the reader can tell whose line is whose.
 * An empty report is said too — the sweep genuinely considered nothing (no projects registered) —
 * because "ran and found nothing to say" and "never ran" must not look alike, which is the very
 * hole this fills.
 */
function describeOutcomes(outcomes: AutoPmOutcome[] | undefined): string {
  // The sweep ran but its report was unreadable: say the true part rather than guessing at more.
  if (!outcomes) return 'The sweep ran.'
  if (!outcomes.length) return 'The sweep ran and considered no projects.'
  if (outcomes.length === 1) return outcomes[0]!.message
  return outcomes.map(o => `${o.path.split('/').pop() || o.path}: ${o.message}`).join(' · ')
}

export function RoutineWork({
  onAgentStarted,
  onSelectProject,
}: {
  /**
   * Told which run the button just started (#1191). The project-carrying form, because the
   * Overview has no project selected — each row picks one — so the shell cannot supply it.
   */
  onAgentStarted: (projectId: string, intent: string, agentId?: string) => void
  /** Where "Configure first, then run" lands (#1507): the picked project's launcher. */
  onSelectProject: (id: string) => void
}) {
  const projects = useLoaded<ProjectSummary[]>(onProjects, NO_PROJECTS, [])
  const preferences = usePreferences()
  const report = useAutoPm()
  const { busy, error, start } = useStartAgent()
  const [picked, setPicked] = useState<string | null>(null)
  // Which routine is in flight, so only its own button says "Starting…".
  const [starting, setStarting] = useState<string | null>(null)
  // The on-demand sweep (#1210): in flight, and anything worth saying about the last attempt.
  const [sweeping, setSweeping] = useState(false)
  const [sweepNote, setSweepNote] = useState<string | null>(null)

  // The list arrives after the first render, and a project can be removed under a stale pick, so
  // the selection is validated against what is actually there rather than trusted.
  const projectId = (picked !== null && projects.some(p => p.id === picked) ? picked : projects[0]?.id) ?? null

  const autoAgent = preferences.autoPm ?? false
  // Absent = nothing opted out, which is also what the store saves an empty list back as.
  const optedOut = preferences.autoPmOptOut ?? []
  // Written as the whole list rather than a delta: `updatePreferences` patches by key, and this
  // key's value *is* the set.
  const setRoutine = (job: AutoPmJob, on: boolean) =>
    updatePreferences({
      autoPmOptOut: on ? optedOut.filter(name => name !== job.name) : [...optedOut, job.name],
    })
  // How many agents the routine may keep going at once (#1204). Absent is the daemon's default
  // rather than 1, so the number on screen is the number the sweep would use.
  const concurrency = preferences.autoPmConcurrency ?? DEFAULT_AUTO_PM_CONCURRENCY
  // The countdown is the sweep's, and the sweep only reports once the daemon has run one. With
  // auto-run off, or before that first report, the box says what it does instead of when.
  const autoAgentLabel =
    autoAgent && report?.nextSweepAt !== undefined ? `Auto-runs ${formatUntil(report.nextSweepAt)}` : 'Auto-run'

  // Firing the sweep on demand (#1210). The RPC awaits the sweep and returns its per-project
  // outcomes (#1433), so the click's own answer lands on the card the moment the tick resolves —
  // two presses used to show literally nothing, with the stand-down reason recoverable only from
  // the source. "Triggering…" holds until then, which is the loading state the flash never was.
  const sweepNow = async () => {
    if (sweeping) return
    setSweeping(true)
    setSweepNote(null)
    const result = await sendAutoPmSweep().catch(() => ({ ok: false as const }))
    setSweeping(false)
    // A host with no loop is the honest failure here, and the only one: a dashboard served by
    // something that does not run the sweep has nothing for this button to fire.
    if (!result.ok) setSweepNote('This dashboard is not running the sweep, so there is nothing to trigger here.')
    else setSweepNote(describeOutcomes('outcomes' in result ? result.outcomes : undefined))
  }

  /**
   * "Configure first, then run" (#1507). Run now spends an agent on settings that are nowhere on
   * this card: the model and where it runs come from the Global options, so the only way to change
   * them was to leave, edit the preferences, and come back. This hands the same prompt to the
   * launcher instead — where those controls are, and where the prompt itself can be edited before
   * it is sent.
   *
   * The carry is the draft stash a hot ticket already uses (#1066/#1139) rather than a second
   * mechanism: the launcher takes it once as it mounts, so nothing re-seeds on a reload.
   *
   * Not gated on `busy`: this starts nothing, and being unable to go and look at the settings
   * because a start is in flight would be the opposite of the point.
   */
  const configureFirst = (job: AutoPmJob) => {
    if (!projectId) return
    stashPendingDraft(job.prompt)
    onSelectProject(projectId)
  }

  /**
   * What a Run now is about to spend, said before it is spent (#1506). The card fires prompts on
   * settings that are nowhere on it: the model and where it runs come from the Global options, a
   * page away, so the button's own cost was invisible right up until the agent existed.
   *
   * The first line is the preset's own sentence rather than one written again here (#1506), so the
   * launcher and this card describe a routine the same way, and the second is rendered from the
   * very preferences the start reads — not a copy that can go stale.
   */
  const settings = describeAgentSettings(preferences)
  const projectName = projects.find(p => p.id === projectId)?.name

  const runNow = async (job: AutoPmJob) => {
    if (!projectId || busy) return
    // The drain's Run now means "spin agents up on the queue" (#1204), and only the sweep can fan
    // out — one agent per entry, up to the concurrency. A plain start could only ever be one
    // agent reading the first entry. Drain-only, so an empty queue is reported on the card
    // rather than the click quietly borrowing a rotation job. No navigation on purpose: the
    // agents land in the Agents card, which is where a batch is watchable.
    if (job.drains) {
      setStarting(job.name)
      setSweepNote(null)
      const result = await sendAutoPmSweep({ drainOnly: true }).catch(() => ({ ok: false as const }))
      setStarting(null)
      if (!result.ok) setSweepNote('This dashboard is not running the sweep, so there is nothing to trigger here.')
      else setSweepNote(describeOutcomes('outcomes' in result ? result.outcomes : undefined))
      return
    }
    setStarting(job.name)
    // Your settings only: the Overview has no project open, so the repo's committed file is not
    // resolved here and the agent starts on the same defaults a fresh launcher would use.
    // Unattended (#1279): a routine fired by a card is the same work the sweep starts, so it runs
    // the same way — gates auto-answer, the agent ends at settle, and the armed handoff fires,
    // instead of parking in the stay-open chat loop with its PR never opened.
    const result = await start(projectId, job.prompt, 'prompt', { ...agentOptionsFromPreferences(preferences), unattended: true })
    setStarting(null)
    // Go to the agent itself, not merely to its project (#1191): selecting the project renders the
    // launcher, so the button that says "Run now" landed you on an empty composer and the session
    // it had just started was nowhere on screen. Handing the id over is what makes it the
    // selection; with no id yet the shell lands on the project and adopts the running agent once the
    // poll surfaces it, which is the same fallback every other start path uses.
    if (result) onAgentStarted(projectId, job.prompt, result.agentId)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Routine work
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {projects.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Add a project to run a routine.</p>
        ) : (
          <>
            {projects.length > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <label htmlFor="routine-project" className="text-muted-foreground">
                  Run in
                </label>
                <select
                  id="routine-project"
                  className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
                  value={projectId ?? ''}
                  onChange={e => setPicked(e.target.value)}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <ul className="divide-y divide-border">
              {AUTO_PM_ROUTINES.map(job => (
                <li key={job.name} className="flex items-center gap-3 py-2 first:pt-0">
                  {/* The row's own name is the box's label, so the whole title is a hit target and
                      no second copy of the wording has to be invented for screen readers. Run now
                      stays outside it: it fires the routine once, whatever the box says. */}
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <Checkbox
                      checked={!optedOut.includes(job.name)}
                      onCheckedChange={checked => setRoutine(job, checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{job.label ?? job.name}</span>
                      {job.describe && (
                        <span className="block truncate text-xs text-muted-foreground">{job.describe}</span>
                      )}
                    </span>
                  </label>
                  {/* A split button, not a hover-revealed second control (#1507): the routine
                      it belongs to is not always the row the pointer is on, and a control that
                      only exists under a mouse is reachable by neither keyboard nor touch. The
                      chevron is the secondary half, so the common click stays one click. */}
                  <div className="flex shrink-0 items-center">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={busy || !projectId}
                            onClick={() => void runNow(job)}
                            className="rounded-r-none border-r-0"
                          />
                        }
                      >
                        <Play className="h-3 w-3" aria-hidden />
                        {starting === job.name ? 'Starting…' : 'Run now'}
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[22rem] space-y-1">
                        {job.tooltip && <span className="block">{job.tooltip}</span>}
                        {/* The drain row's Run now is the sweep, so neither half of the settings
                            line would be true of it: the sweep resolves each project's own
                            `the-framework.yml` on top of these preferences, and it visits every
                            project rather than the one picked above. It says that instead. */}
                        <span className="block text-muted-foreground">
                          {job.drains ? "Each project's own settings decide the model and where it runs." : settings}
                        </span>
                        <span className="block text-muted-foreground">
                          {job.drains
                            ? `Sweeps every project the daemon watches, up to ${concurrency} ${concurrency === 1 ? 'agent' : 'agents'} each, unattended.`
                            : `Starts one agent${projectName ? ` in ${projectName}` : ''}, unattended — nothing is asked mid-run.`}
                        </span>
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        type="button"
                        disabled={!projectId}
                        aria-label={`Other ways to run ${job.label ?? job.name}`}
                        className={cn(buttonVariants({ variant: 'outline', size: 'xs' }), 'rounded-l-none px-1.5')}
                      >
                        <ChevronDown className="h-3 w-3" aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-w-[20rem]">
                        <DropdownMenuItem
                          disabled={!projectId}
                          onClick={() => configureFirst(job)}
                          className="items-start"
                        >
                          <OptionLabel
                            label="Configure first, then run"
                            /* The drain's Run now is a fan-out sweep, and the launcher can only
                               ever send one agent — so this row's secondary action really is a
                               different job, and says so rather than looking like the same one. */
                            description={
                              job.drains
                                ? 'Opens the launcher with this prompt — one agent, not the fan-out.'
                                : 'Opens the launcher with this prompt, so you can set the model and where it runs.'
                            }
                          />
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>

            {error && (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}

            {/* The same `autoPm` preference the Settings page offers (#1161), which is the point:
                one switch, shown where the schedule it governs is listed. (The usage panel's copy
                of it is gone, #960 Edit.) */}
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between gap-2">
                <Tooltip>
                  <TooltipTrigger render={<label className="flex cursor-pointer items-center gap-1.5 text-sm" />}>
                    <Checkbox checked={autoAgent} onCheckedChange={checked => updatePreferences({ autoPm: checked })} />
                    <span className="font-medium text-foreground">{autoAgentLabel}</span>
                  </TooltipTrigger>
                  <TooltipContent>Automatically run the ticked routines on a regular schedule.</TooltipContent>
                </Tooltip>
                {/* The countdown's escape hatch (#1210): the sweep is on a long interval, so
                    without this the only way to fast-forward was to tick the box off and on
                    again. Live even while auto-run is off — that preference records consent to
                    spend quota unasked, and clicking is asking — so the daemon sweeps once and
                    the schedule stays off. */}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={sweepNow}
                        disabled={sweeping}
                        className="shrink-0 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-50"
                      />
                    }
                  >
                    {sweeping ? 'Triggering…' : 'Trigger routine now'}
                  </TooltipTrigger>
                  <TooltipContent>
                    {autoAgent
                      ? 'Run the scheduled sweep now instead of waiting for the countdown.'
                      : 'Run the sweep once now. Auto-run stays off, so nothing further is scheduled.'}
                  </TooltipContent>
                </Tooltip>
              </div>
              {/* The concurrency setting (#1204). Beside the switch it qualifies, and worded as
                  what it does rather than as a number: only draining fans out, because that is the
                  routine that takes work off the queue one entry at a time. */}
              <div className="mt-2 flex items-center justify-between gap-2">
                <Tooltip>
                  <TooltipTrigger
                    render={<label htmlFor="auto-pm-concurrency" className="cursor-pointer text-sm text-foreground" />}
                  >
                    Concurrent agents
                  </TooltipTrigger>
                  <TooltipContent>
                    How many agents the routine keeps going at once while there is queued work.
                  </TooltipContent>
                </Tooltip>
                <input
                  id="auto-pm-concurrency"
                  type="number"
                  min={1}
                  max={MAX_AUTO_PM_CONCURRENCY}
                  step={1}
                  value={concurrency}
                  onChange={event => {
                    // Clamped here as well as in the store, because a number input still hands
                    // back whatever was typed. An emptied box is mid-edit rather than a setting:
                    // it has to be caught by hand, since `Number('')` is 0, not NaN, and the clamp
                    // below would turn a cleared field into a saved 1.
                    const typed = event.target.value.trim()
                    if (!typed) return
                    const next = Math.round(Number(typed))
                    if (!Number.isFinite(next)) return
                    updatePreferences({ autoPmConcurrency: Math.min(Math.max(next, 1), MAX_AUTO_PM_CONCURRENCY) })
                  }}
                  className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {concurrency === 1
                  ? "Only while nothing else is running and the week's allowance is not already spent."
                  : `Keeps up to ${concurrency} agents going at once on queued work, and only while the week's allowance is not already spent.`}
              </p>
              {/* Auto-run on with every routine unticked is a schedule with nothing on it, and
                  from the countdown alone it looks like work is coming (#1209). */}
              {autoAgent && AUTO_PM_ROUTINES.every(job => optedOut.includes(job.name)) && (
                <p className="mt-1 text-xs text-warning">
                  Every routine is unticked, so the schedule has nothing to run.
                </p>
              )}
              {sweepNote && (
                <p role="status" className="mt-1 text-xs text-muted-foreground">
                  {sweepNote}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
