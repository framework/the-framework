import { useMemo, useState, type ElementType, type ReactNode } from 'react'
import { Check, FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react'
import type { AgentTree, FileMark } from '../../src/index.js'
import { onAgentTree, onProjectFileStatus } from '../rpc/reads.js'
import { usePolled } from '../lib/use-async.js'
import { cn } from '../lib/utils.js'
import { FilePreviewHover } from './FilePreview.js'

type FileGitStatus = FileMark['status']

/** The row tint for a changed file or folder — one meaning, one colour (F4). */
const STATUS_TEXT: Record<FileGitStatus, string> = {
  untracked: 'text-success',
  added: 'text-success',
  modified: 'text-warning',
  deleted: 'text-danger',
}

/** The dot a changed folder carries, in the same vocabulary. */
const STATUS_DOT: Record<FileGitStatus, string> = {
  untracked: 'bg-success',
  added: 'bg-success',
  modified: 'bg-warning',
  deleted: 'bg-danger',
}

/** A changed file says which change it is; a folder only says that something under it changed. */
const STATUS_LETTER: Record<FileGitStatus, string> = { untracked: 'U', added: 'A', modified: 'M', deleted: 'D' }

/** One tree row: an icon, a name, and git's verdict on the right when it has one. */
function Row({ icon: Icon, gitStatus, mark, className, children }: {
  icon: ElementType
  /** A folder's roll-up: a dot says something under it changed. */
  gitStatus?: FileGitStatus | undefined
  /** A file's own change: its letter, then a solid dot when committed or a ring when only on disk. */
  mark?: FileMark | undefined
  className?: string
  children: ReactNode
}) {
  const status = mark?.status ?? gitStatus
  return (
    <span className={cn('flex items-center justify-between gap-2 p-2', status && STATUS_TEXT[status], className)}>
      <span className="flex items-center gap-2">
        <Icon className="size-4.5 shrink-0" />
        <span className="text-sm">{children}</span>
      </span>
      {mark ? (
        <span className="flex items-center gap-1" aria-label={`${mark.status}, ${mark.committed ? 'committed' : 'not committed'}`}>
          <span className="text-sm font-medium">{STATUS_LETTER[mark.status]}</span>
          <span className={cn('size-1.5 shrink-0 rounded-full', mark.committed ? 'bg-current' : 'border border-current')} />
        </span>
      ) : (
        gitStatus && <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[gitStatus])} />
      )}
    </span>
  )
}

/** Stable, so the `useMemo` on the marks doesn't re-run for a fresh empty object. */
const EMPTY_STATUS: Record<string, FileMark['status']> = {}

/** Where a run's tree was read from, in the words the caption says it. */
function sourceCaption(tree: AgentTree): string | undefined {
  if (tree.source === 'checkout') return 'From the run’s checkout'
  if (tree.source === 'branch') return `From branch ${tree.branch}`
  if (tree.source === 'merge') return `From the merge of #${tree.number}`
  if (tree.source === 'unchanged') return 'This run changed no files'
  return undefined
}

// The project panel's file tree (#492): a lazy, collapsible tree built from the flat
// `git ls-files` list (onProjectFiles, shared with the `#` picker #504). A run's tree is its own
// read (onAgentTree): its checkout, then its branch, then its merge commit, so a finished run keeps
// showing what it changed; a run that changed nothing shows the project's files with nothing
// marked, and a run whose changes none of those still holds says so in one line. It is a viewer,
// not an editor: hovering a file previews it. With no files, it renders nothing.
//
// Folders are native `<details>`: open/closed state, keyboard operation and the disclosure
// semantics come from the browser. This used to be 1,225 lines of vendored animate-ui — a copied
// component registry, not a dependency, and `@ts-nocheck`'d so none of it was even typechecked —
// whose contribution was an expand animation and a hover highlight on a file list in a side panel.

type TreeNode = {
  name: string
  path: string
  dirs: Map<string, TreeNode>
  files: string[]
}

/** Build a nested tree from repo-relative paths like `src/dashboard/foo.ts`. */
function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', path: '', dirs: new Map(), files: [] }
  for (const p of paths) {
    const parts = p.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i]!
      const childPath = node.path ? `${node.path}/${seg}` : seg
      let child = node.dirs.get(seg)
      if (!child) {
        child = { name: seg, path: childPath, dirs: new Map(), files: [] }
        node.dirs.set(seg, child)
      }
      node = child
    }
    node.files.push(p)
  }
  return root
}

/** Roll each changed file's status up to its ancestor folders so a folder dots when dirty. */
function foldersFromMarks(marks: Record<string, FileMark>): Map<string, FileGitStatus> {
  const dirs = new Map<string, FileGitStatus>()
  for (const [path, { status: st }] of Object.entries(marks)) {
    const parts = path.split('/')
    let acc = ''
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i]!
      const prev = dirs.get(acc)
      dirs.set(acc, prev && prev !== st ? 'modified' : st) // mixed children read as modified
    }
  }
  return dirs
}

const EMPTY_FILES: string[] = []

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

