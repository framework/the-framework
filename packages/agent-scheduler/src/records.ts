import { runnerMark } from '@openagt/agent-runner'
import { listRuns, type LogsDeps, type RunCard } from '@openagt/skill-logs'
import { isTime } from './names.js'
import { promptCommand, type Schedule } from './schedule.js'

/**
 * The runs a command has, read off the run records on the project's `agent-data` branch, so
 * every machine that shares the branch counts the same ones against a command's cap and pace. A
 * record names only what its run was asked; which command of the schedule that is, is decided
 * here when the records are counted: the scheduled command the prompt names, else the prompt's first
 * word without its slash. A run a person started from a dashboard counts like a scheduled one.
 * Only runs `agent-runner` started, which carry its mark, are counted.
 */

/**
 * The command a run counts for, as the machine `host` counts; `undefined` for a run
 * `agent-runner` did not start, and for one whose prompt names no command. A run of an automation
 * kept on a machine counts on that machine alone: another person may keep one of the same name,
 * and theirs is another automation.
 */
export function commandOf(card: RunCard, schedule: Schedule, host: string): string | undefined {
  const mark = runnerMark(card)
  if (!mark || card.intent === undefined) return undefined
  const command = promptCommand(card.intent, schedule)
  if (command === undefined) return undefined
  const own = schedule.commands.some(c => c.name === command && c.text !== undefined)
  return own && mark.host !== host ? undefined : command
}

/**
 * When one command last started, whatever became of the run; nothing when it never did. A skill's
 * command counts every machine's runs; an automation kept on this machine, this machine's. A
 * scheduled run's start is when its command was asked about, before its check ran: the tick gives
 * the run that moment as its start. A record whose start is not a time is not counted.
 */
export async function lastStart(repo: string, command: string, schedule: Schedule, host: string, deps: LogsDeps = {}): Promise<string | undefined> {
  const cards = await listRuns(repo, {}, deps)
  let latest: string | undefined
  for (const card of cards) {
    if (commandOf(card, schedule, host) === command && isTime(card.startedAt) && (latest === undefined || card.startedAt > latest)) latest = card.startedAt
  }
  return latest
}

/** The runs of one command still in flight: on any machine for a skill's command, on this one for an automation kept here. */
export async function inFlight(repo: string, command: string, schedule: Schedule, host: string, deps: LogsDeps = {}): Promise<RunCard[]> {
  const cards = await listRuns(repo, {}, deps)
  return cards.filter(card => card.status === 'running' && commandOf(card, schedule, host) === command)
}
