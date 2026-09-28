import { useEffect, useState, useSyncExternalStore } from 'react'
import { ChevronRight } from 'lucide-react'
import { DiffStat, cn, useModuleHost, type ModuleRunProps } from 'framework/module'
import type { FileChange } from '../src/diff.js'
import { readChanges } from './reads.js'
import { FilePreviewCard } from './FilePreview.js'

// What a working run has changed so far, on its page (#817): a count in the run's action bar and,
// with the bar open, the list of changed files, each opening to its diff. Watching an agent you saw
// `· Edit` go by and never learned which file moved; finding out meant leaving the dashboard.
//
// Read from the run's own checkout, not from the agent's tool calls: a tool's name reaches the
// dashboard but not its arguments, and git is both the honest source (the outcome, not the intent)
// and the one that works for every coding agent. Read only while the run works: once it has ended,
// the dashboard's handoff says what its branch holds, and until that is read the count stays as the
// run left it (#1030) rather than blanking.
//
// The count is the one reader: the bar always shows it while the run works, and the list shows
// what the count last read, so the checkout is read once per tick however much of the page is open.

const EMPTY: FileChange[] = []

const LABEL: Record<FileChange['status'], string> = {
  untracked: 'new',
  added: 'new',
  modified: 'modified',
  deleted: 'deleted',
}

const TONE: Record<FileChange['status'], string> = {
  untracked: 'text-success',
  added: 'text-success',
  modified: 'text-warning',
  deleted: 'text-danger',
}

function ChangeRow({ projectId, agentId: agentId, change }: { projectId: string; agentId: string; change: FileChange }) {
  const [open, setOpen] = useState(false)
  const dir = change.path.slice(0, change.path.lastIndexOf('/') + 1)
  const name = change.path.slice(change.path.lastIndexOf('/') + 1)

  return (
    <li className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent"
      >
        <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          <span className="text-muted-foreground">{dir}</span>
          <span className={cn(change.status === 'deleted' && 'line-through')}>{name}</span>
        </span>
        <span className={cn('shrink-0 text-[10px] uppercase tracking-wide', TONE[change.status])}>
          {LABEL[change.status]}
        </span>
        {!change.binary && <DiffStat added={change.added} removed={change.removed} />}
      </button>
      {/* Mounted only while open, so the run view costs one `git status` + one `numstat` until
          you actually ask for a file's diff. */}
      {open && (
        <div className="border-t border-border bg-muted/30">
          <FilePreviewCard projectId={projectId} agentId={agentId} path={change.path} />
        </div>
      )}
    </li>
  )
}

/** The last changes read for each run, by project and run, with the components showing them. */
const lastRead = new Map<string, FileChange[]>()
const listeners = new Set<() => void>()
const keyOf = (projectId: string, agentId: string) => `${projectId}\0${agentId}`

function publish(key: string, changes: FileChange[]): void {
  lastRead.set(key, changes)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

/** The changes last read for the run. */
function useLastRead(projectId: string, agentId: string): FileChange[] {
  const key = keyOf(projectId, agentId)
  return useSyncExternalStore(subscribe, () => lastRead.get(key) ?? EMPTY)
}

/** How many files the working run has touched, and how many lines, in its action bar (#1023). */
export function ChangesSummary({ projectId, agentId, working }: ModuleRunProps) {
  const host = useModuleHost()
  const changes = useLastRead(projectId, agentId)
  // Read every 8 seconds while the run works, and never after: a run with no checkout left has
  // nothing to read, and the count it ended with stays until the handoff takes over.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!working) return
    const timer = setInterval(() => setTick(t => t + 1), 8_000)
    return () => clearInterval(timer)
  }, [working])
  useEffect(() => {
    if (!working) return
    let live = true
    readChanges(host, projectId, agentId).then(
      next => live && publish(keyOf(projectId, agentId), next),
      () => {}, // a failed read keeps the last count; the next tick usually succeeds
    )
    return () => void (live = false)
    // `host` is the same services every render; the read is keyed by the run and the tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, agentId, working, tick])

  if (changes.length === 0) return null
  const added = changes.reduce((sum, c) => sum + c.added, 0)
  const removed = changes.reduce((sum, c) => sum + c.removed, 0)
  return (
    <span className="flex items-center gap-x-2 text-muted-foreground">
      <span>
        {changes.length} {changes.length === 1 ? 'file' : 'files'}
      </span>
      <DiffStat added={added} removed={removed} className="text-xs" />
    </span>
  )
}

/**
 * The working run's changed files, under its action bar while the bar is open. A run that changed
 * nothing yet shows nothing: an empty panel above the output would only push the output down.
 */
export function ChangesDetails({ projectId, agentId, working, expanded }: ModuleRunProps) {
  const changes = useLastRead(projectId, agentId)
  if (!working || !expanded || changes.length === 0) return null
  return (
    <section className="border-b border-border" aria-label="Changed files">
      <ul className="max-h-80 overflow-auto">
        {changes.map(change => (
          <ChangeRow key={change.path} projectId={projectId} agentId={agentId} change={change} />
        ))}
      </ul>
    </section>
  )
}
