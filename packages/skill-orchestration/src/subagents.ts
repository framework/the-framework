import type { FileBranchWrite, GitRunner } from '@gemstack/agent-data'
import { worktreeBranch, worktreeClean, worktreePath } from '@gemstack/skill-branches'
import { agentLines, findRun, listRuns, publicCard, readDiary, type RunCard } from '@gemstack/skill-logs'
import { AGENT_ID_ENV, isDriverName, markerCard, readLiveCard, runIdFrom, runnerMark, type DriverName, type readyToRun, type spawnRun } from 'agent-runner'

/**
 * A main agent and its subagents. The main agent is the run whose agent calls the command: its id
 * is in its environment (`AGENT_ID`). A subagent is a run started for it: a run of its own, in its
 * own checkout, on a branch started from the main agent's, with the main agent as its parent on
 * its record. The runner tells the main agent when a subagent ends; nothing here waits.
 */

/** What every subagent is told after its task: where its work goes, and that nobody answers it. */
export const SUBAGENT_LINES =
  'You are a subagent: another agent started you for this one task and reads your last reply as its result. Commit your work to your branch and do not open a pull request. Nobody will answer a question: decide yourself, and say in your last reply what you did and what you decided.'

/** The prompt a subagent gets: the task, then the lines above. */
export function subagentPrompt(task: string): string {
  return `${task}\n\n${SUBAGENT_LINES}`
}

/** The task a subagent was given, off its record: its prompt without the lines the command added. */
function taskOf(intent: string): string {
  return intent.endsWith(SUBAGENT_LINES) ? intent.slice(0, -SUBAGENT_LINES.length).trimEnd() : intent
}

export type Refusal = { ok: false; reason: string; [key: string]: unknown }

/** A command refused: the JSON it answers and the line for a person. */
export class Refused extends Error {
  constructor(readonly outcome: Refusal, readonly line: string) {
    super(line)
  }
}

export interface SubagentDeps {
  git: GitRunner
  /** This machine's name, as a run's record carries it. */
  host: string
  isAlive: (pid: number) => boolean
  /** Ask a run's process to stop. */
  stop: (pid: number) => void
  ready: typeof readyToRun
  now: () => Date
  /** Put a run's first record, `running`, on the data branch. */
  mark: (repo: string, card: RunCard) => Promise<FileBranchWrite>
  /** Take that record back. */
  unmark: (repo: string, id: string) => Promise<unknown>
  /** Start a run's process, detached; resolves once it is spawned. */
  spawn: typeof spawnRun
}

/** A subagent as the command prints it: the record's own fields, its task in place of its whole prompt. */
export type Subagent = Omit<RunCard, 'caller'>

function view(card: RunCard): Subagent {
  const shown = publicCard(card)
  return shown.intent !== undefined ? { ...shown, intent: taskOf(shown.intent) } : shown
}

/**
 * The run whose agent is calling: the one `AGENT_ID` names, by its record, or by the live card in
 * its checkout while its first record is still on its way to the branch.
 */
async function mainAgent(repo: string, env: NodeJS.ProcessEnv): Promise<RunCard> {
  const id = env[AGENT_ID_ENV]?.trim()
  if (!id) throw new Refused({ ok: false, reason: 'not-a-run' }, `${AGENT_ID_ENV} is not set: only an agent started as a run has subagents; do the task yourself`)
  const card = (await findRun(repo, id)) ?? (await readLiveCard(worktreePath(repo, id), id))
  if (!card) throw new Refused({ ok: false, reason: 'not-a-run', id }, `no run ${id} in this project: only an agent started as a run has subagents; do the task yourself`)
  return card
}

/** One of the caller's subagents, by id. */
async function subagentOf(repo: string, main: RunCard, id: string): Promise<RunCard> {
  const card = await findRun(repo, id)
  if (!card || runnerMark(card)?.parent !== main.id) throw new Refused({ ok: false, reason: 'not-yours', id }, `${id} is not a subagent of this run`)
  return card
}

