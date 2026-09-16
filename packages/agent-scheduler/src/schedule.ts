import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_CAP, SCHEDULE_FILE } from './names.js'

/**
 * The schedule (#1774): a markdown file a person writes and tracks at the repository root, one
 * list line per command. The tool knows no command by name; this file is the only place a
 * command is named, and `.claude/skills/<command>` in the repository is what runs.
 *
 *     - work-queue: when `npx queue`, cap 1
 *
 * `when` is a shell command, run at the repository root. The command is due while the check
 * exits 0 and prints something other than an empty JSON value. `cap` is how many runs of the
 * command may be in flight at once, across every machine that shares the repository.
 *
 * Every other line — headings, blank lines, prose — is the person's, and is not read. A list line
 * the parser cannot read is skipped and named, so a typo stands down one command and says so
 * rather than silently doing nothing.
 */

/** One command as the schedule names it. */
export interface ScheduledCommand {
  /** The command: the `.claude/skills/<name>` the agent's harness expands from `/<name>`. */
  name: string
  /** The check, a shell command line. */
  when: string
  /** Runs in flight at once, across every machine. */
  cap: number
  /** The file's line number, for a message. */
  line: number
}

/** The schedule as read. */
export interface Schedule {
  commands: ScheduledCommand[]
  /** List lines the parser could not read, each with its text. */
  unreadable: { line: number; text: string }[]
}

const COMMAND_LINE = /^-\s+([a-z0-9][a-z0-9-]*):\s*(.+)$/
const WHEN = /^when\s+`([^`]+)`\s*(?:,\s*cap\s+(\d+))?\s*$/

/** The schedule out of the file's markdown. Pure. */
export function parseSchedule(md: string): Schedule {
  const schedule: Schedule = { commands: [], unreadable: [] }
  md.split('\n').forEach((text, index) => {
    const line = index + 1
    if (!/^-\s/.test(text)) return
    const head = COMMAND_LINE.exec(text.trim())
    const rule = head ? WHEN.exec(head[2]!) : null
    if (!head || !rule) {
      schedule.unreadable.push({ line, text: text.trim() })
      return
    }
    const cap = rule[2] === undefined ? DEFAULT_CAP : Number(rule[2])
    schedule.commands.push({ name: head[1]!, when: rule[1]!.trim(), cap: Math.max(1, cap), line })
  })
  return schedule
}

/** The repository's schedule, or `undefined` when it has none. */
export async function readSchedule(repo: string): Promise<Schedule | undefined> {
  const md = await readFile(join(repo, SCHEDULE_FILE), 'utf8').catch(() => undefined)
  return md === undefined ? undefined : parseSchedule(md)
}

/** The prompt a command runs with: its slash command, which the agent's harness expands. */
export function commandPrompt(name: string): string {
  return `/${name}`
}

/**
 * Whether a check's output says the command is due (#1774): the output parsed as JSON is
 * something other than empty — `[]`, `{}`, `null`, `false`, `""` and no output at all are not
 * due. Every skill command prints JSON on stdout, so a check like `npx queue` needs no piping.
 * Output that is not JSON counts by its text: anything non-blank is due.
 */
export function isDue(stdout: string): boolean {
  const text = stdout.trim()
  if (!text) return false
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return true
  }
  if (value === null || value === false || value === '' || value === 0) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as object).length > 0
  return true
}
