import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn, useModuleHost, usePolled, type ModulePanelProps } from 'framework/module'
import type { ProjectTree } from '../src/server.js'
import type { AgentTree, FileMark } from '../src/tree.js'
import { readProject, readTree } from './reads.js'
import { FilePreviewCard } from './FilePreview.js'

// The side rail's Changes tab: only the files that changed, each opening to its diff. On a run's
// page, what that run changed, read from the same place its Files tree is (the `tree` read), and
// kept once its work is merged: the Files tab's marks say what is not merged yet and go with the
// merge, this list says what the run did and stays. On the project's own page, the files changed
// in the project's folder and not committed (the `project` read).

const LABEL: Record<FileMark['status'], string> = {
  untracked: 'new',
  added: 'new',
  modified: 'modified',
  deleted: 'deleted',
}

const TONE: Record<FileMark['status'], string> = {
  untracked: 'text-success',
  added: 'text-success',
  modified: 'text-warning',
  deleted: 'text-danger',
}

function ChangeRow({ projectId, agentId, path, mark }: { projectId: string; agentId?: string | undefined; path: string; mark: FileMark }) {
  const [open, setOpen] = useState(false)
  const dir = path.slice(0, path.lastIndexOf('/') + 1)
  const name = path.slice(path.lastIndexOf('/') + 1)
  return (
    <li className="border-t border-border first:border-t-0">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent">
        <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          <span className="text-muted-foreground">{dir}</span>
          <span className={cn(mark.status === 'deleted' && 'line-through')}>{name}</span>
        </span>
        {!mark.committed && <span className="shrink-0 text-[10px] text-muted-foreground">not committed</span>}
        <span className={cn('shrink-0 text-[10px] uppercase tracking-wide', TONE[mark.status])}>{LABEL[mark.status]}</span>
      </button>
      {/* Mounted only while open: a diff is read for the files the reader asks about, no other. */}
      {open && (
        <div className="border-t border-border bg-muted/30">
          <FilePreviewCard projectId={projectId} agentId={agentId} path={path} />
        </div>
      )}
    </li>
  )
}

const EMPTY_PROJECT: ProjectTree = { files: [], changes: {} }

function Line({ children }: { children: string }) {
  return <p className="p-3 text-xs text-muted-foreground">{children}</p>
}

export function ChangesPanel({ projectId, agentId, activity }: ModulePanelProps) {
  const host = useModuleHost()
  const { value: projectTree, loaded: projectLoaded } = usePolled<ProjectTree>(agentId ? null : () => readProject(host, projectId), EMPTY_PROJECT, 8_000, [projectId, agentId])
  const { value: answer, loaded: treeLoaded, reload } = usePolled<AgentTree | null>(agentId ? () => readTree(host, projectId, agentId) : null, null, 8_000, [projectId, agentId])
  // A run whose files move as it ends answers pending for a moment: the list it last showed stays.
  const lastTree = useRef<{ agentId: string; tree: AgentTree } | null>(null)
  if (agentId && answer && 'files' in answer) lastTree.current = { agentId, tree: answer }
  const last = lastTree.current
  const runTree = answer?.source === 'pending' && last !== null && last.agentId === agentId ? last.tree : answer
  // The agent did something: read again now rather than on the next poll, once per burst.
  useEffect(() => {
    if (activity === undefined) return
    const timer = setTimeout(reload, 300)
    return () => clearTimeout(timer)
  }, [activity, reload])

  if (agentId) {
    if (!treeLoaded || !runTree || runTree.source === 'pending') return <Line>Looking for this run’s changes…</Line>
    if (runTree.source === 'gone') return <Line>This run’s changes are gone from this machine: its checkout was reclaimed and it left no branch or merged pull request here.</Line>
  } else if (!projectLoaded) return <Line>Reading the project’s files…</Line>

  const changes = agentId ? (runTree && 'changes' in runTree ? runTree.changes : {}) : projectTree.changes
  const paths = Object.keys(changes).sort()
  if (paths.length === 0) return <Line>{agentId ? 'This run changed no files.' : 'Nothing is changed in the project’s folder.'}</Line>
  const merged = agentId !== undefined && runTree !== null && 'merged' in runTree && runTree.merged
  const caption = agentId ? (merged ? 'What this run changed. Merged.' : 'What this run changed. Not merged yet.') : 'Changed in the project’s folder, not committed.'
  return (
    <div className="flex min-h-0 flex-auto flex-col p-2">
      <p className="px-1 pb-1 text-[10px] text-muted-foreground">{caption}</p>
      <ul className="min-h-0 flex-auto overflow-y-auto">
        {paths.map(path => (
          <ChangeRow key={path} projectId={projectId} agentId={agentId} path={path} mark={changes[path]!} />
        ))}
      </ul>
    </div>
  )
}
