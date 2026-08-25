import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DriverSession } from './driver/index.js'
import type { ChoicePick, ChoiceRequest, FrameworkEvent } from './events.js'
import { requestChoices, runAwaitRounds } from './await-gate.js'
import { FLAT_TODO_FILE, ticketFromQueueEntry } from './tickets.js'
import { dataProjectRoot, readDataFile, withDataBranch } from './data-branch.js'
import { drainsQueue } from './preset-catalog.js'
import { createTurnSignalEmitter } from './turn-gate.js'

export { FLAT_TODO_FILE, TICKETS_DIR, ticketFromQueueEntry, todoPriorityForTicket } from './tickets.js'

/**
 * The backlog loop (#323): once the main work settles, consume the agent's own
 * TODO backlog one entry per turn until it is empty. The agent writes the
 * backlog itself (a very large scope, the Maintenance follow-ups, or the
 * [Research] preset's deep-dive picks all append entries); the framework only
 * drives: read the file, gate ("start the next item?") when someone can answer,
 * prompt the agent to complete exactly one entry and check it off, repeat.
 * Termination is Rom's call on the issue: stop when the backlog is empty. The
 * dashboard's autopilot auto-accepts the per-item gate, so `[x] autopilot`
 * consumes the whole backlog unattended; autopilot off pauses before each entry.
 */

/** A located backlog: its filename and the entries still open. */
export interface TodoBacklog {
  /** The backlog filename (workspace-root relative, e.g. `TODO_AGENTS.md`). */
  name: string
  /** The open (unchecked) entries, in file order. */
  entries: string[]
}

/**
 * The open entries of a backlog document: markdown list items (`-`, `*`, or
 * `1.`), where a task checkbox counts only while unchecked (`- [ ]`); a checked
 * `- [x]` entry is done. Headings, prose, and blank lines are not entries.
 */
export function parseTodoEntries(md: string): string[] {
  const entries: string[] = []
  for (const line of md.split('\n')) {
    const item = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line)
    if (!item) continue
    const text = item[1]!.trim()
    if (!text) continue
    const task = /^\[([ xX])\]\s*(.*)$/.exec(text)
    if (task) {
      if (task[1] !== ' ') continue // checked off = done
      if (task[2]!.trim()) entries.push(task[2]!.trim())
    } else {
      entries.push(text)
    }
  }
  return entries
}

/**
 * Append an open entry to the queue on the data branch (#1582), creating {@link FLAT_TODO_FILE}
 * when the branch has none. Resolves with the file written, or `undefined` if it couldn't be.
 *
 * This is how a paused agent leaves word to pick itself up again (#529): the
 * backlog is already the thing a later agent drains, so a resume note needs no
 * machinery of its own. Never throws — it is called while an agent is already
 * unwinding, and must not mask the reason it stopped.
 */
export async function appendTodoEntry(cwd: string, entry: string): Promise<string | undefined> {
  return queueWrite(cwd, '[The Framework] queue a resume note', md => {
    const separator = md === '' || md.endsWith('\n') ? '' : '\n'
    return `${md}${separator}- [ ] ${entry}\n`
  })
}

/**
 * Append an open entry to the queue with a priority, creating {@link FLAT_TODO_FILE} when there
 * is none.
 *
 * The difference from {@link appendTodoEntry} is the priority placement (#1164): a dashboard
 * pick (#697) lands in its `## Priority N` section rather than at the end of the file.
 */
export async function appendFlatTodoEntry(
  cwd: string,
  entry: string,
  priority?: number,
): Promise<string | undefined> {
  return queueWrite(cwd, '[The Framework] queue an entry', md =>
    priority !== undefined
      ? insertTodoEntry(md, entry, priority)
      : `${md}${md === '' || md.endsWith('\n') ? '' : '\n'}- [ ] ${entry}\n`,
  )
}

/**
 * One edit of the queue file, through the data branch's write funnel (#1582): resolve the project
 * root (an agent calls this from its worktree; the data checkout lives beside the main repo),
 * apply the pure edit, let the funnel commit and push it. Never throws; `undefined` means the
 * write did not land.
 */
