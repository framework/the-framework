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

/** A command's last run, as a dashboard lists it: which run, when it started, and whether it failed. */
export interface LastRun {
  id: string
  /** When the run started, ISO. */
  at: string
  /** Whether the run ended `failed`. */
  failed?: true
}

/**
 * Each command's last run: the latest run it has, by its start, whatever became of it. It says
 * `failed` only when that run ended `failed`: one still going, ended well, stopped by a person or
 * waiting for an answer does not, so a later run takes a failure's place. Counted like the
 * starts: every machine's runs for a skill's command, this machine's for an automation kept here.
 */
export async function lastRuns(repo: string, schedule: Schedule, host: string, deps: LogsDeps = {}): Promise<Record<string, LastRun>> {
  const latest = new Map<string, RunCard>()
  for (const card of await listRuns(repo, {}, deps)) {
    const command = commandOf(card, schedule, host)
    if (command === undefined || !isTime(card.startedAt)) continue
    const known = latest.get(command)
    if (!known || card.startedAt > known.startedAt) latest.set(command, card)
  }
  return Object.fromEntries([...latest].map(([command, card]): [string, LastRun] => [command, { id: card.id, at: card.startedAt, ...(card.status === 'failed' ? { failed: true as const } : {}) }]))
}

/** The runs of one command still in flight: on any machine for a skill's command, on this one for an automation kept here. */
export async function inFlight(repo: string, command: string, schedule: Schedule, host: string, deps: LogsDeps = {}): Promise<RunCard[]> {
  const cards = await listRuns(repo, {}, deps)
  return cards.filter(card => card.status === 'running' && commandOf(card, schedule, host) === command)
}
