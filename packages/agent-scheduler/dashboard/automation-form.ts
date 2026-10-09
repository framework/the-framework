import { MAX_NAME, isCommandName } from '../src/names.js'
import { MAX_COUNT, parseInterval, type PaceUnit } from '../src/pace.js'
import { pace } from './schedulers.js'

// The automation form as data: what a person has typed so far, what still keeps it from being
// saved, the command that saves it (`agent-scheduler add …` for a new one, `edit …` for one opened
// from its row), the sentence its row would say, what trying its shell line answered
// (`agent-scheduler try …`), and what the page says before and after one is removed
// (`agent-scheduler remove …`).

/** The form while a person fills it in. The count is text, as typed, so a half-typed one is no pace yet. */
export interface AutomationDraft {
  /** The command's name, without its slash. */
  name: string
  /** What the agent is told. */
  prompt: string
  /** Whether it runs on a pace: every so many of a unit. Without one, its shell line alone says when. */
  paced: boolean
  count: string
  unit: PaceUnit
  /** The shell line that says there is work; empty for none. */
  when: string
  /** What the shell line waits for, in plain words; said on the row. */
  waitsFor: string
  /** Whether it is kept on this machine alone, and not shared with the project as a file to commit. */
  onThisMachine: boolean
}

/**
 * The longest prompt, and the longest shell line, the form can hand over: each travels as one
 * argument of a command the dashboard runs, and the dashboard takes arguments of about four
 * thousand characters. A longer one is written into the saved file by hand.
 */
export const TEXT_MAX = 4000

/** The form as it opens: once a day, no shell line, shared with the project. */
export const EMPTY_DRAFT: AutomationDraft = { name: '', prompt: '', paced: true, count: '1', unit: 'd', when: '', waitsFor: '', onThisMachine: false }

/** The interval a draft's pace is, as a skill writes it (`15m`); nothing without a pace, or while the count is no whole number the tool takes. */
function everyOf(draft: AutomationDraft): string | undefined {
  if (!draft.paced || !/^\d+$/.test(draft.count.trim())) return undefined
  return parseInterval(`${draft.count.trim()}${draft.unit}`)?.text
}

/** An automation opened from its row to be saved again: the form as it opens, and the file it would write anew. */
export interface OpenedAutomation {
  draft: AutomationDraft
  /** Its file, from the project's root. */
  file: string
}

/**
 * Read what `agent-scheduler show` printed into the form it opens. Nothing when the answer is not
 * what the command promises, a name and a prompt at the least, or holds a pace the form cannot
 * show: the form would then save something other than what is there.
 */
export function openedAutomation(output: unknown): OpenedAutomation | undefined {
  const answer = typeof output === 'object' && output !== null ? (output as Record<string, unknown>) : {}
  const { name, prompt, every, when, waitsFor, file } = answer
  if (typeof name !== 'string' || typeof prompt !== 'string' || typeof file !== 'string') return undefined
  const pace = every === undefined ? undefined : typeof every === 'string' ? parseInterval(every) : undefined
  if (every !== undefined && !pace) return undefined
  return {
    draft: { name, prompt, paced: pace !== undefined, count: String(pace?.count ?? EMPTY_DRAFT.count), unit: pace?.unit ?? EMPTY_DRAFT.unit, when: typeof when === 'string' ? when : '', waitsFor: typeof waitsFor === 'string' ? waitsFor : '', onThisMachine: answer['onThisMachine'] === true },
    file,
  }
}

/**
 * What keeps a draft from being saved yet, for the person typing it, the first thing first; nothing
 * when it can be saved. `file` is the file of an automation opened from its row: a text too long
 * for the form is then changed in that file.
 */
