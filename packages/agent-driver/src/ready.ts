import { execFile } from 'node:child_process'

/**
 * Whether a coding agent's CLI can start a session at all, asked before a run spends a checkout
 * on it: the CLI is installed, and it is logged in. Installed is not the same as usable: a CLI
 * that resolves fine and is logged out starts, and every session dies before its first turn.
 *
 * Only a CLI that says no out loud is a problem. An answer this module cannot read is "could not
 * say" and passes: a wrong "you are logged out" blocks a setup that works, which is worse than
 * the dead session this exists to prevent.
 */

/** The coding agents this module can ask, by their driver ids. */
export type ReadyDriver = 'claude-code' | 'codex'

/** What stands in the way of a session: problems stop it, warnings are said and do not. Each line names its own fix. */
export interface DriverReadiness {
  problems: string[]
  warnings: string[]
}

/**
 * Run `<bin> <args>`: whether it succeeded, and everything it said. stdout and stderr merged,
 * since the two CLIs disagree about where a status line belongs.
 */
export type CliProbe = (bin: string, args: readonly string[]) => Promise<{ ok: boolean; output: string }>

interface CliSpec {
  bin: string
  install: string
  authArgs: readonly string[]
  /** Reads the CLI's answer to its login question. `undefined` when it could not say. */
  loggedIn: (result: { ok: boolean; output: string }) => boolean | undefined
  login: string
}

const SPECS: Record<ReadyDriver, CliSpec> = {
  'claude-code': {
    bin: 'claude',
    install: 'install Claude Code and make sure `claude` is on your PATH: https://claude.com/claude-code',
    authArgs: ['auth', 'status'],
    // Prints JSON (`{"loggedIn": true, ...}`) and exits 0 either way, so the flag is the answer.
    // A version too old to know the subcommand prints usage, which reads as "could not say".
    loggedIn: ({ output }) => {
      try {
        const value = (JSON.parse(output) as Record<string, unknown> | null)?.['loggedIn']
        return typeof value === 'boolean' ? value : undefined
      } catch {
        return undefined
      }
    },
    login: 'claude auth login',
  },
  codex: {
    bin: 'codex',
    install: 'install the Codex CLI and make sure `codex` is on your PATH: https://developers.openai.com/codex/cli',
    authArgs: ['login', 'status'],
    // A sentence, not JSON: "Logged in using ChatGPT", or "Not logged in". The negative first,
    // since it contains the positive.
    loggedIn: ({ output }) => (/not logged in/i.test(output) ? false : /logged in/i.test(output) ? true : undefined),
    login: 'codex login',
  },
}

export interface DriverReadyOptions {
  /** The CLI binary to ask. Default the driver's own, on `PATH`. */
  bin?: string
  /** The probe. Default {@link probeCli}. */
  probe?: CliProbe
  /** Whether this process runs as root. Default reads its uid. */
  isRoot?: () => boolean
  /** The user `sudo` recorded, named in the root warning. Default `SUDO_USER`. */
  sudoUser?: string | undefined
}

/**
 * Ask a coding agent's CLI whether a session can start. The login is asked only of a CLI that is
 * there: one "not found" beats two lines saying the same thing.
 *
 * Root is a warning, not a problem: under `sudo` the CLI looks for its credentials in root's home
 * and every session dies alike, saying nothing about why; but a container runs everything as root
 * legitimately.
 */
export async function checkDriverReady(driver: ReadyDriver, opts: DriverReadyOptions = {}): Promise<DriverReadiness> {
  const spec = SPECS[driver]
  const bin = opts.bin ?? spec.bin
  const probe = opts.probe ?? probeCli
  const problems: string[] = []
  const warnings: string[] = []

  const version = await probe(bin, ['--version'])
  if (!version.ok) {
    problems.push(`\`${bin}\` not found — ${spec.install}`)
  } else if (spec.loggedIn(await probe(bin, spec.authArgs)) === false) {
    problems.push(`\`${bin}\` is not logged in. Run \`${spec.login}\`, then start again.`)
  }

  if ((opts.isRoot ?? runningAsRoot)()) {
    const sudoUser = opts.sudoUser !== undefined ? opts.sudoUser : process.env['SUDO_USER']
    warnings.push(
      `running as root, so the coding agent looks for credentials under root's home and will not find yours. Run it as ${sudoUser ? `\`${sudoUser}\`` : 'your own user'}, without \`sudo\`.`,
    )
  }
  return { problems, warnings }
}

/** The real probe: the binary on `PATH`, ten seconds at most. */
export function probeCli(bin: string, args: readonly string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise(resolve => {
    execFile(bin, [...args], { timeout: 10_000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, output: `${String(stdout)}${String(stderr)}` })
    })
  })
}

/** Windows has no uid, and is never root by this test. */
function runningAsRoot(): boolean {
  return process.getuid?.() === 0
}
