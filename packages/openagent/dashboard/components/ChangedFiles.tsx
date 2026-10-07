import { ChevronRight, FileText } from 'lucide-react'
import type { ChangedFile } from '../lib/turn-changes.js'

// The lines a change added and removed, as "+11 −0": added in green, removed in red.
export function LinesChanged({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="shrink-0 tabular-nums">
      <span className="text-success">+{added}</span> <span className="text-danger">−{removed}</span>
    </span>
  )
}

// The files a turn's edits changed, at the end of the turn, as Claude Code on the web lists them:
// a bordered row for each file, with its name, the lines added and removed, and an arrow. A click
// shows the file's change (`onOpen`); with nothing to open it in, the rows are no buttons.
export function ChangedFiles({ files, onOpen }: { files: readonly ChangedFile[]; onOpen?: ((path: string) => void) | undefined }) {
  return (
    <ul aria-label="Files changed" className="flex min-w-0 flex-1 flex-col gap-1 font-sans text-sm">
      {files.map(file => {
        const row = (
          <>
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left text-foreground" title={file.path}>
              {file.name}
            </span>
            <LinesChanged added={file.added} removed={file.removed} />
            {onOpen && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
          </>
        )
        const look = 'flex w-full min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-2'
        return (
          <li key={file.path} className="min-w-0">
            {onOpen ? (
              <button type="button" onClick={() => onOpen(file.path)} aria-label={`Show the change to ${file.name}`} className={`${look} hover:bg-muted`}>
                {row}
              </button>
            ) : (
              <div className={look}>{row}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
