import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkForUpdate, formatUpdateStatus, nodeVersionFetcher, type VersionFetcher } from './update-check.js'
import { isLoopbackHost, runDaemon, DEFAULT_DAEMON_HOST, DEFAULT_DAEMON_PORT } from './daemon.js'
import { ensureDaemonToken } from './registry.js'
import { errorMessage } from './error-message.js'

/** Where the CLI writes. Injectable so tests capture output. */
export interface CliIO {
  out: (line: string) => void
  err: (line: string) => void
}

const defaultIO: CliIO = {
  out: line => process.stdout.write(line + '\n'),
  err: line => process.stderr.write(line + '\n'),
}

/**
 * The CLI version, read from the package's own `package.json` at runtime (#312).
 * The compiled entry lives one level under the package root (`dist/` or
 * `dist-test/`), so its `package.json` is always `../package.json`. Cached after
 * the first read; falls back to `unknown` if the file is somehow unreadable.
 */
let cachedVersion: string | undefined
export function frameworkVersion(): string {
  if (cachedVersion !== undefined) return cachedVersion
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }
    // `unknown`, not `0.0.0`: the packages are unreleased and legitimately versioned `0.0.0`, so a
    // numeric fallback would make a failed read indistinguishable from a correct one (#312).
    cachedVersion = pkg.version ?? 'unknown'
  } catch {
    cachedVersion = 'unknown'
  }
  return cachedVersion
}

const HELP = `The Framework — turnkey AI orchestration that wraps a coding agent (Claude Code or Codex).

Usage:
  framework              Serve the dashboard in the foreground. Ctrl+C closes it; the server
                         logs stream to this terminal.

Options:
  --port <n>             Dashboard port (default: 4200).
  --host <addr>          Bind address (default: 127.0.0.1, localhost only). A non-loopback
                         address (e.g. 0.0.0.0) exposes the dashboard to your network and
                         generates a shared token; the printed URL carries it, and any request
                         without it gets 401. Exposing a process spawner to the network is a
                         security decision (#806).
  -h, --help             Show this help.
  -v, --version          Print the version.

Everything else is the dashboard: it shows a project's runs from their files, and starts one
through the project's own start hook (.the-framework/hooks.yml), which names the tool that runs it.`

/** What the CLI itself accepts: four options, no verbs (D4). */
export interface CliArgs {
  help: boolean
  version: boolean
  /** `--port <n>`: the port the dashboard binds. Default {@link DEFAULT_DAEMON_PORT}; `0` is ephemeral. */
  port?: number
  /**
   * `--host <addr>` (#1051): the dashboard's bind address. Default loopback; a non-loopback
   * address exposes it to the network and gates every route behind the generated shared token.
   */
  host?: string
  error?: string
}

/**
 * Parse argv (without the node/script prefix). Pure and testable.
 *
 * Four options and nothing else: `--host` and `--port` because they are the two things a browser
 * cannot be asked and a dashboard cannot serve about itself; `--help` and `--version` because a
 * command with options owes the user both. The command runs no agent (#1774): a run is started
 * from the dashboard, by the project's own start hook.
 */
export function parseArgs(argv: string[]): CliArgs {
  const opts: CliArgs = { help: false, version: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    switch (arg) {
      case '--help':
      case '-h':
        opts.help = true
        break
      case '--version':
      case '-v':
        opts.version = true
        break
      case '--port': {
        const n = Number(argv[++i])
        if (Number.isInteger(n) && n >= 0) opts.port = n
        else opts.error = 'invalid --port: must be a non-negative integer'
        break
      }
      case '--host': {
        const value = argv[++i]
        if (value === undefined) opts.error = 'invalid --host: missing address'
        else opts.host = value
        break
      }
      default:
        opts.error = arg.startsWith('-') ? `unknown option: ${arg}` : `unknown command: ${arg}`
    }
  }
  return opts
}