async function queueWrite(cwd: string, message: string, edit: (md: string) => string): Promise<string | undefined> {
  const root = await dataProjectRoot(cwd).catch(() => undefined)
  if (!root) return undefined
  const result = await withDataBranch(root, message, async dir => {
    const path = join(dir, FLAT_TODO_FILE)
    const md = await readFile(path, 'utf8').catch(() => '')
    await writeFile(path, edit(md), 'utf8')
  })
  return result.ok ? FLAT_TODO_FILE : undefined
}

/** A `## Priority 7` heading, with whatever gloss the format's example puts after the number. */
const PRIORITY_HEADING = /^##\s+priority\s+(\d{1,2})\b/i

/** Any second-level heading, which is where a priority section ends. */
const SECTION_HEADING = /^##\s+/

/**
 * Place an open entry in the backlog's priority section (`prompts/todo_format.md`), creating the
 * section when the file has none, and return the new document.
 *
 * Pure, because the placement is the whole point and it is much easier to pin here than through
 * the filesystem. The old behaviour was a plain append, which put a just-queued ticket at the
 * *end* of the file — and since the drain preset works "the FIRST open entry" and
 * {@link parseTodoEntries} reads in file order, queueing something meant it would be worked last,
 * behind everything already there (#1164).
 *
 * Placement rules, in the order they are tried:
 * - a section for this priority already exists: the entry joins the end of it, so a queue keeps
 *   its arrival order within a priority
 * - otherwise the section is created before the first *lower*-priority section, since the format
 *   sorts high to low
 * - with no priority sections at all, it goes above the first heading of any kind: the file's
 *   own sections are then unranked, and burying a deliberate pick under them is the bug
 */
export function insertTodoEntry(md: string, entry: string, priority: number): string {
  const item = `- [ ] ${entry}`
  const lines = md.split('\n')
  const headings = lines
    .map((line, index) => ({ index, priority: Number(PRIORITY_HEADING.exec(line)?.[1]) }))
    .filter(h => Number.isFinite(h.priority))

  const existing = headings.find(h => h.priority === priority)
  if (existing) {
    // The end of that section: the last line before the next heading that is not blank, so the
    // entry lands under the section's last item rather than after its trailing blank line.
    let end = lines.findIndex((line, index) => index > existing.index && SECTION_HEADING.test(line))
    if (end === -1) end = lines.length
    while (end > existing.index + 1 && lines[end - 1]!.trim() === '') end--
    lines.splice(end, 0, item)
    return lines.join('\n')
  }

  const section = [`## Priority ${priority}`, '', item, '']
  const lower = headings.find(h => h.priority < priority)
  if (lower) {
    lines.splice(lower.index, 0, ...section)
    return lines.join('\n')
  }
  if (headings.length) {
    // Every existing section outranks it, so it goes last -- but still as its own section.
    const last = headings[headings.length - 1]!
    let end = lines.findIndex((line, index) => index > last.index && SECTION_HEADING.test(line))
    if (end === -1) end = lines.length
    while (end > last.index + 1 && lines[end - 1]!.trim() === '') end--
    lines.splice(end, 0, '', ...section.slice(0, 3))
    return lines.join('\n')
  }
  const firstHeading = lines.findIndex(line => SECTION_HEADING.test(line))
  if (firstHeading === -1) {
    const separator = md === '' || md.endsWith('\n') ? '' : '\n'
    return `${md}${separator}${section.slice(0, 3).join('\n')}\n`
  }
  lines.splice(firstHeading, 0, ...section)
  return lines.join('\n')
}

/**
 * Retire one open entry in a queue document: check its box (or give a bare bullet one, checked).
 * The same "open" grammar {@link parseTodoEntries} reads (#1164/#1297), the retire half of what
 * `queue-promote.ts` did before #1582 made the daemon the queue's one local writer.
 */
