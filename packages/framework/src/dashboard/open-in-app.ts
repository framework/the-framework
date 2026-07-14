import { platform } from 'node:os'

// The project panel's "Open in Finder / editor" (#490, part of #488). Localhost-only: the
// daemon spawns a local command to reveal the repo in the OS file manager or open it in an
// editor. The path is the project's own registered path (never client input), and a public
// host has no local checkout to resolve, so there is nothing to spawn there.

/** Which app to open the project in. */
export type OpenTarget = 'files' | 'editor'

/** The outcome of an open attempt. */
export type OpenResult = { ok: true } | { ok: false; error: string }

/** Spawns a command, resolving once it launches (not on exit) and rejecting if it can't start. */
export type SpawnRunner = (command: string, args: string[]) => Promise<void>

/**
 * A {@link SpawnRunner} backed by `spawn`, detached. Resolves on the `spawn` event so a
 * long-lived editor (or `explorer`, which exits non-zero even on success) does not block or
 * error; rejects on the `error` event (e.g. ENOENT when the command is not on PATH).
 */
export function nodeSpawnRunner(): SpawnRunner {
  return (command, args) =>
    new Promise((resolve, reject) => {
      void import('node:child_process').then(({ spawn }) => {
        const child = spawn(command, args, { stdio: 'ignore', detached: true })
        child.on('error', reject)
        child.on('spawn', () => {
          child.unref()
          resolve()
        })
      })
    })
}

/** The OS command that reveals a path in the file manager. */
export function fileManagerCommand(path: string, os: NodeJS.Platform = platform()): { command: string; args: string[] } {
  if (os === 'darwin') return { command: 'open', args: [path] }
  if (os === 'win32') return { command: 'explorer', args: [path] }
  return { command: 'xdg-open', args: [path] }
}

/** The command to open a path in an editor: `$FRAMEWORK_EDITOR` when set, else the VS Code CLI. */
export function editorCommand(path: string, editor = process.env.FRAMEWORK_EDITOR): { command: string; args: string[] } {
  const bin = editor && editor.trim() ? editor.trim() : 'code'
  return { command: bin, args: [path] }
}

/** Open the project at `cwd` in the file manager or an editor. Failures are values, never throws. */
export async function openInApp(cwd: string, target: OpenTarget, run: SpawnRunner = nodeSpawnRunner()): Promise<OpenResult> {
  const { command, args } = target === 'editor' ? editorCommand(cwd) : fileManagerCommand(cwd)
  try {
    await run(command, args)
    return { ok: true }
  } catch (err) {
    if ((err as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      return { ok: false, error: `"${command}" was not found on PATH` }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'failed to open' }
  }
}
