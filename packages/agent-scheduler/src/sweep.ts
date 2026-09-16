import { readFile, stat } from 'node:fs/promises'
import { nodeGitRunner, type GitRunner } from '@gemstack/agent-data'
import { agentBranchName, reclaimWorktree, worktreeDirEntries, worktreePath } from '@gemstack/skill-branches'
import { listRuns, type LogsDeps, type RunCard } from '@gemstack/skill-logs'
import { endLiveLog, readLiveEvents, readLiveMeta, toCard, toDiaryLine } from './live-log.js'
import { recordRun, schedulerMark } from './records.js'
import { runStderrPath } from './state.js'

/**
 * The belt (#1774): what a run's own process could not do because it died. Runs on every tick,
 * before anything is decided, and only for this machine — a pid means nothing on another.
 *
 * A checkout whose live log says `running` under a dead pid is a run that died mid-work: its
 * record is written `failed` from what it left, and the checkout is reclaimed under the branches
 * rule (a dirty tree stays). A checkout whose log says the run ended is one whose process died
 * between the end and the record, or whose reclaim could not push: recorded again, idempotent,
 * and reclaimed again. A running card on the branch from this machine with no checkout behind it
 * is a run that never started: `failed` with the stderr the spawn left, else `stopped`.
 */

export interface SweepDeps {
  host: string
  isAlive: (pid: number) => boolean
  now?: () => Date
  git?: GitRunner
  logs?: LogsDeps
  log?: (line: string) => void
}

export interface SweepResult {
  /** Runs whose record this sweep wrote, and the status it gave them. */
  recorded: { id: string; status: string }[]
  reclaimed: string[]
  kept: { id: string; reason: string }[]
}

export async function sweep(repo: string, deps: SweepDeps): Promise<SweepResult> {
  const git = deps.git ?? nodeGitRunner()
  const now = deps.now ?? (() => new Date())
  const logs = deps.logs ?? {}
  const result: SweepResult = { recorded: [], reclaimed: [], kept: [] }
  const seen = new Set<string>()

  // Checkouts first: the live log is the truth about a run this machine started.
  for (const entry of await worktreeDirEntries(repo).catch(() => [])) {
    let meta = await readLiveMeta(entry.path)
    if (!meta || meta.host !== deps.host) continue
    seen.add(meta.id)
    if (meta.status === 'running') {
      if (deps.isAlive(meta.pid)) continue
      meta = await endLiveLog(entry.path, meta, { kind: 'end', ok: false, detail: 'its process died before the run ended' }, now().toISOString())
    }
    const events = await readLiveEvents(entry.path)
    const written = await recordRun(repo, toCard(meta), events.map(toDiaryLine), logs)
    if (written.ok || written.committed) result.recorded.push({ id: meta.id, status: meta.status })
    const reclaimed = await reclaimWorktree(repo, entry.path, { mayPush: true, birthBranch: agentBranchName(entry.agentId), git })
    if (reclaimed.ok) result.reclaimed.push(meta.id)
    else result.kept.push({ id: meta.id, reason: 'detail' in reclaimed && reclaimed.detail ? `${reclaimed.reason}: ${reclaimed.detail}` : reclaimed.reason })
  }

  // Then the branch: a running card of this machine's with nothing on disk never started.
  for (const card of await listRuns(repo, {}, logs)) {
    if (card.status !== 'running' || seen.has(card.id)) continue
    const mark = schedulerMark(card)
    if (!mark || mark.host !== deps.host) continue
    if (mark.pid !== undefined && deps.isAlive(mark.pid) && !(await checkoutExists(repo, card.id))) {
      // Spawned and still booting: its checkout is not there yet. Left for the next tick.
      continue
    }
    if (await checkoutExists(repo, card.id)) continue // a checkout with no live log yet: the run is opening it
    const stderr = (await readFile(runStderrPath(repo, card.id), 'utf8').catch(() => '')).trim()
    const ended = stderr ? failedStart(card, stderr, now()) : gone(card, now())
    const written = await recordRun(repo, ended.card, ended.diary, logs)
    if (written.ok || written.committed) result.recorded.push({ id: card.id, status: ended.card.status })
  }
  return result
}

async function checkoutExists(repo: string, id: string): Promise<boolean> {
  return stat(worktreePath(repo, id)).then(s => s.isDirectory(), () => false)
}

function failedStart(card: RunCard, stderr: string, now: Date) {
  const detail = `its process died before the run started: ${stderr.split('\n').slice(-5).join('\n')}`
  return { card: { ...card, status: 'failed' as const, endedAt: now.toISOString() }, diary: [{ kind: 'ended', status: 'failed', detail }] }
}

function gone(card: RunCard, now: Date) {
  return { card: { ...card, status: 'stopped' as const, endedAt: now.toISOString() }, diary: [{ kind: 'ended', status: 'stopped', detail: 'its process is gone and left no checkout' }] }
}