export function checkOffEntry(md: string, entry: string): string {
  const line = /^(\s*(?:[-*]|\d+\.)\s+)(?:\[([ xX])\]\s*)?(.*)$/
  return md
    .split('\n')
    .map(row => {
      const item = line.exec(row)
      if (!item || item[3]?.trim() !== entry || item[2] === 'x' || item[2] === 'X') return row
      return `${item[1]}[x] ${item[3]!.trim()}`
    })
    .join('\n')
}

/**
 * The backlog and its open entries, read off the data branch (#1582) — the queue's one location,
 * readable from the project checkout and from any agent worktree alike. Returns `undefined` when
 * no queue exists or it has no open entry. Session-scoped `TODO_<slug>.agent.md` files are
 * retired (#1369).
 *
 * `fresh: true` re-fetches the branch first: for a long-lived agent process about to act on the
 * queue, where the local ref may trail what other writers pushed meanwhile.
 */
export async function findTodoBacklog(cwd: string, opts: { fresh?: boolean } = {}): Promise<TodoBacklog | undefined> {
  const md = await readDataFile(cwd, FLAT_TODO_FILE, opts)
  if (md === undefined) return undefined
  const entries = parseTodoEntries(md)
  return entries.length ? { name: FLAT_TODO_FILE, entries } : undefined
}

/**
 * Does this session's own backlog still have open work (#1363)?
 *
 * Reads only `TODO_<SESSION_NAME>.agent.md` — the file the [Research] preset (and a very-large
 * scope) has the agent keep for its own session. Never the global `TODO_AGENTS.md`: the queue is
 * decoupled from sessions (#1390), and withholding a merge on it would mean auto-merge never
 * fires while the project has any backlog at all. `false` on a missing or unreadable file, and on
 * a session name that could not name a file — no pendingness known is not pendingness.
 *
 * TEMPORARY SAFETY BELT, built to be deleted (#1390): the agent's setReadyForMerge() is the
 * authorization, and this only catches the agent declaring done while its own session file says
 * otherwise. When the agent's word is deemed enough, delete this function and its single call
 * site in `maybeAutoHandoff`.
 */
export async function agentTodoPending(cwd: string, sessionName: string | undefined): Promise<boolean> {
  // The prompt asks for [a-z0-9-]+; anything wider (a path separator above all) names no file.
  if (!sessionName || !/^[A-Za-z0-9._-]+$/.test(sessionName)) return false
  const md = await readFile(join(cwd, `TODO_${sessionName}.agent.md`), 'utf8').catch(() => undefined)
  return md !== undefined && parseTodoEntries(md).length > 0
}

/**
 * The ticket the next drain agent will pick up, or `undefined` when there is none (#1117).
 *
 * "Next" is the first open entry of the flat backlog, because that is what the [Drain queue]
 * preset says to work ("the FIRST open entry only") and {@link parseTodoEntries} returns entries
 * in file order. Read from the project checkout, the same copy the sweep already consults when it
 * decides whether there is anything to drain, so the entry this names is the entry that decision
 * was made on.
 *
 * A best guess by construction: the agent reads its own worktree a moment later, and an entry
 * checked off in between would move it on. Being wrong here costs a mislabelled lane on the
 * Overview and nothing else — no run is started or steered by this.
 */
export async function nextQueuedTicket(cwd: string): Promise<string | undefined> {
  const md = await readDataFile(cwd, FLAT_TODO_FILE)
  if (md === undefined) return undefined
  const first = parseTodoEntries(md)[0]
  return first ? ticketFromQueueEntry(first) : undefined
}

/**
 * The ticket an agent started by hand is about to implement, when that agent is a drain (#1117).
 *
 * The daemon already does this for the sweep's own drain, off the `drains` flag on the job. An agent
 * fired from the dashboard reaches the same start with none of that context, so a hand-fired drain
 * showed up working on nothing: the agent implemented the ticket, and the lane it belonged in stayed
 * empty. Same read as the sweep's, so both agree on which entry is next.
 *
 * Undefined for anything that is not a drain, and for a drain over an empty queue. The `read` seam
 * is for tests; production always takes the default.
 */
