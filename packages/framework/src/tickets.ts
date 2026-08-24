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
 * the repo-context (#683) fragment names). Lives at the repo root as `TODO_AGENTS.md` (#682):
 * moved out of `tickets/` so that directory holds only tickets. This is the file an agent
 * drains and the dashboard surfaces — the only backlog kind since the session-scoped
 * `TODO_<slug>.agent.md` files were retired (#1369).
 */
export const FLAT_TODO_FILE = 'TODO_AGENTS.md'

// The format specs for {@link TICKETS_DIR} and {@link FLAT_TODO_FILE} (#684/#880) are no longer
// named here as a path. They used to be the two `node_modules/@gemstack/the-framework/prompts/*.md`
// pointers the repo-context (#683) fragment handed the agent, which only resolve when the framework is a
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
 *
 * A number is taken at its word, because that is what the ticket format specifies
 * (`Priority: 10-0`) and what every ticket writes — the word spellings (`urgent`/`high`/`low`)
 * once mapped here were never part of the format and are no longer read. Out-of-range and
 * fractional values are not clamped into something plausible: they are not a priority on this
 * scale, and inventing one hides the typo.
 */
export function todoPriorityForTicket(priority?: string): number {
  const written = priority?.trim()
  if (written !== undefined && /^\d+$/.test(written)) {
    const value = Number(written)
    if (value >= 0 && value <= 10) return value
  }
  return 5
}

/**
 * The ask for one ticket's plan (#685): `Create tickets/<stem>.plan.md`, the `.md` swapped for the
 * sibling `.plan.md` the plan views read. The one wording for plan work wherever it is asked —
 * the sentence the [Plan tickets] preset queues, the plan column starts an attended agent with,
 * and the dashboard's bulk queue-add writes as entries — so the surfaces cannot drift apart
 * (#1187) and a queued copy is recognizable by exact text.
 */
export function planTicketPrompt(file: string): string {
  return `Create ${TICKETS_DIR}/${file.replace(/\.md$/, '')}.plan.md`
}

/**
 * The ticket a queue entry came from, or `undefined` for an entry that is just text (#1117).
 *
 * Queueing a ticket writes the entry as a markdown link back to it (#1164), so the identity the
 * queue used to drop is already on the line — this is the read side of that write. Only a link
 * into {@link TICKETS_DIR} counts, and only one whose target stays inside it: the result names a
 * file a reader will go and open, so an entry linking anywhere else is treated as plain text
 * rather than followed. A relative segment, an absolute path, a URL, or a nested directory all
 * fail that test.
 */
export function ticketFromQueueEntry(entry: string): string | undefined {
  const target = /\]\(([^)\s]+)\)/.exec(entry)?.[1]
  return target && isTicketPath(target) ? target : undefined
}

/**
 * Whether a string names a ticket file: `tickets/<name>.md`, and nothing else (#1117).
 *
 * The one gate for both ends of the link — what a queue entry is read as, and what the `--ticket`
 * flag is allowed to record — because the result is a path the dashboard renders and a reader
 * opens. A relative segment, an absolute path, a URL, a dotfile, or anything nested deeper all
 * fail it, so no caller has to think about the difference.
 */
export function isTicketPath(path: string): boolean {
  if (!path.startsWith(`${TICKETS_DIR}/`)) return false
  const file = path.slice(TICKETS_DIR.length + 1)
  return file.endsWith('.md') && !file.includes('/') && !file.startsWith('.')
}

/**
 * The GitHub issue a ticket tracks, as a `#42` reference, or `undefined` when it tracks none.
 *
 * Read off the ticket's `GitHub: [#42](…/issues/42)` header line (`prompts/ticketing_format.md`).
 * The number comes from the URL when there is one — the label is display text, the URL is the
 * identity — with the label's own `#42` as the fallback for a hand-written line.
 *
 * This is what lets a merge close the ticket's issue (#1334): the reference rides the PR title
 * as `(fix #42)`, and GitHub's squash subject inherits the title.
 */
export function ticketIssueRef(md: string): string | undefined {
  const line = md.split('\n').find(l => l.trim().toLowerCase().startsWith('github:'))
  if (!line) return undefined
  const url = /\((?:[^)]*\/)?(?:issues|pull)\/(\d+)\)/.exec(line)
  const match = url ?? /#(\d+)/.exec(line)
  return match ? `#${match[1]}` : undefined
}

