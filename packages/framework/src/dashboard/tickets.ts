import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { TICKETS_DIR } from '../tickets.js'
import { ticketLockHolder } from '../ticket-locks.js'

/**
 * One ticket in `tickets/` (#697). The dashboard lists these so the backlog the agent plans
 * from is visible without opening the repo.
 */
export interface WorkspaceTicket {
  /** Filename inside `tickets/`, which is also its identity. */
  file: string
  /** The `# ` heading, else the filename made readable. */
  title: string
  /** The `## TLDR` line, else the first prose line. Empty when the ticket has neither. */
  summary: string
  /** The optional `priority:` key, verbatim (a `0`-`10` string; `10` acts immediately). */
  priority?: string
  /** The optional `topics:` key (`topics: [dx, ui]`), as bare tags. */
  topics?: string[]
  /** The optional `GitHub:` key (`GitHub: [#42](https://github.com/org/repo/issues/42)`), split
   *  into the link text and the URL it points at. */
  github?: TicketGithubLink
  /**
   * ISO 8601 (#1144/#1265). The `<DATE>_<SLUG>.md` filename's date when it has one — the format
   * every ticket is written in, imports included — else the file's mtime, for the rare ticket that
   * predates the format. Moves forward on an mtime-dated ticket edited in place (the GitHub update,
   * #1208); a filename-dated one keeps the date it was created on, same as the file itself does.
   */
  date: string
  /** Whether a `<name>.plan.md` sits beside it, i.e. #685 already planned it. */
  planned: boolean
  /**
   * Whether an agent holds this ticket (#1420): a `<name>.lock.md` claim exists — it is planning
   * the ticket or implementing it directly. Mutually informative with `planned` rather than
   * exclusive: the lock covers the ticket's whole life, so a locked ticket may also be planned
   * while its agent keeps working.
   */
  locked?: boolean
  /**
   * Who the `.lock.md` names, from its `CLAIMED: <holder>` line (#1420) — shown so a human can
   * tell whose claim they are about to release. Absent when the lock is missing or unreadable.
   */
  lockedBy?: string
  /**
   * The `Effort:` its `.plan.md` preamble records (`ticketing_format.md`: `0`-`10`, 0 trivial,
   * 10 takes months). Absent when unplanned or the plan names none.
   */
  effort?: number
  /**
   * The `Uncertainty:` its `.plan.md` preamble records (`0`-`10`, 0 an obvious implementation,
   * 10 highly uncertain how). Absent when unplanned or the plan names none.
   */
  uncertainty?: number
}

/** A ticket's `GitHub:` link, split into what a reader clicks and where it goes. */
export interface TicketGithubLink {
  /** As written, e.g. `#42` — not re-derived, in case the source ever names a PR differently. */
  label: string
  /** The issue/PR URL the label links to. */
  url: string
}

/**
 * What `tickets/meta.json` records about the last import (#1208).
 *
 * Written by the agent doing the import, in the same commit as the tickets it describes, and read
 * here so the view can say when `tickets/` last caught up with GitHub. A repo imported before this
 * file existed simply has no stamp, which reads as "not known" rather than as an error.
 */
export interface TicketsMeta {
  /** ISO 8601 UTC, the moment the last import began. Absent when nothing has recorded one. */
  lastImportedAt?: string
}

/** The meta file's name inside `tickets/`. */
const META_FILE = 'meta.json'

/** Big enough for a stamp and whatever is agreed later; small enough that a junk file cannot be read whole. */
const MAX_META_BYTES = 10_000

/** How much of a ticket is read looking for its heading and TLDR. */
const MAX_TICKET_BYTES = 4_000

/** A ticket's siblings, which are not tickets of their own. */
const SIBLING = /\.(plan|lock)\.md$/

/**
 * Whether the project has any ticket at all (#958).
 *
 * A `readdir` rather than a {@link readTickets} parse: the Onboarding checklist only needs
 * presence, and it asks for every project on each dashboard poll, so reading and describing
 * every ticket to answer a yes/no would be paid over and over.
 */
