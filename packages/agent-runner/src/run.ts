import { hostname } from 'node:os'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { continuationPrompt, logDiaryFile, parseQuestion, promptOf, takeInbox, type Driver, type DriverSession, type LogEndStatus } from 'agent-driver'
import { excludeFromGit, nodeGitRunner, type GitRunner } from '@gemstack/agent-data'
import { agentBranchName, attachCheckout, createCheckout, reclaimWorktree, worktreeBranch, worktreePath } from '@gemstack/skill-branches'
import { findRun, readDiary, type AnyDiaryLine, type LogsDeps, type RunCard, type RunStatus } from '@gemstack/skill-logs'
import { inboxPath, liveDir, LIVE_DIR, readLiveCard, readLiveDiary } from './live-card.js'
import { markerCard, recordRun, runnerMark, writeMarker, type RunnerMark } from './records.js'
import { projectGitHost, type GitHost, type MergeOutcome } from './git-host.js'
import { acquireRunLock, isPidAlive, releaseRunLock } from './run-lock.js'

/**
 * One run (#1774): a checkout from the branches package, a session from agent-driver, the prompt
 * once, and the agent's own loop to the end. No system prompt and no gates: the
 * command's skill file is the whole instruction, and the agent publishes its own work through
 * the skills in its checkout. This process records the run and reclaims the checkout when the
 * agent stops; a run that dies is caught by the sweep, which a scheduler runs on every tick.
 *
 * The session keeps the run's live record itself, the card and the diary under `.the-framework/`
 * in the checkout, in the run record's shape; this process adds its mark, the pid and the host,
 * and copies the two files onto the branch unchanged when the run ends. What reaches the agent
 * from outside comes through the session's inbox: a line waiting when a turn ends becomes the
 * next turn; when the last turn ended on a question and nothing waited, the run ends `waiting`,
 * keeps its checkout, and the answer resumes it (`resumeRun`): the same run, the same record,
 * continued.
 *
 * SIGINT or SIGTERM to this process stops the run: the agent's whole process tree is ended
 * through the driver, the run is recorded `stopped`, the checkout reclaimed. That is what a
 * dashboard's Stop sends, the pid being on the live card; nothing else steers a run.
 *
 * One-shot: `agent-runner run <prompt>` runs on its own. A scheduler's tick spawns the same thing
 * with the marker already written and the id chosen.
 *
 * A run may name a follow-up (`run --then <prompt>`): once it ends done with a pull request, a
 * fresh agent, a run of its own with its own record, works on the same branch from the prompt,
 * the first run's id after it. The first agent is told, in a line after its prompt, to open the
 * pull request without arming its merge; the follow-up ending done is when this process merges
 * it, through the project's git host (`git-host.ts`). A follow-up that fails or is stopped leaves the
 * request open, for a person.
 *
 * The pull request a run's branch has is read back the same way, through the git host the project
 * declares; a project with no git host package records none.
 */

/** The detail a stopped run's record carries. */
export const STOPPED_DETAIL = 'stopped by a signal to its process'

/** The line after a prompt when a follow-up is coming: the agent opens the request, this process merges it later. */
export const HOLD_MERGE_LINE = 'Open the pull request but do not arm its merge: it is merged for you once a follow-up is done.'

/** The prompt an agent gets: the run's own, and the line above when the run names a follow-up. */
export function agentPrompt(prompt: string, then: string | undefined): string {
  return then !== undefined ? `${prompt}\n\n${HOLD_MERGE_LINE}` : prompt
}

/** Filesystem-safe, time-ordered id from an ISO start: the shape the dashboard sorts runs by. */
export function runIdFrom(startedAt: string): string {
  return startedAt.replace(/[:.]/g, '-')
}

/** The model as a card or a session takes it: named, or left out so the tool starts on its own default. */
function modelOf(model: string | undefined): { model?: string } {
  return model !== undefined ? { model } : {}
}

