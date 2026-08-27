import { readFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { errorMessage } from './error-message.js'
import { listAgents, readLiveMetas, archivedAgentPaths, META_FILE, type AgentMeta, type AgentStatus } from './store/index.js'
import {
  agentBranchName,
  listWorktreeDirs,
  isSafeAgentId,
  reclaimWorktree,
  removeWorktree,
  pruneWorktrees,
  worktreePath,
  worktreeSize,
  FRAMEWORK_DIR,
  type ReclaimOutcome,
} from '@superskill/branch-management'
import { dataWorktreePath, withDataBranch } from './data-branch.js'

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
 * removes one — the sweep, teardown, and the dashboard's Remove button (#982).
 *
 * **One rule: only what is on the remote may go** — the git side of it is the package's
 * `reclaimWorktree`. What this adds is the agent's side: its record, which says whether the
 * branch may be pushed at all (a session armed to publish nothing, `handoff: local`, B5/#1379,
 * said its branch must not reach the remote — pushing it to make removal possible would have
 * teardown publish the very branch the handoff declined to) and, for a cloud run, the pushed
 * anchor that proves what its checkout holds (#1601).
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
  // The agent's record decides what the git rule may do, before any git runs: a `web` run's
  // hand-off anchor (#1601) proves what its checkout holds; a publish-nothing handoff (B5) means
  // the branch may not be pushed to make removal possible. `handoff` is on the meta from the
  // agent's first event, so a meta that exists without one (a boot death) keeps the recoverable
  // default; a meta that cannot be read keeps the checkout instead, because it cannot tell a
  // publish-nothing session from any other (fail closed, retried by a later pass).
  let meta: AgentMeta | undefined
  try {
    meta = await readMetaFor(cwd, path, agentId)
  } catch (err) {
    return {
      ok: false,
      error: `session ${agentId}'s record could not be read (${errorMessage(err)}); its worktree was kept`,
    }
  }
  const publishNothing = Boolean(meta?.handoff && !meta.handoff.push)
  try {
    const outcome = await reclaimWorktree(cwd, path, {
      birthBranch: agentBranchName(agentId),
      mayPush: !publishNothing,
      ...(meta?.target === 'web' && meta.cloudAnchor ? { heldBy: meta.cloudAnchor } : {}),
      ...(opts.beforeRemove ? { beforeRemove: () => opts.beforeRemove!(agentId) } : {}),
    })
    return outcome.ok ? outcome : { ok: false, error: refusal(agentId, outcome, publishNothing) }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

/** Why a checkout stayed, said the way every surface reports it. */
function refusal(agentId: string, outcome: ReclaimOutcome & { ok: false }, publishNothing: boolean): string {
  switch (outcome.reason) {
    case 'not-a-worktree':
      return `session ${agentId}'s directory is not a git worktree; left alone`
    case 'no-branch':
      return `session ${agentId} is on no branch; its worktree was kept`
    case 'dirty':
      // A publish-nothing session's checkout goes only once everything it holds is already on
      // the remote by someone's explicit act — a clean tree on a pushed tip — so a dirty tree is
      // that refusal too, said as such. Nothing is committed on the way to it (#1638).
      return publishNothing
        ? `session ${agentId} was set to publish nothing (handoff: local); its worktree was kept`
        : `session ${agentId} has uncommitted work; its worktree was kept`
    case 'not-on-remote':
      return publishNothing
        ? `session ${agentId} was set to publish nothing (handoff: local); its worktree was kept`
        : `${outcome.branch} is not on the remote (${outcome.detail ?? 'not pushed'}); its worktree was kept`
  }
}

/**
 * The meta the keep decision reads: the live copy in the checkout, else the archived one.
 *
 * Unlike the store's forgiving list reads — where anything unreadable contributes nothing — this
 * read tells absence from failure, because here they mean opposite things: `undefined` is "no
 * record was ever written" (a boot death, safe to treat as the default), while a record that
 * exists but cannot be read or parsed throws, so the caller refuses rather than guesses.
 */
async function readMetaFor(cwd: string, path: string, agentId: string): Promise<AgentMeta | undefined> {
  const live = await readMetaStrict(join(path, FRAMEWORK_DIR, META_FILE))
  if (live) return live
  const archived = (await archivedAgentPaths(cwd, agentId)).find(p => p.endsWith('.json'))
  return archived ? readMetaStrict(archived) : undefined
}

/** One meta file, strictly: `undefined` when absent, a throw when present but unreadable. */
async function readMetaStrict(path: string): Promise<AgentMeta | undefined> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw err
  }
  return JSON.parse(raw) as AgentMeta
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
 * (or the name the agent gave it) and its commits. Deleting a branch that may carry merged work
 * or an open PR is not a thing a
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
    // still finishes cleanly. A record on the data branch is removed inside its write funnel
    // (#1582) — the deletion is a committed, pushed change — while a transient copy is an unlink.
    const paths = await archivedAgentPaths(cwd, agentId)
    const dataRoot = dataWorktreePath(cwd) + sep
    for (const path of paths.filter(p => !p.startsWith(dataRoot))) await removeFile(path)
    if (paths.some(p => p.startsWith(dataRoot))) {
      const removed = await withDataBranch(cwd, `[The Framework] delete session ${agentId}`, async () => {
        for (const path of paths.filter(p => p.startsWith(dataRoot))) await removeFile(path)
      })
      if (!removed.ok && !removed.committed) return { ok: false, error: removed.error }
    }
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