export async function hasTickets(cwd: string): Promise<boolean> {
  const names = await readdir(join(cwd, TICKETS_DIR)).catch(() => [] as string[])
  return names.some(name => name.endsWith('.md') && !SIBLING.test(name))
}

/**
 * The last-import stamp, or `{}` when there is none to read (#1208).
 *
 * Every failure lands on the same answer — no file, unreadable, not JSON, a `lastImportedAt` that
 * is not a usable date — because the file is written by an agent and read into the UI. "We do not
 * know when this last synced" is a true and harmless thing to say; throwing at the view over a
 * malformed optional file is not.
 */
export async function readTicketsMeta(cwd: string): Promise<TicketsMeta> {
  const raw = await readFile(join(cwd, TICKETS_DIR, META_FILE), 'utf8').catch(() => undefined)
  if (raw === undefined) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(0, MAX_META_BYTES))
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null) return {}
  const stamp = (parsed as Record<string, unknown>)['lastImportedAt']
  // Parsed rather than merely non-empty: the value is rendered as a date, and a string the
  // browser cannot parse would show as "Invalid Date" in the one place claiming to be factual.
  if (typeof stamp !== 'string' || Number.isNaN(Date.parse(stamp))) return {}
  return { lastImportedAt: stamp }
}

/**
 * A filename made readable, for a ticket with no heading. The format is
 * `<DATE>_<SLUG>.md`, but the tickets imported from GitHub are `<number>-<escaped title>.md`,
 * so decoding and de-underscoring gets both most of the way there.
 */
function titleFromFile(file: string): string {
  const withoutExt = file.replace(/\.md$/, '')
  try {
    return decodeURIComponent(withoutExt).replace(/_/g, ' ')
  } catch {
    // A stray `%` is not an escape; the raw name still reads better than throwing.
    return withoutExt.replace(/_/g, ' ')
  }
}

/**
 * Read the head of a ticket: the `key: value` block above the title (`priority:`, `topics:`, and
 * whatever else is agreed later — all optional), the `# ` heading, and the `## TLDR`.
 *
 * Deliberately tolerant. The tickets already in a repo predate the format (they are GitHub
 * imports: a heading, prose, and a trailing `Source:` line), so anything missing falls back
 * rather than dropping the ticket from the list.
 */
function describe(md: string): {
  title?: string
  summary: string
  priority?: string
  topics?: string[]
  github?: TicketGithubLink
} {
  const lines = md.split('\n')
  const heading = lines.find(line => line.startsWith('# '))?.slice(2).trim()

  // The key block is above the title, so stop there rather than reading keys out of the body.
  const headingAt = lines.findIndex(line => line.startsWith('# '))
  const preamble = headingAt === -1 ? [] : lines.slice(0, headingAt)
  const priority = preamble
    .find(line => line.toLowerCase().startsWith('priority:'))
    ?.slice('priority:'.length)
    .trim()
    .toLowerCase()
  // `topics: [dx, ui]` — the brackets are cosmetic (the format doc shows them, but nothing else
  // in this reader requires them), so they are stripped rather than required.
  const topicsLine = preamble.find(line => line.toLowerCase().startsWith('topics:'))?.slice('topics:'.length).trim()
  const topics = topicsLine
    ?.replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)

  // `GitHub: [#42](https://github.com/org/repo/issues/42)` — a bare Markdown link, so pulling the
  // label and URL back out of it is all parsing this needs.
  const githubLine = preamble.find(line => line.toLowerCase().startsWith('github:'))?.slice('github:'.length).trim()
  const githubMatch = githubLine ? /\[([^\]]+)\]\(([^)]+)\)/.exec(githubLine) : null
  const github = githubMatch ? { label: githubMatch[1]!, url: githubMatch[2]! } : undefined

  // The TLDR is the ticket in one line, which is exactly what a list row wants.
  const tldrAt = lines.findIndex(line => line.trim().toLowerCase() === '## tldr')
  const body = tldrAt === -1 ? lines.slice(headingAt + 1) : lines.slice(tldrAt + 1)
  const summary =
    body.find(line => line.trim() !== '' && !line.startsWith('#') && !line.startsWith('Source:'))?.trim() ?? ''

  return {
    ...(heading ? { title: heading } : {}),
    ...(priority ? { priority } : {}),
    ...(topics && topics.length > 0 ? { topics } : {}),
    ...(github ? { github } : {}),
    summary,
  }
}

