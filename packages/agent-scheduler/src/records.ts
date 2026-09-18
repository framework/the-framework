import type { FileBranchWrite } from '@gemstack/agent-data'
import { deleteRun, listRuns, writeRun, type AnyDiaryLine, type LogsDeps, type RunCard } from '@gemstack/skill-logs'

/**
 * A run in flight is a run record (#1774): the `logs` skill's card on the project's `agent-data`
 * branch, written before the agent is spawned with `status: running` and this tool's own mark
 * under `caller`, and written again when the run ends — same id, same file — with how it went.
 * One file for the run's whole life, and every machine that shares the branch counts the same
 * running cards against a command's cap. No pid is held anywhere: a restart loses nothing.
 *
 * A running card from another machine is that machine's: only its own sweep, or a person, changes
 * it. A machine that never comes back leaves its card running and its command capped, on purpose:
 * nothing here guesses that a run it cannot see is dead.
 */

/** This tool's mark on a card, under `caller.scheduler`. */
export interface SchedulerMark {
  /** The command the run was started for. */
  command: string
  /** The machine that started it. */
  host: string
  /** The run's process on that machine, while it runs. */
  pid?: number
  /** The prompt a fresh agent is given once the run ends done with a pull request, the run's id after it (`run --then`). */
  then?: string
}

/** The mark a card carries, or `undefined` for a run this tool did not start. */
export function schedulerMark(card: RunCard): SchedulerMark | undefined {
  const mark = card.caller?.['scheduler']
  if (!mark || typeof mark !== 'object') return undefined
  const { command, host, pid, then } = mark as Record<string, unknown>
  if (typeof command !== 'string' || typeof host !== 'string') return undefined
  return { command, host, ...(typeof pid === 'number' ? { pid } : {}), ...(typeof then === 'string' ? { then } : {}) }
}

/** When one command last started, on any machine, whatever became of the run; nothing when it never did. */
export async function lastStart(repo: string, command: string, deps: LogsDeps = {}): Promise<string | undefined> {
  const cards = await listRuns(repo, {}, deps)
  let latest: string | undefined
  for (const card of cards) {
    if (schedulerMark(card)?.command === command && (latest === undefined || card.startedAt > latest)) latest = card.startedAt
  }
  return latest
}

/** The runs of one command still in flight, on any machine. */
export async function inFlight(repo: string, command: string, deps: LogsDeps = {}): Promise<RunCard[]> {
  const cards = await listRuns(repo, {}, deps)
  return cards.filter(card => card.status === 'running' && schedulerMark(card)?.command === command)
}

/** The card a run starts with. */
export function markerCard(run: { id: string; startedAt: string; prompt: string; driver: string; model?: string; mark: SchedulerMark }): RunCard {
  return {
    id: run.id,
    startedAt: run.startedAt,
    status: 'running',
    intent: run.prompt,
    driver: run.driver,
    ...(run.model !== undefined ? { model: run.model } : {}),
    caller: { scheduler: run.mark },
  }
}

/** Put the run's card on the branch before its agent exists. The outcome says whether it reached origin. */
export function writeMarker(repo: string, card: RunCard, deps: LogsDeps = {}): Promise<FileBranchWrite> {
  return writeRun(repo, card, [], deps)
}

/** Take a marker back: the tick lost the cap to another machine's marker, so this run never starts. */
export function withdrawMarker(repo: string, id: string, deps: LogsDeps = {}): Promise<FileBranchWrite> {
  return deleteRun(repo, id, deps)
}

/** Record how a run went: its card and its diary, over the marker. */
export function recordRun(repo: string, card: RunCard, diary: readonly AnyDiaryLine[], deps: LogsDeps = {}): Promise<FileBranchWrite> {
  return writeRun(repo, card, diary, deps)
}