export function FileTree({
  projectId,
  agentId: agentId,
  files,
  selected,
  onToggle,
}: {
  projectId: string
  /** The selected run: the tree is then the run's own (onAgentTree), not the project's (#815). */
  agentId?: string | null | undefined
  /** The project's files, shown when no run is selected. */
  files: string[]
  /** The Context set: a file in it shows ticked. */
  selected: Set<string>
  /** Tick or untick a file in the Context. */
  onToggle: (path: string) => void
}) {
  const [query, setQuery] = useState('')

  // The project's per-file git status (#492), polled so it tracks edits; with a run selected, the
  // run's own tree and marks instead (#815), polled so it tracks an agent editing files.
  const { value: projectStatus } = usePolled<Record<string, FileGitStatus>>(
    agentId ? null : () => onProjectFileStatus(projectId),
    EMPTY_STATUS,
    8_000,
    [projectId, agentId],
  )
  const { value: runTree, loaded: treeLoaded } = usePolled<AgentTree | null>(
    agentId ? () => onAgentTree(projectId, agentId) : null,
    null,
    8_000,
    [projectId, agentId],
  )
  const runFiles = runTree && 'files' in runTree ? runTree : undefined
  const shown = agentId ? (runFiles?.files ?? EMPTY_FILES) : files
  const marks = useMemo<Record<string, FileMark>>(
    () =>
      agentId
        ? (runFiles?.changes ?? {})
        : Object.fromEntries(Object.entries(projectStatus).map(([path, status]) => [path, { status, committed: false }])),
    [agentId, runFiles, projectStatus],
  )

  const folderStatus = useMemo(() => foldersFromMarks(marks), [marks])

  // A search narrows to matching files (and the folders on their way), so the tree is usable
  // on a large repo without scrolling. Empty query shows everything.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? shown.filter(f => f.toLowerCase().includes(q)) : shown
  }, [shown, query])

  const tree = useMemo(() => buildTree(visible), [visible])

  const renderNode = (node: TreeNode) => (
    <>
      {[...node.dirs.values()].sort(byName).map(dir => {
        const dirGit = folderStatus.get(dir.path)
        return (
          <details key={dir.path} className="group">
            <summary className="cursor-pointer list-none rounded-lg hover:bg-accent">
              <Row icon={FolderIcon} gitStatus={dirGit} className="group-open:hidden">
                {dir.name}
              </Row>
              <Row icon={FolderOpenIcon} gitStatus={dirGit} className="hidden group-open:flex">
                {dir.name}
              </Row>
            </summary>
            {/* The guide line down the left of a folder's contents. */}
            <div className="relative ml-6 before:absolute before:inset-y-0 before:-left-2 before:h-full before:w-px before:bg-border">
              {renderNode(dir)}
            </div>
          </details>
        )
      })}
      {[...node.files]
        .sort((a, b) => a.localeCompare(b))
        .map(path => {
          const name = path.slice(path.lastIndexOf('/') + 1)
          const isOn = selected.has(path)
          const git = marks[path]
          // No `title`: the hover preview card already leads with the full path, and a native
          // tooltip on top of it is the slow system one the dashboard no longer uses (#1149).
          const item = (
            <button
              type="button"
              onClick={() => onToggle(path)}
              className={cn('w-full rounded-lg text-start hover:bg-accent', isOn && 'text-primary')}
            >
              <Row icon={isOn ? Check : FileIcon} mark={git}>
                {name}
              </Row>
            </button>
          )
          // Every file previews on hover: a changed one shows its diff (#816), an unchanged one
          // its contents (#828). `git` picks which read the card makes, so the tree's own status
          // map answers that rather than a second server lookup.
          return (
            <FilePreviewHover key={path} projectId={projectId} agentId={agentId} path={path} changed={Boolean(git)}>
              {item}
            </FilePreviewHover>
          )
        })}
    </>
  )

  if (agentId && (!treeLoaded || runTree?.source === 'pending')) {
    return <p className="p-3 text-xs text-muted-foreground">Looking for this run’s changes…</p>
  }
  // No checkout, no branch and no merge commit on this machine: say so rather than show the
  // project root unmarked, which reads as "this run touched nothing".
  if (agentId && runTree?.source === 'gone') {
    return (
      <p className="p-3 text-xs text-muted-foreground">
        This run’s changes are gone from this machine: its checkout was reclaimed and it left no branch or merged pull request here.
      </p>
    )
  }
  if (shown.length === 0) return null
  const caption = runTree ? sourceCaption(runTree) : undefined

  return (
    <div className="flex min-h-0 flex-auto flex-col p-2">
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Filter files…"
        aria-label="Filter files"
        className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
      />
      {caption && <p className="px-1 pb-1 text-[10px] text-muted-foreground">{caption}</p>}
      {/* A query with zero hits used to render an empty pane, which reads as broken (#948). */}
      {query.trim() && visible.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">No files match &ldquo;{query.trim()}&rdquo;.</p>
      ) : (
        <>
          {query.trim() && (
            <p className="px-1 pb-1 text-[10px] text-muted-foreground">
              {visible.length} of {shown.length} files
            </p>
          )}
          {/* The tree is the one panel with no scroller of its own, so it carries one: a long repo
              scrolls here rather than stretching the rail past what follows it. */}
          <div className="min-h-0 w-full flex-auto overflow-y-auto text-sm">{renderNode(tree)}</div>
        </>
      )}
    </div>
  )
}
