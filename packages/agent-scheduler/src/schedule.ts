import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { HARNESS_SKILL_DIRS } from '@openagt/skill-branches'
import { DEFAULT_CAP, RUN_SKILLS_DIR, SKILL_FILE } from './names.js'
import { parseInterval, type Interval } from './pace.js'

/**
 * The schedule (#2022): the scheduled commands of a project, each brought by the skill it runs.
 * The tool knows no command by name; a skill says it can be scheduled with a `schedule` in the
 * front matter of its `SKILL.md`, and a skill that is not in the project has no command here.
 *
 *     ---
 *     name: update-tickets
 *     disable-model-invocation: true
 *     schedule:
 *       every: 15m
 *       when: npx tickets meta | jq …
 *       waits-for: when an issue changed since the last import
 *     ---
 *
 * A skill with several modes lists one row per mode, each with the `word` the skill gets as its
 * argument (`triage quick`, `triage consensual`):
 *
 *     schedule:
 *       - word: quick
 *         every: 6h
 *       - word: consensual
 *         every: 7d
 *
 * A command is named as a person types it, without the slash: the skill's folder name, then the
 * row's word when it has one. The whole name is the command's identity (its prompt, its switch,
 * its interval, its cap, its run records).
 *
 * `when` is a shell command, run at the repository root. The command is due while the check
 * exits 0 and prints something other than an empty JSON value. `every` is how often at most: the
 * command is due only once that long has passed since its last recorded start. A row carries one
 * or both; with both, the command starts only when both hold. `waits-for` is one plain line
 * saying what the check waits for, for a person: a check is a shell line nothing can turn into a
 * sentence. `agents` is how many runs of the command may be in flight at once, across every
 * machine that shares the repository.
 *
 * Whether a command runs, and how far its runs publish, is not the skill's to say: each person
 * sets both on their own machine, in the tool's state.
 *
 * A `schedule` the reader cannot read is skipped and named, so a typo stands down one skill's
 * commands and says so rather than silently doing nothing.
 *
 * The schedule is read from every folder a coding agent reads skills from, so a project's skills
 * are all listed; a command whose skill is not in the folder of the agent that runs scheduled
 * commands is listed and never started, and the tick says so.
 */

/** One command as its skill schedules it. */
export interface ScheduledCommand {
  /** The command as typed without its slash: the skill's folder name, then at most one word the skill gets as its argument (`triage quick`). */
  name: string
  /** The check, a shell command line; absent when the row paces by time alone. */
  when?: string
  /** How often at most, where no person set another pace: the least time since the command's last recorded start. */
  every?: Interval
  /** What the check waits for, in one plain line for a person. */
  waitsFor?: string
  /** Runs in flight at once, across every machine. */
  cap: number
  /** The skills folder the skill was read from (`.claude/skills`). */
  dir: string
  /** What the skill does, in its own words: the `description` of its front matter, when it has one. */
  description?: string
}

/** The schedule as read. */
export interface Schedule {
  commands: ScheduledCommand[]
  /** The skills whose `schedule` could not be read, each with why. */
  unreadable: { skill: string; reason: string }[]
}

const SKILL = /^[a-z0-9][a-z0-9-]*$/
const WORD = SKILL
const ROW_KEYS = ['word', 'every', 'when', 'waits-for', 'agents']

/**
 * The commands a skill schedules, out of its `SKILL.md` in the skills folder `dir`: none when the
 * file has no front matter or the front matter no `schedule`. One row or a list of rows; any row
 * that cannot be read makes the whole `schedule` unreadable, and the reason names the row. Pure.
 */
export function skillSchedule(skill: string, md: string, dir: string): Schedule {
  const unreadable = (reason: string): Schedule => ({ commands: [], unreadable: [{ skill, reason }] })
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)
  if (!front) return { commands: [], unreadable: [] }
  let data: unknown
  try {
    data = parseYaml(front[1]!)
  } catch {
    // Only a skill that tries to schedule something is named: a coding agent reads front matter
    // more loosely than YAML does, and a skill with no `schedule` is none of this tool's business.
    return /^schedule\s*:/m.test(front[1]!) ? unreadable('the front matter is not YAML') : { commands: [], unreadable: [] }
  }
  const written = isMap(data) ? data['schedule'] : undefined
  if (written === undefined) return { commands: [], unreadable: [] }
  // A `schedule:` with nothing after it is YAML's null: no row, like an empty list.
  const rows = Array.isArray(written) ? written : written === null ? [] : [written]
  if (rows.length === 0) return unreadable('the schedule lists no row')
  const said = isMap(data) ? data['description'] : undefined
  const description = typeof said === 'string' && said.trim() ? { description: said.trim() } : {}
  const commands: ScheduledCommand[] = []
  for (const row of rows) {
    const command = parseRow(skill, row, dir)
    if (typeof command === 'string') return unreadable(rows.length > 1 ? `row ${commands.length + 1}: ${command}` : command)
    if (commands.some(c => c.name === command.name)) return unreadable(`two rows are named ${command.name}`)
    commands.push({ ...command, ...description })
  }
  return { commands, unreadable: [] }
}

