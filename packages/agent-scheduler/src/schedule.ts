import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_CAP, SCHEDULE_FILE } from './names.js'

/**
 * The schedule (#1774): a markdown file a person writes and tracks at the repository root, one
 * list line per command. The tool knows no command by name; this file is the only place a
 * command is named. A command is written as a person types it, without the slash: a skill's
 * folder name, then at most one word the skill takes as its argument; `.claude/skills/<folder>`
 * in the repository is what runs, and the whole name is the command's identity (its prompt,
 * its switch, its interval, its cap, its run records).
 *
 *     - work-queue: when `npx queue`, cap 1
 *     - triage quick: every 6h
 *     - triage consensual: every 7d, when `npx tickets list | jq …`
 *     - update-tickets: every 1h, when `npx tickets meta | jq …`
 *     - post-merge-cleanup: every 1d, off
 *
 * `when` is a shell command, run at the repository root. The command is due while the check
 * exits 0 and prints something other than an empty JSON value. `every` is how often at most: the
 * command is due only once that long has passed since its last recorded start. A line carries
 * one or both; with both, the command starts only when both hold. `cap` is how many runs of the
 * command may be in flight at once, across every machine that shares the repository. `off` lists
 * a command that runs only on a machine where a person switched it on; every other command runs
 * unless a person switched it off there. The switches are per machine, in the tool's state.
 *
 * Every other line — headings, blank lines, prose — is the person's, and is not read. A list line
 * the parser cannot read is skipped and named, so a typo stands down one command and says so
 * rather than silently doing nothing.
 */

/** One command as the schedule names it. */
export interface ScheduledCommand {
  /** The command as typed without its slash: the skill's folder name, then at most one word the skill gets as its argument (`triage quick`). */
  name: string
  /** The check, a shell command line; absent when the line paces by time alone. */
  when?: string
  /** How often at most: the least time since the command's last recorded start, and the text as written (`6h`). */
  every?: { ms: number; text: string }
  /** Runs in flight at once, across every machine. */
  cap: number
  /** Whether the command runs on a machine where nobody switched it: the line says `off` when it does not. */
  on: boolean
  /** The file's line number, for a message. */
  line: number
}

/** The schedule as read. */
export interface Schedule {
  commands: ScheduledCommand[]
  /** List lines the parser could not read, each with its text. */
  unreadable: { line: number; text: string }[]
}

const COMMAND_LINE = /^-\s+([a-z0-9][a-z0-9-]*(?: [a-z0-9][a-z0-9-]*)?):\s*(.+)$/
const EVERY = /^every\s+(\d+)(m|h|d)$/
const WHEN = /^when\s+`([^`]+)`$/
const CAP = /^cap\s+(\d+)$/
const OFF = /^off$/
const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const

/** The schedule out of the file's markdown. Pure. */
export function parseSchedule(md: string): Schedule {
  const schedule: Schedule = { commands: [], unreadable: [] }
  md.split('\n').forEach((text, index) => {
    const line = index + 1
    if (!/^-\s/.test(text)) return
    const head = COMMAND_LINE.exec(text.trim())
    const command = head ? parseRule(head[1]!, head[2]!, line) : undefined
    if (!command) {
      schedule.unreadable.push({ line, text: text.trim() })
      return
    }
    schedule.commands.push(command)
  })
  return schedule
}

/**
 * The clauses after the name, in any order, each at most once: `every <N><m|h|d>`, `when \`…\``,
 * `cap <N>`, `off`. At least one of `every` and `when`, else nothing says when. `every 0` is refused
 * rather than read as "always", which is the clause being absent.
 */
function parseRule(name: string, rule: string, line: number): ScheduledCommand | undefined {
  let when: string | undefined
  let every: { ms: number; text: string } | undefined
  let cap: number | undefined
  let off = false
  for (const clause of clauses(rule)) {
    const asEvery = EVERY.exec(clause)
    const asWhen = WHEN.exec(clause)
    const asCap = CAP.exec(clause)
    const asOff = OFF.exec(clause)
    if (asEvery && every === undefined && Number(asEvery[1]) > 0) {
      every = { ms: Number(asEvery[1]) * UNIT_MS[asEvery[2] as keyof typeof UNIT_MS], text: `${asEvery[1]}${asEvery[2]}` }
    } else if (asWhen && when === undefined) {
      when = asWhen[1]!.trim()
    } else if (asCap && cap === undefined) {
      cap = Math.max(1, Number(asCap[1]))
    } else if (asOff && !off) {
      off = true
    } else {
      return undefined
    }
  }
  if (when === undefined && every === undefined) return undefined
  return { name, ...(when !== undefined ? { when } : {}), ...(every ? { every } : {}), cap: cap ?? DEFAULT_CAP, on: !off, line }
}

/** The rule split on the commas outside backticks, each piece trimmed. */
function clauses(rule: string): string[] {
  const out: string[] = []
  let current = ''
  let quoted = false
  for (const ch of rule) {
    if (ch === '`') quoted = !quoted
    if (ch === ',' && !quoted) {
      out.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  out.push(current)
  return out.map(s => s.trim()).filter(Boolean)
}

/** The repository's schedule, or `undefined` when it has none. */
export async function readSchedule(repo: string): Promise<Schedule | undefined> {
  const md = await readFile(join(repo, SCHEDULE_FILE), 'utf8').catch(() => undefined)
  return md === undefined ? undefined : parseSchedule(md)
}

/** The prompt a command runs with: its slash command, which the agent's harness expands, the word after it handed to the skill. */
export function commandPrompt(name: string): string {
  return `/${name}`
}

/** The skill folder a command runs: the name's first word; the rest is the skill's argument. */
export function commandSkill(name: string): string {
  return name.split(' ')[0]!
}

/**
 * The command a run's prompt is counted under, so a run a person started counts against that
 * command's cap and interval like a scheduled one: the schedule line whose name the prompt is, without its
 * slash (`/triage quick` → `triage quick`), else the prompt's first word (`/work-queue now` →
 * `work-queue`; a plain prompt's first word).
 */
export function promptCommand(prompt: string, schedule: Schedule | undefined): string {
  const typed = prompt.trim().replace(/^\//, '')
  if (schedule?.commands.some(c => c.name === typed)) return typed
  return typed.split(/\s+/)[0] || prompt
}

/**
 * Whether a check's output says the command is due (#1774): the output parsed as JSON is
 * something other than empty — `[]`, `{}`, `null`, `false`, `""`, `0` and no output at all are not
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
