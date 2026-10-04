import { useEffect, useRef, useState } from 'react'
import { cn, useModuleHost, usePolled, type ModulePanelProps } from 'framework/module'
import type { ProjectTree } from '../src/server.js'
import type { AgentTree, FileMark } from '../src/tree.js'
import { readProject, readTree } from './reads.js'
import { FilePreviewCard } from './FilePreview.js'

// The side panel's Changes tab, as Claude Code on the web draws it: the files that changed in a
// list on the left, and on the right the diff of the one picked, the first file picked by itself.
// On a run's page, what that run changed, read from the same place its Files tree is (the `tree`
// read), and kept once its work is merged: the Files tab's marks say what is not merged yet and go
// with the merge, this list says what the run did and stays. On the project's own page, the files
// changed in the project's folder and not committed (the `project` read).

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

function ChangeRow({ path, mark, picked, onPick }: { path: string; mark: FileMark; picked: boolean; onPick: () => void }) {
  const dir = path.slice(0, path.lastIndexOf('/') + 1)
  const name = path.slice(path.lastIndexOf('/') + 1)
  return (
    <li>
      <button type="button" onClick={onPick} aria-pressed={picked} title={path} className={cn('flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent', picked && 'bg-accent')}>
        <span className="w-full truncate font-mono text-xs">
          <span className="text-muted-foreground">{dir}</span>
          <span className={cn(mark.status === 'deleted' && 'line-through')}>{name}</span>
        </span>
        <span className="text-[10px] text-muted-foreground">
          <span className={cn('uppercase tracking-wide', TONE[mark.status])}>{LABEL[mark.status]}</span>
          {!mark.committed && ' · not committed'}
        </span>
      </button>
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

  // The file whose diff shows: the one clicked on this page, or the first of the list while none
  // is, or once the one clicked is no longer in the list. A click counts for the page it was made
  // on: another run's list starts at its own first file.
  const [click, setClick] = useState<{ agentId: string | undefined; path: string } | null>(null)
  const clicked = click !== null && click.agentId === agentId ? click.path : null

  if (agentId) {
    if (!treeLoaded || !runTree || runTree.source === 'pending') return <Line>Looking for this run’s changes…</Line>
    if (runTree.source === 'gone') return <Line>This run’s changes are gone from this machine: its checkout was reclaimed and it left no branch or merged pull request here.</Line>
  } else if (!projectLoaded) return <Line>Reading the project’s files…</Line>

  const changes = agentId ? (runTree && 'changes' in runTree ? runTree.changes : {}) : projectTree.changes
  const paths = Object.keys(changes).sort()
  if (paths.length === 0) return <Line>{agentId ? 'This run changed no files.' : 'Nothing is changed in the project’s folder.'}</Line>
  const merged = agentId !== undefined && runTree !== null && 'merged' in runTree && runTree.merged
  const caption = agentId ? (merged ? 'What this run changed. Merged.' : 'What this run changed. Not merged yet.') : 'Changed in the project’s folder, not committed.'
  const picked = clicked !== null && paths.includes(clicked) ? clicked : paths[0]!
  return (
    <div className="flex min-h-0 flex-auto flex-col">
      <p className="px-3 pb-1 text-[10px] text-muted-foreground">{caption}</p>
      <div className="flex min-h-0 flex-auto border-t border-border">
        <ul aria-label="Changed files" className="w-1/3 max-w-56 min-w-32 shrink-0 space-y-0.5 overflow-y-auto border-r border-border p-1">
          {paths.map(path => (
            <ChangeRow key={path} path={path} mark={changes[path]!} picked={path === picked} onPick={() => setClick({ agentId, path })} />
          ))}
        </ul>
        {/* Keyed by the file: a diff still being read is never shown under another file's name. */}
        <div className="flex min-w-0 flex-auto flex-col overflow-auto">
          <FilePreviewCard key={picked} projectId={projectId} agentId={agentId} path={picked} />
        </div>
      </div>
    </div>
  )
}
