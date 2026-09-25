import type { FileBranchWrite } from '@gemstack/agent-data'
import { deleteRun, writeRun, type AnyDiaryLine, type LogsDeps, type RunCard } from '@gemstack/skill-logs'

/**
 * A run in flight is a run record (#1774): the `logs` skill's card on the project's `agent-data`
 * branch, written before the agent is spawned with `status: running` and this tool's own mark
 * under `caller`, and written again when the run ends — same id, same file — with how it went.
 * One file for the run's whole life, and every machine that shares the branch reads the same
 * running cards (a scheduler counts them against its caps). No pid is held anywhere: a restart
 * loses nothing.
 *
 * A running card from another machine is that machine's: only its own sweep, or a person, changes
 * it. A machine that never comes back leaves its card running, on purpose: nothing here guesses that a run it cannot see is dead.
 */

/** This tool's mark on a card, under `caller.runner`. */
export interface RunnerMark {
  /** The machine that started it. */
  host: string
  /** The run's process on that machine, while it runs. */
  pid?: number
  /** The prompt a fresh agent is given once the run ends done with a pull request, the run's id after it (`run --then`). */
  then?: string
}

/** The mark a card carries, or `undefined` for a run this tool did not start. */
export function runnerMark(card: RunCard): RunnerMark | undefined {
  const mark = card.caller?.['runner']
  if (!mark || typeof mark !== 'object') return undefined
  const { host, pid, then } = mark as Record<string, unknown>
  if (typeof host !== 'string') return undefined
  return { host, ...(typeof pid === 'number' ? { pid } : {}), ...(typeof then === 'string' ? { then } : {}) }
}

/** The card a run starts with. */
export function markerCard(run: { id: string; startedAt: string; prompt: string; driver: string; model?: string; mark: RunnerMark }): RunCard {
  return {
    id: run.id,
    startedAt: run.startedAt,
    status: 'running',
    intent: run.prompt,
    driver: run.driver,
    ...(run.model !== undefined ? { model: run.model } : {}),
    caller: { runner: run.mark },
  }
}

/** Put the run's card on the branch before its agent exists. The outcome says whether it reached origin. */
export function writeMarker(repo: string, card: RunCard, deps: LogsDeps = {}): Promise<FileBranchWrite> {
  return writeRun(repo, card, [], deps)
}

/** Take a marker back: a scheduler lost a cap to another machine's marker, so this run never starts. */
export function withdrawMarker(repo: string, id: string, deps: LogsDeps = {}): Promise<FileBranchWrite> {
  return deleteRun(repo, id, deps)
}

/** Record how a run went: its card and its diary, over the marker. */
export function recordRun(repo: string, card: RunCard, diary: readonly AnyDiaryLine[], deps: LogsDeps = {}): Promise<FileBranchWrite> {
  return writeRun(repo, card, diary, deps)
}