export function draftProblem(draft: AutomationDraft, file?: string): string | undefined {
  const name = draft.name.trim()
  if (name === '') return draft.onThisMachine ? 'Give it a name, like answer-comments.' : 'Give it a name. It becomes the command, like /answer-comments.'
  if (!isCommandName(name)) return 'A name is lower-case letters, digits and dashes, never three dashes in a row, like answer-comments.'
  if (name.length > MAX_NAME) return `A name is ${MAX_NAME} characters at most.`
  if (draft.prompt.trim() === '') return 'Write what the agent is told.'
  if (draft.prompt.trim().length > TEXT_MAX) return `What the agent is told is ${draft.prompt.trim().length} characters, and this form takes ${TEXT_MAX} at most. ${file === undefined ? 'Save a shorter one, then write the rest into the file.' : `Change it in its file, ${file}.`}`
  if (draft.when.trim().length > TEXT_MAX) return `The shell line is ${draft.when.trim().length} characters, and this form takes ${TEXT_MAX} at most.`
  if (draft.when.trim() !== '' && draft.waitsFor.trim().length > TEXT_MAX) return `What the line waits for is ${draft.waitsFor.trim().length} characters, and this form takes ${TEXT_MAX} at most.`
  if (draft.paced && everyOf(draft) === undefined) return `Type a whole number, from 1 to ${MAX_COUNT}.`
  if (!draft.paced && draft.when.trim() === '') return 'Say when it runs: on a pace, by a shell line, or both.'
  return undefined
}

/**
 * The command that saves a draft, after `agent-scheduler`; nothing while the draft cannot be
 * saved. Each text goes as one argument with its flag (`--prompt=…`), so one that opens with a
 * dash is still the flag's own text. What the shell line waits for is left out without a line.
 * `--private` keeps it on this machine alone.
 */
export function addArgs(draft: AutomationDraft): string[] | undefined {
  if (draftProblem(draft) !== undefined) return undefined
  return ['add', ...saidOf(draft), ...(draft.onThisMachine ? ['--private'] : [])]
}

/**
 * The command that saves an automation again from the draft it was opened into, after
 * `agent-scheduler`: `edit` with its name and every part the draft has, each in place of what its
 * file said. A part the draft does not have goes as an empty flag (`--when=`), which takes it out
 * of the file: a flag left out would leave that part as it was. Nothing while the draft cannot be
 * saved. Where it is kept is not the command's to change.
 */
export function editArgs(draft: AutomationDraft, file: string): string[] | undefined {
  if (draftProblem(draft, file) !== undefined) return undefined
  const when = draft.when.trim()
  return ['edit', draft.name.trim(), `--prompt=${draft.prompt.trim()}`, `--every=${everyOf(draft) ?? ''}`, `--when=${when}`, `--waits-for=${when !== '' ? draft.waitsFor.trim() : ''}`]
}

/** A draft's name and what it says, as the arguments of `add`: a part it does not have is left out. */
function saidOf(draft: AutomationDraft): string[] {
  const every = everyOf(draft)
  const when = draft.when.trim()
  const waitsFor = draft.waitsFor.trim()
  return [draft.name.trim(), `--prompt=${draft.prompt.trim()}`, ...(every !== undefined ? [`--every=${every}`] : []), ...(when !== '' ? [`--when=${when}`] : []), ...(when !== '' && waitsFor !== '' ? [`--waits-for=${waitsFor}`] : [])]
}

/** Whether two drafts would save the same automation: the form opened from a row has nothing to save, and loses nothing when closed, until they differ. */
export function saysTheSame(a: AutomationDraft, b: AutomationDraft): boolean {
  return saidOf(a).join('\0') === saidOf(b).join('\0')
}

/** When a draft would run, as the sentence its row would say; nothing while it has no pace and no shell line that could say. */
export function draftSentence(draft: AutomationDraft): string | undefined {
  const every = everyOf(draft)
  const when = draft.when.trim()
  if (every === undefined && when === '') return undefined
  if (draft.paced && every === undefined) return undefined
  const waitsFor = draft.waitsFor.trim()
  return pace({ command: draft.name.trim(), on: false, publish: 'commit', ...(every !== undefined ? { every } : {}), ...(when !== '' ? { when, ...(waitsFor !== '' ? { waitsFor } : {}) } : {}) })
}

