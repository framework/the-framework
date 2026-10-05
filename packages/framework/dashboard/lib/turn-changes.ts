import type { FrameworkEvent } from '../../src/index.js'

// The files an agent's edits changed, turn by turn, off the log: each edit's own account of what
// it did to its file (the `changed` of a tool call's output), summed for each file of a turn.
// A file changed by a shell command is no edit and is not here: the Changes tab lists it.

/** One file a turn's edits changed. */
export interface ChangedFile {
  /** The file's path in the agent's checkout, as the Changes tab names it. */
  path: string
  /** The path's last part: what the row reads. */
  name: string
  added: number
  removed: number
  /** An edit of the turn made the file. */
  created: boolean
}

/** A path inside the agent's checkout, said from the checkout: the coding agents name a file by its whole path. */
export function inCheckout(path: string, workspace: string | undefined): string {
  const root = workspace?.replace(/\/+$/, '')
  return root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path
}

/** What an event says its tool call changed, if it is the output of one that changed a file. */
function changedBy(e: FrameworkEvent): readonly { path: string; added: number; removed: number; created?: true }[] {
  return e.kind === 'driver' && e.event.type === 'output' ? (e.event.changed ?? []) : []
}

function isPrompt(e: FrameworkEvent): boolean {
  return e.kind === 'driver' && e.event.type === 'start'
}

/**
 * The files each turn's edits changed, in the order first changed, each once with its edits
 * summed: `ended` under the prompt that ended the turn, `last` for the turn no prompt has ended
 * yet. A turn that changed no file has no entry.
 */
export function turnChanges(events: readonly FrameworkEvent[], workspace: string | undefined): { ended: Map<FrameworkEvent, ChangedFile[]>; last: ChangedFile[] } {
  // A file the turn made holds, at the turn's end, the lines its edits added less the ones they
  // removed again, and it removed none of an earlier file's: "+3 −0" then "+2 −1" is a new file of
  // four lines, "+4 −0". A file that was there before sums its edits as they are.
  const said = (turn: Map<string, ChangedFile>): ChangedFile[] => [...turn.values()].map(file => (file.created ? { ...file, added: Math.max(0, file.added - file.removed), removed: 0 } : file))
  const ended = new Map<FrameworkEvent, ChangedFile[]>()
  let turn = new Map<string, ChangedFile>()
  for (const e of events) {
    if (isPrompt(e)) {
      if (turn.size > 0) ended.set(e, said(turn))
      turn = new Map()
      continue
    }
    for (const change of changedBy(e)) {
      const path = inCheckout(change.path, workspace)
      const file = turn.get(path) ?? { path, name: path.replace(/\/+$/, '').split('/').pop() || path, added: 0, removed: 0, created: false }
      turn.set(path, { ...file, added: file.added + change.added, removed: file.removed + change.removed, created: file.created || change.created === true })
    }
  }
  return { ended, last: said(turn) }
}
