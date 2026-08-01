import { join } from 'node:path'
import { archivedRunPaths, isSafeRunId, readLiveMetas, EVENTS_FILE, FRAMEWORK_DIR } from './run-store.js'
import { worktreePath } from './worktree.js'
import { nodeFs } from '../node-fs.js'

/**
 * The checkout a run id resolves to (#738/#797): the run's own worktree while it exists, else
 * the project root. Live metas first — a running run records its cwd — then the worktree
 * directory itself, which exists before the run has written its `run.json` (#766): the daemon
 * creates the directory and spawns the process, and only then does the run write its meta, so
 * a lookup by run state alone misses a run that certainly exists.
 *
 * The directory probe matters beyond a slow first read: a Telefunc Channel resolves its path
 * once, when the client subscribes. Falling back to the project root would not self-correct a
 * moment later — the channel would tail the wrong file for the life of the subscription, which
 * is how a newly started run once showed a previous run's output.
 *
 * An unknown or finished `runId` falls back to the project root rather than failing: the
 * run's worktree may already be gone, and the project's own state is still the sane thing to
 * act on. This is the one resolution every run-addressed surface shares — the daemon's serve
 * targets and previews, and each dashboard RPC — so the fallback rules cannot drift apart.
 */
export async function resolveRunCheckout(projectCwd: string, runId: string | undefined): Promise<string> {
  if (!runId || !isSafeRunId(runId)) return projectCwd
  const live = await readLiveMetas(projectCwd).catch(() => [])
  const running = live.find(run => run.id === runId)?.cwd
  if (running) return running
  const path = worktreePath(projectCwd, runId)
  return (await nodeFs().isDirectory(path)) ? path : projectCwd
}

/**
 * The events journal a run-scoped subscribe should tail (#1472). Follows
 * {@link resolveRunCheckout}'s order — live meta cwd, then the worktree — but where that
 * resolution would fall back to the project root, an ended run's **archived** `<id>.jsonl`
 * wins: the archive existing proves the run ended, and it is the run's own record, where the
 * root journal belongs to whatever root run wrote it last. The root journal stays the final
 * fallback for the no-archive residue, so a just-starting root run (no meta yet, #766, and no
 * worktree to probe) streams exactly as before.
 *
 * Only the events tails resolve here; every other run-addressed surface keeps
 * {@link resolveRunCheckout}'s root fallback, where the project's own state is the sane
 * thing to act on.
 */
export async function resolveRunEventsPath(projectCwd: string, runId: string | undefined): Promise<string> {
  const rootJournal = join(projectCwd, FRAMEWORK_DIR, EVENTS_FILE)
  if (!runId || !isSafeRunId(runId)) return rootJournal
  const live = await readLiveMetas(projectCwd).catch(() => [])
  const running = live.find(run => run.id === runId)?.cwd
  if (running) return join(running, FRAMEWORK_DIR, EVENTS_FILE)
  const path = worktreePath(projectCwd, runId)
  if (await nodeFs().isDirectory(path)) return join(path, FRAMEWORK_DIR, EVENTS_FILE)
  const [, archivedEvents] = await archivedRunPaths(projectCwd, runId)
  return archivedEvents ?? rootJournal
}
