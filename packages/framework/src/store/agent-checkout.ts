import { join } from 'node:path'
import { readFinishedDiary, readLiveMetas } from './agent-store.js'
import { projectRuns, type AnyDiaryLine, type RunsFor } from './runs.js'
import { isSafeAgentId, worktreePath } from '@gemstack/skill-branches'
import { THE_FRAMEWORK_DIR } from '../framework-dir.js'
import { nodeFs } from '../node-fs.js'

/**
 * The checkout an agent id resolves to (#738/#797): the agent's own worktree while it exists, else
 * the project root. The checkouts' cards first, then the worktree directory itself, which exists
 * before the run's tool has written the card (#766), so a lookup by card alone misses a run that
 * certainly exists.
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
 * Where a run's diary is, for a reader that follows it: a file while the run has a checkout, or
 * the finished run's lines once it has none.
 */
export type AgentDiarySource = { file: string } | { finished: AnyDiaryLine[] }

/**
 * The diary a run-scoped subscribe should follow (#1472, #1774): the run's own `<id>.jsonl`.
 * While the run has a checkout it is a file there, under the checkout's `.the-framework/`,
 * written by the run's tool as the agent works. Once the run is recorded and its checkout
 * reclaimed, it is the finished run's diary, whole, from the project's runs provider. A run that
 * has neither yet was started a moment ago: its tool has not made the checkout, so the answer is
 * the file where the diary will appear, and the tail waits for it there. A project with no runs
 * provider answers the same for a finished run: the file that is gone, where nothing more comes.
 *
 * Only the events tails resolve here; every other run-addressed surface keeps
 * {@link resolveAgentCheckout}'s root fallback, where the project's own state is the sane
 * thing to act on.
 */
export async function resolveAgentDiary(projectCwd: string, agentId: string | undefined, runs: RunsFor = projectRuns): Promise<AgentDiarySource | undefined> {
  if (!agentId || !isSafeAgentId(agentId)) return undefined
  const live = await readLiveMetas(projectCwd).catch(() => [])
  const checkout = live.find(agent => agent.id === agentId)?.cwd ?? worktreePath(projectCwd, agentId)
  const liveDiary = join(checkout, THE_FRAMEWORK_DIR, `${agentId}.jsonl`)
  if (await nodeFs().isDirectory(checkout)) return { file: liveDiary }
  const finished = await readFinishedDiary(projectCwd, agentId, runs)
  return finished ? { finished } : { file: liveDiary }
}
