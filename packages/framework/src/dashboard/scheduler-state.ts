import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isPidAlive } from '../store/index.js'
import type { ProjectSummary } from './projects.js'

// The scheduler card's read (#1774): a projection of `.agent-scheduler/state.json`, the file the
// scheduler writes per project and per user, exactly as it stands. The dashboard reads the file by
// its name; it never runs the tool, and a project without the file is simply not set up.
//
// Forgiving like every other read here: a missing, unreadable or malformed file reads as not set
// up, and a field that is not what the file promises reads as absent. The one thing added on the
// way out is whether the scheduler's process is alive, which only the operating system knows.

/** The file the scheduler keeps its state in, at the project's root; per user, hidden from git by the tool. */
export const SCHEDULER_STATE_FILE = '.agent-scheduler/state.json'

/** What the last tick decided for one scheduled command, one line for a person. */
export interface SchedulerDecision {
  command: string
  outcome: string
  /** The run's id when the tick started one: the same id the agent's record and checkout carry. */
  run?: string
}

/** The last tick as the state file remembers it. */
export interface SchedulerTick {
  /** ISO timestamp. */
  at: string
  decisions: SchedulerDecision[]
  /** Why the tick decided nothing, when it could not. */
  note?: string
}

/** A project's scheduler as the card shows it. */
export interface SchedulerState {
  /** Whether the state file exists and parses: a project without it has no scheduler set up. */
  present: boolean
  /** Whether ticks start agents. */
  on: boolean
  /** Whether the scheduler's process outlives the dashboard that started it. */
  keepAlive: boolean
  /** Whether the scheduler's own process is alive on this machine. */
  running: boolean
  /** The model every run starts on. */
  model?: string
  /** How far past the quota boundary this project's unattended runs may start, in percentage points. */
  spendOffset?: number
  lastTick?: SchedulerTick
}

export interface ProjectScheduler extends SchedulerState {
  projectId: string
  projectName: string
}

const NOT_SET_UP: SchedulerState = { present: false, on: false, keepAlive: false, running: false }

/**
 * Read one project's scheduler state. `isAlive` is the process probe; injectable so a test can
 * decide what "running" means without holding a process.
 */
export async function readSchedulerState(cwd: string, isAlive: (pid: number) => boolean = isPidAlive): Promise<SchedulerState> {
  let raw: string
  try {
    raw = await readFile(join(cwd, SCHEDULER_STATE_FILE), 'utf8')
  } catch {
    return { ...NOT_SET_UP }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...NOT_SET_UP }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...NOT_SET_UP }
  const state = parsed as Record<string, unknown>
  const pid = typeof state['pid'] === 'number' ? state['pid'] : undefined
  const tick = lastTick(state['lastTick'])
  return {
    present: true,
    on: state['on'] === true,
    keepAlive: state['keepAlive'] === true,
    running: pid !== undefined && isAlive(pid),
    ...(typeof state['model'] === 'string' ? { model: state['model'] } : {}),
    ...(typeof state['spendOffset'] === 'number' && Number.isFinite(state['spendOffset']) ? { spendOffset: state['spendOffset'] } : {}),
    ...(tick ? { lastTick: tick } : {}),
  }
}

/** The last tick, kept only when it has the shape the file promises. */
function lastTick(value: unknown): SchedulerTick | undefined {
  if (!value || typeof value !== 'object') return undefined
  const tick = value as Record<string, unknown>
  if (typeof tick['at'] !== 'string' || !Array.isArray(tick['decisions'])) return undefined
  const decisions: SchedulerDecision[] = []
  for (const item of tick['decisions'] as unknown[]) {
    if (!item || typeof item !== 'object') continue
    const d = item as Record<string, unknown>
    if (typeof d['command'] !== 'string' || typeof d['outcome'] !== 'string') continue
    decisions.push({ command: d['command'], outcome: d['outcome'], ...(typeof d['run'] === 'string' ? { run: d['run'] } : {}) })
  }
  return { at: tick['at'], decisions, ...(typeof tick['note'] === 'string' ? { note: tick['note'] } : {}) }
}

/** Every registered project's scheduler, one row per project in registry order, a failing read as not set up. */
export async function collectSchedulers(
  projects: ProjectSummary[],
  read: (cwd: string) => Promise<SchedulerState> = readSchedulerState,
): Promise<ProjectScheduler[]> {
  const rows: ProjectScheduler[] = []
  for (const project of projects) {
    const state = await read(project.path).catch((): SchedulerState => ({ ...NOT_SET_UP }))
    rows.push({ projectId: project.id, projectName: project.name, ...state })
  }
  return rows
}

/**
 * The spend offset the usage panel draws (#960), read off the projects' schedulers: the loosest
 * one, since it is the one that lets unattended work spend the furthest; `undefined` when no
 * scheduler names one. The panel's slider writes it back through each project's `offset` hook,
 * so the schedulers agree unless one was set by hand.
 */
export function loosestSpendOffset(states: readonly SchedulerState[]): number | undefined {
  const offsets = states.flatMap(state => (state.spendOffset !== undefined ? [state.spendOffset] : []))
  return offsets.length ? Math.max(...offsets) : undefined
}
