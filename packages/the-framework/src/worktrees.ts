import { join } from 'node:path'
import { errorMessage } from './error-message.js'
import {
  listWorktreeDirs,
  listAgents,
  readLiveMetas,
  branchPushed,
  commitPendingWork,
  currentBranch,
  removeWorktree,
  pruneWorktrees,
  worktreePath,
  worktreeSize,
  isSafeAgentId,
  archivedAgentPaths,
  FRAMEWORK_DIR,
  type AgentStatus,
} from './store/index.js'
import { pushAgentBranch } from './dashboard/agent-handoff.js'

/** A retained worktree and the agent that left it behind (#752). */
export interface WorktreeRow {
  /** The agent id, which is also the worktree's directory name. */
  agentId: string
  /** The branch the agent's work landed on, when its meta recorded one (#799). */
  branch?: string
  /** How the agent that left this checkout ended, or `running` while it is still going. */
  status?: AgentStatus
  /** Size on disk in bytes, absent for a live agent (its tree is still changing) or when unreadable. */
  sizeBytes?: number
  /** True while the agent owning this checkout is still going: it is in use, not retained. */
  live: boolean
}

/** Why a worktree was left in place by {@link pruneProjectWorktrees}. */
export interface SkippedWorktree {
  agentId: string
  reason: string
}

/** What {@link pruneProjectWorktrees} did. */
export interface PruneResult {
  removed: string[]
  skipped: SkippedWorktree[]
}

/** The outcome of {@link removeProjectWorktree}. */
export type RemoveResult = { ok: true } | { ok: false; error: string }

/** Surface-specific work {@link removeProjectWorktree} does once removal is decided on. */
export interface RemoveWorktreeOptions {
  /**
   * Run after the safety checks pass and the work is committed, just before the checkout goes.
   * The dashboard stops the preview serving that tree here (#797); the CLI has none to stop.
   */
  beforeRemove?: (agentId: string) => Promise<void>
}

/**
 * The worktrees a project still has on disk (#752), newest first — the same view the dashboard's
 * retained-worktrees list is built from, through the same store reads, so the CLI is a second
 * surface rather than a second behaviour.
 *
 * A live agent's checkout is included and flagged rather than hidden: "what is this directory and
 * why can I not remove it" is exactly the question the list has to answer.
 */
export async function listProjectWorktrees(cwd: string, opts: { sizes?: boolean } = {}): Promise<WorktreeRow[]> {
  const [names, live, archived] = await Promise.all([
    listWorktreeDirs(cwd).catch(() => []),
    readLiveMetas(cwd).catch(() => []),
    listAgents(cwd).catch(() => []),
  ])
  const rows: WorktreeRow[] = []
  for (const agentId of names) {
    const meta = live.find(agent => agent.id === agentId) ?? archived.find(agent => agent.id === agentId)
    const isLive = meta?.status === 'running'
    rows.push({
      agentId,
      live: isLive,
      ...(meta?.branch ? { branch: meta.branch } : {}),
      ...(meta?.status ? { status: meta.status } : {}),
      // Sizing a tree an agent is writing to gives a number that is wrong by the time it prints;
      // a caller that only wants the rows (the dashboard's retained list) skips the du entirely.
      ...(isLive || opts.sizes === false ? {} : await sizeOf(cwd, agentId)),
    })
  }
  return rows.sort((a, b) => (a.agentId < b.agentId ? 1 : a.agentId > b.agentId ? -1 : 0))
}

async function sizeOf(cwd: string, agentId: string): Promise<{ sizeBytes?: number }> {
  const bytes = await worktreeSize(worktreePath(cwd, agentId)).catch(() => undefined)
  return bytes === undefined ? {} : { sizeBytes: bytes }
}

/**
 * Remove one retained worktree (#752/#737/E5): the one implementation behind every surface that
 * removes one — the sweep, teardown, and the dashboard's Remove button (#982).
 *
 * **One rule: only what is on the remote may go.** The work is committed to the session's branch,
 * the branch is pushed, and the checkout is removed only once the remote has it. Every deletion is
 * therefore recoverable, and nothing local is ever the last copy of anything. It replaced three
 * interacting rules that each asked *what state did this session end in* — a clean finish removes
 * the checkout, a failure or stop keeps it, a merged branch reclaims it later via two different
 * "landed" signals — where the question that actually matters is *is this recoverable yet*. There
 * is one failure mode now, and it is legible: the push did not land, so the checkout stays and the
 * reason says why.
 *
 * Refuses while the agent is still going — an agent's checkout is where its agent is working, and Stop
 * is how you end an agent, not pulling the floor out from under it.
 */
