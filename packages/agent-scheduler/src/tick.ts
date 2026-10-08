import type { DriverQuota, DriverReadiness } from '@openagt/agent-driver'
import { markerCard, runnerMark, type Publish, type RunnerMark } from '@openagt/agent-runner'
import type { FileBranchWrite } from '@openagt/agent-data'
import type { RunCard } from '@openagt/skill-logs'
import { LAST_RUN_ENV, RUN_SKILLS_DIR } from './names.js'
import { dueFrom, localStamp, paceInForce, paceText } from './pace.js'
import { quotaBoundaryStatus, quotaHeadroom } from './quota-boundary.js'
import { checkFound, commandPrompt, isDue, lastRunValue, type Schedule, type ScheduledCommand } from './schedule.js'
import { capInForce, publishInForce, switchedOnAt, type ListedCommand, type State, type TickDecision, type TickRecord } from './state.js'

/**
 * One tick (#1774): pull the branch, sweep, read the schedule, and for each command decide in
 * the cheapest order — can the coding agent run it, is it switched on on this machine, is it due by its pace (this machine's, else its skill's), is its check
 * due, is its cap reached, can the coding agent start at all, is there quota — then mark and spawn one run. Every decision is one line in the state, so a
 * dashboard or a person reads why nothing started without a log. A run its check started is handed
 * what the check printed, with its prompt.
 *
 * The quota is read only when everything else says start: a read spawns the agent's CLI and the
 * agent's own usage fetch is refused upstream when asked too often.
 *
 * Two machines can tick the same queue. Each marks before it spawns, then counts again: the
 * marker that landed second past the cap is withdrawn, and that machine does not spawn. A push
 * that fails twice means another machine got there first; no spawn either.
 */

/** What a check said. */
export interface CheckResult {
  ok: boolean
  stdout: string
  stderr: string
}

export interface TickDeps {
  state: State
  schedule: Schedule
  host: string
  now: () => Date
  pull: () => Promise<{ ok: true } | { ok: false; error: string }>
  sweep: () => Promise<unknown>
  /** Run a check, which reads `lastRun` as `$LAST_RUN`. */
  check: (shell: string, lastRun: string) => Promise<CheckResult>
  /** When the command last started on any machine, ISO; nothing when it never did. */
  lastStart: (command: string) => Promise<string | undefined>
  inFlight: (command: string) => Promise<RunCard[]>
  /** Whether the coding agent's CLI can start a session: a missing or logged-out one starts nothing. */
  ready: () => Promise<DriverReadiness>
  quota: () => Promise<DriverQuota>
  mint: () => string
  writeMarker: (card: RunCard) => Promise<FileBranchWrite>
  withdrawMarker: (id: string) => Promise<unknown>
  /** Start the run's process, detached; resolves once it is spawned. `startedAt` is the start its record keeps, `attached` what the agent is handed with the prompt. */
  spawn: (run: { id: string; prompt: string; startedAt: string; model: string; publish?: Publish; attached?: string }) => Promise<void>
  /** The driver's id, for the marker's card. */
  driver: string
  /** Whether the scheduler was told to stop while this tick runs: then nothing more is started. */
  stopped?: () => boolean
  log?: (line: string) => void
}

