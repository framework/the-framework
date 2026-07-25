import { stat } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The root `tickets/` directory (#629): a plain repo convention where The Framework
 * keeps its human-facing roadmap files, rather than hiding them in a proprietary
 * `.the-framework/` dir. It sits beside conventions like the `knowledge-base/` docs. Since
 * #682 moved the backlog out to a root `TODO_AGENTS.md`, this directory holds only
 * ticket files (`<DATE>_<SLUG>.md`).
 */
export const TICKETS_DIR = 'tickets'

/**
 * The flat, durable backlog/roadmap file — the confirmed-task queue (the "AI task queue"
 * the #683 context fragment names). Lives at the repo root as `TODO_AGENTS.md` (#682):
 * moved out of `tickets/` so that directory holds only tickets. This is the file a run
 * drains and the dashboard surfaces; the session-scoped `TODO_<slug>.agent.md` files the
 * system prompt writes are separate and also live at the root.
 */
export const FLAT_TODO_FILE = 'TODO_AGENTS.md'

// The format specs for {@link TICKETS_DIR} and {@link FLAT_TODO_FILE} (#684/#880) are no longer
// named here as a path. They used to be the two `node_modules/@gemstack/the-framework/prompts/*.md`
// pointers the #683 context fragment handed the agent, which only resolve when the framework is a
// root dependency of the repo it works on — so the agent could not open them and both files drifted
// from the format (#1163). The spec content now travels in the system channel itself; see
// `CONTEXT_FORMATS` in system-prompt.ts. The priority sections that spec describes need no parser
// support: `parseTodoEntries` skips headings and returns entries in file order, so a
// priority-sorted file drains in priority order.

/**
 * Which `## Priority N` section a ticket's own `priority:` key earns it, translating the ticket
 * format's words into the backlog format's numbers (#1164).
 *
 * The two formats were specified separately and never mapped onto each other, so a ticket put on
 * the queue had no ranked place to land. The scale's ends are reserved by `todo_format.md`
 * itself: 10 is "rarely used, critical production bugs", which nothing queued by a click should
 * claim, and 0 is "only if capacity", which is a decision about the ticket rather than a
 * translation of it. An unmarked ticket sits in the middle, which is what the ticket format
 * saying `priority:` is optional has to mean.
 */
export function todoPriorityForTicket(priority?: string): number {
  switch (priority?.trim().toLowerCase()) {
    case 'urgent':
      return 9
    case 'high':
      return 7
    case 'low':
      return 2
    default:
      return 5
  }
}

/** The brief hyphen spelling from #682, read as a fallback after #674 settled on the underscore. */
export const LEGACY_HYPHEN_TODO_FILE = 'TODO-AGENTS.md'

/** The #629 backlog location (under `tickets/`), read as a fallback after #682 moved it to the root. */
export const LEGACY_TICKETS_TODO_FILE = `${TICKETS_DIR}/TODO.md`

/** The pre-#629 root location, still read so an older repo keeps its backlog. */
export const LEGACY_TODO_FILE = 'TODO.md'

/** Whether a workspace-relative path is an existing file. Never throws. */
async function isFile(cwd: string, rel: string): Promise<boolean> {
  return stat(join(cwd, rel))
    .then(s => s.isFile())
    .catch(() => false)
}

/**
 * The workspace's flat backlog file, newest convention first: the root `TODO_AGENTS.md`,
 * else the brief hyphen spelling, else the #629 `tickets/TODO.md`, else the pre-#629 root
 * `TODO.md`. Returns the workspace-relative path, or `undefined` when none exists. New
 * backlogs are created at {@link FLAT_TODO_FILE}.
 */
export async function findFlatTodo(cwd: string): Promise<string | undefined> {
  for (const rel of [FLAT_TODO_FILE, LEGACY_HYPHEN_TODO_FILE, LEGACY_TICKETS_TODO_FILE, LEGACY_TODO_FILE]) {
    if (await isFile(cwd, rel)) return rel
  }
  return undefined
}
