import { useEffect, useRef, useState } from 'react'
import type { ChoiceRequest, LogEntry, WorkspaceDoc } from '@gemstack/the-framework'
import type { LoopStatus } from '@gemstack/the-framework/client'
import { LoopStatusCard } from './LoopStatusCard.js'
import { DocsPanel } from './DocsPanel.js'
import { ProjectLogPanel } from './ProjectLogPanel.js'
import { ChoicesRail } from './ChoicesRail.js'
import { ViewsRail } from './ViewsRail.js'
import { FileTree } from './FileTree.js'
import { BrowserPanel } from './BrowserPanel.js'
import type { AgentView } from '../lib/live-state.js'
import { Badge } from './ui/badge.js'
import { Button } from './ui/button.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import { cn } from '../lib/utils.js'
import { usePolled } from '../lib/use-async.js'
import { onDocs, onProjectLog } from '../server/reads.telefunc.js'

type Tab = 'files' | 'choices' | 'views' | 'browser' | 'docs' | 'history'

// A one-word tab only works when the reader already knows the system. The former "Log" was
// read as agent output or a console stream, not the durable project history it actually is.
const TABS: Record<Tab, { label: string; help: string }> = {
  files: { label: 'Files', help: 'The project’s files — click one to add it to the next session’s context.' },
  choices: { label: 'Choices', help: 'Questions this session is parked on, waiting for your answer.' },
  views: { label: 'Views', help: 'Documents the agent pushed up during the session — a plan, a summary, a writeup.' },
  browser: { label: 'Browser', help: 'Live view of the browser this session is driving.' },
  docs: { label: 'Docs', help: 'The PLAN/TODO markdown files at the root of the workspace.' },
  history: {
    label: 'History',
    help: 'Every finished session in this project, from the committed .the-framework/LOGS.md — it outlives the sidebar’s recent sessions, which are local and untracked.',
  },
}

