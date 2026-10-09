import { mkdir, readdir, rmdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { excludeFromGit, originDefaultBranch, type GitRunner } from '@openagt/agent-data'
import { HARNESS_SKILL_DIRS } from '@openagt/skill-branches'
import { MAX_NAME, OWN_AUTOMATIONS_DIR, OWN_TEXT_MAX, RUN_SKILLS_DIR, SKILL_FILE, STATE_DIR, TRY_TIMEOUT_MS, isCommandName } from './names.js'
import { foundOutput, isDue, lastRunValue, skillSchedule } from './schedule.js'
import { runCheck } from './tick.js'

/**
 * A person's own automation: a prompt they wrote, saved as a command skill of the project, so it
 * has a row like any skill's and nothing else in the tool knows it apart. The skill's text is the
 * prompt; its front matter makes it a command (`disable-model-invocation`) and carries the
 * `schedule` the person picked: a pace, a check, or both.
 *
 * Shared with the project, it is a file in the person's checkout, in the folder the coding agent
 * that runs scheduled commands reads. Like any skill a person writes there, it is no command to a
 * run until it is on the commit a run's checkout starts from: the person commits it and brings it
 * there. Kept on this machine alone, it is the same file in the tool's own folder, and a run is
 * handed its text with a prompt that is the automation's name.
 */

/** An automation as a person fills it in. */
export interface NewAutomation {
  /** The command's name, without its slash: the skill's folder. */
  name: string
  /** What the agent is told: the skill's whole text. */
  prompt: string
  /** How often at most, as a skill writes it (`15m`, `1d`). */
  every?: string
  /** The check, a shell line. */
  when?: string
  /** What the check waits for, in one plain line. */
  waitsFor?: string
}

/** How much of the prompt's first line stands as the skill's description, in characters. */
const DESCRIPTION_MAX = 150

export type AddRefusal =
  | { ok: false; reason: 'bad-name'; detail: string }
  | { ok: false; reason: 'no-prompt' }
  | { ok: false; reason: 'long-prompt'; detail: string }
  | { ok: false; reason: 'bad-schedule'; detail: string }
  | { ok: false; reason: 'taken'; folder: string }

/**
 * Why an automation cannot be saved as written, or nothing: its name, its prompt, and its
 * schedule by the very reader the tick reads skills with. What the reader reads back has to be
 * what was typed, and the file has to read the same to a coding agent, whose reader ends the
 * front matter at the first three dashes it meets anywhere.
 */
export function automationProblem(automation: NewAutomation): AddRefusal | undefined {
  if (!isCommandName(automation.name)) return { ok: false, reason: 'bad-name', detail: 'a name is lower-case letters, digits and single or double dashes, and starts with a letter or a digit' }
  if (automation.name.length > MAX_NAME) return { ok: false, reason: 'bad-name', detail: `a name is ${MAX_NAME} characters at most` }
  // A NUL character is no text: a file holds none of it for an agent.
  if (!automation.prompt.replaceAll('\0', '').trim()) return { ok: false, reason: 'no-prompt' }
  const text = automationSkill(automation)
  const read = skillSchedule(automation.name, text, RUN_SKILLS_DIR)
  const unreadable = read.unreadable[0]
  if (unreadable) return { ok: false, reason: 'bad-schedule', detail: unreadable.reason }
  const command = read.commands[0]
  const when = automation.when === undefined ? undefined : wellFormed(automation.when.trim())
  const waitsFor = automation.waitsFor === undefined ? undefined : wellFormed(automation.waitsFor.trim())
  if (!command || command.when !== when || command.waitsFor !== waitsFor || frontMatterOf(text).includes('---')) return { ok: false, reason: 'bad-schedule', detail: 'it would not read back as typed' }
  return undefined
}

/** Characters a quoted value writes as an escape beyond what JSON escapes: DEL and the C1 controls, the two Unicode line ends, the byte order mark. */
const SPECIALS = /[\u007f-\u009f\u2028\u2029\ufeff]/g

/** Characters a block cannot hold as typed: every control character but the line end, and the ones above. */
const CONTROLS = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029\ufeff]/

/** A text with each half of a broken character pair replaced: such a half is no text a file holds. */
function wellFormed(text: string): string {
  return text.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '\ufffd')
}

/** The front matter of a skill file as written here, between its two lines of dashes. */
function frontMatterOf(text: string): string {
  return text.slice(4, text.indexOf('\n---\n', 4))
}