export async function ticketForPrompt(
  prompt: string,
  cwd: string,
  read: (cwd: string) => Promise<string | undefined> = nextQueuedTicket,
): Promise<string | undefined> {
  if (!drainsQueue(prompt)) return undefined
  return read(cwd).catch(() => undefined)
}

/** Why the loop ended. */
export type TodoLoopReason =
  /** The backlog is empty (or was never written) — the success case. */
  | 'empty'
  /** The user picked "stop" at a per-item gate. */
  | 'stopped'
  /** Two check-offs in a row could not be written to the data branch. */
  | 'stalled'
  /** The item cap was reached with entries still open. */
  | 'max-items'

/** What {@link runTodoLoop} resolves with. */
export interface TodoLoopResult {
  /** Backlog entries worked (turns taken), regardless of outcome. */
  completed: number
  /** Why the loop ended. */
  reason: TodoLoopReason
  /** The backlog filename, when one was found. */
  file?: string
  /**
   * An answer marked `stop` (#358) inside an item's turn — a plan the user declined — ends the
   * whole session, not just the loop. Distinct from the benign `reason: 'stopped'` per-item gate,
   * which only stops draining the backlog. The caller aborts the session on this.
   */
  sessionStopped?: boolean
}

/** Options for {@link runTodoLoop}. */
export interface TodoLoopOptions {
  /** The live driver session the agent already owns. */
  session: DriverSession
  /** The workspace the backlog lives in. */
  cwd: string
  /** Emit the loop's events onto the agent stream. */
  emit: (event: FrameworkEvent) => void
  /**
   * The interactive gate handler (#304). When wired, the loop pauses before each
   * entry ("start the next item?") — the dashboard's autopilot auto-accepts, so
   * autopilot off means a human gate per item (#323). Headless runs don't pause.
   */
  requestChoice?: ((req: ChoiceRequest) => Promise<ChoicePick>) | undefined
  /** The agent signal; aborting (Stop button / budget cap #322) ends the loop. */
  signal?: AbortSignal | undefined
  /** Hard cap on entries worked in one agent. Default {@link DEFAULT_MAX_TODO_ITEMS}. */
  maxItems?: number | undefined
}

/** The default per-agent cap on backlog entries — a backstop beside the budget cap (#322). */
const DEFAULT_MAX_TODO_ITEMS = 25

/** How many consecutive failed check-off writes before the loop stops rather than spins. */
const MAX_STALLS = 2

/**
 * Drive the backlog to empty: read the next open entry (fresh off the data branch), gate, prompt
 * the agent to complete exactly that entry, check it off on the data branch, and repeat. The
 * check-off is the framework's, not the agent's (#1582): the queue lives on a branch the agent's
 * checkout does not hold, and the one writer model keeps every edit going through the same
 * funnel. Caps make it safe to leave unattended (#322's concern): the agent's budget/abort
 * signal ends any turn, a hard item cap bounds the agent, and two check-offs in a row failing to
 * land stop the loop instead of re-working the same entry. A backlog turn is a turn like any
 * other: await gates (`showChoices()` / `showMultiSelect()`) and the signals (`showMarkdown()`,
 * `setSessionName()`, `setReadyForMerge()`) are honored here too.
 */
