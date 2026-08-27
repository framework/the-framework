import { execFile, spawn, type ChildProcess } from 'node:child_process'
import type { ClaudeCodeDriverOptions, McpServerSpec } from 'agent-driver'
import type { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, delimiter, join } from 'node:path'
import { promisify } from 'node:util'

/**
 * The agent's browser (#793, first slice of #609).
 *
 * `--browser` (#452) used to let chrome-devtools-mcp launch its own Chrome. That is fine
 * while the agent is the only client, but #609 wants a human watching the same page over a
 * screencast, and a second client cannot attach to a browser whose port we never opened. So
 * the agent launches Chrome itself with `--remote-debugging-port` and hands the MCP server a
 * `--browserUrl`. Chrome takes both CDP clients at once, which is what makes the preview and
 * the step-in relay possible at all.
 */
export interface SharedBrowser {
  /** The CDP endpoint both the agent and any preview attach to. */
  browserUrl: string
  /** Kill Chrome and remove its throwaway profile. Safe to call twice. */
  close(): Promise<void>
}

/**
 * The prefix of every throwaway profile an agent's browser runs on. It is the ownership mark
 * (#1719): a Chrome whose profile carries it was launched by an agent, and by nothing else.
 */
export const AGENT_PROFILE_PREFIX = 'framework-chrome-'

/** Where Chrome usually lives, per platform. First hit wins. */
const CHROME_PATHS: Record<string, string[]> = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
}

/** The binaries to look for on `PATH` when no well-known path exists. */
const CHROME_BINARIES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']

/** Whether a path exists. Injectable so a test does not depend on what the host has installed. */
export type ExistsFn = (path: string) => boolean

/** First existing match for `name` on `PATH`, or undefined. */
function onPath(name: string, env: NodeJS.ProcessEnv, platform: string, exists: ExistsFn): string | undefined {
  const exts = platform === 'win32' ? ['.exe', '.cmd', ''] : ['']
  for (const dir of (env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const full = join(dir, name + ext)
      if (exists(full)) return full
    }
  }
  return undefined
}

/**
 * The Chrome binary to launch, or undefined when the machine has none. `CHROME_PATH` (and
 * Puppeteer's variable, since a repo that has one usually means it) wins so a user on a
 * non-standard install is not stuck.
 *
 * `exists` is a parameter rather than a direct `existsSync` call so the lookup can be tested
 * against a known filesystem: CI runners have Chrome installed, so a test that assumes the
 * well-known paths are absent passes on a laptop and fails there.
 */
export function resolveChromePath(
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
  exists: ExistsFn = existsSync,
): string | undefined {
  for (const override of [env.CHROME_PATH, env.PUPPETEER_EXECUTABLE_PATH]) {
    if (override && exists(override)) return override
  }
  for (const candidate of CHROME_PATHS[platform] ?? []) {
    if (exists(candidate)) return candidate
  }
  for (const name of CHROME_BINARIES) {
    const found = onPath(name, env, platform, exists)
    if (found) return found
  }
  return undefined
}

/**
 * The launch flags. Headless by default — the agent has no screen, and a screencast reads a
 * headless page fine. The profile is throwaway so an agent never inherits (or dirties) the
 * user's real Chrome session.
 */
export function chromeLaunchArgs(port: number, userDataDir: string, headless = true): string[] {
  return [
    ...(headless ? ['--headless=new'] : []),
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,720',
    'about:blank',
  ]
}

/** A free localhost port, asked of the OS rather than guessed. */
export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => (port ? resolve(port) : reject(new Error('no port'))))
    })
  })
}

/**
 * Poll `/json/version` until Chrome answers. Chrome opens the port a beat after the process
 * starts, so handing the MCP server a URL that is not listening yet is the obvious race.
 */
