import { basename } from 'node:path'
import type { ProjectSummary } from './projects.js'
import { readDocs, type WorkspaceDoc } from './docs.js'

// The cross-project Queue (#438, part of #314). The per-project docs rail already surfaces
// a project's TODO (see docs.ts / onDocs), but the first sidebar needs the aggregate: every
// registered project's open TODO items in one place. This parses the GitHub-style task-list
// items out of each project's surfaced TODO docs and rolls them up per project.

/** One TODO checklist entry: its text and whether it is checked off. */
export interface QueueItem {
  text: string
  done: boolean
}

/** One project's rolled-up TODO queue. */
export interface ProjectQueue {
  projectId: string
  projectName: string
  /** Count of unchecked items (what is still queued). */
  open: number
  /** Count of all parsed items (open + done). */
  total: number
  items: QueueItem[]
}

// A markdown list item (`-`, `*`, or `1.`), any leading indent. Same rule as the sweep's
// `parseTodoEntries` (todo-loop.ts), deliberately: the queue's readers must agree on what an
// entry is, or the card says "Nothing queued" while the sweep drains the same file (#1296).
const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+(.*\S)\s*$/
// A GitHub-style task checkbox at the start of an item's text: `[ ]` open, `[x]` done.
const CHECKBOX = /^\[([ xX])\]\s*(.*)$/

/**
 * Parse the queue entries out of a TODO doc; headings, prose and blank lines are ignored.
 *
 * Every list item is an entry, open unless its checkbox is checked — the sweep's semantics
 * (#1296). Triage agents write the ticket-link (#1164) style (`- [Title](tickets/x.md) — ...`) with no
 * checkbox, and the old checkbox-only regex read that whole queue as empty.
 */
export function parseTodoItems(content: string): QueueItem[] {
  const items: QueueItem[] = []
  for (const line of content.split('\n')) {
    const item = LIST_ITEM.exec(line)
    if (!item) continue
    const task = CHECKBOX.exec(item[1]!)
    if (task) {
      if (task[2]!.trim()) items.push({ text: task[2]!.trim(), done: task[1] !== ' ' })
    } else {
      items.push({ text: item[1]!, done: false })
    }
  }
  return items
}

/**
 * Roll up the open TODO queue across the given projects, most-open first. Reads each
 * project's surfaced TODO docs (the `TODO*` half of {@link readDocs}) and parses their
 * checklist items. `read` is injectable so this is unit-testable off disk. Projects with
 * no TODO doc or no checklist items are omitted; a read failure just skips that project.
 */
export async function collectQueue(
  projects: ProjectSummary[],
  read: (cwd: string) => Promise<WorkspaceDoc[]> = readDocs,
): Promise<ProjectQueue[]> {
  const queues: ProjectQueue[] = []
  for (const project of projects) {
    const docs = await read(project.path).catch(() => [])
    const items = docs.filter(d => basename(d.name).startsWith('TODO')).flatMap(d => parseTodoItems(d.content))
    if (items.length === 0) continue
    const open = items.filter(i => !i.done).length
    queues.push({ projectId: project.id, projectName: project.name, open, total: items.length, items })
  }
  return queues.sort((a, b) => b.open - a.open)
}
