import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StartRunKind, StartRunOptions } from './dashboard/index.js'

/**
 * The dashboard's process API to a session it spawns (D4).
 *
 * This used to be twenty-seven command-line flags. `StartRunOptions` was serialized onto an argv
 * — every field carrying a "maps to `--x`" comment — which made the dashboard's IPC format and the
 * CLI's human surface the same thing. That is what forced the flags to be mutually validated,
 * documented in a 140-line help text, and tri-stated: `--auto-open-pr` / `--no-auto-open-pr` both
 * had to exist because argv has no way to say `false`, only "present" and "absent".
 *
 * JSON has a real `false`, so none of that is needed. The dashboard writes this blob to a temp
 * file and spawns `framework --session <path>`; the child reads it, deletes it, and runs. The
 * flags are gone, the `--no-*` pairs with them, and the CLI is left with the four options a human
 * actually types.
 */
export interface SessionSpec {
  /** What the session is asked to do. Empty is allowed for `research`, which has its own default. */
  prompt: string
  /** Build from an intent, run one prompt verbatim, or run the Research preset. */
  kind: StartRunKind
  /** The checkout the session runs in: a worktree, or the project itself. */
  cwd: string
  /** The id its worktree is named with, so the directory and the run recorded inside it are one string. */
  runId?: string
  /** Reopen `runId`'s log instead of truncating it: the follow-up IS that run (#762). */
  continueRun?: boolean
  /** Everything the launcher's options gear and Settings decide about the session. */
  options: StartRunOptions
}

/** The env var naming the directory session specs are written to. Set by tests; defaults to the OS temp dir. */
const SPEC_DIR_ENV = 'FRAMEWORK_SESSION_SPEC_DIR'

/**
 * Write a spec and return its path, for `framework --session <path>`.
 *
 * A file rather than a pipe or an fd: the child is spawned detached with its stdio closed, so
 * there is no channel to inherit, and a path survives the spawn without either side blocking on
 * the other. The child removes it once read, so a spec never outlives the session it started.
 */
export async function writeSessionSpec(spec: SessionSpec, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const dir = await mkdtemp(join(env[SPEC_DIR_ENV] ?? tmpdir(), 'framework-session-'))
  const path = join(dir, 'session.json')
  await writeFile(path, JSON.stringify(spec, null, 2) + '\n')
  return path
}

/**
 * Read a spec, and remove it. Consumed rather than merely read: it is a one-shot handoff, and a
 * session's options can name a device token (`options.remote`), which has no business staying on
 * disk after the session that used it has started.
 */
export async function readSessionSpec(path: string): Promise<SessionSpec> {
  const raw = await readFile(path, 'utf8')
  await rm(path, { force: true }).catch(() => {})
  const spec = JSON.parse(raw) as Partial<SessionSpec>
  if (typeof spec.prompt !== 'string' || typeof spec.cwd !== 'string' || !spec.kind) {
    throw new Error(`${path} is not a session spec`)
  }
  return { ...spec, options: spec.options ?? {} } as SessionSpec
}