/**
 * One row: `every: <N><m|h|d|w|mo>`, `when: <shell line>`, `waits-for: <one line>`, `agents: <N>`,
 * `word: <the skill's argument>`. At least one of `every` and `when`, else nothing says when.
 * `every: 0m` is refused rather than read as "always", which is the key being absent. A key the
 * reader does not know is refused too: it is a typo, or a rule this tool would not follow.
 * `waits-for` says what the check waits for, so a row without `when` has none.
 * Answers the command, or why the row cannot be read.
 */
function parseRow(skill: string, row: unknown, dir: string): ScheduledCommand | string {
  if (!isMap(row)) return 'a row is a list of keys'
  const unknown = Object.keys(row).find(key => !ROW_KEYS.includes(key))
  if (unknown !== undefined) return `unknown key ${unknown}`
  const { word, every, when, agents } = row
  const waitsFor = row['waits-for']
  if (word !== undefined && !(typeof word === 'string' && WORD.test(word))) return 'word is one word of lower-case letters, digits and dashes'
  const asEvery = every === undefined ? undefined : parseInterval(String(every))
  if (every !== undefined && !asEvery) return 'every is a number from 1 to 9999 and a unit, m, h, d, w or mo (15m, 6h, 7d, 2w, 1mo)'
  if (when !== undefined && !(typeof when === 'string' && when.trim())) return 'when is a shell command line'
  if (waitsFor !== undefined && !(typeof waitsFor === 'string' && waitsFor.trim() && !waitsFor.trim().includes('\n'))) return 'waits-for is one line of text'
  if (agents !== undefined && !(typeof agents === 'number' && Number.isInteger(agents) && agents >= 1)) return 'agents is a whole number, 1 or more'
  if (when === undefined && every === undefined) return 'neither every nor when says when'
  if (waitsFor !== undefined && when === undefined) return 'waits-for says what when waits for, and there is no when'
  return {
    name: word === undefined ? skill : `${skill} ${word}`,
    ...(typeof when === 'string' ? { when: when.trim() } : {}),
    ...(asEvery ? { every: asEvery } : {}),
    ...(typeof waitsFor === 'string' ? { waitsFor: waitsFor.trim() } : {}),
    cap: typeof agents === 'number' ? agents : DEFAULT_CAP,
    dir,
  }
}

function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The project's schedule: every skill's commands, the skills in name order. Read from each folder
 * a coding agent reads skills from, the folder of the agent that runs scheduled commands first; a
 * skill in two folders is read once, from the first folder that holds its `SKILL.md`. A project
 * with no skills folder schedules nothing.
 */
export async function readSchedule(repo: string): Promise<Schedule> {
  const files = new Map<string, { md: string; dir: string }>()
  for (const dir of [RUN_SKILLS_DIR, ...HARNESS_SKILL_DIRS.filter(d => d !== RUN_SKILLS_DIR)]) {
    const entries = await readdir(join(repo, dir)).catch(() => [])
    for (const skill of entries) {
      if (files.has(skill) || !SKILL.test(skill)) continue
      const md = await readFile(join(repo, dir, skill, SKILL_FILE), 'utf8').catch(() => undefined)
      if (md !== undefined) files.set(skill, { md, dir })
    }
  }
  const schedule: Schedule = { commands: [], unreadable: [] }
  for (const skill of [...files.keys()].sort()) {
    const { md, dir } = files.get(skill)!
    const read = skillSchedule(skill, md, dir)
    schedule.commands.push(...read.commands)
    schedule.unreadable.push(...read.unreadable)
  }
  return schedule
}

/** The prompt a command runs with: its slash command, which the agent's harness expands, the word after it handed to the skill. */
export function commandPrompt(name: string): string {
  return `/${name}`
}

/**
 * The command a run's prompt is counted under, so a run a person started counts against that
 * command's cap and interval like a scheduled one: the scheduled command whose name the prompt is, without its
 * slash (`/triage quick` → `triage quick`), else the prompt's first word (`/work-queue now` →
 * `work-queue`; a plain prompt's first word).
 */
export function promptCommand(prompt: string, schedule: Schedule): string {
  const typed = prompt.trim().replace(/^\//, '')
  if (schedule.commands.some(c => c.name === typed)) return typed
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
