import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { FLAT_TODO_FILE } from './tickets.js'

// The disk half of `tickets.ts`, split out the way `system-prompt-file.ts` is from
// `system-prompt.ts`: the client barrel reaches the ticket path/entry helpers through
// `auto-pm.ts`, so nothing in `tickets.ts` may import `node:*` (#431).

/** Whether a workspace-relative path is an existing file. Never throws. */
async function isFile(cwd: string, rel: string): Promise<boolean> {
  return stat(join(cwd, rel))
    .then(s => s.isFile())
    .catch(() => false)
}

/**
 * The workspace's flat backlog file: the root `TODO_AGENTS.md`, or `undefined` when it does not
 * exist. The pre-#682 spellings (`TODO-DRIVERS.md`, `tickets/TODO.md`, root `TODO.md`) are no
 * longer read — one convention, one location.
 */
export async function findFlatTodo(cwd: string): Promise<string | undefined> {
  return (await isFile(cwd, FLAT_TODO_FILE)) ? FLAT_TODO_FILE : undefined
}
