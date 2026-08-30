import { useState } from 'react'
import type { ProjectQueue } from '../../src/index.js'
import { agentOptionsFromPreferences } from '../../src/client.js'
import { FastForward, ListTodo, Play } from 'lucide-react'
import { queueEntryLabel } from '../lib/queue-entry.js'
import { usePreferences } from '../lib/preferences.js'
import { useStartAgent } from '../lib/use-start-agent.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import { StartAgentButton } from './StartAgentButton.js'

// The Overview's AI Queue card (#1139): every project's open `TODO_AGENTS.md` entries — the work the
// framework picks up on its own — grouped by project and shown in full. No "+N more": this is the
// plan, and a collapsed plan is one you cannot read.
//
// Two ways to act on an entry, and they are different acts. Its title opens what the entry NAMES:
// a queued ticket links back to its ticket (#1164), so the title opens that ticket's own page
// (#1144) — reading the plan, not starting it. The play button STARTS it: one agent, on that entry
// alone, the same work the drain sweep would get to (#855) but on your click. The project header
// stays a header — a project name that jumped to the launcher was the odd redirect #1139 called
// out, and that is still true — but it carries the project's batch act: a fan-out button that
// starts one agent per top entry, as many as the count beside it says, each pinned to its own
// entry the way the sweep pins a drain batch (#1204).
//
// Both starts are split buttons (#1507): the chevron beside each hands its prompt to the project's
// launcher instead of spending an agent on the settings the card cannot show.
//
// Its own file rather than inline in DashboardPage, like every other card on the Overview:
// DashboardPage has no test file, and opening tickets and starting runs are behaviour worth pinning.

/**
 * The prompt the play button starts an agent with: the drain preset's vocabulary (work one entry
 * through the `tickets` skill, then take it off the queue; do not start any other entry) narrowed
 * from "the FIRST open entry" to the one entry the row shows. The raw `TODO_AGENTS.md` line, not
 * the pretty label: the agent must name exactly this entry to take it off, and the line's link is
 * how it opens the ticket (#1164). Exported so the test asserts against this and not a copy.
 */
export function workOnEntryPrompt(entry: string): string {
  return `Use the \`tickets\` skill: work on this one open queue entry only, and when the work is done and published run \`tickets queue done "<the entry>"\`. Do not start any other entry. The entry:\n\n${entry}`
}

/** How many agents the fan-out button starts until its count says otherwise. */
export const DEFAULT_FAN_OUT_COUNT = 3

/**
 * What the fan-out button promises, sized to what a click would actually start: the count beside
 * the button, capped at the entries the project has open. Exported so the tests assert against
 * this and not a copy.
 */
export function fanOutLabel(count: number): string {
  return count === 1
    ? 'Spin up an agent working on the top entry'
    : `Spin up ${count} agents working on the top ${count} entries`
}