export async function tick(deps: TickDeps): Promise<TickRecord> {
  const at = deps.now().toISOString()
  // A schedule that cannot be read is named on every tick, on or off: nothing else says why a skill's commands are missing.
  const unreadable = deps.schedule.unreadable.map(({ skill, reason }): TickDecision => ({ command: skill, outcome: `unreadable schedule: ${reason}` }))
  const record: TickRecord = { at, decisions: unreadable, schedule: deps.schedule.commands.map(listed) }
  const pulled = await deps.pull()
  if (!pulled.ok) return { ...record, note: `agent-data could not be pulled: ${pulled.error}` }
  await deps.sweep()
  if (!deps.state.on) return { ...record, note: 'off' }
  if (record.decisions.length === 0 && deps.schedule.commands.length === 0) return { ...record, note: 'no skill of this project schedules a command' }

  let readiness: DriverReadiness | undefined
  let quota: Awaited<ReturnType<typeof quotaHeadroom>> | undefined
  for (const command of deps.schedule.commands) {
    const decide = (outcome: string, run?: string): void => {
      record.decisions.push({ command: command.name, outcome, ...(run ? { run } : {}) })
    }
    if (command.dir !== RUN_SKILLS_DIR) {
      decide(`not a command of the coding agent: its skill is only under ${command.dir}, not ${RUN_SKILLS_DIR}`)
      continue
    }
    const switchedOn = switchedOnAt(deps.state, command.name)
    if (switchedOn === undefined) {
      decide('switched off on this machine')
      continue
    }
    // When the command is asked about: the start of a run started now. The next check's "since the
    // last start" then begins before this check ran, not the seconds later the run's process began,
    // and nothing that came in between is missed.
    const now = deps.now()
    // The pace in force: this machine's pick, else the skill's; none for a command its check alone paces.
    const pace = paceInForce(deps.state.paces?.[command.name], command)
    const last = pace || command.when !== undefined ? await deps.lastStart(command.name) : undefined
    if (pace) {
      // The pace before the check: the records are on disk already, the check spawns a shell.
      const from = dueFrom(pace, last === undefined ? undefined : new Date(last), now)
      if (now.getTime() < from.getTime()) {
        decide(pace.at ? `not due (next start from ${localStamp(from)}, every ${paceText(pace)})` : `not due (last start ${age(now.getTime() - Date.parse(last!))} ago, every ${paceText(pace)})`)
        continue
      }
    }
    // What the check printed, handed to the run it starts: a command its pace alone starts has none.
    let found: string | undefined
    if (command.when !== undefined) {
      // What is new for the check: since its command last started, or since it was switched on here when that is later.
      const since = lastRunValue(last !== undefined && Date.parse(last) > Date.parse(switchedOn) ? last : switchedOn)
      const checked = await deps.check(command.when, since).catch((err): CheckResult => ({ ok: false, stdout: '', stderr: String(err) }))
      if (!checked.ok) {
        decide(`check failed: ${checked.stderr.trim().split('\n').at(-1) ?? ''}`)
        continue
      }
      if (!isDue(checked.stdout)) {
        decide('not due')
        continue
      }
      found = checkFound(checked.stdout, since)
    }
    // The cap in force: this machine's number for the command, else the skill's, held against every machine's runs.
    const cap = capInForce(deps.state, command)
    const running = await deps.inFlight(command.name)
    if (running.length >= cap) {
      decide(`cap reached (${running.length} in flight: ${running.map(describe).join(', ')})`)
      continue
    }
    // Both read once per tick, and only now: each spawns the agent's CLI.
    readiness ??= await deps.ready()
    if (readiness.problems.length > 0) {
      decide(`not ready: ${readiness.problems.join(' ')}`)
      continue
    }
    quota ??= quotaHeadroom(await boundary(deps))
    if (!quota.start) {
      decide(`quota: ${quota.reason}`)
      continue
    }
    // The stop may have come in during the readings above: a stopped scheduler starts nothing.
    if (deps.stopped?.()) {
      decide('not started: the scheduler was stopped')
      continue
    }
    const id = deps.mint()
    const prompt = commandPrompt(command.name)
    // The publish level in force, this machine's pick, goes on the marker and to the run: the agent is told it after its prompt.
    const level = publishInForce(deps.state, command.name)
    const publish = level !== undefined ? { publish: level } : {}
    const mark: RunnerMark = { host: deps.host, ...publish }
    const marked = await deps.writeMarker(markerCard({ id, startedAt: now.toISOString(), prompt, driver: deps.driver, model: deps.state.model, mark }))
    if (!marked.ok) {
      // The commit stayed local and would ride a later push: taken back, so no record says running for a run that never was.
      await deps.withdrawMarker(id)
      decide(`another machine got there first: ${marked.error}`)
      continue
    }
    // Both machines' markers may have landed. The cap is the first `cap` ids in time order;
    // a marker ranked past it is withdrawn by the machine that wrote it.
    const after = await deps.inFlight(command.name)
    const rank = after.map(card => card.id).sort().indexOf(id)
    if (rank >= cap) {
      await deps.withdrawMarker(id)
      const others = after.filter(c => c.id !== id)
      decide(`cap reached (${others.length} in flight: ${others.map(describe).join(', ')})`)
      continue
    }
    try {
      await deps.spawn({ id, prompt, startedAt: now.toISOString(), model: deps.state.model, ...publish, ...(found !== undefined ? { attached: found } : {}) })
      decide(`started ${id}`, id)
    } catch (err) {
      decide(`could not start: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return record
}

/** A command as a dashboard lists it: what its skill says, not this machine's switch or publish pick, which the state carries. */
function listed(command: ScheduledCommand): ListedCommand {
  return { command: command.name, ...(command.every ? { every: command.every.text } : {}), ...(command.when !== undefined ? { when: command.when } : {}), ...(command.waitsFor !== undefined ? { waitsFor: command.waitsFor } : {}), ...(command.description !== undefined ? { description: command.description } : {}), ...(command.cap > 1 ? { agents: command.cap } : {}) }
}

/** An age for a decision line: `less than a minute`, `12m`, `3h`, `2d`, floored. */
function age(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'less than a minute'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function describe(card: RunCard): string {
  const host = runnerMark(card)?.host
  return host ? `${card.id} on ${host}` : card.id
}

async function boundary(deps: TickDeps) {
  const reading = await deps.quota().catch((): DriverQuota => ({ available: false, reason: 'fetch-failed' }))
  if (!reading.available) return undefined
  return quotaBoundaryStatus({ windows: reading.windows, now: deps.now().getTime(), model: deps.state.model, limitOffset: deps.state.spendOffset })
}

/** Run a check at the repository root through the shell, within its budget; the check reads `lastRun` as `$LAST_RUN`. */
export async function runCheck(repo: string, shell: string, timeoutMs: number, lastRun: string): Promise<CheckResult> {
  const { execFile } = await import('node:child_process')
  return new Promise<CheckResult>(resolve => {
    execFile('sh', ['-c', shell], { cwd: repo, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, [LAST_RUN_ENV]: lastRun } }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout), stderr: err && !String(stderr).trim() ? err.message : String(stderr) })
    })
  })
}

export type { TickDecision }
