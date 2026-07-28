import { join } from 'node:path'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { errorMessage } from './error-message.js'
import { nodeGitRunner, type GitRunner } from './project.js'
import { FLAT_TODO_FILE, TICKETS_DIR, todoPriorityForTicket } from './tickets.js'

/**
 * Turn a plan's own verdict into queued work (#1334).
 *
 * The missing link in the autonomy chain. Tickets arrive from GitHub, [Spike & plan] costs them,
 * and the drain implements whatever is on the queue -- but nothing carried a plan's conclusion
 * onto that queue, so a ticket the planner had already judged trivial still waited for a triage
 * run to read the same ticket and reach the same conclusion a second time.
 *
 * The promotion is done here rather than by an agent because it is a decision the plan has
 * already made: reading two keys out of a file and appending a line needs judgement from nobody,
 * and spending a subscription turn to re-derive an answer already written down is the waste #879
 * exists to avoid. It is the daemon that writes, for the reason queue-promote.ts gives: agents
 * stay sandboxed in their worktrees with no write access to the checkout.
 */

/** How much work the plan says the ticket is. */
export type PlanEffort = 'quick-win' | 'significant'

/** Whether the plan says there is anything left to decide. */
export type PlanConsensus = 'consensual' | 'open-questions'

/** The two keys a plan records about itself, absent when the plan did not say. */
export interface PlanVerdict {
  effort?: PlanEffort
  consensus?: PlanConsensus
}

const EFFORTS: readonly string[] = ['quick-win', 'significant']
const CONSENSUS: readonly string[] = ['consensual', 'open-questions']

/**
 * Read a plan file's verdict keys.
 *
 * Only the header is scanned -- everything above the first `##` section -- because that is where
 * the ticket format puts its keys, and because a plan that *discusses* quick wins in its prose
 * must not be read as declaring itself one.
 */
export function parsePlanVerdict(md: string): PlanVerdict {
  const verdict: PlanVerdict = {}
  for (const line of md.split('\n')) {
    if (line.startsWith('## ')) break
    const key = /^\s*(Effort|Consensus)\s*:\s*(.+?)\s*$/i.exec(line)
    if (!key) continue
    const value = key[2]!.toLowerCase()
    if (/^effort$/i.test(key[1]!)) {
      if (EFFORTS.includes(value) && verdict.effort === undefined) verdict.effort = value as PlanEffort
    } else if (CONSENSUS.includes(value) && verdict.consensus === undefined) {
      verdict.consensus = value as PlanConsensus
    }
  }
  return verdict
}

/**
 * Whether a plan authorises the drain to implement its ticket unattended.
 *
 * Fails closed, and demands both keys explicitly: the same polarity as `quotaHeadroom` (#879),
 * for the same reason. A plan that forgot to say, or said something this version does not
 * recognise, means a human decides -- not that an agent starts.
 */
export function isAutoImplementable(verdict: PlanVerdict): boolean {
  return verdict.effort === 'quick-win' && verdict.consensus === 'consensual'
}

/** `tickets/<slug>.plan.md` for `tickets/<slug>.md`, and the read back. */
export function planPathFor(ticket: string): string {
  return `${ticket.slice(0, -'.md'.length)}.plan.md`
}

/** The ticket a plan belongs to, or undefined for a file that is not one. */
export function ticketForPlan(plan: string): string | undefined {
  if (!plan.endsWith('.plan.md')) return undefined
  return `${plan.slice(0, -'.plan.md'.length)}.md`
}

/** A ticket's `Status:`/`Priority:`/title, as the queue needs them. */
export interface TicketHeader {
  title: string
  priority: number
  open: boolean
}

/**
 * Read a ticket's header. Keys sit above the `# Title`, per the ticket format.
 *
 * A ticket with no `Status:` counts as open: the key is what a *closed* ticket is marked with,
 * and treating an unmarked one as closed would silently drop it out of the roadmap.
 */
export function parseTicketHeader(md: string): TicketHeader {
  const title = /^#\s+(.+?)\s*$/m.exec(md)?.[1]?.trim() ?? ''
  const status = /^\s*Status\s*:\s*(.+?)\s*$/im.exec(md)?.[1]?.trim().toLowerCase()
  const priority = /^\s*Priority\s*:\s*(.+?)\s*$/im.exec(md)?.[1]?.trim()
  return { title, priority: todoPriorityForTicket(priority), open: status !== 'closed' }
}

/** The queue line for a planned ticket: the link, and nothing else. */
export function queueEntryFor(ticket: string, title: string): string {
  return `[${title}](${ticket})`
}

const PRIORITY_HEADING = /^##\s+Priority\s+(\d+)\b/

/**
 * Add an entry under its priority heading, creating the section when the file has none.
 *
 * Placement is the whole point rather than a nicety: `parseTodoEntries` returns entries in file
 * order and the drain takes the first, so an entry appended to the end of the file is the last
 * thing that would ever be worked -- which is the opposite of what "autonomously work on
 * quick-wins" asks for. Additive like `landPinnedEntry`, so it composes with whatever else is
 * mid-flight: it only ever inserts one line.
 */
