/**
 * One `execFile`-backed CLI runner, configured per binary — `gh`'s reads and writes. Git runs
 * through the `skill-branches` package's own runner, which budgets per subcommand.
 */

/** Runs a CLI binary in `cwd`, resolving its stdout. Rejects on a non-zero exit. */
export type CliRunner = (args: string[], cwd: string) => Promise<string>

/**
 * A CLI killed for outrunning its timeout, as opposed to one the tool itself rejected (#997).
 *
 * `execFile` SIGTERMs on timeout, and a killed `git push` usually writes nothing to stderr, so
 * without this the failure surfaces as a bare "Command failed: git push ..." that reads like a
 * rejected push.
 */
export class CliTimeoutError extends Error {
  /** Brand, so a value that crossed a module boundary is still recognisable. */
  readonly timedOut = true
  constructor(
    readonly bin: string,
    readonly args: string[],
    readonly timeoutMs: number,
  ) {
    super(`${bin} ${args.join(' ')} timed out after ${timeoutMs}ms`)
    this.name = 'CliTimeoutError'
  }
}

/** How to invoke one binary. */
export interface CliRunnerOptions {
  bin: string
  /** Kill the process after this long, so a hung CLI cannot hang the caller. */
  timeoutMs: number
  /**
   * Reject with the CLI's own stderr rather than the generic exec message. `gh` puts the
   * useful part there ("not logged in", "no default remote"), and that is exactly what the
   * dashboard should show instead of a generic failure.
   */
  preferStderr?: boolean
}

/** Build a {@link CliRunner} for one binary. */
export function cliRunner(opts: CliRunnerOptions): CliRunner {
  return async (args, cwd) => {
    const { execFile } = await import('node:child_process')
    return new Promise<string>((resolvePromise, rejectPromise) => {
      execFile(opts.bin, args, { cwd, timeout: opts.timeoutMs }, (err, stdout, stderr) => {
        if (!err) return resolvePromise(String(stdout))
        // execFile kills on both timeout and a maxBuffer overrun; only the latter carries ENOBUFS.
        const killed = (err as { killed?: boolean }).killed === true
        if (killed && (err as { code?: unknown }).code !== 'ENOBUFS') {
          return rejectPromise(new CliTimeoutError(opts.bin, args, opts.timeoutMs))
        }
        rejectPromise(opts.preferStderr ? new Error(String(stderr).trim() || err.message) : err)
      })
    })
  }
}
