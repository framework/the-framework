/**
 * The agent queue's line-level grammar, and the three-way merge built on it (#1204).
 *
 * A leaf module (no imports at all) on purpose: `todo-loop.ts` reads the grammar to drive the
 * backlog, `queue-promote.ts` reads it to land a finished run's queue, and the two must agree on
 * what an entry is. One parser here is what stops the drain loop and the promotion from ever
 * reading the same line differently.
 *
 * The merge exists because runs may overlap (#1204): each runs in its own worktree and rewrites
 * the whole queue file on its own branch, so with two agents going the second promotion used to
 * overwrite the first — un-checking the entry the first had just retired, dropping the entries it
 * had queued, and sending the sweep off to do the same work again. Entries are independent lines
 * with a natural identity (their text), so the file merges the way a union-merged changelog does.
 */

/** One markdown list line, as the queue reads it. */
export interface TodoEntryLine {
  /** The entry text, without the marker or checkbox. */
  text: string
  /** `true` = checked off, `false` = an open checkbox, `undefined` = a bare item (open too). */
  checked: boolean | undefined
}

/**
 * Read one line as a queue entry: a markdown list item (`-`, `*`, or `1.`), where a task checkbox
 * carries its state and a bare item counts as open. Headings, prose, and blank lines are not
 * entries. The one grammar `parseTodoEntries` and the promotion merge both read.
 */
export function parseTodoEntryLine(line: string): TodoEntryLine | undefined {
  const item = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line)
  if (!item) return undefined
  const text = item[1]!.trim()
  if (!text) return undefined
  const task = /^\[([ xX])\]\s*(.*)$/.exec(text)
  if (!task) return { text, checked: undefined }
  const rest = task[2]!.trim()
  if (!rest) return undefined
  return { text: rest, checked: task[1] !== ' ' }
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
 * `parseTodoEntries` reads in file order, queueing something meant it would be worked last,
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

/** The entry lines of a document, by text. First occurrence wins, as `parseTodoEntries` reads them. */
function entryStates(md: string): Map<string, TodoEntryLine> {
  const states = new Map<string, TodoEntryLine>()
  for (const line of md.split('\n')) {
    const entry = parseTodoEntryLine(line)
    if (entry && !states.has(entry.text)) states.set(entry.text, entry)
  }
  return states
}

/** The line, checked off in place, whatever list marker it uses. */
function checkLine(line: string): string {
  const item = /^(\s*(?:[-*]|\d+\.)\s+)(.*)$/.exec(line)
  if (!item) return line
  const marker = item[1]!
  const rest = item[2]!
  return /^\[ \]/.test(rest) ? marker + rest.replace('[ ]', '[x]') : `${marker}[x] ${rest.trim()}`
}

/**
 * Land a run's queue edits on a checkout that has moved since the run forked (#1204).
 *
 * A three-way merge at entry granularity, keyed on entry text: what the run did is read as
 * `base -> theirs` (entries it checked off, removed, or added) and replayed onto `ours`, so two
 * runs that worked different entries compose instead of the later promotion reverting the
 * earlier one. The queue's operations are narrow — check off, remove, append — which is what
 * makes text identity enough; a reworded entry is a removal plus an addition, exactly as a line
 * merge would read it.
 *
 * Everything the run did not touch is `ours` verbatim: the checkout is the copy humans edit, and
 * its formatting is not the promotion's to reflow. Added entries keep their priority section via
 * {@link insertTodoEntry} when `theirs` placed them under one; anything else joins the end.
 */
export function mergeQueueDocuments(base: string, ours: string, theirs: string): string {
  const atBase = entryStates(base)
  const inTheirs = entryStates(theirs)

  // What the run did: entries it retired (open at base, checked in its copy), entries it removed
  // outright, and entries it wrote that the base never had.
  const checkedOff = new Set(
    [...inTheirs].filter(([text, entry]) => entry.checked === true && atBase.get(text)?.checked !== true).map(([text]) => text),
  )
  const removed = new Set([...atBase.keys()].filter(text => !inTheirs.has(text)))

  // Replay onto ours, line by line: retire what the run retired, drop what it removed, keep the
  // rest — including entries and prose the run never saw.
  const merged: string[] = []
  for (const line of ours.split('\n')) {
    const entry = parseTodoEntryLine(line)
    if (!entry || entry.checked === true) {
      merged.push(line)
      continue
    }
    if (removed.has(entry.text)) continue
    merged.push(checkedOff.has(entry.text) ? checkLine(line) : line)
  }

  // The run's own additions, in its order. Present-in-ours (whatever the state) means both sides
  // have it and ours' copy already won above.
  const present = new Set([...entryStates(merged.join('\n')).keys()])
  let result = merged.join('\n')
  let priority: number | undefined
  for (const line of theirs.split('\n')) {
    const heading = PRIORITY_HEADING.exec(line)
    if (heading) priority = Number(heading[1])
    else if (SECTION_HEADING.test(line)) priority = undefined
    const entry = parseTodoEntryLine(line)
    if (!entry || atBase.has(entry.text) || present.has(entry.text)) continue
    present.add(entry.text)
    if (entry.checked !== true && priority !== undefined) {
      result = insertTodoEntry(result, entry.text, priority)
    } else {
      // No section to aim for (or the run added it already checked): the end keeps it, and the
      // end is also where an unranked queue reads last, which is the honest place for it.
      const separator = result === '' || result.endsWith('\n') ? '' : '\n'
      result = `${result}${separator}${line.trim()}\n`
    }
  }
  return result
}