export async function removeProjectWorktree(
  cwd: string,
  agentId: string,
  opts: RemoveWorktreeOptions = {},
): Promise<RemoveResult> {
  if (!isSafeAgentId(agentId)) return { ok: false, error: `invalid session id: ${agentId}` }
  const names = await listWorktreeDirs(cwd).catch((): string[] => [])
  if (!names.includes(agentId)) return { ok: false, error: `no worktree for session ${agentId}` }
  const live = await readLiveMetas(cwd).catch(() => [])
  if (live.some(agent => agent.id === agentId && agent.status === 'running')) {
    return { ok: false, error: 'that session is still going; stop it before removing its worktree' }
  }
  const path = worktreePath(cwd, agentId)
  try {
    // `removeWorktree` forces past a dirty tree, so an uncommitted edit has to be on the branch
    // before the checkout can go — otherwise the very diff the checkout held is what is deleted.
    if (!(await commitPendingWork(path))) {
      return {
        ok: false,
        error: `session ${agentId} has uncommitted work that could not be committed; its worktree was kept`,
      }
    }
    const branch = await currentBranch(path)
    if (!branch) return { ok: false, error: `session ${agentId} is on no branch; its worktree was kept` }
    if (!(await branchPushed(cwd, branch))) {
      // Pushing is what makes the removal recoverable, so it is attempted here rather than
      // required of the caller. A repo with no remote never gets past this, which is the honest
      // answer: there is nowhere for the work to be recoverable from.
      const pushed = await pushAgentBranch(cwd, branch)
      if (!pushed.ok) {
        return { ok: false, error: `${branch} is not on the remote (${pushed.error}); its worktree was kept` }
      }
    }
    await opts.beforeRemove?.(agentId)
    await removeWorktree(cwd, path)
    await pruneWorktrees(cwd)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

/** The outcome of {@link deleteProjectAgent}. */
export type DeleteAgentResult = { ok: true } | { ok: false; error: string }

/** Surface-specific work {@link deleteProjectAgent} does, and the file-removal seam for tests. */
export interface DeleteAgentOptions {
  /** Run before the worktree comes off disk (stop a preview serving it, as removal does). */
  beforeRemove?: (agentId: string) => Promise<void>
  /** Remove one file, tolerant of an absent one. Defaults to `rm(path, { force: true })`. */
  removeFile?: (path: string) => Promise<void>
}

async function rmFile(path: string): Promise<void> {
  const { rm } = await import('node:fs/promises')
  await rm(path, { force: true })
}

/**
 * Delete a session (#1032): take it out of the dashboard, records and all.
 *
 * This is the sibling of {@link removeProjectWorktree}, and the difference is the whole point.
 * Remove-worktree reclaims the checkout on disk and keeps the session — its row, its replayable
 * log — because the history was already archived. Delete removes that archive too: the agent meta
 * (`<id>.json`, what the rail lists) and its event log (`<id>.jsonl`, what replays), wherever they
 * are filed, so the row is gone for good. It is the one destructive-of-history action, which is
 * why the surfaces that call it confirm first. Since #1179 that archive is committed, so the files
 * go but the deletion is itself a change git will record.
 *
 * What it deliberately leaves is git's, not the dashboard's: the branch `tf-agent-<id>`
 * (or the name the agent gave it) and its commits, the committed `LOGS.md` line, and the
 * conversation record. Deleting a branch that may carry merged work or an open PR is not a thing a
 * dashboard action should do silently, so the branch stays and delete means "remove from the
 * dashboard", not "erase every trace".
 *
 * Refuses while the agent is still going — Stop is how an agent ends. Any uncommitted work in the
 * worktree is discarded with it, which is the intent here (the session is being thrown away),
 * unlike remove-worktree, which commits that work to the kept branch first.
 */
export async function deleteProjectAgent(cwd: string, agentId: string, opts: DeleteAgentOptions = {}): Promise<DeleteAgentResult> {
  if (!isSafeAgentId(agentId)) return { ok: false, error: `invalid session id: ${agentId}` }
  const live = await readLiveMetas(cwd).catch(() => [])
  if (live.some(agent => agent.id === agentId && agent.status === 'running')) {
    return { ok: false, error: 'that session is still going; stop it before deleting it' }
  }
  const removeFile = opts.removeFile ?? rmFile
  try {
    // The worktree first, if one is on disk: force-removed (its uncommitted work goes with the
    // session), where remove-worktree would have committed it to the kept branch.
    const names = await listWorktreeDirs(cwd).catch((): string[] => [])
    if (names.includes(agentId)) {
      await opts.beforeRemove?.(agentId)
      await removeWorktree(cwd, worktreePath(cwd, agentId))
      await pruneWorktrees(cwd)
    }
    // Then the records that put the row in the list. Looked up rather than derived from the id: a
    // session is archived under whichever user ran it (#1179), so the id alone no longer names its
    // path. Tolerant of an absent file, so a half-deleted session (its worktree already gone)
    // still finishes cleanly.
    for (const path of await archivedAgentPaths(cwd, agentId)) await removeFile(path)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

/**
 * Remove every retained worktree whose run is not live (#752): the "clean all of this up" case.
 * A live agent keeps its checkout and is reported as skipped, so the count always adds up to what
 * the list showed — and so does one whose branch could not reach the remote (E5).
 */
export async function pruneProjectWorktrees(cwd: string): Promise<PruneResult> {
  const result: PruneResult = { removed: [], skipped: [] }
  for (const row of await listProjectWorktrees(cwd)) {
    if (row.live) {
      result.skipped.push({ agentId: row.agentId, reason: 'still running' })
      continue
    }
    const outcome = await removeProjectWorktree(cwd, row.agentId)
    if (outcome.ok) result.removed.push(row.agentId)
    else result.skipped.push({ agentId: row.agentId, reason: outcome.error })
  }
  return result
}