export function insertQueueEntry(md: string, entry: string, priority: number): string {
  const lines = md.split('\n')
  const headings = lines.flatMap((line, i) => {
    const found = PRIORITY_HEADING.exec(line)
    return found ? [{ index: i, priority: Number(found[1]) }] : []
  })
  const line = `- ${entry}`

  if (!headings.length) {
    const body = md.endsWith('\n') || md === '' ? md : `${md}\n`
    return `${body}${line}\n`
  }

  const own = headings.find(h => h.priority === priority)
  if (own) {
    // The end of the section: the line before the next heading, with trailing blanks left where
    // they are so the file's spacing survives.
    const next = headings.find(h => h.index > own.index)
    let end = next ? next.index : lines.length
    while (end > own.index + 1 && lines[end - 1]!.trim() === '') end--
    return [...lines.slice(0, end), line, ...lines.slice(end)].join('\n')
  }

  // No section for this priority yet. Sections run high to low, so the new one goes before the
  // first section that is less urgent, or after the last one when it is the least urgent of all.
  const before = headings.find(h => h.priority < priority)
  const at = before ? before.index : lines.length
  const section = [`## Priority ${priority}`, '', line, '']
  if (!before) {
    while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop()
    return [...lines, '', ...section].join('\n')
  }
  return [...lines.slice(0, at), ...section, ...lines.slice(at)].join('\n')
}

/** Everything the promotion reads and writes, injected so the policy above tests off disk. */
export interface PlanPromoteDeps {
  list?: (dir: string) => Promise<string[]>
  read?: (path: string) => Promise<string>
  write?: (path: string, content: string) => Promise<void>
  git?: GitRunner
}

/** What one promotion pass did. Never throws: this runs on a background tick. */
export interface PlanPromotion {
  /** The entries appended, in the order they were added. */
  queued: string[]
  /** Why nothing was queued, when nothing was. */
  reason?: string
  /**
   * Something stood in the way, as opposed to there simply being nothing to promote.
   *
   * The distinction is what keeps the daemon log readable: "no plan called its ticket a quick-win"
   * is the ordinary state of a healthy repo and would otherwise print on every tick of every
   * project forever, burying the one line that means a human should look.
   */
  blocked?: true
}

/** The commit message a promotion writes, naming the count so the history reads at a glance. */
export function plannedQueueMessage(count: number): string {
  return `[The Framework] queue ${count} planned quick-win${count === 1 ? '' : 's'}`
}

/**
 * Queue every ticket whose plan declares itself a consensual quick-win and that is not on the
 * queue already (#1334).
 *
 * Skips wholesale on a dirty queue file, for the same reason `promoteQueue` does: a human editing
 * the queue by hand outranks an unattended tidy-up, and the next tick will try again.
 */
export async function promotePlannedQuickWins(
  projectCwd: string,
  deps: PlanPromoteDeps = {},
): Promise<PlanPromotion> {
  const list = deps.list ?? (dir => readdir(dir))
  const read = deps.read ?? (path => readFile(path, 'utf8'))
  const write = deps.write ?? ((path, content) => writeFile(path, content, 'utf8'))
  const git = deps.git ?? nodeGitRunner()

  try {
    const files = await list(join(projectCwd, TICKETS_DIR)).catch(() => [])
    const plans = files.filter(file => file.endsWith('.plan.md')).sort()
    if (!plans.length) return { queued: [], reason: 'no plans yet' }

    const queuePath = join(projectCwd, FLAT_TODO_FILE)
    let queue = await read(queuePath).catch(() => '')

    const dirty = (await git(['status', '--porcelain', '--', FLAT_TODO_FILE], projectCwd)).trim()
    if (dirty) return { queued: [], reason: 'the checkout has uncommitted queue changes', blocked: true }

    const queued: string[] = []
    for (const plan of plans) {
      const ticket = ticketForPlan(`${TICKETS_DIR}/${plan}`)
      if (!ticket) continue
      // Already on the queue, open or checked off: `queue.includes` on the link target is enough
      // because the entry is written as a link to exactly this path.
      if (queue.includes(`(${ticket})`)) continue

      const verdict = parsePlanVerdict(await read(join(projectCwd, TICKETS_DIR, plan)).catch(() => ''))
      if (!isAutoImplementable(verdict)) continue

      const header = parseTicketHeader(await read(join(projectCwd, ticket)).catch(() => ''))
      // A ticket whose file is gone or whose title is empty has nothing a queue line could say,
      // and a closed one is not work.
      if (!header.title || !header.open) continue

      const entry = queueEntryFor(ticket, header.title)
      queue = insertQueueEntry(queue, entry, header.priority)
      queued.push(entry)
    }

    if (!queued.length) return { queued: [], reason: 'no plan called its ticket a consensual quick-win' }

    await write(queuePath, queue)
    await git(['add', '--', FLAT_TODO_FILE], projectCwd)
    await git(['commit', '-m', plannedQueueMessage(queued.length), '--', FLAT_TODO_FILE], projectCwd)
    return { queued }
  } catch (err) {
    return { queued: [], reason: errorMessage(err), blocked: true }
  }
}