/** `<DATE>_<SLUG>.md`'s `<DATE>`, at midnight UTC. */
const FILENAME_DATE = /^(\d{4}-\d{2}-\d{2})_/

/**
 * The date a ticket's own filename carries (#1144/#1265), when it carries one. Every ticket the
 * format describes is written `<DATE>_<SLUG>.md` — imports included, since the import preset
 * follows the same format — so this is the one true "when" for a ticket, unlike the file's mtime,
 * which moves every time the file is merely edited (a GitHub update reconciling it, #1208).
 */
function dateFromFilename(file: string): string | undefined {
  const match = FILENAME_DATE.exec(file)
  return match ? `${match[1]}T00:00:00.000Z` : undefined
}

/** A file's mtime as ISO 8601, or the epoch when it cannot be stat'd — sorts last, not thrown. */
async function fileDate(path: string): Promise<string> {
  const info = await stat(path).catch(() => undefined)
  return (info?.mtime ?? new Date(0)).toISOString()
}

/** A ticket's date (#1144/#1265): its filename's, else its mtime for the rare ticket predating
 *  the dated-filename format. */
async function ticketDate(dir: string, file: string): Promise<string> {
  return dateFromFilename(file) ?? fileDate(join(dir, file))
}

/**
 * A plan preamble's `0`-`10` value, or `undefined` when the key is missing or does not name one.
 * Out-of-range and fractional values are not clamped into something plausible, same as
 * `todoPriorityForTicket`: they are not a value on this scale, and inventing one hides the typo.
 */
function planScale(preamble: readonly string[], key: string): number | undefined {
  const written = preamble
    .find(line => line.toLowerCase().startsWith(`${key}:`))
    ?.slice(key.length + 1)
    .trim()
  if (written === undefined || !/^\d+$/.test(written)) return undefined
  const value = Number(written)
  return value >= 0 && value <= 10 ? value : undefined
}

/**
 * What a `.plan.md`'s preamble records (`ticketing_format.md`): `Effort: 0-10` and
 * `Uncertainty: 0-10`, the keys above the `# [Plan]` heading. Reads only up to the heading, like
 * a ticket's own preamble — the body is the plan, not metadata.
 */
function planMeta(md: string | undefined): { effort?: number; uncertainty?: number } {
  if (md === undefined) return {}
  const lines = md.slice(0, MAX_TICKET_BYTES).split('\n')
  const headingAt = lines.findIndex(line => line.startsWith('# '))
  const preamble = headingAt === -1 ? lines : lines.slice(0, headingAt)
  const effort = planScale(preamble, 'effort')
  const uncertainty = planScale(preamble, 'uncertainty')
  return { ...(effort === undefined ? {} : { effort }), ...(uncertainty === undefined ? {} : { uncertainty }) }
}

/**
 * One sibling's state: absent, or present with its content for the preamble read. Existence is the
 * answer again since #1420 — a claim is its own `.lock.md` file, never placeholder content
 * inside a plan.
 */
async function readSibling(dir: string, name: string, siblings: Set<string>): Promise<{ real: boolean; md?: string }> {
  if (!siblings.has(name)) return { real: false }
  const md = await readFile(join(dir, name), 'utf8').catch(() => undefined)
  return { real: true, ...(md === undefined ? {} : { md }) }
}

/**
 * A ticket's `.lock.md` claim (#1420): whether it exists, and who its `CLAIMED:` line names. An
 * unreadable or malformed lock still locks — the file's existence is the claim; the holder is
 * display sugar.
 */
async function readLock(dir: string, name: string, siblings: Set<string>): Promise<{ locked: boolean; lockedBy?: string }> {
  if (!siblings.has(name)) return { locked: false }
  const md = await readFile(join(dir, name), 'utf8').catch(() => undefined)
  const lockedBy = md === undefined ? undefined : ticketLockHolder(md)
  return { locked: true, ...(lockedBy === undefined ? {} : { lockedBy }) }
}

