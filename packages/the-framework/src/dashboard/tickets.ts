import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { TICKETS_DIR } from '../tickets.js'
import { isSpikeLock } from '../spike-locks.js'

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
  /** The `status:` key (#1144/#1230). Defaults to `'open'` — a ticket written before the field
   *  existed is still open work, not one this silently drops from the default view. */
  status: 'open' | 'closed'
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
  /** Whether a real `<name>.spike.md` sits beside it — a `PENDING:` placeholder (#1327) does not
   *  count: that marks a spike in flight, not one done. */
  spiked: boolean
  /** Whether a real `<name>.plan.md` sits beside it, i.e. #685 already planned it. A `PENDING:`
   *  placeholder does not count, same as {@link WorkspaceTicket.spiked}. */
  planned: boolean
  /**
   * Whether a concurrent spike agent holds this ticket (#1327): a sibling exists whose content is
   * still the `PENDING:<agent>` placeholder the daemon locked it with. Mutually informative with
   * the two flags above rather than exclusive — a ticket whose real spike landed while its plan
   * stayed PENDING is `spiked` and `locked` at once.
   */
  locked?: boolean
  /**
   * The effort estimate a spike or plan recorded (#1144/#1265), e.g. `low` or `2h`. The spike
   * format asks for one ("Human intervention effort: trivial/low/…"), so the first `…effort…: value`
   * line in the `.spike.md` (else the `.plan.md`) is it. Absent when no sibling names one.
   */
  effort?: string
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
const SIBLING = /\.(plan|spike)\.md$/

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
 * Read the head of a ticket: the `key: value` block above the title (`status:`, `priority:`,
 * `topics:`, and whatever else is agreed later — all but `status:` optional), the `# ` heading,
 * and the `## TLDR`.
 *
 * Deliberately tolerant. The tickets already in a repo predate the format (they are GitHub
 * imports: a heading, prose, and a trailing `Source:` line), so anything missing falls back
 * rather than dropping the ticket from the list.
 */
function describe(md: string): {
  title?: string
  summary: string
  status: 'open' | 'closed'
  priority?: string
  topics?: string[]
  github?: TicketGithubLink
} {
  const lines = md.split('\n')
  const heading = lines.find(line => line.startsWith('# '))?.slice(2).trim()

  // The key block is above the title, so stop there rather than reading keys out of the body.
  const headingAt = lines.findIndex(line => line.startsWith('# '))
  const preamble = headingAt === -1 ? [] : lines.slice(0, headingAt)
  const statusValue = preamble
    .find(line => line.toLowerCase().startsWith('status:'))
    ?.slice('status:'.length)
    .trim()
    .toLowerCase()
  // Anything other than an explicit `closed` reads as open: a ticket written before this key
  // existed, or with a malformed value, is still open work rather than one this silently drops.
  const status = statusValue === 'closed' ? 'closed' : 'open'
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
    status,
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
 * A line naming an effort, e.g. `Human intervention effort: low` or `Estimated effort: 2h` —
 * anything before the colon that ends in "effort", and a non-empty value after it. The spike
 * format asks for these in prose rather than as a preamble key, so this scans whole lines.
 */
const EFFORT_LINE = /(?:^|[-*\s])[^:]*effort[^:]*:\s*(\S.*)/i

/** Long enough for "trivial (option A) / high (option B)"; short enough to stay a badge. */
const MAX_EFFORT_CHARS = 60

/**
 * The effort estimate recorded against a ticket (#1144/#1265): the first effort-naming line in
 * its `.spike.md`, else its `.plan.md` — the spike is where the format asks for the estimate, so
 * it wins when both name one. Undefined when neither sibling names one. Takes the contents in
 * that order rather than re-reading the files: the caller has already read them to tell a real
 * sibling from a `PENDING:` placeholder (#1327), and a placeholder names no effort anyway.
 */
function effortFrom(sources: readonly (string | undefined)[]): string | undefined {
  for (const md of sources) {
    if (md === undefined) continue
    for (const line of md.slice(0, MAX_TICKET_BYTES).split('\n')) {
      const match = EFFORT_LINE.exec(line)
      if (match) return match[1]!.trim().slice(0, MAX_EFFORT_CHARS)
    }
  }
  return undefined
}

/**
 * One sibling's state (#1327): absent, a `PENDING:` lock, or a real document whose content the
 * effort scan can use. Read whole rather than stat'd, because existence stopped being the answer
 * the moment a placeholder could exist — and the effort scan wanted the content anyway.
 */
async function readSibling(dir: string, name: string, siblings: Set<string>): Promise<{ real: boolean; pending: boolean; md?: string }> {
  if (!siblings.has(name)) return { real: false, pending: false }
  const md = await readFile(join(dir, name), 'utf8').catch(() => undefined)
  // An unreadable sibling keeps the pre-#1327 answer its existence gave: spiked, not locked.
  if (md === undefined) return { real: true, pending: false }
  return isSpikeLock(md) ? { real: false, pending: true } : { real: true, pending: false, md }
}

/**
 * The project's tickets, by filename, newest first (#1144). `[]` when the repo has no `tickets/`
 * directory at all, which is the state the view offers to import into.
 *
 * A `.spike.md` or `.plan.md` is written *about* a ticket rather than being one, so it never
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
    const stem = file.replace(/\.md$/, '')
    const { title, summary, status, priority, topics, github } = describe(content.slice(0, MAX_TICKET_BYTES))
    const [spike, plan] = await Promise.all([
      readSibling(dir, `${stem}.spike.md`, siblings),
      readSibling(dir, `${stem}.plan.md`, siblings),
    ])
    const locked = spike.pending || plan.pending
    const effort = effortFrom([spike.md, plan.md])
    tickets.push({
      file,
      title: title ?? titleFromFile(file),
      summary,
      status,
      ...(priority ? { priority } : {}),
      ...(topics ? { topics } : {}),
      ...(github ? { github } : {}),
      date,
      spiked: spike.real,
      planned: plan.real,
      ...(locked ? { locked } : {}),
      ...(effort ? { effort } : {}),
    })
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
 * and not one of a ticket's own siblings (a `.plan.md`/`.spike.md` is written about a ticket,
 * not one itself, same as {@link readTickets}).
 */
function isTicketFile(file: string): boolean {
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
  const stem = file.replace(/\.md$/, '')
  const { title, summary, status, priority, topics, github } = describe(content)
  const present = new Set(names)
  const [spike, plan] = await Promise.all([
    readSibling(dir, `${stem}.spike.md`, present),
    readSibling(dir, `${stem}.plan.md`, present),
  ])
  const locked = spike.pending || plan.pending
  const effort = effortFrom([spike.md, plan.md])
  return {
    file,
    title: title ?? titleFromFile(file),
    summary,
    status,
    ...(priority ? { priority } : {}),
    ...(topics ? { topics } : {}),
    ...(github ? { github } : {}),
    date,
    spiked: spike.real,
    planned: plan.real,
    ...(locked ? { locked } : {}),
    ...(effort ? { effort } : {}),
    content,
  }
}
