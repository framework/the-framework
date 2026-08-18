import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import type { StartAgentKind, StartAgentOptions } from './dashboard/index.js'

/**
 * The dashboard's process API to a session it spawns (D4).
 *
 * This used to be twenty-seven command-line flags. `StartAgentOptions` was serialized onto an argv
 * — every field carrying a "maps to `--x`" comment — which made the dashboard's IPC format and the
 * CLI's human surface the same thing. That is what forced the flags to be mutually validated,
 * documented in a 140-line help text, and tri-stated: `--auto-open-pr` / `--no-auto-open-pr` both
 * had to exist because argv has no way to say `false`, only "present" and "absent".
 *
 * JSON has a real `false`, so none of that is needed. The dashboard writes this blob to a temp
 * file and spawns `framework --agent <path>`; the child reads it, deletes it, and runs. The
 * flags are gone, the `--no-*` pairs with them, and the CLI is left with the four options a human
 * actually types.
 */
export interface AgentSpec {
  /** What the session is asked to do. Empty is allowed for `research`, which has its own default. */
  prompt: string
  /** Build from an intent, run one prompt verbatim, or run the Research preset. */
  kind: StartAgentKind
  /** The checkout the session runs in: a worktree, or the project itself. */
  cwd: string
  /** The id its worktree is named with, so the directory and the agent recorded inside it are one string. */
  agentId?: string
  /** Reopen `agentId`'s log instead of truncating it: the follow-up IS that agent (#762). */
  continueAgent?: boolean
  /** Everything the launcher's options gear and Settings decide about the session. */
  options: StartAgentOptions
}

/** The env var naming the directory session specs are written to. Set by tests; defaults to the OS temp dir. */
const SPEC_DIR_ENV = 'FRAMEWORK_SESSION_SPEC_DIR'

/** The per-spec mkdtemp directory's prefix, which marks the directory as this module's to remove. */
const SPEC_DIR_PREFIX = 'framework-session-'

/**
 * Write a spec and return its path, for `framework --agent <path>`.
 *
 * A file rather than a pipe or an fd: the child is spawned detached with its stdio closed, so
 * there is no channel to inherit, and a path survives the spawn without either side blocking on
 * the other. The child removes it once read, so a spec never outlives the session it started.
 */
export async function writeAgentSpec(spec: AgentSpec, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const dir = await mkdtemp(join(env[SPEC_DIR_ENV] ?? tmpdir(), SPEC_DIR_PREFIX))
  const path = join(dir, 'session.json')
  await writeFile(path, JSON.stringify(spec, null, 2) + '\n')
  return path
}

/**
 * Remove a spec — and the directory {@link writeAgentSpec} made for it, or removing one spec per
 * session would leave one empty directory per session behind forever. Only a directory carrying
 * this module's own prefix goes whole: `--agent <path>` accepts any path, and a hand-written spec
 * must not take the directory the user keeps it in with it.
 *
 * Also the cleanup for a spawn that failed (the child never ran, so nothing consumed the spec),
 * which otherwise left the whole prompt sitting on disk.
 */
export async function removeAgentSpec(path: string): Promise<void> {
  const dir = dirname(path)
  if (basename(dir).startsWith(SPEC_DIR_PREFIX)) await rm(dir, { recursive: true, force: true }).catch(() => {})
  else await rm(path, { force: true }).catch(() => {})
}

/**
 * Read a spec, and remove it. Consumed rather than merely read: it is a one-shot handoff, and a
 * session's options can name a device token (`options.remote`), which has no business staying on
 * disk after the session that used it has started.
 */
export async function readAgentSpec(path: string): Promise<AgentSpec> {
  const raw = await readFile(path, 'utf8')
  await removeAgentSpec(path)
  const spec = JSON.parse(raw) as Partial<AgentSpec>
  if (typeof spec.prompt !== 'string' || typeof spec.cwd !== 'string' || !spec.kind) {
    throw new Error(`${path} is not a session spec`)
  }
  return { ...spec, options: spec.options ?? {} } as AgentSpec
}