/**
 * A text as a quoted value of the front matter: every character that could end the value, the
 * line or the front matter is written as an escape, three dashes in a row among them, since a
 * coding agent's reader ends the front matter at the first three dashes anywhere. Half of a
 * broken character pair, which no file holds as text, is replaced. It reads back as the text.
 */
function quoted(text: string): string {
  return JSON.stringify(wellFormed(text))
    .replace(SPECIALS, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
    .replaceAll('---', '--\\u002d')
}

/**
 * Whether a check can stand in the file as a block, line for line as typed, the way the skills
 * write theirs: no character a block would lose or read as layout (a control character, blanks at
 * a line's end, blanks at its first line's start, where the block's indent is measured), and no
 * three dashes. Any other check is written quoted, on one line.
 */
function fitsBlock(check: string): boolean {
  if (CONTROLS.test(check) || check.includes('---')) return false
  const lines = check.split('\n')
  return lines[0] === lines[0]!.trimStart() && lines.every(line => line === line.trimEnd())
}

/**
 * The skill file of an automation: the front matter, then the prompt. The description is the
 * prompt's first line, cut short: it is what the row says the command does. Every text a person
 * typed is written quoted, so it can change no other key of the front matter, and the check as a
 * block where it can be, so it reads in the file as typed.
 */
export function automationSkill(automation: NewAutomation): string {
  const prompt = wellFormed(automation.prompt.trim())
  // Cut by whole characters: half an emoji is no text.
  const first = Array.from(prompt.split('\n')[0]!.trim())
  const description = first.length > DESCRIPTION_MAX ? `${first.slice(0, DESCRIPTION_MAX - 1).join('')}…` : first.join('')
  const when = automation.when === undefined ? undefined : wellFormed(automation.when.trim())
  const lines = [
    '---',
    `name: ${automation.name}`,
    `description: ${quoted(description)}`,
    'disable-model-invocation: true',
    // With neither a pace nor a check the schedule is an empty row, which the reader refuses in its own words.
    automation.every === undefined && when === undefined && automation.waitsFor === undefined ? 'schedule: {}' : 'schedule:',
    // A pace as the tool writes one stands as it is; anything else typed there is quoted, and the reader then says what is wrong with it.
    ...(automation.every !== undefined ? [`  every: ${/^\d+(m|h|d|w|mo)$/.test(automation.every) ? automation.every : quoted(automation.every)}`] : []),
    ...(automation.waitsFor !== undefined ? [`  waits-for: ${quoted(automation.waitsFor.trim())}`] : []),
    ...(when === undefined ? [] : fitsBlock(when) ? ['  when: |-', ...when.split('\n').map((line: string) => (line === '' ? '' : `    ${line}`))] : [`  when: ${quoted(when)}`]),
    '---',
    '',
    prompt,
    '',
  ]
  return lines.join('\n')
}

/** Where an automation was saved, and what whoever asked needs to say about it. */
export interface Added {
  ok: true
  command: string
  /** The file written, from the repository root. */
  file: string
  /** What a run's checkout starts from, as git names it: where a shared automation's file has to get to before its command can start. */
  startsFrom: string
  /** Whether it is kept on this machine alone: it needs no commit, and its command can start at once. */
  onThisMachine?: true
}

/**
 * Save an automation, shared with the project or kept on this machine alone.
 *
 * Shared, it is a skill file of the project, which the person commits; like any skill, its command
 * starts no run before the file is on the commit a run's checkout starts from. Kept on this
 * machine, it is one file in the tool's own folder, hidden from git like the state: nobody else
 * gets the row, nothing is to commit, and a run of it is handed its text.
 *
 * Refused when it cannot be read back as written, and when its name is taken, whatever its
 * capitals: by a skill in any folder a coding agent reads skills from, or by an automation kept on
 * this machine. An automation never replaces either, and on a disk that ignores capitals `Foo` and
 * `foo` are one name. A write that fails leaves no empty folder behind, shared or kept here.
 */
export async function addAutomation(repo: string, automation: NewAutomation, git: GitRunner, opts: { onThisMachine?: boolean; write?: typeof writeFile } = {}): Promise<Added | AddRefusal> {
  const write = opts.write ?? writeFile
  const problem = automationProblem(automation)
  if (problem) return problem
  for (const dir of HARNESS_SKILL_DIRS) {
    const there = (await readdir(join(repo, dir)).catch((): string[] => [])).find(name => name.toLowerCase() === automation.name)
    if (there !== undefined) return { ok: false, reason: 'taken', folder: `${dir}/${there}` }
  }
  const kept = (await readdir(join(repo, OWN_AUTOMATIONS_DIR)).catch((): string[] => [])).find(file => file.toLowerCase() === `${automation.name}.md`)
  if (kept !== undefined) return { ok: false, reason: 'taken', folder: `${OWN_AUTOMATIONS_DIR}/${kept}` }
  const origin = await originDefaultBranch(repo, git).catch(() => undefined)
  const startsFrom = origin ?? 'HEAD'
  if (opts.onThisMachine) {
    // Its text travels to each run as one command-line argument: a longer one could be saved and never listed.
    const length = automation.prompt.trim().length
    if (length > OWN_TEXT_MAX) return { ok: false, reason: 'long-prompt', detail: `the prompt is ${length} characters, and one kept on this machine has ${OWN_TEXT_MAX} at most` }
    const file = `${OWN_AUTOMATIONS_DIR}/${automation.name}.md`
    await mkdir(join(repo, OWN_AUTOMATIONS_DIR), { recursive: true })
    // The tool's folder is hidden from git before anything of a person's is in it; best-effort, as for the state.
    await excludeFromGit(repo, `/${STATE_DIR}`, undefined, git).catch(() => {})
    try {
      await write(join(repo, file), automationSkill(automation), { flag: 'wx' })
    } catch (err) {
      // Another save made it since the look above.
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') return { ok: false, reason: 'taken', folder: file }
      // The folder made for the first automation is not left empty behind a write that failed.
      await rmdir(join(repo, OWN_AUTOMATIONS_DIR)).catch(() => {})
      throw err
    }
    return { ok: true, command: automation.name, file, startsFrom, onThisMachine: true }
  }
  const folder = join(repo, RUN_SKILLS_DIR, automation.name)
  await mkdir(join(repo, RUN_SKILLS_DIR), { recursive: true })
  try {
    // Never into a folder that is there: another save may have made it since the look above.
    await mkdir(folder)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return { ok: false, reason: 'taken', folder: `${RUN_SKILLS_DIR}/${automation.name}` }
    throw err
  }
  try {
    await write(join(folder, SKILL_FILE), automationSkill(automation), { flag: 'wx' })
  } catch (err) {
    await rmdir(folder).catch(() => {})
    throw err
  }
  return { ok: true, command: automation.name, file: `${RUN_SKILLS_DIR}/${automation.name}/${SKILL_FILE}`, startsFrom }
}

/** How far back a check that is only being tried asks from: a command that does not exist yet has no last start, and "since now" would never show a person anything. */
export const TRY_SINCE_MS = 24 * 60 * 60 * 1000

/** How much of a failed check's last line of error is answered, in characters. */
const ERROR_MAX = 500

/** What trying a check answered. */
export interface Tried {
  /** The time the check was given as `$LAST_RUN`. */
  lastRun: string
  /** Whether the check ran to its end without an error. */
  ran: boolean
  /** Whether what it printed would start an agent. */
  due: boolean
  /** What it printed, cut as a run is handed it, with the line that says it was cut. */
  printed: string
  /** Why it did not run, when it did not: that it took too long, or the last line of what it said went wrong. */
  error?: string
}

/**
 * Run a check once, as the tick would, and say what it printed and whether an agent would start:
 * nothing is saved and nothing is started. It asks what is new since a day ago. A try has less
 * time than a tick gives a check ({@link TRY_TIMEOUT_MS}): whoever asks, a dashboard, waits for
 * the answer, and gives up before a tick would.
 */
export async function tryCheck(repo: string, shell: string, now: Date, check: typeof runCheck = runCheck, budgetMs: number = TRY_TIMEOUT_MS): Promise<Tried> {
  const lastRun = lastRunValue(new Date(now.getTime() - TRY_SINCE_MS).toISOString())
  const started = Date.now()
  const checked = await check(repo, shell, budgetMs, lastRun)
  const printed = foundOutput(checked.stdout, lastRun)
  if (checked.ok) return { lastRun, ran: true, due: isDue(checked.stdout), printed }
  const said = checked.stderr.trim().split('\n').at(-1) ?? ''
  const error = Date.now() - started >= budgetMs ? `it took longer than ${budgetMs / 1000} seconds` : said.length > ERROR_MAX ? `${said.slice(0, ERROR_MAX)}…` : said
  return { lastRun, ran: false, due: false, printed, error }
}