// The right sidebar (#314 third rail): the interactive choice gates the run parks on
// (#440), the ad-hoc markdown views the agent pushes (#441), the surfaced docs (PLAN/TODO),
// and the committed project log. Choices/views come from the live event stream, passed
// down from the shell; docs/log are Telefunc-backed reads of the selected project. The rail
// jumps to whatever the run most wants seen: a choice gate first, else a fresh view.
export function RightRail({
  projectId,
  runId,
  choices,
  views,
  files,
  context,
  toggleContext,
  hasBrowser = false,
  target,
  loop,
}: {
  projectId: string | null
  /** The selected run: resolves a choice pick's gate (#749) and scopes the tree to its worktree (#815). */
  runId?: string | null | undefined
  choices: ChoiceRequest[]
  views: AgentView[]
  /** The project's files for the Files tab tree (#492); empty on the relay. */
  files: string[]
  /** The run Context set, shared with the Start form (#504). */
  context: Set<string>
  /** Toggle a file path in the Context. */
  toggleContext: (path: string) => void
  /** Whether the selected run is serving a browser preview (#813), i.e. it was started with Browser on. */
  hasBrowser?: boolean
  /** Where the selected run executes (#1053/#610): an `actions` run has no browser on the runner, so no pane; `remote` (#1067) has none locally either, and neither does a `web` cloud session. */
  target?: 'local' | 'actions' | 'remote' | 'web' | undefined
  /** The selected run's production-grade loop verdict, pinned under the tabs rather than given a tab
   *  of its own: it is a standing fact about the run, not a panel you browse, so it stays readable
   *  whichever tab is open. Null for a run that never looped (a prototype scope, or a plain prompt). */
  loop?: LoopStatus | null | undefined
}) {
  // The two content panels are read here rather than each polling for itself: the rail has to
  // know whether they have anything before it can decide which tabs to offer, and whether to be
  // there at all (#1146). One read each, passed down; the panels render what they are given.
  // Tickets used to be a third one (#697) — now its own full page (#1144), not a rail read.
  const { value: docs, loaded: docsLoaded } = usePolled<WorkspaceDoc[]>(projectId ? () => onDocs(projectId) : null, [], 4000, [projectId])
  const { value: logs, loaded: logsLoaded } = usePolled<LogEntry[]>(projectId ? () => onProjectLog(projectId) : null, [], 10_000, [projectId])
  // Hidden only once we KNOW it is empty: while the first read is out, the tab stays, so switching
  // projects does not blink the rail out and back in.
  const hasDocs = !docsLoaded || docs.length > 0
  const hasLog = !logsLoaded || logs.length > 0

  const [tab, setTab] = useState<Tab>('docs')
  // Once the user picks a tab, stop auto-defaulting (#695/U22) — only a genuinely new choice
  // gate or the first view may still pull focus after that.
  const touched = useRef(false)
  const pickTab = (t: Tab) => {
    touched.current = true
    setTab(t)
  }
  const hasChoices = choices.length > 0
  const hasViews = views.length > 0
  const hasFiles = files.length > 0
  // No browser on a GitHub Actions runner (#1053), so no screencast to proxy — never offer the tab.
  const showBrowser = hasBrowser && target !== 'actions'

  // Only pull the rail for something genuinely new (#695/U22): a fresh choice gate (an id we
  // haven't shown) or the first view. A resolving gate, a second view, or a Files flip no longer
  // yanks the tab you're reading, and an explicit pick is never overridden by the browse default.
  const seenChoiceIds = useRef<Set<string>>(new Set())
  const sawView = useRef(false)
  useEffect(() => {
    const freshChoice = choices.some(c => !seenChoiceIds.current.has(c.id))
    for (const c of choices) seenChoiceIds.current.add(c.id)
    const firstView = hasViews && !sawView.current
    sawView.current = sawView.current || hasViews

    if (freshChoice) setTab('choices')
    else if (firstView) setTab('views')
    else if (!touched.current && !hasChoices && !hasViews) setTab(hasFiles ? 'files' : 'docs')
  }, [choices, hasChoices, hasViews, hasFiles])

  if (!projectId) return null

  // Files first (#492): the project peek surface, before the run's own choices/views/docs/log.
  // Every tab is earned by content (#1146): a tab that can only say "nothing yet" is one the rail
  // does not offer, and a rail with no tabs left is not shown at all.
  const tabs: Tab[] = [
    ...(hasFiles ? ['files' as const] : []),
    ...(hasChoices ? ['choices' as const] : []),
    ...(hasViews ? ['views' as const] : []),
    // Only when the run actually has one (#813) — a dead tab teaches people the preview is broken.
    ...(showBrowser && runId ? ['browser' as const] : []),
    ...(hasDocs ? ['docs' as const] : []),
    ...(hasLog ? ['history' as const] : []),
  ]
  if (tabs.length === 0) return null
  // The remembered tab may have just lost its content (the last doc deleted, a gate resolved), so
  // fall back to the first one that still exists rather than rendering an empty panel.
  const active: Tab = tabs.includes(tab) ? tab : tabs[0]!
  // The Files badge counts only selected files, not whole-repo entries (#661): the shared context
  // set also holds project paths (from the Start form's repo checkboxes), which aren't in `files`.
  const selectedFiles = files.filter(f => context.has(f)).length
  const count = (t: Tab) => (t === 'choices' ? choices.length : t === 'views' ? views.length : t === 'files' ? selectedFiles : 0)

  return (
    <aside
      className={cn(
        'flex w-[27rem] shrink-0 flex-col border-l border-border',
      )}
    >
      {/* flex-wrap: up to 7 tabs share a w-80 rail, and without it the tail clipped (#948).
          Announced as the tabset it visually is. */}
      <div role="tablist" aria-label="Rail panels" className="flex flex-wrap gap-1 p-2">
        {tabs.map(t => (
          <Tooltip key={t}>
            <TooltipTrigger
              render={
                <Button
                  role="tab"
                  aria-selected={active === t}
                  variant="ghost"
                  size="sm"
                  className={cn('h-7 gap-1.5 text-xs', active === t && 'bg-accent text-accent-foreground')}
                  onClick={() => pickTab(t)}
                />
              }
            >
              {TABS[t].label}
              {count(t) > 0 && <Badge className="border-primary/40 text-primary">{count(t)}</Badge>}
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{TABS[t].help}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      {/* The panel is as tall as it needs to be, and no taller than the rail allows: it sizes to its
          own content (so a short file list does not stretch to the floor), and shrinks with its own
          scroller once the content outgrows what is left. That is what puts the verdict below
          directly under the last row rather than at the foot of an empty column. */}
      <div className="flex min-h-0 flex-col overflow-hidden">
        {active === 'files' && hasFiles ? (
          <FileTree projectId={projectId} runId={runId} files={files} selected={context} onToggle={toggleContext} />
        ) : active === 'choices' && hasChoices ? (
          <ChoicesRail projectId={projectId} runId={runId} choices={choices} />
        ) : active === 'views' && hasViews ? (
          <ViewsRail views={views} />
        ) : active === 'browser' && showBrowser && runId ? (
          <BrowserPanel projectId={projectId} runId={runId} />
        ) : active === 'history' ? (
          <ProjectLogPanel logs={logs} loaded={logsLoaded} />
        ) : (
          <DocsPanel docs={docs} loaded={docsLoaded} />
        )}
      </div>
      {/* Straight under the panel's content, not one of the tabs and not pinned to the floor: the
          loop's verdict belongs to the run, so it holds still while you move between panels, and it
          reads as the end of what the rail is saying rather than a footer you scroll to. Its own
          scroller keeps a pass with many blockers from taking the rail. */}
      {loop && (
        <div className="max-h-[33%] shrink-0 overflow-y-auto px-2 pb-2">
          <LoopStatusCard loop={loop} />
        </div>
      )}
    </aside>
  )
}
