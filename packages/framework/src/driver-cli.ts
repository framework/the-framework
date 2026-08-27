import { ClaudeCodeDriver, CodexDriver, type ClaudeCodeDriverOptions, type Driver } from 'agent-driver'
import { DRIVER_LABELS, type DriverName } from './driver-names.js'

/**
 * Which agent drives an agent (#542). Each is a whole coding-agent CLI the user
 * already pays for, driven on their own subscription with no API key (#495).
 *
 * The names live in the node-free `agent-names.ts` so the dashboard and the registry read
 * the same list without touching the driver layer; this module adds what only the node side
 * needs (binaries, drivers). Historical import sites keep working via these re-exports.
 */
export { DRIVERS, isDriverName, driverFromImpl, DRIVER_LABELS, type DriverName } from './driver-names.js'

/**
 * How an agent CLI answers "am I logged in?", and what fixes it when the answer is no (#1326).
 *
 * The exit code cannot decide this on its own: `claude auth status` prints its answer as JSON
 * and exits 0 either way. So each agent reads its own answer, and anything unrecognised comes
 * back `undefined` (could not say) rather than `false`. That asymmetry is deliberate. A wrong
 * "you are logged out" blocks a setup that works, which is worse than the silent dead agent this
 * exists to prevent, so only a CLI that says no out loud fails preflight.
 */
export interface AgentAuthSpec {
  /** The args that make the CLI report its login state, e.g. `auth status`. */
  args: readonly string[]
  /** Reads the CLI's answer out of its output. `undefined` when it could not say. */
  loggedIn: (result: { ok: boolean; output: string }) => boolean | undefined
  /** The one command that fixes a logged-out CLI. */
  fix: string
}

/** What we know about an agent before we run it. */
export interface DriverSpec {
  /** How to say it in a sentence, e.g. "Claude Code". */
  label: string
  /** The CLI binary, resolved on PATH. */
  bin: string
  /** Shown when preflight cannot find {@link bin}. */
  installHint: string
  /** How preflight asks the CLI whether it is logged in (#1326). */
  auth: AgentAuthSpec
}

/** The agents we can drive, and what each can tell us about itself. */
export const DRIVER_SPECS: Record<DriverName, DriverSpec> = {
  claude: {
    label: DRIVER_LABELS.claude,
    bin: 'claude',
    installHint: 'install Claude Code and make sure `claude` is on your PATH: https://claude.com/claude-code',
    auth: {
      args: ['auth', 'status'],
      // Prints JSON (`{"loggedIn": true, "authMethod": ...}`) and exits 0 either way, so the
      // flag is the answer and the exit code is not. A version too old to know the subcommand
      // prints usage instead, which parses as nothing and correctly reads as "could not say".
      loggedIn: ({ output }) => {
        try {
          const parsed: unknown = JSON.parse(output)
          const value = (parsed as Record<string, unknown> | null)?.loggedIn
          return typeof value === 'boolean' ? value : undefined
        } catch {
          return undefined
        }
      },
      fix: 'claude auth login',
    },
  },
  codex: {
    label: DRIVER_LABELS.codex,
    bin: 'codex',
    installHint: 'install the Codex CLI and make sure `codex` is on your PATH: https://developers.openai.com/codex/cli',
    auth: {
      args: ['login', 'status'],
      // Answers in a sentence rather than JSON: "Logged in using ChatGPT", or a "Not logged in".
      // The negative is tested first, since it contains the positive as a substring.
      loggedIn: ({ output }) => (/not logged in/i.test(output) ? false : /logged in/i.test(output) ? true : undefined),
      fix: 'codex login',
    },
  },
}

/** Options for {@link createDriver}. */
export interface CreateDriverOptions {
  driver: DriverName
  /** Claude Code driver options. Ignored by any other agent, which has its own. */
  claudeOpts?: ClaudeCodeDriverOptions
}

/**
 * Build the {@link Driver} for the picked driver name — the one place a session turns
 * the choice into a live implementation.
 *
 * Codex takes none of the Claude options: its sandbox is its own flag rather
 * than a permission mode, and it has no MCP config for `--browser`. Those are
 * dropped here and reported at the call site, so a flag that cannot apply says
 * so rather than looking honored.
 */
export function createDriver(opts: CreateDriverOptions): Driver {
  switch (opts.driver) {
    case 'codex':
      return new CodexDriver()
    case 'claude':
      return new ClaudeCodeDriver(opts.claudeOpts ?? {})
  }
}