export function AiQueue({
  queue,
  loading,
  onOpenTicket,
  onAgentStarted,
  onSelectProject,
}: {
  queue: ProjectQueue[]
  loading: boolean
  /** Open a queued ticket's own page (#1144), by project and the `WorkspaceTicket.file` slug. */
  onOpenTicket: (projectId: string, file: string) => void
  /**
   * Told which run the play button just started (#1191). The project-carrying form, because the
   * Overview has no project selected — each entry knows its own — so the shell cannot supply it.
   */
  onAgentStarted: (projectId: string, intent: string, agentId?: string) => void
  /** Where "Configure first, then run" lands (#1507): the entry's own project's launcher. */
  onSelectProject: (id: string) => void
}) {
  const preferences = usePreferences()
  const { busy, error, start } = useStartAgent()
  // Which entry is in flight, keyed by content rather than index: the list is polled and can
  // shift under a click, and only the clicked row's button should spin.
  const [starting, setStarting] = useState<string | null>(null)
  // Which project's fan-out is in flight. Its own flag rather than `busy`, because the batch is a
  // sequence of starts and `busy` drops between two of them — a gap a second click could slip into.
  const [fanningOut, setFanningOut] = useState<string | null>(null)
  // The count beside each project's fan-out button. Per project, since queues differ in depth;
  // plain component state, since it parameterizes the next click rather than recording a setting.
  const [fanOutCounts, setFanOutCounts] = useState<Record<string, number>>({})
  const inFlight = busy || fanningOut !== null

  const fanOutCount = (projectId: string) => fanOutCounts[projectId] ?? DEFAULT_FAN_OUT_COUNT

  /**
   * The entries a fan-out click would take: the top of the queue, as many as the count beside the
   * button says. One reading of "the top", shared by the click and by the "Configure first, then
   * run" beside it — which sends the first of them, since a launcher can only ever send one agent.
   */
  const topEntries = (project: ProjectQueue) =>
    project.items
      .filter(item => !item.done)
      .slice(0, fanOutCount(project.projectId))
      .map(item => item.text)

  const agentEntry = async (projectId: string, entry: string) => {
    if (inFlight) return
    const key = `${projectId}\n${entry}`
    const prompt = workOnEntryPrompt(entry)
    setStarting(key)
    // Unattended (#1279): starting a queue entry from the card is the same work the drain sweep
    // starts, so it runs the same way — gates auto-answer, the agent ends at settle, and the armed
    // handoff fires, instead of parking in the stay-open chat loop with its PR never opened.
    const result = await start(projectId, prompt, 'prompt', { ...agentOptionsFromPreferences(preferences), unattended: true })
    setStarting(null)
    // Go to the agent itself (#1191): one agent on one named entry is a session to watch, unlike the
    // sweep's fan-out, which lands in the Agents card. With no id yet the shell lands on the
    // project and adopts the running agent once the poll surfaces it.
    if (result) onAgentStarted(projectId, prompt, result.agentId)
  }

  const fanOutProject = async (project: ProjectQueue) => {
    if (inFlight) return
    // The top of the queue, one agent per entry: the same order the drain sweep picks in, and each
    // prompt pinned to its own entry for the same reason the sweep pins a batch (#1204) — several
    // agents told "the first open entry" would all implement the same one.
    const entries = topEntries(project)
    setFanningOut(project.projectId)
    for (const entry of entries) {
      // One after another, the way the sweep spawns its batch: each start allocates a worktree and
      // an id of its own. The batch ends at the first refusal — whatever refused this start is not
      // going to take the next one a moment later, and the refusal stays on screen under the list.
      const result = await start(project.projectId, workOnEntryPrompt(entry), 'prompt', { ...agentOptionsFromPreferences(preferences), unattended: true })
      if (!result) break
    }
    setFanningOut(null)
    // No navigation, unlike the single play button (#1191): a batch is the sweep's fan-out fired
    // by hand, and it lands in the Agents card sitting right above this one.
  }

  const withOpen = queue.filter(q => q.open > 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          AI Queue
        </CardTitle>
        <p className="text-xs text-muted-foreground">Tasks AI will work on next</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : withOpen.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nothing queued.</p>
        ) : (
          <ul className="space-y-4">
            {withOpen.map(q => (
              <li key={q.projectId}>
                <div className="flex w-full items-center gap-2">
                  <span className="truncate text-sm font-medium">{q.projectName}</span>
                  <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{q.open}</span>
                  {/* The project's batch act: how many, then the button the count qualifies. */}
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={fanOutCount(q.projectId)}
                          aria-label="How many agents to spin up"
                          onChange={event => {
                            // Floored like the routine panel's concurrency box: a number input
                            // still hands back whatever was typed, and an emptied box is mid-edit
                            // rather than a count — `Number('')` is 0, and the floor would turn a
                            // cleared field into a saved 1.
                            const typed = event.target.value.trim()
                            if (!typed) return
                            const next = Math.round(Number(typed))
                            if (!Number.isFinite(next)) return
                            setFanOutCounts(counts => ({
                              ...counts,
                              [q.projectId]: Math.max(next, 1),
                            }))
                          }}
                          className="h-7 w-11 shrink-0 rounded border border-border bg-background px-1 text-center text-xs tabular-nums text-foreground"
                        />
                      }
                    />
                    <TooltipContent>How many agents to spin up — one per entry, from the top of the queue.</TooltipContent>
                  </Tooltip>
                  {/* The batch, and beside it the launcher (#1507). The chevron sends the top
                      entry alone: a launcher can only ever start one agent, which is why its
                      wording says so rather than letting the two halves look like one act. */}
                  <StartAgentButton
                    variant="ghost"
                    size="icon-sm"
                    icon={<FastForward className="h-3.5 w-3.5" aria-hidden />}
                    ariaLabel={fanOutLabel(Math.min(fanOutCount(q.projectId), q.open))}
                    menuAriaLabel={`Other ways to spin up agents on ${q.projectName}'s queue`}
                    tooltip={fanOutLabel(Math.min(fanOutCount(q.projectId), q.open))}
                    busy={inFlight}
                    starting={fanningOut === q.projectId}
                    onStart={() => void fanOutProject(q)}
                    onConfigure={() => onSelectProject(q.projectId)}
                    prompt={workOnEntryPrompt(topEntries(q)[0] ?? '')}
                    configureDescription="Opens the launcher with the top entry's prompt — one agent, not the batch."
                    className="text-muted-foreground hover:text-foreground"
                  />
                </div>
                <ul className="mt-1.5 space-y-1 pl-0.5">
                  {q.items
                    .filter(i => !i.done)
                    .map((item, i) => {
                      // The line is markdown, and a queued ticket is written as a link to it
                      // (#1164), so print the title rather than the source; the whole line stays
                      // in the tooltip.
                      const label = queueEntryLabel(item.text)
                      const key = `${q.projectId}\n${item.text}`
                      return (
                        <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span aria-hidden className="text-muted-foreground/50">•</span>
                          {label.ticket !== undefined ? (
                            // In-app, so a button rather than an anchor, like every other row that
                            // navigates the shell; external targets get a real link in a new tab.
                            <button
                              type="button"
                              onClick={() => onOpenTicket(q.projectId, label.ticket!)}
                              className="min-w-0 flex-1 truncate text-left hover:text-foreground hover:underline"
                              title={item.text}
                            >
                              {label.text}
                            </button>
                          ) : label.url !== undefined ? (
                            <a
                              href={label.url}
                              target="_blank"
                              rel="noreferrer"
                              className="min-w-0 flex-1 truncate hover:text-foreground hover:underline"
                              title={item.text}
                            >
                              {label.text}
                            </a>
                          ) : (
                            <span className="min-w-0 flex-1 truncate" title={item.text}>
                              {label.text}
                            </span>
                          )}
                          <StartAgentButton
                            variant="ghost"
                            size="icon-sm"
                            icon={<Play className="h-3.5 w-3.5" aria-hidden />}
                            ariaLabel="Spin up an agent working on this entry"
                            menuAriaLabel={`Other ways to run ${label.text}`}
                            tooltip="Spin up an agent working on this entry"
                            busy={inFlight}
                            starting={starting === key}
                            onStart={() => void agentEntry(q.projectId, item.text)}
                            onConfigure={() => onSelectProject(q.projectId)}
                            prompt={workOnEntryPrompt(item.text)}
                            configureDescription="Opens the launcher with this entry's prompt, so you can set the model and where it runs."
                            className="text-muted-foreground hover:text-foreground"
                          />
                        </li>
                      )
                    })}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
