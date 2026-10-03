import type { ModuleHost, ModuleProject } from 'framework/module'
import type { PublishPick, TickDecision } from '../src/state.js'
import type { Publish } from 'agent-runner'

// What the module shows of each project's scheduler: the answer of `agent-scheduler status`, the
// state file as it stands plus whether the scheduler's process is alive. Forgiving: a field that is
// not what the command promises reads as absent, and a project whose command fails is a row that
// says why.

/** The publish picks a person can make for a scheduled command, in the menu's order, with their labels. */
export const PUBLISH_LABELS: Readonly<Record<PublishPick, string>> = {
  nothing: 'Nothing',
  branch: 'Publish branch',
  pr: 'Open PR',
  merge: 'Merge on green',
}

const PUBLISH_PICKS = Object.keys(PUBLISH_LABELS) as PublishPick[]

/** How far the spend offset reaches either side of the quota boundary, in percentage points: the reach of the usage bar's handle. */
import { MAX_SPEND_OFFSET } from 'framework/module'
export { MAX_SPEND_OFFSET }

/** One command of the project's schedule, as the scheduler's last tick read it, with this machine's switch and publish pick. */
export interface SchedulerCommand {
  command: string
  /** How often at most, as written (`1d`). */
  every?: string
  /** The check, when the line has one. */
  when?: string
  /** Whether it runs on this machine: the machine's switch, else what the line says. */
  on: boolean
  /** How far a run of the command publishes, when the line says. A line that says nothing publishes nothing. */
  publish?: Publish
  /** This machine's publish pick for the command, which stands in for the line's level; absent when nobody picked here. */
  publishPick?: PublishPick
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
  /** The schedule's commands; empty until the scheduler has ticked once with a schedule. */
  commands: SchedulerCommand[]
}

function isPick(value: unknown): value is PublishPick {
  return (PUBLISH_PICKS as unknown[]).includes(value)
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** A project's row from what `status` printed: each scheduled command with this machine's switch and publish pick folded in. */
export function schedulerRow(project: ModuleProject, output: unknown): SchedulerRow {
  const state = record(output)
  const tick = record(state['lastTick'])
  const switches = record(state['switches'])
  const publishes = record(state['publishes'])
  const commands: SchedulerCommand[] = []
  for (const item of Array.isArray(tick['schedule']) ? (tick['schedule'] as unknown[]) : []) {
    const line = record(item)
    const command = line['command']
    if (typeof command !== 'string' || typeof line['on'] !== 'boolean') continue
    const switched = switches[command]
    const picked = publishes[command]
    const level = line['publish']
    commands.push({
      command,
      ...(typeof line['every'] === 'string' ? { every: line['every'] } : {}),
      ...(typeof line['when'] === 'string' ? { when: line['when'] } : {}),
      on: typeof switched === 'boolean' ? switched : line['on'],
      ...(isPick(level) && level !== 'nothing' ? { publish: level } : {}),
      ...(isPick(picked) ? { publishPick: picked } : {}),
    })
  }
  const decisions: TickDecision[] = []
  for (const item of Array.isArray(tick['decisions']) ? (tick['decisions'] as unknown[]) : []) {
    const d = record(item)
    if (typeof d['command'] !== 'string' || typeof d['outcome'] !== 'string') continue
    decisions.push({ command: d['command'], outcome: d['outcome'], ...(typeof d['run'] === 'string' ? { run: d['run'] } : {}) })
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
  }
}

/** Every project's scheduler, one row per project in the order given: `agent-scheduler status` run in each. */
export function readSchedulers(host: ModuleHost, projects: readonly ModuleProject[]): Promise<SchedulerRow[]> {
  return Promise.all(
    projects.map(async project => {
      const answer = await host.runCommand(project.id, ['status'])
      return answer.ok ? schedulerRow(project, answer.output) : { project, error: answer.error, on: false, keepAlive: false, running: false, commands: [] }
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

/** The picks a scheduled command's publish menu lists after "As the file says": all four where the project has a git host package, else Nothing and Publish branch, since no pull request can be opened; and the pick already saved when the project is no longer offered it. */
export function publishChoices(gitHost: boolean, saved: PublishPick | undefined): readonly PublishPick[] {
  const offered: readonly PublishPick[] = gitHost ? PUBLISH_PICKS : ['nothing', 'branch']
  return saved !== undefined && !offered.includes(saved) ? [...offered, saved] : offered
}

/** How often a scheduled command runs, in words: its interval, its check, or both. */
export function pace(command: SchedulerCommand): string {
  if (command.every && command.when) return `every ${command.every} at most, when its check finds work`
  if (command.every) return `every ${command.every}`
  return 'when its check finds work'
}

/** How far a scheduled command's runs publish on this machine, in words: the person's pick here, else what its schedule line says, nothing when it says none. */
export function publishes(command: SchedulerCommand): string {
  const level = command.publishPick ?? command.publish
  if (level === 'branch') return 'publishes its branch'
  if (level === 'pr') return 'opens a pull request'
  if (level === 'merge') return 'opens a pull request that merges on green'
  return 'publishes nothing'
}

/** The one word a scheduler's row leads with, and its colour. */
export function schedulerStatus(row: SchedulerRow): { label: string; tone: string } {
  if (row.error !== undefined) return { label: 'not readable', tone: 'text-danger' }
  if (!row.on) return { label: 'off', tone: 'text-muted-foreground' }
  if (!row.running) return { label: 'on, not running', tone: 'text-warning' }
  return { label: 'on', tone: 'text-success' }
}