/**
 * One ticket's row: what the head of its markdown says about itself, plus what the `.plan.md` and
 * `.lock.md` beside it add. `head` is the whole file for the detail page and the first
 * {@link MAX_TICKET_BYTES} for a list row — nothing below that is ever shown.
 */
async function ticketRow(dir: string, file: string, head: string, date: string, siblings: Set<string>): Promise<WorkspaceTicket> {
  const stem = file.replace(/\.md$/, '')
  const { title, summary, priority, topics, github } = describe(head)
  const [plan, lock] = await Promise.all([
    readSibling(dir, `${stem}.plan.md`, siblings),
    readLock(dir, `${stem}.lock.md`, siblings),
  ])
  return {
    file,
    title: title ?? titleFromFile(file),
    summary,
    ...(priority ? { priority } : {}),
    ...(topics ? { topics } : {}),
    ...(github ? { github } : {}),
    date,
    planned: plan.real,
    ...(lock.locked ? { locked: true } : {}),
    ...(lock.lockedBy !== undefined ? { lockedBy: lock.lockedBy } : {}),
    ...planMeta(plan.md),
  }
}

/**
 * The project's tickets, by filename, newest first (#1144). `[]` when the repo has no `tickets/`
 * directory at all, which is the state the view offers to import into.
 *
 * A `.plan.md` or `.lock.md` is written *about* a ticket rather than being one, so it never
 * becomes a row of its own: it marks its ticket instead.
 */
export async function readTickets(cwd: string): Promise<WorkspaceTicket[]> {
  const dir = join(cwd, TICKETS_DIR)
  const names = await readdir(dir).catch(() => [] as string[])
  const md = names.filter(name => name.endsWith('.md')).sort()
  const siblings = new Set(md.filter(name => SIBLING.test(name)))
  const tickets: WorkspaceTicket[] = []
  for (const file of md) {
    if (siblings.has(file)) continue
    // Only the head: a ticket can be long, and nothing below it is shown.
    const [content, date] = await Promise.all([
      readFile(join(dir, file), 'utf8').catch(() => undefined),
      ticketDate(dir, file),
    ])
    if (content === undefined) continue
    tickets.push(await ticketRow(dir, file, content.slice(0, MAX_TICKET_BYTES), date, siblings))
  }
  // Newest first: what changed most recently is what the list is for (#1144), and it is the only
  // ordering that means the same thing for a dated ticket and a bare GitHub-imported one alike.
  tickets.sort((a, b) => b.date.localeCompare(a.date))
  return tickets
}

/** One ticket, with its entire markdown rather than just the head (#1144's detail page). */
export interface WorkspaceTicketDetail extends WorkspaceTicket {
  /** The ticket's full text, unlike {@link readTickets}' head-only read. */
  content: string
}

/**
 * A bare filename inside `tickets/`: no path segments (so it cannot address another directory)
 * and not one of a ticket's own siblings (a `.plan.md`/`.lock.md` is written about a ticket, not
 * one itself, same as {@link readTickets}). Exported for the RPCs that take a ticket filename
 * from the browser (#1420's release).
 */
export function isTicketFile(file: string): boolean {
  return /^[^/\\]+\.md$/.test(file) && !SIBLING.test(file)
}

/**
 * One ticket by filename, full text included, for its own page (#1144) rather than the list's
 * head-only row. Null when `file` is not a bare `.md` name, is a sibling rather than a ticket,
 * or does not exist.
 */
export async function readTicket(cwd: string, file: string): Promise<WorkspaceTicketDetail | null> {
  if (!isTicketFile(file)) return null
  const dir = join(cwd, TICKETS_DIR)
  const [content, date, names] = await Promise.all([
    readFile(join(dir, file), 'utf8').catch(() => undefined),
    ticketDate(dir, file),
    readdir(dir).catch(() => [] as string[]),
  ])
  if (content === undefined) return null
  return { ...(await ticketRow(dir, file, content, date, new Set(names))), content }
}