export async function runCli(argv: string[], io: CliIO = defaultIO): Promise<number> {
  const args = parseArgs(argv)
  if (args.error) {
    io.err(args.error)
    io.err('Run `framework --help` for usage.')
    return 2
  }
  if (args.help) {
    io.out(HELP)
    return 0
  }
  if (args.version) {
    io.out(frameworkVersion())
    return 0
  }
  // Everything else is bare `framework`: serve the dashboard in the foreground until Ctrl-C.
  return runForegroundDaemonCmd(args, io)
}

/**
 * Bare `framework`: run the dashboard server in the foreground (#456), so its logs and any
 * server-thrown errors are visible and Ctrl+C stops it. Blocks until the server is signalled
 * (SIGINT/SIGTERM).
 */
async function runForegroundDaemonCmd(args: CliArgs, io: CliIO): Promise<number> {
  const cwd = process.cwd()
  const port = args.port ?? DEFAULT_DAEMON_PORT
  const host = args.host
  // #1051: pre-generate the shared token for a non-loopback bind so onListening (sync) can print
  // the reachable URL; runDaemon reuses the same persisted token.
  const token = host !== undefined && !isLoopbackHost(host) ? await ensureDaemonToken() : undefined
  try {
    await runDaemon(cwd, {
      port,
      ...(host !== undefined ? { host } : {}),
      onListening: state => {
        io.out(`◆ dashboard running: ${state.url}`)
        if (!isLoopbackHost(state.host ?? DEFAULT_DAEMON_HOST)) {
          printNonLoopbackAccess(io, state.host ?? DEFAULT_DAEMON_HOST, state.url, token)
        }
        io.out('  Ctrl+C to stop the dashboard. Server logs stream below.')
        // #312 asks bare `framework` to print the commands + version too. onListening is sync and
        // runDaemon then blocks until signalled, so this is fire-and-forget by necessity: the
        // update line lands a moment later, above the server logs.
        void printStartupFooter(io)
      },
    })
  } catch (err) {
    io.err(`could not start the dashboard (${errorMessage(err)}).`)
    return 1
  }
  return 0
}

/**
 * The loud one-line warning and the token-bearing URL printed on any non-loopback daemon bind
 * (#1051). A daemon that spawns processes is code execution for anyone who reaches the port, and
 * the shared token is the only guard, so this says so before the daemon is left running. The bound
 * host is a bind-all like `0.0.0.0`, so the user swaps it for the machine's actual reachable
 * address (a Tailscale/LAN hostname); the token rides the URL for the first hop, then the cookie.
 */
function printNonLoopbackAccess(io: CliIO, host: string, url: string, token: string | undefined): void {
  io.err(`⚠ SECURITY: bound to ${host} (non-loopback). This exposes code execution to your network; the shared token is the only guard (#1051).`)
  if (!token) return
  io.out(`  Open with the token (swap ${host} for this machine's reachable address, e.g. a Tailscale hostname):`)
  io.out(`    ${url}/?token=${token}`)
}

/**
 * The startup footer every dashboard path prints (#312): where prompts come from, the version,
 * and then — once npm answers — whether that version is the latest.
 *
 * The update line is deliberately not awaited before the static lines. #312 asks for the static
 * info first, and the foreground path (bare `framework`) blocks on the server forever, so a line
 * printed after the await would never appear there at all. `checkForUpdate` is already forgiving:
 * offline or slow (2.5s cap) resolves to 'unknown', which prints nothing.
 */
export function printStartupFooter(io: CliIO, opts: { fetchLatest?: VersionFetcher } = {}): Promise<void> {
  const version = frameworkVersion()
  io.out('')
  io.out('Type a prompt on the dashboard to start an agent, or use:')
  io.out('  framework --help              All options')
  io.out('')
  io.out(`The Framework v${version}`)
  return checkForUpdate(version, opts.fetchLatest ?? nodeVersionFetcher())
    .then(status => {
      const line = formatUpdateStatus(status)
      if (line) io.out(line)
    })
    .catch(() => {})
}