/**
 * Start a subagent on a task: a run with the caller as its parent, its branch started from the
 * branch the caller's checkout is on, on the caller's coding agent unless one is named. A
 * subagent starts none of its own. Its record is written before its process is spawned, as a
 * scheduler's run is, so the id answered is one `list`, `read` and `stop` already know.
 */
export async function startSubagent(
  repo: string,
  env: NodeJS.ProcessEnv,
  opts: { task: string; model?: string; driver?: DriverName },
  deps: SubagentDeps,
): Promise<{ id: string; driver: DriverName; model?: string; base: string; uncommitted?: true }> {
  const main = await mainAgent(repo, env)
  if (runnerMark(main)?.parent !== undefined) throw new Refused({ ok: false, reason: 'subagent' }, 'a subagent starts no subagents: do the task yourself')
  const checkout = worktreePath(repo, main.id)
  const base = await worktreeBranch(checkout, deps.git)
  if (base === undefined) throw new Refused({ ok: false, reason: 'no-branch' }, `the checkout of ${main.id} is on no branch: a subagent starts from a branch`)
  const driver = opts.driver ?? (main.driver !== undefined && isDriverName(main.driver) ? main.driver : 'claude-code')
  const ready = await deps.ready(repo, driver)
  if (ready.problems.length > 0) throw new Refused({ ok: false, reason: 'not-ready', ...ready }, ready.problems.join(' '))
  // The subagent's branch starts from the caller's last commit: what is not committed is not in it.
  const uncommitted = !(await worktreeClean(checkout, deps.git).catch(() => true))
  const startedAt = deps.now().toISOString()
  const id = runIdFrom(startedAt)
  const prompt = subagentPrompt(opts.task)
  const model = opts.model !== undefined ? { model: opts.model } : {}
  const marked = await deps.mark(repo, markerCard({ id, startedAt, prompt, driver, ...model, mark: { host: deps.host, parent: main.id, base } }))
  if (!marked.ok && !marked.committed) throw new Error(`the subagent's record could not be written: ${marked.error}`)
  try {
    await deps.spawn(repo, { id, prompt, driver, ...model, parent: main.id, base })
  } catch (err) {
    await deps.unmark(repo, id)
    throw err
  }
  return { id, driver, ...model, base, ...(uncommitted ? { uncommitted: true } : {}) }
}

/** The caller's subagents, newest first. */
export async function listSubagents(repo: string, env: NodeJS.ProcessEnv): Promise<Subagent[]> {
  const main = await mainAgent(repo, env)
  return (await listRuns(repo)).filter(card => runnerMark(card)?.parent === main.id).map(view)
}

/** One of the caller's subagents, with its last reply as `result` once it has one on its record. */
export async function readSubagent(repo: string, env: NodeJS.ProcessEnv, id: string): Promise<Subagent & { result?: string }> {
  const card = await subagentOf(repo, await mainAgent(repo, env), id)
  const result = agentLines((await readDiary(repo, id)) ?? [])
    .flatMap(line => (line.kind === 'result' ? [line.text] : []))
    .at(-1)
  return { ...view(card), ...(result !== undefined ? { result } : {}) }
}

/**
 * Stop one of the caller's subagents: the signal a person's Stop sends, to the process its live
 * card names. The run records itself `stopped` and tells its parent, like any other end.
 */
export async function stopSubagent(repo: string, env: NodeJS.ProcessEnv, id: string, deps: SubagentDeps): Promise<{ id: string }> {
  const card = await subagentOf(repo, await mainAgent(repo, env), id)
  if (card.status !== 'running') throw new Refused({ ok: false, reason: 'not-running', id, status: card.status }, `${id} is not running: it ended ${card.status}`)
  if (runnerMark(card)?.host !== deps.host) throw new Refused({ ok: false, reason: 'other-machine', id }, `${id} runs on another machine: it can only be stopped there`)
  const live = await readLiveCard(worktreePath(repo, id), id)
  const pid = live?.status === 'running' ? runnerMark(live)?.pid : undefined
  if (pid === undefined || !deps.isAlive(pid)) throw new Refused({ ok: false, reason: 'no-process', id }, `${id} has no process to stop yet, or its process died: look again in a moment`)
  deps.stop(pid)
  return { id }
}