export async function waitForDebugEndpoint(
  browserUrl: string,
  opts: { timeoutMs?: number; intervalMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const { timeoutMs = 15_000, intervalMs = 100, fetchImpl = fetch } = opts
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetchImpl(`${browserUrl}/json/version`)
      if (res.ok) return true
    } catch {
      // Not listening yet.
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return false
}

/**
 * Launch the agent's Chrome, or return undefined when this machine has none — in which case the
 * caller leaves `--browser` exactly as it was (chrome-devtools-mcp launches its own). A
 * missing browser should cost the agent its preview, never its browser tools.
 */
export async function launchSharedBrowser(
  opts: { chromePath?: string | undefined; headless?: boolean; timeoutMs?: number } = {},
): Promise<SharedBrowser | undefined> {
  const chromePath = opts.chromePath ?? resolveChromePath()
  if (!chromePath) return undefined

  const port = await freePort()
  const userDataDir = await mkdtemp(join(tmpdir(), AGENT_PROFILE_PREFIX))
  const browserUrl = `http://127.0.0.1:${port}`

  let child: ChildProcess
  try {
    child = spawn(chromePath, chromeLaunchArgs(port, userDataDir, opts.headless ?? true), { stdio: 'ignore' })
  } catch {
    await rm(userDataDir, { recursive: true, force: true })
    return undefined
  }
  const disarm = reapOnExit(child)

  let closed = false
  const close = async () => {
    if (closed) return
    closed = true
    disarm()
    child.kill()
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }

  // A Chrome that dies on its own must not leave the agent pointing at a dead port. `error`
  // needs its own handler or a failed spawn (bad path, no exec bit) throws unhandled and
  // takes the agent with it — a missing browser must only cost the preview.
  child.on('exit', () => void close())
  child.on('error', () => void close())

  const timeoutOpt = opts.timeoutMs === undefined ? {} : { timeoutMs: opts.timeoutMs }
  if (!(await waitForDebugEndpoint(browserUrl, timeoutOpt))) {
    await close()
    return undefined
  }
  return { browserUrl, close }
}

/**
 * Kill `child` when this process exits before `close()` ran (#1719). Node reaps nothing on its
 * own: an agent that leaves through `process.exit` (the second Ctrl+C) or an uncaught error
 * leaves its Chrome running on `ppid 1`, and a headless Chrome that nobody owns runs for days.
 * Signal deaths are the CLI's to handle — it aborts the agent, which closes the browser — and a
 * SIGKILL runs no handler at all; that case is the daemon's, which kills the agent's whole
 * process group. Returns the disarm, for a browser closed the ordinary way.
 *
 * `target` is the process; injectable so a test can fire the exit without exiting.
 */
export function reapOnExit(child: ChildProcess, target: EventEmitter = process): () => void {
  const reap = () => {
    try {
      child.kill('SIGKILL')
    } catch {
      // already gone
    }
  }
  target.once('exit', reap)
  return () => void target.off('exit', reap)
}

/** A browser process an agent launched, as read off the process table. */
export interface AgentBrowser {
  pid: number
  /** Its throwaway profile directory, which is what marks it as ours. */
  profile: string
}

/**
 * The agent browsers in a process listing that no agent owns any more (#1719). `listing` is
 * `ps -axo pid=,ppid=,command=`: one process per line, pid, parent pid, then the full command.
 *
 * Ours = the command carries a `--user-data-dir` under the agent-profile prefix and is the
 * browser process itself, not one of its `--type=` helpers (renderers and the like repeat the
 * flag, and their parent is the browser). Orphaned = its parent is gone, which shows as
 * reparenting: to pid 1, to a process not in the listing, or to a process that is not Node —
 * the only thing that ever launches these browsers is a Node agent, so any other parent is the
 * init, subreaper or shell that inherited it.
 */
export function orphanedAgentBrowsers(listing: string): AgentBrowser[] {
  const rows = new Map<number, { ppid: number; command: string }>()
  for (const line of listing.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line)
    if (match) rows.set(Number(match[1]), { ppid: Number(match[2]), command: match[3] ?? '' })
  }
  // `ps` prints the command unquoted, so a Node under a path with spaces in it cannot be split
  // into argv; instead the executable is looked for before the first flag, as a path segment
  // named `node` (`node22` and `node.exe` included).
  const isNode = (command: string): boolean => /(?:^|\/)node\d*(?:\.exe)?(?:\s|$)/.test(command.split(/\s-/)[0] ?? '')
  const orphans: AgentBrowser[] = []
  for (const [pid, { ppid, command }] of rows) {
    const profile = /(?:^|\s)--user-data-dir=(\S+)/.exec(command)?.[1]
    if (!profile || !basename(profile).startsWith(AGENT_PROFILE_PREFIX) || /\s--type=/.test(command)) continue
    const parent = rows.get(ppid)
    if (ppid === 1 || !parent || !isNode(parent.command)) orphans.push({ pid, profile })
  }
  return orphans
}

