import { useMemo, useState, type ElementType, type ReactNode } from 'react'
import { Check, FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react'
import { onProjectFileStatus } from '../server/reads.telefunc.js'
import { usePolled } from '../lib/use-async.js'
import { cn } from '../lib/utils.js'
import { FilePreviewHover } from './FilePreview.js'

type FileGitStatus = 'untracked' | 'modified' | 'deleted'

/** The row tint for a changed file or folder — one meaning, one colour (F4). */
const STATUS_TEXT: Record<FileGitStatus, string> = {
  untracked: 'text-success',
  modified: 'text-warning',
  deleted: 'text-danger',
}

/** The dot a changed folder carries, in the same vocabulary. */
const STATUS_DOT: Record<FileGitStatus, string> = {
  untracked: 'bg-success',
  modified: 'bg-warning',
  deleted: 'bg-danger',
}

/** A changed file says which change it is; a folder only says that something under it changed. */
const STATUS_LETTER: Record<FileGitStatus, string> = { untracked: 'U', modified: 'M', deleted: 'D' }

/** One tree row: an icon, a name, and git's verdict on the right when it has one. */
function Row({ icon: Icon, gitStatus, badge, className, children }: {
  icon: ElementType
  gitStatus?: FileGitStatus | undefined
  /** `letter` for a file (which change), `dot` for a folder (something under it). */
  badge: 'letter' | 'dot'
  className?: string
  children: ReactNode
}) {
  return (
    <span className={cn('flex items-center justify-between gap-2 p-2', gitStatus && STATUS_TEXT[gitStatus], className)}>
      <span className="flex items-center gap-2">
        <Icon className="size-4.5 shrink-0" />
        <span className="text-sm">{children}</span>
      </span>
      {gitStatus &&
        (badge === 'letter' ? (
          <span className="text-sm font-medium">{STATUS_LETTER[gitStatus]}</span>
        ) : (
          <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[gitStatus])} />
        ))}
    </span>
  )
}

/** Stable, so the `useMemo` on `status` doesn't re-run for a fresh empty object. */
const EMPTY_STATUS: Record<string, FileGitStatus> = {}

// The project panel's file tree (#492): a lazy, collapsible tree built from the flat
// `git ls-files` list (onProjectFiles, shared with the `#` picker #504). It is a file-level
// CONTEXT PICKER, not an editor — clicking a file toggles it in the run Context, the same
// set the `#` chips and the whole-repo Context selector feed. Localhost-only: no files (the
// relay has no checkout) renders nothing.
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
function foldersFromStatus(status: Record<string, FileGitStatus>): Map<string, FileGitStatus> {
  const dirs = new Map<string, FileGitStatus>()
  for (const [path, st] of Object.entries(status)) {
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

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

export function FileTree({
  projectId,
  runId,
  files,
  selected,
  onToggle,
}: {
  projectId: string
  /** The selected run, so the dots describe its worktree and not the project root (#815). */
  runId?: string | null | undefined
  files: string[]
  selected: Set<string>
  onToggle: (path: string) => void
}) {
  const [query, setQuery] = useState('')

  // Per-file git status for the dots (#492): polled so it tracks a run editing files. Scoped to
  // the selected run's worktree (#815) so the dots agree with the branch and Serve in the action
  // bar right above, which have resolved the worktree since #738.
  const { value: status } = usePolled<Record<string, FileGitStatus>>(
    () => onProjectFileStatus(projectId, runId ?? undefined),
    EMPTY_STATUS,
    8_000,
    [projectId, runId],
  )

  const folderStatus = useMemo(() => foldersFromStatus(status), [status])

  // A search narrows to matching files (and the folders on their way), so the tree is usable
  // on a large repo without scrolling. Empty query shows everything.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? files.filter(f => f.toLowerCase().includes(q)) : files
  }, [files, query])

  const tree = useMemo(() => buildTree(visible), [visible])

  const renderNode = (node: TreeNode) => (
    <>
      {[...node.dirs.values()].sort(byName).map(dir => {
        const dirGit = folderStatus.get(dir.path)
        return (
          <details key={dir.path} className="group">
            <summary className="cursor-pointer list-none rounded-lg hover:bg-accent">
              <Row icon={FolderIcon} gitStatus={dirGit} badge="dot" className="group-open:hidden">
                {dir.name}
              </Row>
              <Row icon={FolderOpenIcon} gitStatus={dirGit} badge="dot" className="hidden group-open:flex">
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
          const git = status[path]
          // No `title`: the hover preview card already leads with the full path, and a native
          // tooltip on top of it is the slow system one the dashboard no longer uses (#1149).
          const item = (
            <button
              type="button"
              onClick={() => onToggle(path)}
              className={cn('w-full rounded-lg text-start hover:bg-accent', isOn && 'text-primary')}
            >
              <Row icon={isOn ? Check : FileIcon} gitStatus={git} badge="letter">
                {name}
              </Row>
            </button>
          )
          // Every file previews on hover: a changed one shows its diff (#816), an unchanged one
          // its contents (#828). `git` picks which read the card makes, so the tree's own status
          // map answers that rather than a second server lookup.
          return (
            <FilePreviewHover key={path} projectId={projectId} runId={runId} path={path} changed={Boolean(git)}>
              {item}
            </FilePreviewHover>
          )
        })}
    </>
  )

  if (files.length === 0) return null

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
      {/* A query with zero hits used to render an empty pane, which reads as broken (#948). */}
      {query.trim() && visible.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">No files match &ldquo;{query.trim()}&rdquo;.</p>
      ) : (
        <>
          {query.trim() && (
            <p className="px-1 pb-1 text-[10px] text-muted-foreground">
              {visible.length} of {files.length} files
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
