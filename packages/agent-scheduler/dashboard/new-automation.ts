import { MAX_NAME, isCommandName } from '../src/names.js'
import { MAX_COUNT, parseInterval, type PaceUnit } from '../src/pace.js'
import { pace } from './schedulers.js'

// The "New automation" form as data: what a person has typed so far, what still keeps it from
// being saved, the command that saves it (`agent-scheduler add …`), the sentence its row would
// say, and what trying its shell line answered (`agent-scheduler try …`).

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
}

/**
 * The longest prompt, and the longest shell line, the form can hand over: each travels as one
 * argument of a command the dashboard runs, and the dashboard takes arguments of about four
 * thousand characters. A longer one is written into the saved file by hand.
 */
export const TEXT_MAX = 4000

/** The form as it opens: once a day, no shell line. */
export const EMPTY_DRAFT: AutomationDraft = { name: '', prompt: '', paced: true, count: '1', unit: 'd', when: '', waitsFor: '' }

/** The interval a draft's pace is, as a skill writes it (`15m`); nothing without a pace, or while the count is no whole number the tool takes. */
function everyOf(draft: AutomationDraft): string | undefined {
  if (!draft.paced || !/^\d+$/.test(draft.count.trim())) return undefined
  return parseInterval(`${draft.count.trim()}${draft.unit}`)?.text
}

/** What keeps a draft from being saved yet, for the person typing it, the first thing first; nothing when it can be saved. */
export function draftProblem(draft: AutomationDraft): string | undefined {
  const name = draft.name.trim()
  if (name === '') return 'Give it a name. It becomes the command, like /answer-comments.'
  if (!isCommandName(name)) return 'A name is lower-case letters, digits and dashes, never three dashes in a row, like answer-comments.'
  if (name.length > MAX_NAME) return `A name is ${MAX_NAME} characters at most.`
  if (draft.prompt.trim() === '') return 'Write what the agent is told.'
  if (draft.prompt.trim().length > TEXT_MAX) return `What the agent is told is ${draft.prompt.trim().length} characters, and this form takes ${TEXT_MAX} at most. Save a shorter one, then write the rest into the file.`
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
 */
export function addArgs(draft: AutomationDraft): string[] | undefined {
  if (draftProblem(draft) !== undefined) return undefined
  const every = everyOf(draft)
  const when = draft.when.trim()
  const waitsFor = draft.waitsFor.trim()
  return ['add', draft.name.trim(), `--prompt=${draft.prompt.trim()}`, ...(every !== undefined ? [`--every=${every}`] : []), ...(when !== '' ? [`--when=${when}`] : []), ...(when !== '' && waitsFor !== '' ? [`--waits-for=${waitsFor}`] : [])]
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

/** Read what `agent-scheduler add` printed: the file it wrote and where a run's checkout starts. */
export function savedFile(output: unknown): { file: string; startsFrom: string } {
  const answer = typeof output === 'object' && output !== null ? (output as Record<string, unknown>) : {}
  return { file: typeof answer['file'] === 'string' ? answer['file'] : 'a skill file', startsFrom: typeof answer['startsFrom'] === 'string' ? answer['startsFrom'] : 'HEAD' }
}

/** When a saved automation's row shows on the page, in a sentence: the rows are what the project's scheduler last read, so a scheduler that is not running shows none. */
export function showsWhen(ticking: boolean): string {
  return ticking ? 'Its row shows here once the scheduler has looked, within a minute. It starts switched off.' : "The scheduler is not running in this project, so its row does not show yet: it shows once the scheduler runs. It starts switched off."
}

/** Where a saved automation's file has to get to before its row can start, in a sentence. */
export function startsWhen(startsFrom: string): string {
  return startsFrom === 'HEAD' ? 'Its row cannot start before you commit the file.' : `Its row cannot start before the file is on ${startsFrom}: commit it and bring it there.`
}
