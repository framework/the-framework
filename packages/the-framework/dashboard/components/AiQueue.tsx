import { useState } from 'react'
import type { ProjectQueue } from '../../dist/index.js'
import { agentOptionsFromPreferences } from '../../dist/client.js'
import { ListTodo, Loader2, Play } from 'lucide-react'
import { queueEntryLabel } from '../lib/queue-entry.js'
import { usePreferences } from '../lib/preferences.js'
import { useStartAgent } from '../lib/use-start-agent.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { Button } from './ui/button.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'

// The Overview's AI Queue card (#1139): every project's open `TODO_AGENTS.md` items — the work the
// framework picks up on its own — grouped by project and shown in full. No "+N more": this is the
// plan, and a collapsed plan is one you cannot read.
//
// Two ways to act on an entry, and they are different acts. Its title opens what the entry NAMES:
// a queued ticket links back to its ticket (#1164), so the title opens that ticket's own page
// (#1144) — reading the plan, not starting it. The play button STARTS it: one agent, on that entry
// alone, the same work the drain sweep would get to (#855) but on your click. The project header
// stays a header — a project name that jumped to the launcher was the odd redirect #1139 called
// out, and that is still true.
//
// Its own file rather than inline in DashboardPage, like every other card on the Overview:
// DashboardPage has no test file, and opening tickets and starting runs are behaviour worth pinning.

/**
 * The prompt the play button starts an agent with: the drain preset's vocabulary ("work on … then
 * check it off. Do not start any other entry.") narrowed from "the FIRST open entry" to the one
 * entry the row shows. The raw `TODO_AGENTS.md` line, not the pretty label: the agent must find
 * exactly this entry to check it off, and the line's link is how it opens the ticket (#1164).
 * Exported so the test asserts against this and not a copy.
 */
export function workOnEntryPrompt(entry: string): string {
  return `Open TODO_AGENTS.md and work on this one open entry only, then check it off. Do not start any other entry. The entry:\n\n${entry}`
}

export function AiQueue({
  queue,
  loading,
  onOpenTicket,
  onAgentStarted,
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
}) {
  const preferences = usePreferences()
  const { busy, error, start } = useStartAgent()
  // Which entry is in flight, keyed by content rather than index: the list is polled and can
  // shift under a click, and only the clicked row's button should spin.
  const [starting, setStarting] = useState<string | null>(null)

  const agentEntry = async (projectId: string, entry: string) => {
    if (busy) return
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
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Spin up an agent working on this entry"
                                  disabled={busy}
                                  onClick={() => void agentEntry(q.projectId, item.text)}
                                  className="shrink-0 text-muted-foreground hover:text-foreground"
                                />
                              }
                            >
                              {starting === key ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Play className="h-3.5 w-3.5" aria-hidden />
                              )}
                            </TooltipTrigger>
                            <TooltipContent>Spin up an agent working on this entry</TooltipContent>
                          </Tooltip>
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
