import { execFile } from 'node:child_process'

/**
 * The system folder picker behind the dashboard's "Add project" (#1150): the daemon opens the
 * OS's own choose-a-folder dialog and hands the picked absolute path back, because a browser page
 * cannot learn the absolute path of anything the user picks in it.
 */

/** The outcome of asking the OS for a folder: a path, a dismissed dialog (`path: null`), or why the dialog could not be asked. */
export type PickDirectoryResult =
  | { ok: true; path: string | null }
  | { ok: false; error: string }

/** Injectable seam so tests never open a real dialog. */
export type DialogRunner = (command: string, args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>

const nodeDialogRunner: DialogRunner = (command, args) =>
  new Promise(done => {
    execFile(command, args, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0
      done({ code, stdout: String(stdout), stderr: String(stderr) })
    })
  })

/**
 * Open the OS folder picker and wait for the user's choice.
 *
 * macOS only so far: `osascript`'s `choose folder`, which renders the standard folder sheet.
 * Dismissing the dialog is a normal outcome (`path: null`), not an error — osascript reports it
 * as error -128, which is the one exit we translate rather than surface.
 */
export async function pickDirectory(platform: NodeJS.Platform = process.platform, run: DialogRunner = nodeDialogRunner): Promise<PickDirectoryResult> {
  if (platform !== 'darwin') return { ok: false, error: 'The system folder picker is only available on macOS so far.' }
  const result = await run('osascript', ['-e', 'POSIX path of (choose folder with prompt "Choose a git repository to add as a project")'])
  if (result.code === 0) {
    // osascript prints the POSIX path with a trailing slash; the registry stores paths without one.
    const path = result.stdout.trim().replace(/(.)\/$/, '$1')
    return path ? { ok: true, path } : { ok: false, error: 'the folder dialog returned no path' }
  }
  if (result.stderr.includes('-128')) return { ok: true, path: null }
  return { ok: false, error: result.stderr.trim() || 'the folder dialog could not be opened' }
}
