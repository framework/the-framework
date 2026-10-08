import type { ModuleHost, ModuleProject } from '@openagt/dashboard/module'
import type { PublishPick, TickDecision } from '../src/state.js'
import { DEFAULT_PUBLISH } from '../src/names.js'

// What the module shows of each project's scheduler: the answer of `agent-scheduler status`, the
// state file as it stands plus whether the scheduler's process is alive. Forgiving: a field that is
// not what the command promises reads as absent, and a project whose command fails is a row that
// says why.

/** The publish picks a person can make for a scheduled command, in the menu's order, with their labels. */
export const PUBLISH_LABELS: Readonly<Record<PublishPick, string>> = {
  nothing: 'Nothing',
  commit: 'Commit',
  branch: 'Publish branch',
  pr: 'Open PR',
  merge: 'Merge on green',
}

const PUBLISH_PICKS = Object.keys(PUBLISH_LABELS) as PublishPick[]

/** How far the spend offset reaches either side of the quota boundary, in percentage points: the reach of the usage bar's handle. */
import { MAX_SPEND_OFFSET } from '@openagt/dashboard/module'
export { MAX_SPEND_OFFSET }

/** One command the project's skills schedule, as the scheduler's last tick read it, with this machine's switch and publish pick. */
export interface SchedulerCommand {
  command: string
  /** How often at most, as written (`1d`). */
  every?: string
  /** The check, when the skill gives one. */
  when?: string
  /** What the check waits for, in one plain line, when the skill gives one. */
  waitsFor?: string
  /** Whether it runs on this machine: off until a person switched it on here. */
  on: boolean
  /** How far a run of the command publishes on this machine: the pick made here, commit until one is made. */
  publish: PublishPick
  /** What the command's skill does, in the skill's own words, when it says. */
  description?: string
  /** What the scheduler's last tick decided for the command, when it decided anything. */
  decision?: TickDecision
}

/** A skill of the project whose `schedule` the scheduler could not read, with why: its commands are missing from the list. */
export interface UnreadableSchedule {
  skill: string
  reason: string
}

/** One project's scheduler, as its `status` answered. */
export interface SchedulerRow {
  project: ModuleProject
  /** Why the status could not be read; the rest is then empty. */
  error?: string
  /** Whether ticks start agents. */
  on: boolean
  /** Whether the scheduler's process outlives the dashboard that started it. */
  keepAlive: boolean
  /** Whether the scheduler's own process is alive on this machine. */
  running: boolean
  /** The model every scheduled run starts on. */
  model?: string
  /** How far past the quota boundary the project's scheduled runs may still start, in percentage points. */
  spendOffset?: number
  lastTick?: { at: string; decisions: TickDecision[]; note?: string }
  /** The scheduled commands; empty until the scheduler has ticked once, and where no skill of the project schedules one. */
  commands: SchedulerCommand[]
  /** The skills whose `schedule` the last tick could not read. */
  unreadable: UnreadableSchedule[]
}