export interface RunOptions {
  /** What the agent is told, usually a slash command. */
  prompt: string
  /** The run's id; minted from the start time when absent. */
  id?: string
  /** Whether the run's marker is already on the branch: a scheduler's tick writes it before it spawns. A person's run marks itself. */
  marked?: boolean
  /** The model the session starts on; the tool's own default when absent. */
  model?: string
  driver: Driver
  /** The branch to work on, an existing one; a fresh `agent-<id>` when absent. */
  branch?: string
  /** The follow-up's prompt: a fresh agent's once this run ends done with a pull request, this run's id after it. */
  then?: string
  /** The coding agent a follow-up run is on, given its id; this run's own when absent. */
  nextDriver?: (id: string) => Driver
  host?: string
  pid?: number
  /** Whether a pid is a live process here: what the run's lock asks of its holder. */
  isAlive?: (pid: number) => boolean
  now?: () => Date
  git?: GitRunner
  /** The project's git host; the one the project declares when absent. */
  gitHost?: GitHost
  logs?: LogsDeps
  log?: (line: string) => void
}

export interface RunOutcome {
  id: string
  status: Exclude<RunStatus, 'running'>
  branch?: string
  pr?: { number: number; url: string }
  cost?: number
  /** Whether the checkout went once the remote had its branch, or stayed and why. */
  checkout: { reclaimed: true } | { reclaimed: false; reason: string }
  detail?: string
  /** The follow-up run, when one ran, and how the merge of this run's pull request went when it ended done. */
  then?: RunOutcome & { merge?: MergeOutcome }
}

export async function runCommand(repo: string, opts: RunOptions): Promise<RunOutcome> {
  const outcome = await runOnce(repo, opts)
  return opts.then !== undefined ? followUp(repo, outcome, opts.then, opts) : outcome
}

async function runOnce(repo: string, opts: RunOptions): Promise<RunOutcome> {
  const git = opts.git ?? nodeGitRunner()
  const now = opts.now ?? (() => new Date())
  const clock = () => now().toISOString()
  const host = opts.host ?? hostname()
  const pid = opts.pid ?? process.pid
  const startedAt = clock()
  const id = opts.id ?? runIdFrom(startedAt)
  const mark: RunnerMark = { host, pid, ...(opts.then !== undefined ? { then: opts.then } : {}) }
  const log = opts.log ?? (() => {})
  const logs = opts.logs ?? {}

  await acquireRunLock(repo, id, { pid, isAlive: opts.isAlive ?? isPidAlive })
  try {
    // A person's run marks itself; a scheduler's run was marked before it was spawned.
    if (!opts.marked) {
      const marked = await writeMarker(repo, markerCard({ id, startedAt, prompt: opts.prompt, driver: opts.driver.id, ...modelOf(opts.model), mark }), logs)
      if (!marked.ok && !marked.committed) log(`[agent-runner] the run's record could not be written: ${marked.error}`)
    }

    // The checkout: the branches package's one sequence, on a fresh branch or the one given.
    // Without one there is no run, and the record says so instead of a marker left running.
    let checkout: { path: string; branch: string }
    try {
      checkout = opts.branch !== undefined ? await attachCheckout(repo, { agentId: id, branch: opts.branch }, git) : await createCheckout(repo, { agentId: id }, git)
    } catch (err) {
      const detail = `could not create a checkout: ${errorMessage(err)}`
      const endedAt = clock()
      await recordRun(repo, { ...markerCard({ id, startedAt, prompt: opts.prompt, driver: opts.driver.id, ...modelOf(opts.model), mark }), status: 'failed', endedAt }, [{ kind: 'ended', status: 'failed', detail, at: endedAt }], logs)
      return { id, status: 'failed', checkout: { reclaimed: false, reason: 'no checkout' }, detail }
    }
    // Awaited here, not returned: the lock is let go in `finally`, and a bare `return` of the
    // promise would run that before the session ends, leaving the run to the sweep.
    return await session(repo, {
      id,
      checkout,
      card: { id, startedAt, status: 'running', intent: opts.prompt, driver: opts.driver.id, ...modelOf(opts.model), branch: checkout.branch, caller: { runner: mark, pid, host, kind: 'prompt', workspace: checkout.path } },
      prompt: agentPrompt(opts.prompt, opts.then),
      driver: opts.driver,
      ...modelOf(opts.model),
      continued: false,
      git,
      gitHost: opts.gitHost ?? projectGitHost,
      logs,
      log,
      clock,
    })
  } finally {
    await releaseRunLock(repo, id, pid).catch(() => {})
  }
}

