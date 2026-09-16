import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { excludeFromGit } from '@gemstack/agent-data'
import type { DriverEvent } from 'agent-driver'
import type { AnyDiaryLine, RunCard, RunStatus } from '@gemstack/skill-logs'
import type { SchedulerMark } from './records.js'

/**
 * The live log of a run, TEMPORARY: `agent.json` and `events.jsonl` under `.the-framework/` in
 * the run's checkout, in the shape The Framework's dashboard reads today — the shape its own run
 * child writes. Written here so a scheduled run shows on the dashboard as it goes, until
 * agent-driver writes a live log of its own to a path it is given and the dashboard reads that.
 * Nothing in this tool reads these files back except the sweep, which needs the pid.
 *
 * The meta is folded from the events the way the dashboard folds them: `session` names the
 * driver and the workspace, `intent` the prompt, `branch` the branch, `usage` adds to the cost,
 * `end` closes the run, `done`, `failed` or `stopped` (the dashboard's own flag on an end event).
 */

/** The dashboard's directory, and the two files, as it names them. */
export const LIVE_DIR = '.the-framework'
export const META_FILE = 'agent.json'
export const EVENTS_FILE = 'events.jsonl'

export interface LiveMeta {
  status: RunStatus
  id: string
  startedAt: string
  updatedAt: string
  endedAt?: string
  pid: number
  host: string
  intent: string
  kind: 'prompt'
  driver?: string
  workspace?: string
  model?: string
  branch?: string
  sessionId?: string
  cost?: number
  /** This tool's mark: the sweep touches only a checkout whose meta carries one. */
  scheduler: SchedulerMark
}

export type LiveEvent =
  | { kind: 'session'; driver: string; workspace: string; fake: boolean; model?: string }
  | { kind: 'session-update'; sessionId: string }
  | { kind: 'intent'; text: string }
  | { kind: 'branch'; branch: string }
  | { kind: 'driver'; event: DriverEvent }
  | { kind: 'usage'; costUsd?: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; turns: number }
  | { kind: 'end'; ok: boolean; stopped?: boolean; detail?: string }

/** One event folded into the meta, the dashboard's rules. Pure. */
export function foldEvent(meta: LiveMeta, event: LiveEvent, at: string): LiveMeta {
  const next: LiveMeta = { ...meta, updatedAt: at }
  switch (event.kind) {
    case 'session':
      next.driver = event.driver
      next.workspace = event.workspace
      if (event.model) next.model = event.model
      break
    case 'session-update':
      next.sessionId = event.sessionId
      break
    case 'intent':
      next.intent = event.text
      break
    case 'branch':
      next.branch = event.branch
      break
    case 'usage':
      if (event.costUsd !== undefined) next.cost = (next.cost ?? 0) + event.costUsd
      break
    case 'end':
      next.status = endStatus(event)
      next.endedAt = at
      break
    default:
      break
  }
  return next
}

/** How an end event ends the run: `done`, `stopped` when a signal ended it, else `failed`. */
function endStatus(event: LiveEvent & { kind: 'end' }): Exclude<RunStatus, 'running'> {
  return event.ok ? 'done' : event.stopped ? 'stopped' : 'failed'
}

/**
 * One event as a line of the `logs` skill's diary: what the agent said, its result, the run's end
 * and its cost become the four kinds the skill knows; every other event is written as it is,
 * which is how the dashboard replays an archived run.
 */
export function toDiaryLine(event: LiveEvent): AnyDiaryLine {
  switch (event.kind) {
    case 'driver': {
      if (event.event.type === 'text') return { kind: 'said', text: event.event.text }
      if (event.event.type === 'result') {
        const { type: _type, ...rest } = event.event
        return { kind: 'result', ...rest }
      }
      return event as unknown as AnyDiaryLine
    }
    case 'end':
      return { kind: 'ended', status: endStatus(event), ...(event.detail !== undefined ? { detail: event.detail } : {}) }
    case 'usage': {
      const { kind: _kind, costUsd, ...rest } = event
      return { kind: 'cost', ...(costUsd !== undefined ? { usd: costUsd } : {}), ...rest }
    }
    default:
      return event as unknown as AnyDiaryLine
  }
}

