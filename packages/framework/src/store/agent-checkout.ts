import { join } from 'node:path'
import { archivedAgentPaths, readLiveMetas, EVENTS_FILE } from './agent-store.js'
import { isSafeAgentId, FRAMEWORK_DIR } from '@better-skills/branch-management'
import { worktreePath } from '@better-skills/branch-management'
import { nodeFs } from '../node-fs.js'

/**
 * The checkout an agent id resolves to (#738/#797): the agent's own worktree while it exists, else
 * the project root. Live metas first — a running agent records its cwd — then the worktree
 * directory itself, which exists before the agent has written its `agent.json` (#766): the daemon
 * creates the directory and spawns the process, and only then does the agent write its meta, so
 * a lookup by agent state alone misses an agent that certainly exists.
 *
 * The directory probe matters beyond a slow first read: the event stream resolves its path once,
 * when the browser opens it. Falling back to the project root would not self-correct a moment
 * later — the stream would tail the wrong file for as long as that connection lived, which is how
 * a newly started agent once showed a previous one's output.
 *
 * An unknown or finished `agentId` falls back to the project root rather than failing: the
 * run's worktree may already be gone, and the project's own state is still the sane thing to
 * act on. This is the one resolution every run-addressed surface shares — the daemon's serve
 * targets and previews, and each dashboard RPC — so the fallback rules cannot drift apart.
 */
export async function resolveAgentCheckout(projectCwd: string, agentId: string | undefined): Promise<string> {
  if (!agentId || !isSafeAgentId(agentId)) return projectCwd
  const live = await readLiveMetas(projectCwd).catch(() => [])
  const running = live.find(agent => agent.id === agentId)?.cwd
  if (running) return running
  const path = worktreePath(projectCwd, agentId)
  return (await nodeFs().isDirectory(path)) ? path : projectCwd
}

/**
 * The events journal a run-scoped subscribe should tail (#1472). Follows
 * {@link resolveAgentCheckout}'s order — live meta cwd, then the worktree — but where that
 * resolution would fall back to the project root, an ended agent's **archived** `<id>.jsonl`
 * wins: the archive existing proves the agent ended, and it is the agent's own record, where the
 * root journal belongs to whatever root run wrote it last. The root journal stays the final
 * fallback for the no-archive residue, so a just-starting root agent (no meta yet, #766, and no
 * worktree to probe) streams exactly as before.
 *
 * Only the events tails resolve here; every other run-addressed surface keeps
 * {@link resolveAgentCheckout}'s root fallback, where the project's own state is the sane
 * thing to act on.
 */
export async function resolveAgentEventsPath(projectCwd: string, agentId: string | undefined): Promise<string> {
  const rootJournal = join(projectCwd, FRAMEWORK_DIR, EVENTS_FILE)
  if (!agentId || !isSafeAgentId(agentId)) return rootJournal
  const live = await readLiveMetas(projectCwd).catch(() => [])
  const running = live.find(agent => agent.id === agentId)?.cwd
  if (running) return join(running, FRAMEWORK_DIR, EVENTS_FILE)
  const path = worktreePath(projectCwd, agentId)
  if (await nodeFs().isDirectory(path)) return join(path, FRAMEWORK_DIR, EVENTS_FILE)
  const [, archivedEvents] = await archivedAgentPaths(projectCwd, agentId)
  return archivedEvents ?? rootJournal
}
