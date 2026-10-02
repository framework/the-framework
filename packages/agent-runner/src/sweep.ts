import { readFile, stat } from 'node:fs/promises'
import { nodeGitRunner, type GitRunner } from '@gemstack/agent-data'
import { agentBranchName, reclaimWorktree, worktreeDirEntries, worktreePath } from '@gemstack/skill-branches'
import { listRuns, type LogsDeps, type RunCard } from '@gemstack/skill-logs'
import { endLiveCard, readLiveCard, readLiveDiary } from './live-card.js'
import { lockHolder, runStderrPath } from './run-lock.js'
import { recordBranchGone, recordRun, runnerMark, startOf } from './records.js'
import { childEndedLine, tellParent, type ParentDeps } from './parent.js'

/**
 * The belt (#1774): what a run's own process could not do because it died. A scheduler runs it on
 * every tick, before anything is decided, and it acts only for this machine — a pid means nothing on another.
 *
 * A checkout whose live card says `running` under a dead pid is a run that died mid-work: its
 * record is written `failed` from what it left, and the checkout is reclaimed under the branches
 * rule (a dirty tree stays). A checkout whose card says the run ended is one whose process died
 * between the end and the record, or whose reclaim could not push: recorded again, idempotent,
 * and reclaimed again; a run that ended `waiting` keeps its checkout for the answer. A running
 * card on the branch from this machine with no checkout behind it is a run that never started:
 * `failed` with the stderr the spawn left, else `stopped`.
 *
 * A run whose lock a live process holds is that process's: it is booting, working, recording,
 * reclaiming, or resuming, and the sweep does not touch it.
 *
 * A run this sweep ends, one that died mid-work or never started, tells its parent when its record
 * names one (`parent.ts`): its own process is not there to. A run that had ended by itself told
 * its parent then, or died just before it could; the sweep does not tell again.
 */

export interface SweepDeps {
  host: string
  isAlive: (pid: number) => boolean
  now?: () => Date
  git?: GitRunner
  logs?: LogsDeps
  log?: (line: string) => void
  /** How an ended parent is continued, in its own process; absent, only a working parent is told. */
  resume?: ParentDeps['resume']
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
  const telling: ParentDeps = { host: deps.host, isAlive: deps.isAlive, ...(deps.resume ? { resume: deps.resume } : {}), log: deps.log ?? (() => {}) }
  const tell = async (card: RunCard, detail: string, branch: string | undefined): Promise<void> => {
    const parent = runnerMark(card)?.parent
    if (parent !== undefined) await tellParent(repo, parent, childEndedLine({ id: card.id, status: card.status, detail, ...(branch !== undefined ? { branch } : {}), ...(card.pr ? { pr: card.pr } : {}) }), telling)
  }

  // Checkouts first: the live card is the truth about a run this machine started.
  for (const entry of await worktreeDirEntries(repo).catch(() => [])) {
    let card = await readLiveCard(entry.path, entry.agentId)
    const mark = card && runnerMark(card)
    if (!card || !mark || mark.host !== deps.host) continue
    seen.add(card.id)
    if (await lockHolder(repo, card.id, deps.isAlive)) continue
    const died = card.status === 'running'
    if (died) card = await endLiveCard(entry.path, card, 'failed', DIED_DETAIL, now().toISOString())
    const diary = await readLiveDiary(entry.path, card.id)
    const written = await recordRun(repo, card, diary, logs)
    if (written.ok || written.committed) result.recorded.push({ id: card.id, status: card.status })
    if (card.status === 'waiting') {
      result.kept.push({ id: card.id, reason: 'waiting' })
      continue
    }
    const reclaimed = await reclaimWorktree(repo, entry.path, { mayPush: true, birthBranch: agentBranchName(entry.agentId), ...startOf(card), git })
    if (reclaimed.ok) {
      result.reclaimed.push(card.id)
      await recordBranchGone(repo, card, diary, reclaimed.branchesDeleted, logs)
    } else result.kept.push({ id: card.id, reason: 'detail' in reclaimed && reclaimed.detail ? `${reclaimed.reason}: ${reclaimed.detail}` : reclaimed.reason })
    if (died) await tell(card, DIED_DETAIL, reclaimed.ok && card.branch !== undefined && reclaimed.branchesDeleted?.includes(card.branch) ? undefined : card.branch)
  }

  // Then the branch: a running card of this machine's with nothing on disk never started.
  for (const card of await listRuns(repo, {}, logs)) {
    if (card.status !== 'running' || seen.has(card.id)) continue
    const mark = runnerMark(card)
    if (!mark || mark.host !== deps.host) continue
    if (await lockHolder(repo, card.id, deps.isAlive)) continue
    if (await checkoutExists(repo, card.id)) continue // a checkout with no live card yet: the run is opening it
    const stderr = (await readFile(runStderrPath(repo, card.id), 'utf8').catch(() => '')).trim()
    const ended = stderr ? failedStart(card, stderr, now()) : gone(card, now())
    const written = await recordRun(repo, ended.card, ended.diary, logs)
    if (written.ok || written.committed) result.recorded.push({ id: card.id, status: ended.card.status })
    await tell(ended.card, ended.diary[0]!.detail, undefined)
  }
  return result
}

/** The detail of a run whose process died mid-work. */
const DIED_DETAIL = 'its process died before the run ended'

async function checkoutExists(repo: string, id: string): Promise<boolean> {
  return stat(worktreePath(repo, id)).then(s => s.isDirectory(), () => false)
}

function failedStart(card: RunCard, stderr: string, now: Date) {
  const detail = `its process died before the run started: ${stderr.split('\n').slice(-5).join('\n')}`
  return { card: { ...card, status: 'failed' as const, endedAt: now.toISOString() }, diary: [{ kind: 'ended', status: 'failed', detail, at: now.toISOString() }] }
}

function gone(card: RunCard, now: Date) {
  return { card: { ...card, status: 'stopped' as const, endedAt: now.toISOString() }, diary: [{ kind: 'ended', status: 'stopped', detail: 'its process is gone and left no checkout', at: now.toISOString() }] }
}