/** The run's card out of its meta: the skill's fields on top, the rest under `caller`. */
export function toCard(meta: LiveMeta, pr?: { number: number; url: string }): RunCard {
  const { id, startedAt, endedAt, status, intent, driver, model, branch, cost, scheduler, ...rest } = meta
  const card: RunCard = { id, startedAt, status, intent, caller: { scheduler, ...rest } }
  if (endedAt !== undefined) card.endedAt = endedAt
  if (driver !== undefined) card.driver = driver
  if (model !== undefined) card.model = model
  if (branch !== undefined) card.branch = branch
  if (cost !== undefined) card.cost = cost
  if (pr !== undefined) card.pr = pr
  return card
}

/** The live log of one run: the files under its checkout, kept in step with the events appended. */
export class LiveLog {
  readonly events: LiveEvent[] = []
  private tail: Promise<void> = Promise.resolve()

  private constructor(
    private readonly dir: string,
    public meta: LiveMeta,
    private readonly clock: () => string,
  ) {}

  /**
   * Start a run's log: the directory made and hidden from git through the repository's exclude
   * file (an untracked directory would keep the checkout dirty, and a dirty checkout is never
   * reclaimed), the meta written, the event file empty.
   */
  static async open(checkout: string, meta: LiveMeta, clock: () => string = () => new Date().toISOString()): Promise<LiveLog> {
    const dir = join(checkout, LIVE_DIR)
    await mkdir(dir, { recursive: true })
    await excludeFromGit(checkout, `/${LIVE_DIR}`).catch(() => {})
    const log = new LiveLog(dir, meta, clock)
    await writeFile(join(dir, EVENTS_FILE), '')
    await log.writeMeta()
    return log
  }

  /** Append one event and refresh the meta. Writes stay ordered; a failed write never breaks the run. */
  append(event: LiveEvent): Promise<void> {
    this.meta = foldEvent(this.meta, event, this.clock())
    this.events.push(event)
    this.tail = this.tail
      .then(() => appendFile(join(this.dir, EVENTS_FILE), JSON.stringify(event) + '\n'))
      .then(() => this.writeMeta())
      .catch(() => {})
    return this.tail
  }

  /** The events as the skill's diary. */
  diary(): AnyDiaryLine[] {
    return this.events.map(toDiaryLine)
  }

  private writeMeta(): Promise<void> {
    return writeFile(join(this.dir, META_FILE), JSON.stringify(this.meta, null, 2) + '\n')
  }
}

/** A checkout's meta, or `undefined` when it holds none or it is not this tool's. */
export async function readLiveMeta(checkout: string): Promise<LiveMeta | undefined> {
  const raw = await readFile(join(checkout, LIVE_DIR, META_FILE), 'utf8').catch(() => undefined)
  if (raw === undefined) return undefined
  try {
    const meta = JSON.parse(raw) as LiveMeta
    return meta && typeof meta === 'object' && typeof meta.id === 'string' && meta.scheduler ? meta : undefined
  } catch {
    return undefined
  }
}

/** A checkout's events, every line that parses. */
export async function readLiveEvents(checkout: string): Promise<LiveEvent[]> {
  const raw = await readFile(join(checkout, LIVE_DIR, EVENTS_FILE), 'utf8').catch(() => '')
  const events: LiveEvent[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      events.push(JSON.parse(line) as LiveEvent)
    } catch {
      break
    }
  }
  return events
}

/** Close a checkout's log from outside its process: the run's end appended to both files, as the sweep does for a dead run. */
export async function endLiveLog(checkout: string, meta: LiveMeta, event: LiveEvent & { kind: 'end' }, at: string): Promise<LiveMeta> {
  const dir = join(checkout, LIVE_DIR)
  const next = foldEvent(meta, event, at)
  await appendFile(join(dir, EVENTS_FILE), JSON.stringify(event) + '\n').catch(() => {})
  await writeFile(join(dir, META_FILE), JSON.stringify(next, null, 2) + '\n').catch(() => {})
  return next
}
