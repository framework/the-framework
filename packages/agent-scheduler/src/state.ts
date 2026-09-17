import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { excludeFromGit, nodeGitRunner, type GitRunner } from '@gemstack/agent-data'
import { DEFAULT_MODEL, DEFAULT_SPEND_OFFSET, RUNS_DIR, STATE_DIR, STATE_FILE } from './names.js'

/**
 * The tool's state (#1774): one JSON file under `.agent-scheduler/` at the repository root,
 * written by the tool and read by anyone — a dashboard shows it as it is. Per user, never
 * tracked: the directory is hidden through the repository's exclude file, the way `.branches/`
 * is, so no tracked file changes and nothing rides a sweeping `git add -A`.
 *
 * What is here is what would otherwise live in a process's memory: whether the scheduler is on,
 * whether it should outlive whatever started it, the model and the spend cushion this user's runs
 * take, the pid of the scheduler's own process when one runs, and the last tick with what it
 * decided per command. A restart loses nothing.
 */

/** What the tick decided for one command. */
export interface TickDecision {
  command: string
  /** One line, for a person: `started`, `not due`, `cap reached (…)`, `quota: …`, … */
  outcome: string
  /** The run's id, when one was started. */
  run?: string
}

/** One tick as the state remembers it. */
export interface TickRecord {
  /** ISO timestamp. */
  at: string
  decisions: TickDecision[]
  /** Why the tick decided nothing, when it could not: the schedule is missing, the pull failed. */
  note?: string
}

export interface State {
  /** Whether ticks start agents. Off is the default: nothing runs until a person says so. */
  on: boolean
  /** Whether the scheduler's process outlives whatever started it. Read by `stop --unless-keep-alive` only, the line a dashboard runs when it closes. */
  keepAlive: boolean
  /** The model every run starts on. */
  model: string
  /** How far past the spend boundary a run may still start, in percentage points. */
  spendOffset: number
  /** The scheduler's own process, while `start` has one running. */
  pid?: number
  /** When that process started, ISO. */
  startedAt?: string
  lastTick?: TickRecord
}

export const DEFAULT_STATE: State = { on: false, keepAlive: false, model: DEFAULT_MODEL, spendOffset: DEFAULT_SPEND_OFFSET }

export function stateDir(repo: string): string {
  return join(repo, STATE_DIR)
}

export function statePath(repo: string): string {
  return join(stateDir(repo), STATE_FILE)
}

/** Where a spawned run's stderr lands, so a run that dies before writing anything leaves a trace. */
export function runStderrPath(repo: string, id: string): string {
  return join(stateDir(repo), RUNS_DIR, `${id}.stderr`)
}

/** The state as written, defaults filled in; the default state when there is none or it does not parse. */
export async function readState(repo: string): Promise<State> {
  const raw = await readFile(statePath(repo), 'utf8').catch(() => undefined)
  if (raw === undefined) return { ...DEFAULT_STATE }
  try {
    const parsed = JSON.parse(raw) as Partial<State>
    return { ...DEFAULT_STATE, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

/**
 * Write the state. The first write also hides the directory from git; that is best-effort, since
 * a repository whose exclude file cannot be written still has a scheduler.
 */
export async function writeState(repo: string, state: State, git: GitRunner = nodeGitRunner()): Promise<void> {
  await mkdir(join(stateDir(repo), RUNS_DIR), { recursive: true })
  await excludeFromGit(repo, `/${STATE_DIR}`, undefined, git).catch(() => {})
  await writeFile(statePath(repo), JSON.stringify(state, null, 2) + '\n')
}

/**
 * The state without the scheduler's process, when that process is `pid`; unchanged otherwise. A
 * scheduler ending must not clear a pid another scheduler wrote meanwhile: a dashboard's close
 * hook stops one and its open hook starts the next while the first still finishes its tick.
 */
export function withoutPid(state: State, pid: number): State {
  if (state.pid !== pid) return state
  const { pid: _pid, startedAt: _startedAt, ...rest } = state
  return rest
}

/** Read, change, write: one edit of the state. */
export async function updateState(repo: string, change: (state: State) => State, git?: GitRunner): Promise<State> {
  const next = change(await readState(repo))
  await writeState(repo, next, git)
  return next
}