export interface ResumeOptions {
  /** The run to continue: one that ended `waiting`, or any ended run whose session the driver can resume. */
  id: string
  /** The user's words to the agent; or, with `answer`, absent. */
  text?: string
  /** The chosen label or labels, answering the question the run's last turn asked. */
  answer?: string
  driver: Driver
  /** The coding agent a follow-up run is on, given its id, when the run's record names a follow-up; this run's own when absent. */
  nextDriver?: (id: string) => Driver
  model?: string
  host?: string
  pid?: number
  /** Whether a pid is a live process here: what the run's lock asks of its holder. */
  isAlive?: (pid: number) => boolean
  now?: () => Date
  git?: GitRunner
  /** The project's git host; the one the project declares when absent. */
  gitHost?: GitHost
  logs?: LogsDeps
  log?: (line: string) => void
}

/**
 * Continue an ended run: the same id, the same record, the same branch. The checkout is the one
 * the run kept, or a new one attached to its branch; the session resumes by the id the record
 * carries; the diary goes on from where it stopped. The prompt is the user's text, or the
 * continuation of the question the run ended on with the given answer. A follow-up the record
 * names is still owed: the agent is told again not to arm the merge, and the follow-up runs once
 * this ends done.
 */
export async function resumeRun(repo: string, opts: ResumeOptions): Promise<RunOutcome> {
  const resumed = await resumeOnce(repo, opts)
  return resumed.then !== undefined ? followUp(repo, resumed.outcome, resumed.then, { ...opts, ...(resumed.model !== undefined ? { model: resumed.model } : {}) }) : resumed.outcome
}

async function resumeOnce(repo: string, opts: ResumeOptions): Promise<{ outcome: RunOutcome; then?: string; model?: string }> {
  const git = opts.git ?? nodeGitRunner()
  const now = opts.now ?? (() => new Date())
  const clock = () => now().toISOString()
  const host = opts.host ?? hostname()
  const pid = opts.pid ?? process.pid
  const logs = opts.logs ?? {}
  const log = opts.log ?? (() => {})

  const id = opts.id
  // Another process of this run, the one that ended it and still records and reclaims, or a
  // resume started just before this one, goes first: this one waits, then reads the run as that
  // one left it.
  await acquireRunLock(repo, id, { pid, isAlive: opts.isAlive ?? isPidAlive })
  try {
    const card = await findRun(repo, opts.id, logs)
    if (!card) throw new Error(`no run ${opts.id}`)
    // Every process of this run is gone by now, so a record still saying running is one whose
    // process died before it could end it: the sweep's to close first.
    if (card.status === 'running') throw new Error(`run ${opts.id} is still recorded running`)
    const previous = runnerMark(card)
    if (!previous) throw new Error(`run ${opts.id} is not this tool's`)
    const diary = (await readDiary(repo, opts.id, logs)) ?? []
    const sessionId = typeof card.caller?.['sessionId'] === 'string' ? (card.caller['sessionId'] as string) : undefined

    let prompt: string
    if (opts.answer !== undefined) {
      const question = [...diary].reverse().find(line => line.kind === 'question')
      const title = typeof question?.['title'] === 'string' ? (question['title'] as string) : 'your question'
      prompt = continuationPrompt(title, opts.answer)
    } else if (opts.text) {
      prompt = opts.text
    } else {
      throw new Error('a text or an answer is needed to resume a run')
    }

    const branch = card.branch ?? agentBranchName(opts.id)
    const path = worktreePath(repo, opts.id)
    const kept = await stat(path).then(s => s.isDirectory(), () => false)
    const checkout = kept ? { path, branch } : await attachCheckout(repo, { agentId: opts.id, branch }, git)

    // The record is written running again over the ended one, so every reader sees the run in flight.
    const mark: RunnerMark = { host, pid, ...(previous.then !== undefined ? { then: previous.then } : {}) }
    const runningCard: RunCard = { ...card, status: 'running', caller: { ...card.caller, runner: mark, pid, host, workspace: checkout.path } }
    delete runningCard.endedAt
    const reopened = await recordRun(repo, runningCard, diary, logs)
    if (!reopened.ok && !reopened.committed) log(`[agent-runner] the run's record could not be written: ${reopened.error}`)

    const model = opts.model ?? card.model
    const outcome = await session(repo, {
      id: opts.id,
      checkout,
      card: { ...runningCard },
      priorDiary: diary,
      prompt: agentPrompt(prompt, previous.then),
      driver: opts.driver,
      ...modelOf(model),
      continued: true,
      ...(sessionId !== undefined ? { resumeSessionId: sessionId } : {}),
      git,
      gitHost: opts.gitHost ?? projectGitHost,
      logs,
      log,
      clock,
    })
    return { outcome, ...(previous.then !== undefined ? { then: previous.then } : {}), ...modelOf(model) }
  } finally {
    await releaseRunLock(repo, id, pid).catch(() => {})
  }
}