/** Whether nothing has been typed into a draft yet: closing such a form loses nothing. */
export function isUntouched(draft: AutomationDraft): boolean {
  return draft.name === '' && draft.prompt === '' && draft.when === '' && draft.waitsFor === ''
}

/** What the words beside the pace say of it, given whether a shell line is typed: how the two decide together when the row runs. */
export function paceHint(draft: AutomationDraft): string {
  const line = draft.when.trim() !== ''
  if (!draft.paced) return line ? 'not on a pace: the shell line below alone says when' : 'not on a pace'
  return line ? 'at most, and only when the shell line below prints something' : 'by time alone'
}

/** What trying a shell line answered, as the page shows it. */
export interface TriedLine {
  /** The time the line was given as `$LAST_RUN`. */
  lastRun?: string
  /** What the line printed. */
  printed: string
  /** What it means: an agent would start, nothing to do, or the line failed and why. */
  verdict: string
  tone: 'start' | 'quiet' | 'failed'
}

/** Read what `agent-scheduler try` printed. Forgiving: an answer that is not what the command promises reads as a line that could not be tried. */
export function triedLine(output: unknown): TriedLine {
  const answer = typeof output === 'object' && output !== null ? (output as Record<string, unknown>) : {}
  const printed = typeof answer['printed'] === 'string' ? answer['printed'] : ''
  const lastRun = typeof answer['lastRun'] === 'string' ? { lastRun: answer['lastRun'] } : {}
  if (answer['ran'] !== true) return { ...lastRun, printed, verdict: `The line failed${typeof answer['error'] === 'string' && answer['error'] !== '' ? `: ${answer['error']}` : '.'}`, tone: 'failed' }
  return answer['due'] === true ? { ...lastRun, printed, verdict: 'It printed something: an agent would start now.', tone: 'start' } : { ...lastRun, printed, verdict: 'It printed nothing to do: no agent would start.', tone: 'quiet' }
}

/** Read what `agent-scheduler add` or `edit` printed: the file it wrote, where a run's checkout starts, and whether it is kept on this machine alone. */
export function savedFile(output: unknown): { file: string; startsFrom: string; onThisMachine: boolean } {
  const answer = typeof output === 'object' && output !== null ? (output as Record<string, unknown>) : {}
  return { file: typeof answer['file'] === 'string' ? answer['file'] : 'a skill file', startsFrom: typeof answer['startsFrom'] === 'string' ? answer['startsFrom'] : 'HEAD', onThisMachine: answer['onThisMachine'] === true }
}

/** What a saved automation is and what the person has to do with it, in a sentence: a shared one is a file to commit that must reach where a run's checkout starts; one kept on this machine needs nothing. */
export function savedWords(saved: { startsFrom: string; onThisMachine: boolean }): string {
  if (saved.onThisMachine) return 'It is kept on this machine alone: nothing to commit, and nobody else gets the row. Its row can start as soon as you switch it on. Its prompt is in the record of each run, which is shared where this project shares its records.'
  return `It is a file of yours, in this project, and nothing was committed for you. ${startsWhen(saved.startsFrom)}`
}

/**
 * What an automation saved again is and what the person has to do with it, in a sentence. A
 * shared one is a change to a file of theirs: an agent works in its own copy of the project, so
 * it is told the new words only once the change is where that copy starts, while the scheduler
 * reads the pace and the shell line from the person's own files. One kept on this machine needs
 * nothing.
 */
export function editedWords(saved: { startsFrom: string; onThisMachine: boolean }): string {
  if (saved.onThisMachine) return 'It is kept on this machine alone: nothing to commit. The scheduler uses the new words from its next look. Its past runs, its switch and your picks for it stay.'
  const once = saved.startsFrom === 'HEAD' ? 'once you commit the change' : `once the change is on ${saved.startsFrom}: commit it and bring it there`
  return `It is a change to a file of yours, in this project, and nothing was committed for you. An agent is told the new words only ${once}. The pace and the shell line are read from your file, so the scheduler uses the new ones from its next look. Its past runs, its switch and your picks for it stay.`
}

