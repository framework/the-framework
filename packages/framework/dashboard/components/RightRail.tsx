import { useEffect, useRef, useState } from 'react'
import type { WorkspaceDoc } from '../../src/index.js'
import { DocsPanel } from './DocsPanel.js'
import { FileTree } from './FileTree.js'
import { Button } from './ui/button.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import { cn } from '../lib/utils.js'
import { usePolled } from '../lib/use-async.js'
import { onDocs } from '../rpc/reads.js'

type Tab = 'files' | 'docs'

// Choices had a tab here (#440) until the gates moved inline into the transcript (#1455
// items 6/7) — a question is answered where it was asked, so the rail has no panel for them.
// History had one too, rendering a committed markdown re-narration of what the event log already
// holds exactly (B3); the sessions themselves are the history now.
const TABS: Record<Tab, { label: string; help: string }> = {
  files: { label: 'Files', help: 'The project’s files, with what the session changed — hover one to preview it.' },
  docs: { label: 'Docs', help: 'The PLAN/TODO markdown files at the root of the workspace.' },
}

// The right sidebar (#314 third rail): the project's files and the surfaced docs (PLAN/TODO). Docs
// are an RPC read of the selected project; choice gates live inline in the transcript (#1455 items
// 6/7), so nothing here pulls focus for them.
export function RightRail({
  projectId,
  agentId: agentId,
  files,
  docsInMain = false,
}: {
  projectId: string | null
  /** The selected agent: scopes the file tree to its worktree (#815). */
  agentId?: string | null | undefined
  /** The project's files for the Files tab tree (#492); empty on the relay. */
  files: string[]
  /**
   * The launcher renders Docs in its main column (#1455 item 2), so while it is the main view the
   * rail must not repeat it: the tab is withheld and the poll skipped. A session view passes false
   * (or nothing) and keeps the full rail.
   */
  docsInMain?: boolean
}) {
  // The two content panels are read here rather than each polling for itself: the rail has to
  // know whether they have anything before it can decide which tabs to offer, and whether to be
  // there at all (#1146). One read each, passed down; the panels render what they are given.
  // Tickets used to be a third one (#697) — now its own full page (#1144), not a rail read.
  const { value: docs, loaded: docsLoaded } = usePolled<WorkspaceDoc[]>(projectId && !docsInMain ? () => onDocs(projectId) : null, [], 4000, [projectId, docsInMain])
  // Hidden only once we KNOW it is empty: while the first read is out, the tab stays, so switching
  // projects does not blink the rail out and back in. While the launcher owns this panel
  // (#1455 item 2), the tab is withheld outright.
  const hasDocs = !docsInMain && (!docsLoaded || docs.length > 0)

  const [tab, setTab] = useState<Tab>('docs')
  // Once the user picks a tab, stop auto-defaulting (#695/U22).
  const touched = useRef(false)
  const pickTab = (t: Tab) => {
    touched.current = true
    setTab(t)
  }
  const hasFiles = files.length > 0

  // The browse default: Files when there are any, else Docs. An explicit pick is never overridden.
  useEffect(() => {
    if (!touched.current) setTab(hasFiles ? 'files' : 'docs')
  }, [hasFiles])

  if (!projectId) return null

  // Files first (#492): the project peek surface, before the docs.
  // Every tab is earned by content (#1146): a tab that can only say "nothing yet" is one the rail
  // does not offer, and a rail with no tabs left is not shown at all.
  const tabs: Tab[] = [
    ...(hasFiles ? ['files' as const] : []),
    ...(hasDocs ? ['docs' as const] : []),
  ]
  if (tabs.length === 0) return null
  // The remembered tab may have just lost its content (the last doc deleted, a gate resolved), so
  // fall back to the first one that still exists rather than rendering an empty panel.
  const active: Tab = tabs.includes(tab) ? tab : tabs[0]!

  return (
    <aside
      className={cn(
        'flex w-[22rem] shrink-0 flex-col border-l border-border',
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
          <FileTree projectId={projectId} agentId={agentId} files={files} />
        ) : (
          <DocsPanel docs={docs} loaded={docsLoaded} />
        )}
      </div>
    </aside>
  )
}