/**
 * The follow-up a run named, once the run ended done with a pull request: a fresh agent on the
 * run's branch, a run of its own, given the prompt and the first run's id. When it ends done the
 * first run's request is merged through the project's git host; otherwise the request stays open. A
 * run that did not end done, or opened no request, has nothing to follow up.
 */
async function followUp(repo: string, first: RunOutcome, then: string, opts: FollowUpContext): Promise<RunOutcome> {
  if (first.status !== 'done' || !first.pr || !first.branch) return first
  const id = runIdFrom((opts.now ?? (() => new Date()))().toISOString())
  const next = await runCommand(repo, {
    prompt: `${then} ${first.id}`,
    id,
    branch: first.branch,
    driver: opts.nextDriver ? opts.nextDriver(id) : opts.driver,
    ...pick(opts, ['model', 'host', 'pid', 'isAlive', 'now', 'git', 'gitHost', 'logs', 'log']),
  })
  if (next.status !== 'done') return { ...first, then: next }
  return { ...first, then: { ...next, merge: await (opts.gitHost ?? projectGitHost).mergeRequest(repo, first.pr.number) } }
}

/** What a follow-up run shares with the run before it: where it runs and how, never what it is for. */
type FollowUpContext = Pick<RunOptions, 'driver' | 'nextDriver' | 'model' | 'host' | 'pid' | 'isAlive' | 'now' | 'git' | 'gitHost' | 'logs' | 'log'>

function pick<T extends object, K extends keyof T>(from: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const picked: Partial<Pick<T, K>> = {}
  for (const key of keys) if (from[key] !== undefined) picked[key] = from[key]
  return picked
}

interface SessionRun {
  id: string
  checkout: { path: string; branch: string }
  card: RunCard
  /** The diary the record already holds, for a continued run: written into the checkout before the session opens. */
  priorDiary?: AnyDiaryLine[]
  prompt: string
  driver: Driver
  model?: string
  continued: boolean
  resumeSessionId?: string
  git: GitRunner
  gitHost: GitHost
  logs: LogsDeps
  log: (line: string) => void
  clock: () => string
}

/** The session, its end, the record and the reclaim: the part a fresh run and a continued one share. */
async function session(repo: string, run: SessionRun): Promise<RunOutcome> {
  const dir = liveDir(run.checkout.path)
  const inbox = inboxPath(run.checkout.path)
  if (run.priorDiary) {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, logDiaryFile(run.id)), run.priorDiary.map(line => JSON.stringify(line) + '\n').join(''))
  }
  // A checkout with an untracked directory in it is a dirty tree, which the branches rule never reclaims.
  await excludeFromGit(run.checkout.path, `/${LIVE_DIR}`).catch(() => {})

  // A signal stops the run: the first aborts the session, which ends the agent's process tree.
  // The handlers stay until this process is done, so a second signal, or one that comes while the
  // run records and reclaims, is ignored instead of killing the process halfway through a write.
  const stop = new AbortController()
  const onSignal = (): void => stop.abort()
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  try {
    return await sessionToEnd(repo, run, dir, inbox, stop.signal)
  } finally {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
  }
}

