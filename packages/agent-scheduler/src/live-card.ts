import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { logCardFile, logDiaryFile } from 'agent-driver'
import { parseDiary, parseRunCard, type AnyDiaryLine, type RunCard, type RunStatus } from '@gemstack/skill-logs'
import { schedulerMark } from './records.js'

/**
 * A run's live record: the card and the diary agent-driver keeps under `.the-framework/` in the
 * run's checkout, in the run record's shape, while the agent works. The dashboard reads them
 * there; the run copies them onto the `agent-data` branch unchanged when it ends; the sweep
 * reads them to find a run whose process died, and closes them from outside.
 */

/** The dashboard's directory in a checkout, where the two files live. */
export const LIVE_DIR = '.the-framework'

/** The inbox's file name under the live directory: what reaches the agent from outside. */
export const INBOX_FILE = 'inbox.jsonl'

export function liveDir(checkout: string): string {
  return join(checkout, LIVE_DIR)
}

export function inboxPath(checkout: string): string {
  return join(liveDir(checkout), INBOX_FILE)
}

/** A checkout's live card, or `undefined` when it holds none, it does not parse, or it is not this tool's (no mark). */
export async function readLiveCard(checkout: string, id: string): Promise<RunCard | undefined> {
  const raw = await readFile(join(liveDir(checkout), logCardFile(id)), 'utf8').catch(() => undefined)
  if (raw === undefined) return undefined
  const card = parseRunCard(raw)
  return card && schedulerMark(card) ? card : undefined
}

/** A checkout's live diary, every line that parses. */
export async function readLiveDiary(checkout: string, id: string): Promise<AnyDiaryLine[]> {
  const raw = await readFile(join(liveDir(checkout), logDiaryFile(id)), 'utf8').catch(() => '')
  return parseDiary(raw)
}

/** Close a checkout's live record from outside its process: the `ended` line appended, the card's status set. Best-effort. */
export async function endLiveCard(checkout: string, card: RunCard, status: Exclude<RunStatus, 'running'>, detail: string, at: string): Promise<RunCard> {
  const ended: RunCard = { ...card, status, endedAt: at }
  await appendFile(join(liveDir(checkout), logDiaryFile(card.id)), JSON.stringify({ kind: 'ended', status, detail }) + '\n').catch(() => {})
  await writeFile(join(liveDir(checkout), logCardFile(card.id)), JSON.stringify(ended, null, 2) + '\n').catch(() => {})
  return ended
}