export async function runTodoLoop(opts: TodoLoopOptions): Promise<TodoLoopResult> {
  const { session, cwd, emit } = opts
  const maxItems = opts.maxItems ?? DEFAULT_MAX_TODO_ITEMS
  // One emitter for the whole backlog, so ready-for-merge fires once across every item
  // and a session name only re-emits on an actual rename.
  const gateDeps = {
    requestChoice: opts.requestChoice,
    emit,
    signal: opts.signal,
    emitTurnSignals: createTurnSignalEmitter(emit),
  }

  let completed = 0
  let file: string | undefined

  // The backlog emptied: announce it if we did any work, and report a clean finish.
  // Both the mid-loop find and the post-loop re-check funnel through here.
  const finishEmpty = (): TodoLoopResult => {
    if (completed > 0) emit({ kind: 'log', message: `Backlog done: ${file ?? 'TODO'} is empty after ${completed} item(s).` })
    return { completed, reason: 'empty', ...(file ? { file } : {}) }
  }

  for (let item = 0; item < maxItems; item++) {
    if (opts.signal?.aborted) break
    const backlog = await findTodoBacklog(cwd, { fresh: true })
    if (!backlog) return finishEmpty()
    file = backlog.name
    const next = backlog.entries[0]!
    const preview = next.length > 100 ? `${next.slice(0, 100)}…` : next

    if (item === 0) emit({ kind: 'log', message: `Backlog: ${backlog.name} has ${backlog.entries.length} open item(s).` })

    // The per-item gate (#323): pause before starting a new entry when someone
    // can answer. Interactive-only, like the plan-approval gate — a headless agent
    // emits no gate and just proceeds (autopilot semantics, budget-capped).
    if (opts.requestChoice) {
      const picked = await requestChoices({
        id: item === 0 ? 'todo-next' : `todo-next-${item}`,
        title: `Start the next backlog item? (${backlog.entries.length} open)`,
        options: [
          { id: 'proceed', label: `Work on: ${preview}` },
          { id: 'stop', label: 'Stop the backlog loop' },
        ],
        recommended: 'proceed',
        requestChoice: opts.requestChoice,
        emit,
        ...(opts.signal ? { signal: opts.signal } : {}),
      })
      if (picked === 'stop') {
        emit({ kind: 'log', message: `Backlog loop stopped by you (${backlog.entries.length} item(s) left in ${backlog.name}).` })
        return { completed, reason: 'stopped', file }
      }
    }

    emit({ kind: 'log', message: `Backlog item ${completed + 1}: ${preview}` })
    // Complete exactly this entry, honoring await gates. The queue file is not the agent's to
    // touch (#1582): it lives on the data branch, and the check-off below is the framework's.
    const prompt = `Work on exactly this task from the project's task queue, and nothing else:\n\n${next}\n\nComplete it fully and verify your work. Do not start any other task; the framework checks this entry off the queue when the turn ends.`
    const rounds = await runAwaitRounds({ session, prompt, ...gateDeps })
    completed++
    // A plan the user declined with a stop-marked answer (#358) ends the whole session, not just
    // this loop — so the session does not go on to publish work that was just rejected. The caller
    // aborts on `sessionStopped`; `reason` stays descriptive of the loop itself.
    if (rounds.stopped) {
      emit({ kind: 'log', message: `Session stopped by your answer (${backlog.entries.length} item(s) left in ${backlog.name}).` })
      return { completed, reason: 'stopped', file, sessionStopped: true }
    }

    // Retire the entry on the data branch. `checkOffEntry` no-ops when someone else already
    // retired it meanwhile — the write funnel re-reads the fresh queue either way. Retried
    // inline rather than across rounds: a check-off that never lands would re-serve the same
    // entry, and re-doing finished work is worse than stopping with the queue intact.
    let landed: string | undefined
    for (let tries = 0; tries < MAX_STALLS && landed === undefined; tries++) {
      landed = await queueWrite(cwd, '[The Framework] check off a worked entry', md => checkOffEntry(md, next))
    }
    if (landed === undefined) {
      emit({ kind: 'log', message: `Backlog loop stopped: the check-off of "${preview}" could not be written after ${MAX_STALLS} attempt(s).` })
      return { completed, reason: 'stalled', file }
    }
  }

  // Aborted mid-loop (Stop button / budget cap #322): the agent is ending anyway,
  // so report a clean stop without extra narration.
  if (opts.signal?.aborted) return { completed, reason: 'stopped', ...(file ? { file } : {}) }

  const remaining = await findTodoBacklog(cwd)
  if (!remaining) return finishEmpty()
  emit({
    kind: 'log',
    message: `Backlog loop stopped at the ${maxItems}-item cap; ${remaining.entries.length} item(s) left in ${remaining.name}.`,
  })
  return { completed, reason: 'max-items', ...(file ? { file } : {}) }
}