async function sessionToEnd(repo: string, run: SessionRun, dir: string, inbox: string, stopped: AbortSignal): Promise<RunOutcome> {
  const { id: _id, status: _status, endedAt: _endedAt, ...startCard } = run.card
  let status: LogEndStatus = 'done'
  let detail: string | undefined
  let branch = run.checkout.branch
  let pr: RunOutcome['pr']
  let driverSession: DriverSession | undefined
  try {
    driverSession = await run.driver.start({
      cwd: run.checkout.path,
      ...(run.model !== undefined ? { model: run.model } : {}),
      signal: stopped,
      ...(run.resumeSessionId !== undefined ? { resumeSessionId: run.resumeSessionId } : {}),
      log: { dir, card: { id: run.id, ...startCard }, continue: run.continued },
    })
  } catch (err) {
    status = 'failed'
    detail = errorMessage(err)
  }
  try {
    // The prompts this process owes the agent: the run's own, then the lines that reached the
    // inbox after the last turn took it but while the card still said running. Whoever wrote
    // them was told the run has them, so this process sends them before it lets the run go.
    let prompts = [run.prompt]
    let resume = run.continued
    while (driverSession) {
      status = 'done'
      detail = undefined
      let lastText = ''
      try {
        for (const [i, prompt] of prompts.entries()) {
          // Only the last one drains the inbox: a line written meanwhile comes after these.
          const last = i === prompts.length - 1
          const turn = await driverSession.prompt(prompt, { ...(last ? { inbox } : {}), ...(resume ? { resume: true } : {}) })
          lastText = turn.text
          resume = true
        }
      } catch (err) {
        status = 'failed'
        detail = errorMessage(err)
      }
      if (stopped.aborted) {
        status = 'stopped'
        detail = STOPPED_DETAIL
      } else if (status === 'done' && parseQuestion(lastText)) {
        // The last turn asked and nothing waited in the inbox: the run ends here, waiting, and
        // keeps its checkout for the answer to resume it.
        status = 'waiting'
      }

      // Where the work ended up: the agent renames its branch itself, and the pull request it
      // opened, if any, is read back off the branch through the project's git host.
      branch = (await worktreeBranch(run.checkout.path, run.git).catch(() => undefined)) ?? run.checkout.branch
      pr = await run.gitHost.requestOfBranch(repo, branch).catch(() => undefined)
      const live = driverSession.log
      if (!live) break
      await live.patch({ branch, ...(pr ? { pr } : {}) })
      await live.end(status, detail)
      await live.settled()

      // The card says ended now, so a line written from here on goes to the project's resume
      // hook, which waits for this process. What is in the inbox was written before: this
      // process's to send. A stopped run was stopped on purpose; what reached it is dropped.
      if (status === 'stopped' || stopped.aborted) break
      const late = await takeInbox(inbox)
      if (late.length === 0) break
      prompts = late.map(promptOf)
      await live.reopen()
    }
  } finally {
    await driverSession?.dispose().catch(() => {})
  }

  // The record: the two files the session kept, copied onto the branch unchanged.
  const live = driverSession?.log
  const card = (await readLiveCard(run.checkout.path, run.id)) ?? { ...run.card, status, endedAt: run.clock(), branch, ...(pr ? { pr } : {}) }
  const diary = live ? await readLiveDiary(run.checkout.path, run.id) : [...(run.priorDiary ?? []), { kind: 'ended', status, ...(detail !== undefined ? { detail } : {}), at: card.endedAt ?? run.clock() }]
  const recorded = await recordRun(repo, card, diary, run.logs)
  if (!recorded.ok && !recorded.committed) run.log(`[agent-runner] the run's record could not be written: ${recorded.error}`)

  // The checkout goes once the remote has everything it holds (the branches rule); a dirty tree
  // or a branch that could not be pushed keeps it, and the sweep tries again later. A
  // waiting run keeps it on purpose: the answer resumes the run there.
  if (status === 'waiting') {
    return outcomeOf(run.id, status, branch, pr, card.cost, { reclaimed: false, reason: 'waiting' }, detail)
  }
  const reclaimed = await reclaimWorktree(repo, run.checkout.path, { mayPush: true, birthBranch: agentBranchName(run.id), git: run.git })
  return outcomeOf(run.id, status, branch, pr, card.cost, reclaimed.ok ? { reclaimed: true } : { reclaimed: false, reason: reclaimReason(reclaimed) }, detail)
}

function outcomeOf(id: string, status: Exclude<RunStatus, 'running'>, branch: string, pr: RunOutcome['pr'], cost: number | undefined, checkout: RunOutcome['checkout'], detail: string | undefined): RunOutcome {
  return {
    id,
    status,
    branch,
    ...(pr ? { pr } : {}),
    ...(cost !== undefined ? { cost } : {}),
    checkout,
    ...(detail !== undefined ? { detail } : {}),
  }
}

function reclaimReason(outcome: { ok: false; reason: string; detail?: string }): string {
  return outcome.detail ? `${outcome.reason}: ${outcome.detail}` : outcome.reason
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