/** When a row shows what was saved again, in a sentence: the rows are what the project's scheduler last read. */
export function showsChangeWhen(ticking: boolean): string {
  return ticking ? 'Its row shows the change once the scheduler has looked, within a minute.' : 'The scheduler is not running in this project, so its row shows the change once the scheduler runs.'
}

/** What the form says of where an automation opened from its row is saved: that is not the form's to change. */
export function keptWhereHint(opened: OpenedAutomation): string {
  return opened.draft.onThisMachine ? `Kept on this machine alone, outside git: ${opened.file}.` : `A skill file in this project, ${opened.file}: the change is yours to commit.`
}

/** What a row says before its automation is removed, for the person to confirm: what is deleted, what of it can be brought back, and what stays. */
export function removeWarning(command: { onThisMachine?: true }): string {
  const rest = 'Its switch and your picks for it go with it. The records of its past runs stay.'
  if (command.onThisMachine) return `Its file is deleted. It is kept on this machine alone, outside git, so it cannot be brought back. ${rest}`
  return `Its skill file is deleted from your files in this project, and nothing is committed for you. Git can bring back only what you committed of it: a file never committed, or your last changes to it, cannot be brought back. Everyone else who has the project keeps the row until your deletion reaches them. ${rest}`
}

/**
 * Read what `agent-scheduler remove` printed, and say what was removed and what is left for the
 * person to do, in a sentence: by what git still holds of a shared one's file. An answer that
 * does not say sends the person to git to look.
 */
export function removedWords(title: string, output: unknown): string {
  const answer = typeof output === 'object' && output !== null ? (output as Record<string, unknown>) : {}
  const file = typeof answer['file'] === 'string' ? answer['file'] : 'its file'
  const startsFrom = typeof answer['startsFrom'] === 'string' ? answer['startsFrom'] : 'HEAD'
  if (answer['onThisMachine'] === true) return `Removed ${title}: ${file} is deleted. Nothing is to commit.`
  if (answer['git'] === 'committed') return `Removed ${title}: ${file} is deleted, and nothing was committed for you. ${startsFrom === 'HEAD' ? 'Commit the deletion.' : `Commit the deletion and bring it to ${startsFrom}: until then everyone else who has the project keeps the row.`}`
  if (answer['git'] === 'staged') return `Removed ${title}: ${file} is deleted. It was staged and never committed, so a commit made now would still add it: take it out of the next commit with "git rm --cached ${file}".`
  if (answer['git'] === 'nothing') return `Removed ${title}: ${file} is deleted. Git never had the file, so nothing is to commit.`
  return `Removed ${title}: ${file} is deleted. What git holds of it could not be read: look with "git status".`
}

/** What the form says of where a draft will be saved, under its two choices. */
export function whereHint(draft: AutomationDraft): string {
  return draft.onThisMachine ? 'Kept on this machine alone, outside git. The row starts switched off, and can start as soon as you switch it on.' : 'Saved as a skill file in this project, which you commit. The row starts switched off.'
}

/** When a saved automation's row shows on the page, in a sentence: the rows are what the project's scheduler last read, so a scheduler that is not running shows none. */
export function showsWhen(ticking: boolean): string {
  return ticking ? 'Its row shows here once the scheduler has looked, within a minute. It starts switched off.' : "The scheduler is not running in this project, so its row does not show yet: it shows once the scheduler runs. It starts switched off."
}

/** Where a saved automation's file has to get to before its row can start, in a sentence. */
export function startsWhen(startsFrom: string): string {
  return startsFrom === 'HEAD' ? 'Its row cannot start before you commit the file.' : `Its row cannot start before the file is on ${startsFrom}: commit it and bring it there.`
}