function isPick(value: unknown): value is PublishPick {
  return (PUBLISH_PICKS as unknown[]).includes(value)
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** What a tick says of a skill whose `schedule` it could not read, before the reason. */
const UNREADABLE = 'unreadable schedule: '

/** A project's row from what `status` printed: each scheduled command with this machine's switch and publish pick and the last tick's decision folded in, and the skills the tick could not read. */
export function schedulerRow(project: ModuleProject, output: unknown): SchedulerRow {
  const state = record(output)
  const tick = record(state['lastTick'])
  const switches = record(state['switches'])
  const publishes = record(state['publishes'])
  const decisions: TickDecision[] = []
  for (const item of Array.isArray(tick['decisions']) ? (tick['decisions'] as unknown[]) : []) {
    const d = record(item)
    if (typeof d['command'] !== 'string' || typeof d['outcome'] !== 'string') continue
    decisions.push({ command: d['command'], outcome: d['outcome'], ...(typeof d['run'] === 'string' ? { run: d['run'] } : {}) })
  }
  const commands: SchedulerCommand[] = []
  for (const item of Array.isArray(tick['schedule']) ? (tick['schedule'] as unknown[]) : []) {
    const row = record(item)
    const command = row['command']
    if (typeof command !== 'string') continue
    const picked = publishes[command]
    const decision = decisions.find(d => d.command === command)
    commands.push({
      command,
      ...(typeof row['every'] === 'string' ? { every: row['every'] } : {}),
      ...(typeof row['when'] === 'string' ? { when: row['when'] } : {}),
      ...(typeof row['waitsFor'] === 'string' ? { waitsFor: row['waitsFor'] } : {}),
      on: switches[command] === true,
      publish: isPick(picked) ? picked : DEFAULT_PUBLISH,
      ...(typeof row['description'] === 'string' ? { description: row['description'] } : {}),
      ...(decision ? { decision } : {}),
    })
  }
  const offset = state['spendOffset']
  return {
    project,
    on: state['on'] === true,
    keepAlive: state['keepAlive'] === true,
    running: state['running'] === true,
    ...(typeof state['model'] === 'string' ? { model: state['model'] } : {}),
    ...(typeof offset === 'number' && Number.isFinite(offset) ? { spendOffset: offset } : {}),
    ...(typeof tick['at'] === 'string' ? { lastTick: { at: tick['at'], decisions, ...(typeof tick['note'] === 'string' ? { note: tick['note'] } : {}) } } : {}),
    commands,
    unreadable: decisions.flatMap(d => (d.outcome.startsWith(UNREADABLE) ? [{ skill: d.command, reason: d.outcome.slice(UNREADABLE.length) }] : [])),
  }
}

/** Every project's scheduler, one row per project in the order given: `agent-scheduler status` run in each. */
export function readSchedulers(host: ModuleHost, projects: readonly ModuleProject[]): Promise<SchedulerRow[]> {
  return Promise.all(
    projects.map(async project => {
      const answer = await host.runCommand(project.id, ['status'])
      return answer.ok ? schedulerRow(project, answer.output) : { project, error: answer.error, on: false, keepAlive: false, running: false, commands: [], unreadable: [] }
    }),
  )
}

/**
 * The spend offset in force across the projects: the loosest one, since it is the one that lets
 * scheduled work spend the furthest; `undefined` when no project answered one. A save writes every
 * project, so the schedulers agree unless one was set by hand.
 */
export function loosestSpendOffset(rows: readonly SchedulerRow[]): number | undefined {
  const offsets = rows.flatMap(row => (row.spendOffset !== undefined ? [row.spendOffset] : []))
  return offsets.length ? Math.max(...offsets) : undefined
}

/** The projects whose spend offset is not the one in force (the loosest), each with its own, to one decimal: what a save would bring into line. */
export function offsetsThatDiffer(rows: readonly SchedulerRow[]): { name: string; offset: number }[] {
  const loosest = loosestSpendOffset(rows)
  return rows.flatMap(row => (row.spendOffset !== undefined && row.spendOffset !== loosest ? [{ name: row.project.name, offset: Math.round(row.spendOffset * 10) / 10 }] : []))
}

/** The spend offset a typed text means: a whole number of points held to the reach of the usage bar's handle; `undefined` while the text is no number yet (empty, a minus sign alone). */
export function typedOffset(raw: string): number | undefined {
  if (raw.trim() === '' || !Number.isFinite(Number(raw))) return undefined
  return Math.min(Math.max(Math.round(Number(raw)), -MAX_SPEND_OFFSET), MAX_SPEND_OFFSET)
}

export type Saved = { ok: true } | { ok: false; error: string }

/** Save the spend offset in every project: `agent-scheduler offset -- <points>`, the `--` so a negative value is no flag. Each failing project is named. */
export async function saveSpendOffset(host: ModuleHost, projects: readonly ModuleProject[], points: number): Promise<Saved> {
  const answers = await Promise.all(projects.map(async project => ({ project, answer: await host.runCommand(project.id, ['offset', '--', String(points)]) })))
  const failed = answers.flatMap(({ project, answer }) => (answer.ok ? [] : [`${project.name}: ${answer.error}`]))
  return failed.length ? { ok: false, error: failed.join('; ') } : { ok: true }
}

/** The picks a scheduled command's publish menu lists: every one where the project has a git host package, else Nothing, Commit and Publish branch, since no pull request can be opened; and the pick in force when the project is not offered it. */
export function publishChoices(gitHost: boolean, saved: PublishPick): readonly PublishPick[] {
  const offered: readonly PublishPick[] = gitHost ? PUBLISH_PICKS : ['nothing', 'commit', 'branch']
  return offered.includes(saved) ? offered : [...offered, saved]
}

const UNITS: Readonly<Record<string, string>> = { m: 'minute', h: 'hour', d: 'day' }

/** An interval as a skill writes it, spelled out: `15m` is "15 minutes", `1h` is "1 hour". One the tool would not have read is shown as written. */
export function spelled(every: string): string {
  const unit = UNITS[every.slice(-1)]
  const count = Number(every.slice(0, -1))
  return unit && Number.isInteger(count) ? `${count} ${unit}${count === 1 ? '' : 's'}` : every
}

const sentence = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** How often a scheduled command runs, as a sentence: its interval, what its check waits for, or both. A check whose skill gives no plain line is "when its check finds work". */
export function pace(command: SchedulerCommand): string {
  const waits = command.waitsFor ?? 'when its check finds work'
  if (command.every && command.when) return `Every ${spelled(command.every)} at most, ${waits}`
  if (command.every) return `Every ${spelled(command.every)}`
  return sentence(waits)
}

/** How far a scheduled command's runs publish on this machine, as a sentence. */
export function publishes(command: SchedulerCommand): string {
  if (command.publish === 'commit') return 'Commits its work'
  if (command.publish === 'branch') return 'Publishes its branch'
  if (command.publish === 'pr') return 'Opens a pull request'
  if (command.publish === 'merge') return 'Opens a pull request that merges on green'
  return 'Publishes nothing'
}

/**
 * What the scheduler last decided for a scheduled command, for a person: "Off" for a command
 * switched off here, "No work" for a check that found none, "Started a run", else the tool's own
 * words (`Cap reached (…)`, `Quota: …`, `Not due (last start 2h ago, every 6h)`). A command the
 * coding agent cannot run says so whatever its switch. Nothing for a command switched on that no
 * tick has decided yet.
 */
export function decided(command: SchedulerCommand): string | undefined {
  const outcome = command.decision?.outcome
  if (outcome?.startsWith('not a command of the coding agent')) return sentence(outcome)
  if (!command.on) return 'Off'
  if (outcome === undefined || outcome === 'switched off on this machine') return undefined
  if (outcome === 'not due') return 'No work'
  if (outcome.startsWith('started ')) return 'Started a run'
  return sentence(outcome)
}

/** The one word a scheduler's row leads with, and its colour. */
export function schedulerStatus(row: Pick<SchedulerRow, 'error' | 'on' | 'running'>): { label: string; tone: string } {
  if (row.error !== undefined) return { label: 'not readable', tone: 'text-danger' }
  if (!row.on) return { label: 'off', tone: 'text-muted-foreground' }
  if (!row.running) return { label: 'on, not running', tone: 'text-warning' }
  return { label: 'on', tone: 'text-success' }
}
