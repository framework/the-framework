import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { DriverEvent } from './types.js'

// The pieces every driver session needs but that are not agent-specific: emitting events
// without letting a listener throw into the agent, folding the session + per-call signals and
// framing, and reading a workspace file. The agent-specific parts (argv, the output parser,
// how framing is delivered) stay in each driver; these do not, so a second driver reuses
// them rather than copying them.

/**
 * A {@link DriverStartOptions.onEvent} caller that never lets a listener throw into the
 * driver — a throwing UI handler must not abort the agent. An absent `onEvent`
 * is a no-op. `driver` names it in the swallow log so a thrown handler stays traceable.
 */
export function makeEmit(onEvent: ((event: DriverEvent) => void) | undefined, driver: string): (event: DriverEvent) => void {
  if (!onEvent) return () => {}
  return event => {
    try {
      onEvent(event)
    } catch (err) {
      console.error(`${driver} onEvent threw; ignoring:`, err)
    }
  }
}

/** The live AbortSignals for a prompt — the session's and the per-call one, minus the absent. */
export function combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal[] {
  return signals.filter((s): s is AbortSignal => s != null)
}

/** Fold a session's framing and a per-call system prompt into one blank-line-separated block. */
export function combineFraming(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join('\n\n')
}

/** Read a workspace file relative to the session cwd — the driver's `readCode`. */
export function readWorkspaceFile(cwd: string, path: string): Promise<string> {
  return readFile(resolve(cwd, path), 'utf8')
}

/** How long a tool call's detail may be: enough for a long command, short enough to keep the diary lean. */
const DETAIL_MAX = 200

/** A tool call's detail as a driver emits it: flattened to one line and cut to 200 characters. */
export function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > DETAIL_MAX ? flat.slice(0, DETAIL_MAX - 1) + '…' : flat
}

/**
 * How many characters of a tool call's output are kept. An output is a diary line, and the diary
 * is copied onto the run's record: the limit keeps a run of many calls a small file.
 */
export const OUTPUT_MAX = 4000

/**
 * What a tool call printed, as a driver emits it: whole when it fits in {@link OUTPUT_MAX}
 * characters, else its first half-limit and its last half-limit, with one line between them saying
 * how many characters were cut. The start says what ran and the end says how it went.
 */
export function cutOutput(text: string): string {
  const whole = text.replace(/\s+$/, '')
  if (whole.length <= OUTPUT_MAX) return whole
  const half = OUTPUT_MAX / 2
  return `${whole.slice(0, half)}\n… ${whole.length - OUTPUT_MAX} characters cut …\n${whole.slice(-half)}`
}

/**
 * The parts of an `action` event that say what the call was given: `detail`, the argument on one
 * line and cut short, and `whole`, the argument as it was given (cut as an output is), only when
 * `detail` is not all of it.
 */
export function callArgument(argument: string | undefined): { detail?: string; whole?: string } {
  if (argument === undefined || argument.trim() === '') return {}
  const detail = oneLine(argument)
  const whole = cutOutput(argument.trim())
  return whole === detail ? { detail } : { detail, whole }
}
