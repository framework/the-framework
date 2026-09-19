import { errorMessage } from './error-message.js'
import { listAgents, projectRuns, readLiveMetas, type AgentStatus, type RunsFor } from './store/index.js'
import { agentBranchName, listWorktreeDirs, isSafeAgentId, reclaimWorktree, removeWorktree, pruneWorktrees, worktreePath, worktreeSize, type ReclaimOutcome } from '@gemstack/skill-branches'

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

/** The outcome of {@link removeProjectWorktree}. */
export type RemoveResult =
  | {
      ok: true
      /**
       * Branches that went with the checkout: the branch it was on, when that held nothing the
       * remote lacks (#1650); the run-id branch the agent branched away from, when everything on
       * it is in the branch that stays (#1657). Absent when nothing went.
       */
      branchesDeleted?: string[]
    }
  | { ok: false; error: string }

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
 * removes one: the dashboard's Remove button (#982). The run's own tool reclaims a finished run's
 * checkout by the same git rule; this is for the checkouts that rule kept.
 *
 * **One rule: only what is on the remote may go**: the git side of it is the package's
 * `reclaimWorktree`, which pushes the branch first when the remote lacks it.
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
    const outcome = await reclaimWorktree(cwd, path, {
      birthBranch: agentBranchName(agentId),
      mayPush: true,
      ...(opts.beforeRemove ? { beforeRemove: () => opts.beforeRemove!(agentId) } : {}),
    })
    return outcome.ok ? outcome : { ok: false, error: refusal(agentId, outcome) }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

/** Why a checkout stayed, said the way every surface reports it. */
function refusal(agentId: string, outcome: ReclaimOutcome & { ok: false }): string {
  switch (outcome.reason) {
    case 'not-a-worktree':
      return `session ${agentId}'s directory is not a git worktree; left alone`
    case 'no-branch':
      return `session ${agentId} is on no branch; its worktree was kept`
    case 'dirty':
      // Nothing is committed on the way to a removal (#1638).
      return `session ${agentId} has uncommitted work; its worktree was kept`
    case 'not-on-remote':
      return `${outcome.branch} is not on the remote (${outcome.detail ?? 'not pushed'}); its worktree was kept`
  }
}

/** The outcome of {@link deleteProjectAgent}. */
export type DeleteAgentResult = { ok: true } | { ok: false; error: string }

/** Surface-specific work {@link deleteProjectAgent} does. */
export interface DeleteAgentOptions {
  /** Run before the worktree comes off disk (stop a preview serving it, as removal does). */
  beforeRemove?: (agentId: string) => Promise<void>
  /** Where the project's finished runs are read and removed; the project's runs provider by default. */
  runs?: RunsFor
}

/**
 * Delete a session (#1032): take it out of the dashboard, records and all.
 *
 * This is the sibling of {@link removeProjectWorktree}, and the difference is the whole point.
 * Remove-worktree reclaims the checkout on disk and keeps the session — its row, its replayable
 * log — because the run is recorded on the data branch. Delete removes that record too: the card
 * (`<id>.json`, what the rail lists) and the diary (`<id>.jsonl`, what replays), so the row is
 * gone for good. It is the one destructive-of-history action, which is
 * why the surfaces that call it confirm first. The run is on the data branch, so its deletion is
 * itself a committed, pushed change.
 *
 * What it deliberately leaves is git's, not the dashboard's: the branch `agent-<id>`
 * (or the name the agent gave it) and its commits. Deleting a branch that may carry merged work
 * or an open PR is not a thing a
 * dashboard action should do silently, so the branch stays and delete means "remove from the
 * dashboard", not "erase every trace".
 *
 * Refuses while the agent is still going — Stop is how an agent ends. Any uncommitted work in the
 * worktree is discarded with it, which is the intent here (the session is being thrown away),
 * unlike remove-worktree, which refuses a checkout holding uncommitted work.
 */
export async function deleteProjectAgent(cwd: string, agentId: string, opts: DeleteAgentOptions = {}): Promise<DeleteAgentResult> {
  if (!isSafeAgentId(agentId)) return { ok: false, error: `invalid session id: ${agentId}` }
  const live = await readLiveMetas(cwd).catch(() => [])
  if (live.some(agent => agent.id === agentId && agent.status === 'running')) {
    return { ok: false, error: 'that session is still going; stop it before deleting it' }
  }
  try {
    // The worktree first, if one is on disk: force-removed (its uncommitted work goes with the
    // session), where remove-worktree would have refused it.
    const names = await listWorktreeDirs(cwd).catch((): string[] => [])
    if (names.includes(agentId)) {
      await opts.beforeRemove?.(agentId)
      await removeWorktree(cwd, worktreePath(cwd, agentId))
      await pruneWorktrees(cwd)
    }
    // Then the record that put the row in the list: the finished run, removed through the
    // project's runs provider (#1582/#1769). Tolerant of an absent record, and of a project with
    // no provider, so a half-deleted session (its worktree already gone) still finishes cleanly.
    const runs = await (opts.runs ?? projectRuns)(cwd).catch(() => undefined)
    if (runs && (await runs.list()).some(card => card.id === agentId)) {
      const removed = await runs.remove(agentId)
      if (!removed.ok) return { ok: false, error: removed.error }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}
