import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { DriverQuota } from 'agent-driver'
import type { FileBranchWrite } from '@gemstack/agent-data'
import type { RunCard } from '@gemstack/skill-logs'
import { COMMANDS_DIR } from './names.js'
import { quotaBoundaryStatus, quotaHeadroom } from './quota-boundary.js'
import { markerCard, type SchedulerMark } from './records.js'
import { commandPrompt, isDue, type Schedule } from './schedule.js'
import type { State, TickDecision, TickRecord } from './state.js'

/**
 * One tick (#1774): pull the branch, sweep, read the schedule, and for each command decide in
 * the cheapest order — does the project have the command, is it due, is its cap reached, is
 * there quota — then mark and spawn one run. Every decision is one line in the state, so a
 * dashboard or a person reads why nothing started without a log.
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
  schedule: Schedule | undefined
  host: string
  now: () => Date
  pull: () => Promise<{ ok: true } | { ok: false; error: string }>
  sweep: () => Promise<unknown>
  hasCommand: (name: string) => Promise<boolean>
  check: (shell: string) => Promise<CheckResult>
  inFlight: (command: string) => Promise<RunCard[]>
  quota: () => Promise<DriverQuota>
  mint: () => string
  writeMarker: (card: RunCard) => Promise<FileBranchWrite>
  withdrawMarker: (id: string) => Promise<unknown>
  /** Start the run's process, detached; resolves once it is spawned. */
  spawn: (run: { id: string; command: string; prompt: string; model: string }) => Promise<void>
  /** The driver's id, for the marker's card. */
  driver: string
  log?: (line: string) => void
}

export async function tick(deps: TickDeps): Promise<TickRecord> {
  const at = deps.now().toISOString()
  const record: TickRecord = { at, decisions: [] }
  const pulled = await deps.pull()
  if (!pulled.ok) return { ...record, note: `agent-data could not be pulled: ${pulled.error}` }
  await deps.sweep()
  if (!deps.state.on) return { ...record, note: 'off' }
  if (!deps.schedule) return { ...record, note: 'no agent-schedule.md' }

  for (const { line, text } of deps.schedule.unreadable) record.decisions.push({ command: `line ${line}`, outcome: `unreadable: ${text}` })

  let quota: Awaited<ReturnType<typeof quotaHeadroom>> | undefined
  for (const command of deps.schedule.commands) {
    const decide = (outcome: string, run?: string): void => {
      record.decisions.push({ command: command.name, outcome, ...(run ? { run } : {}) })
    }
    if (!(await deps.hasCommand(command.name))) {
      decide('no such command in this project')
      continue
    }
    const checked = await deps.check(command.when).catch((err): CheckResult => ({ ok: false, stdout: '', stderr: String(err) }))
    if (!checked.ok) {
      decide(`check failed: ${checked.stderr.trim().split('\n').at(-1) ?? ''}`)
      continue
    }
    if (!isDue(checked.stdout)) {
      decide('not due')
      continue
    }
    const running = await deps.inFlight(command.name)
    if (running.length >= command.cap) {
      decide(`cap reached (${running.length} in flight: ${running.map(describe).join(', ')})`)
      continue
    }
    // Read once per tick, and only now.
    quota ??= quotaHeadroom(await boundary(deps))
    if (!quota.start) {
      decide(`quota: ${quota.reason}`)
      continue
    }
    const id = deps.mint()
    const prompt = commandPrompt(command.name)
    const mark: SchedulerMark = { command: command.name, host: deps.host }
    const marked = await deps.writeMarker(markerCard({ id, startedAt: deps.now().toISOString(), prompt, driver: deps.driver, model: deps.state.model, mark }))
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
    if (rank >= command.cap) {
      await deps.withdrawMarker(id)
      const others = after.filter(c => c.id !== id)
      decide(`cap reached (${others.length} in flight: ${others.map(describe).join(', ')})`)
      continue
    }
    try {
      await deps.spawn({ id, command: command.name, prompt, model: deps.state.model })
      decide(`started ${id}`, id)
    } catch (err) {
      decide(`could not start: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return record
}

function describe(card: RunCard): string {
  const host = (card.caller?.['scheduler'] as { host?: string } | undefined)?.host
  return host ? `${card.id} on ${host}` : card.id
}

async function boundary(deps: TickDeps) {
  const reading = await deps.quota().catch((): DriverQuota => ({ available: false, reason: 'fetch-failed' }))
  if (!reading.available) return undefined
  return quotaBoundaryStatus({ windows: reading.windows, now: deps.now().getTime(), model: deps.state.model, limitOffset: deps.state.spendOffset })
}

/** Whether the project has a command: its skill folder is there, tracked file or link. */
export async function projectHasCommand(repo: string, name: string): Promise<boolean> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return false
  return stat(join(repo, COMMANDS_DIR, name)).then(s => s.isDirectory(), () => false)
}

/** Run a check at the repository root through the shell, within its budget. */
export async function runCheck(repo: string, shell: string, timeoutMs: number): Promise<CheckResult> {
  const { execFile } = await import('node:child_process')
  return new Promise<CheckResult>(resolve => {
    execFile('sh', ['-c', shell], { cwd: repo, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout), stderr: err && !String(stderr).trim() ? err.message : String(stderr) })
    })
  })
}

/** The list a decision reads as, one line per command, for a person. */
export function describeTick(record: TickRecord): string[] {
  const lines = [`tick ${record.at}${record.note ? `: ${record.note}` : ''}`]
  for (const d of record.decisions) lines.push(`  ${d.command}: ${d.outcome}`)
  return lines
}

export type { TickDecision }
