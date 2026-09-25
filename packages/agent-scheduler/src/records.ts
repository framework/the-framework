import { runnerMark } from 'agent-runner'
import { listRuns, type LogsDeps, type RunCard } from '@gemstack/skill-logs'
import { promptCommand, type Schedule } from './schedule.js'

/**
 * The runs a command has, read off the run records on the project's `agent-data` branch, so
 * every machine that shares the branch counts the same ones against a command's cap and pace. A
 * record names only what its run was asked; which command of the schedule that is, is decided
 * here when the records are counted: the schedule line the prompt names, else the prompt's first
 * word without its slash. A run a person started from a dashboard counts like a scheduled one.
 * Only runs `agent-runner` started, which carry its mark, are counted.
 */

/** The command a run counts for, or `undefined` for a run `agent-runner` did not start. */
export function commandOf(card: RunCard, schedule: Schedule | undefined): string | undefined {
  if (!runnerMark(card) || card.intent === undefined) return undefined
  return promptCommand(card.intent, schedule)
}

/** When one command last started, on any machine, whatever became of the run; nothing when it never did. */
export async function lastStart(repo: string, command: string, schedule: Schedule | undefined, deps: LogsDeps = {}): Promise<string | undefined> {
  const cards = await listRuns(repo, {}, deps)
  let latest: string | undefined
  for (const card of cards) {
    if (commandOf(card, schedule) === command && (latest === undefined || card.startedAt > latest)) latest = card.startedAt
  }
  return latest
}

/** The runs of one command still in flight, on any machine. */
export async function inFlight(repo: string, command: string, schedule: Schedule | undefined, deps: LogsDeps = {}): Promise<RunCard[]> {
  const cards = await listRuns(repo, {}, deps)
  return cards.filter(card => card.status === 'running' && commandOf(card, schedule) === command)
}