/** What the sweep needs from the machine; injectable so a test needs no orphan of its own. */
export interface OrphanSweepDeps {
  /** The process listing, `ps -axo pid=,ppid=,command=` shaped. */
  list(): Promise<string>
  kill(pid: number, signal: NodeJS.Signals): void
  /** Remove a throwaway profile. */
  remove(path: string): Promise<void>
  platform: string
}

const realSweepDeps = (): OrphanSweepDeps => ({
  list: async () => (await promisify(execFile)('ps', ['-axo', 'pid=,ppid=,command='], { maxBuffer: 64 * 1024 * 1024 })).stdout,
  kill: (pid, signal) => process.kill(pid, signal),
  remove: path => rm(path, { recursive: true, force: true }),
  platform: process.platform,
})

/**
 * Kill every agent browser no agent owns any more, and remove its profile (#1719). Run at daemon
 * boot: it is the net under the two in-process guards, for a Chrome whose agent died by SIGKILL
 * under a daemon that is gone, or from a build before the guards existed. Returns what it closed.
 * Windows has no `ps`; the sweep does nothing there.
 */
export async function closeOrphanedAgentBrowsers(deps: OrphanSweepDeps = realSweepDeps()): Promise<AgentBrowser[]> {
  if (deps.platform === 'win32') return []
  const orphans = orphanedAgentBrowsers(await deps.list())
  for (const { pid, profile } of orphans) {
    try {
      deps.kill(pid, 'SIGKILL')
    } catch {
      // gone between the listing and the kill
    }
    await deps.remove(profile).catch(() => {})
  }
  return orphans
}

/**
 * The `--browser` MCP wiring (#452): chrome-devtools-mcp is a maintained stdio
 * server that launches its own Chromium and exposes DevTools tools (navigate,
 * console, network, DOM, screenshot). `npx -y` resolves it on demand so there is
 * nothing to pre-install. Merged into the build driver only, not the short
 * preset-router turn.
 */
export const BROWSER_MCP_SERVERS: Record<string, McpServerSpec> = {
  'chrome-devtools': { command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'] },
}

/**
 * The same server, pointed at a Chrome the agent already launched (#793). `--browserUrl` makes
 * it attach instead of launching, which is what lets a second client (the screencast (#609))
 * watch the very page the agent is on. Without a URL this is the old spec unchanged.
 */
export function browserMcpServers(browserUrl?: string | undefined): Record<string, McpServerSpec> {
  if (!browserUrl) return BROWSER_MCP_SERVERS
  return { 'chrome-devtools': { command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest', '--browserUrl', browserUrl] } }
}

/** Fold the `--browser` MCP server into driver options when the flag is set. */
export function withBrowser(
  base: ClaudeCodeDriverOptions,
  browser: boolean,
  browserUrl?: string | undefined,
): ClaudeCodeDriverOptions {
  if (!browser) return base
  return { ...base, mcpServers: { ...base.mcpServers, ...browserMcpServers(browserUrl) } }
}
