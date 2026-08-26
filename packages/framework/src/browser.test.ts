import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { chromeLaunchArgs, freePort, launchSharedBrowser, resolveChromePath, waitForDebugEndpoint } from './browser.js'
import { browserMcpServers, withBrowser, BROWSER_MCP_SERVERS } from './browser.js'
import { AGENT_PROFILE_PREFIX, closeOrphanedAgentBrowsers, orphanedAgentBrowsers, reapOnExit, type OrphanSweepDeps } from './browser.js'
import { isPidAlive } from './store/index.js'

test('chromeLaunchArgs opens the debug port on a throwaway profile (#793)', () => {
  const args = chromeLaunchArgs(9333, '/tmp/profile')
  assert.ok(args.includes('--remote-debugging-port=9333'), 'the port is what a second client attaches to')
  assert.ok(args.includes('--user-data-dir=/tmp/profile'), 'never the user’s real Chrome profile')
  assert.ok(args.includes('--headless=new'))
  assert.equal(args.at(-1), 'about:blank')
})

test('chromeLaunchArgs can run headful for local debugging', () => {
  assert.ok(!chromeLaunchArgs(1, '/tmp/p', false).includes('--headless=new'))
})

/**
 * A filesystem where only `present` exists. Injected so these assertions mean the same thing
 * on a laptop and on CI — the runners have Chrome at a well-known path, so a test that assumes
 * "nothing is installed" is really testing the host.
 */
const fsWith = (...present: string[]) => (path: string) => present.includes(path)

test('resolveChromePath prefers an explicit CHROME_PATH over the well-known locations', () => {
  const exists = fsWith('/custom/my-chrome', '/usr/bin/google-chrome')
  assert.equal(resolveChromePath({ CHROME_PATH: '/custom/my-chrome' }, 'linux', exists), '/custom/my-chrome')
  assert.equal(resolveChromePath({ PUPPETEER_EXECUTABLE_PATH: '/custom/my-chrome' }, 'linux', exists), '/custom/my-chrome')
})

test('resolveChromePath falls through an override that does not exist', () => {
  assert.equal(resolveChromePath({ CHROME_PATH: '/nope/chrome', PATH: '' }, 'linux', fsWith()), undefined)
  assert.equal(
    resolveChromePath({ CHROME_PATH: '/nope/chrome', PATH: '' }, 'linux', fsWith('/usr/bin/chromium')),
    '/usr/bin/chromium',
    'a bad override must not hide a browser that is actually installed',
  )
})

test('resolveChromePath finds a browser on PATH when no standard install exists', () => {
  assert.equal(resolveChromePath({ PATH: '/opt/bin' }, 'linux', fsWith('/opt/bin/chromium')), '/opt/bin/chromium')
})

// No Windows PATH-lookup test on purpose: `join` and `delimiter` follow the host, so asserting
// a `C:\...` result only passes when the test itself runs on Windows.

test('freePort returns a port nothing is listening on', async () => {
  const port = await freePort()
  assert.ok(port > 0 && port < 65536)
})

test('waitForDebugEndpoint resolves once the endpoint answers', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ Browser: 'Chrome/150' }))
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  try {
    assert.equal(await waitForDebugEndpoint(`http://127.0.0.1:${port}`, { timeoutMs: 3000 }), true)
  } finally {
    server.close()
  }
})

test('waitForDebugEndpoint gives up rather than hanging the run when Chrome never listens', async () => {
  const port = await freePort()
  assert.equal(await waitForDebugEndpoint(`http://127.0.0.1:${port}`, { timeoutMs: 250, intervalMs: 25 }), false)
})

test('a machine with no Chrome resolves to nothing, which is what makes --browser fall back', () => {
  assert.equal(resolveChromePath({ PATH: '/usr/bin' }, 'linux', fsWith()), undefined)
})

test('launchSharedBrowser gives up on a binary that never opens the port', async () => {
  // A path that cannot start: stands in for a Chrome that never listens. The agent must get
  // undefined (and fall back) rather than a handle to a browser nothing is behind.
  const browser = await launchSharedBrowser({ chromePath: join(tmpdir(), 'definitely-not-chrome'), timeoutMs: 400 })
  assert.equal(browser, undefined, 'a browser that never listens must not be handed to the agent')
})

test('browserMcpServers points the MCP server at our Chrome when we launched one (#793)', () => {
  const args = browserMcpServers('http://127.0.0.1:9333')['chrome-devtools']?.args ?? []
  assert.ok(args.includes('--browserUrl'))
  assert.ok(args.includes('http://127.0.0.1:9333'))
})

test('browserMcpServers is the old launch-its-own spec when there is no shared browser', () => {
  assert.deepEqual(browserMcpServers(undefined), BROWSER_MCP_SERVERS)
  assert.ok(!(browserMcpServers(undefined)['chrome-devtools']?.args ?? []).includes('--browserUrl'))
})

test('withBrowser folds the browser URL through to the driver options', () => {
  const opts = withBrowser({ permissionMode: 'bypassPermissions' }, true, 'http://127.0.0.1:4242')
  assert.ok((opts.mcpServers?.['chrome-devtools']?.args ?? []).includes('http://127.0.0.1:4242'))
})

test('withBrowser stays a no-op without the flag, URL or not', () => {
  const base = { permissionMode: 'bypassPermissions' } as const
  assert.deepEqual(withBrowser(base, false, 'http://127.0.0.1:4242'), base)
})

// --- The browser dies with its agent (#1719) ---

/** A process that lingers like a browser: alive until signalled. */
const lingerer = (...args: string[]): ChildProcess =>
  spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', ...args], { stdio: 'ignore' })

/** How the child ended, or 'alive' if it is still running after a second — a broken guard must fail, not hang. */
const exited = (child: ChildProcess): Promise<NodeJS.Signals | null | 'alive'> =>
  Promise.race([
    new Promise<NodeJS.Signals | null>(resolve => (child.exitCode !== null || child.signalCode !== null ? resolve(child.signalCode) : child.once('exit', (_code, signal) => resolve(signal)))),
    new Promise<'alive'>(resolve => setTimeout(() => resolve('alive'), 1000).unref()),
  ])

const settle = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

test('reapOnExit kills the browser when the agent exits without closing it (#1719)', async () => {
  const child = lingerer()
  const agent = new EventEmitter()
  reapOnExit(child, agent)
  agent.emit('exit')
  try {
    assert.equal(await exited(child), 'SIGKILL', 'an agent that leaves through process.exit takes its Chrome with it')
  } finally {
    child.kill('SIGKILL')
  }
})

test('a browser closed the ordinary way is not reaped twice: close disarms the exit hook', async () => {
  const child = lingerer()
  const agent = new EventEmitter()
  const disarm = reapOnExit(child, agent)
  disarm()
  agent.emit('exit')
  await settle(100)
  assert.equal(child.exitCode, null, 'disarmed: the exit hook no longer touches the child')
  assert.equal(agent.listenerCount('exit'), 0, 'and it left no listener behind')
  child.kill('SIGKILL')
  await exited(child)
})

/**
 * A stand-in Chrome: a shell script that answers `/json/version` on the port it was handed, so
 * `launchSharedBrowser` succeeds without a real browser on the machine.
 */
async function fakeChrome(dir: string): Promise<string> {
  const script = join(dir, 'server.cjs')
  await writeFile(
    script,
    [
      "const port = Number(process.argv.find(a => a.startsWith('--remote-debugging-port=')).split('=')[1])",
      "require('node:http').createServer((_req, res) => res.end('{}')).listen(port, '127.0.0.1')",
    ].join('\n'),
  )
  const bin = join(dir, 'chrome')
  await writeFile(bin, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`)
  await chmod(bin, 0o755)
  return bin
}

test('launchSharedBrowser arms the exit reaper, and close disarms it (#1719)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fake-chrome-'))
  const before = process.listenerCount('exit')
  try {
    const browser = await launchSharedBrowser({ chromePath: await fakeChrome(dir), timeoutMs: 5000 })
    assert.ok(browser, 'the stand-in Chrome answers on its port')
    try {
      assert.equal(process.listenerCount('exit'), before + 1, 'the agent process now reaps this browser on exit')
    } finally {
      // Closed even when the assertion fails: a live child handle would keep this process's
      // event loop alive, and the run would hang instead of failing.
      await browser.close()
    }
    assert.equal(process.listenerCount('exit'), before, 'closed: nothing left to reap')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

// --- Browsers no agent owns any more (#1719) ---

const chrome = (pid: number, ppid: number, profile: string, extra = ''): string =>
  `${pid} ${ppid} /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new${extra} --remote-debugging-port=5${pid} --user-data-dir=${profile} about:blank`

const listing = [
  '1 0 /sbin/launchd',
  '400 1 tmux',
  '500 1 /usr/local/bin/node /repo/dist/bin.js --agent /repo/.the-framework/agents/a.json',
  chrome(501, 500, '/var/folders/x/framework-chrome-live'),
  chrome(502, 501, '/var/folders/x/framework-chrome-live', ' --type=renderer'),
  chrome(600, 1, '/var/folders/x/framework-chrome-dead'),
  chrome(601, 600, '/var/folders/x/framework-chrome-dead', ' --type=gpu-process'),
  chrome(700, 400, '/var/folders/x/framework-chrome-tmux'),
  chrome(800, 999, '/var/folders/x/framework-chrome-unlisted'),
  chrome(900, 1, '/Users/me/.the-framework-browser/profile'),
  '950 1 /usr/local/bin/node -e setInterval(()=>{},1000)',
  '960 1 /Users/me/Library/Application Support/fnm/node-versions/v24.16.0/installation/bin/node /repo/dist/bin.js --agent /repo/.the-framework/agents/b.json',
  chrome(961, 960, '/var/folders/x/framework-chrome-spaces'),
].join('\n')

test('orphanedAgentBrowsers: an agent browser whose parent is gone is an orphan, one under a live agent is not (#1719)', () => {
  const orphans = orphanedAgentBrowsers(listing).map(b => b.pid)
  assert.ok(!orphans.includes(501), 'launched by a Node process that is still there: owned')
  assert.ok(!orphans.includes(961), 'ps prints commands unquoted: a Node under a path with spaces is still Node')
  assert.ok(orphans.includes(600), 'reparented to init: nobody owns it')
  assert.ok(orphans.includes(700), 'reparented to a subreaper that is not Node: nobody owns it')
  assert.ok(orphans.includes(800), 'a parent not in the listing is a parent that is gone')
  assert.deepEqual(orphanedAgentBrowsers(listing).find(b => b.pid === 600)?.profile, '/var/folders/x/framework-chrome-dead')
})

test('orphanedAgentBrowsers leaves helpers, other browsers and non-browsers alone (#1719)', () => {
  const orphans = orphanedAgentBrowsers(listing).map(b => b.pid)
  assert.ok(!orphans.includes(502) && !orphans.includes(601), 'a --type= helper dies with its browser; killing it alone would break a live one')
  assert.ok(!orphans.includes(900), "the daemon's bridge browser runs on its own profile, not an agent's")
  assert.ok(!orphans.includes(950), 'a process without an agent profile is not ours')
})

test('closeOrphanedAgentBrowsers kills each orphan and removes its profile, and does nothing on Windows (#1719)', async () => {
  const killed: number[] = []
  const removed: string[] = []
  const deps: OrphanSweepDeps = {
    list: async () => listing,
    kill: pid => {
      killed.push(pid)
      if (pid === 800) throw new Error('ESRCH')
    },
    remove: async path => void removed.push(path),
    platform: 'darwin',
  }
  const closed = await closeOrphanedAgentBrowsers(deps)
  assert.deepEqual(closed.map(b => b.pid), [600, 700, 800])
  assert.deepEqual(killed, [600, 700, 800])
  assert.deepEqual(removed, ['/var/folders/x/framework-chrome-dead', '/var/folders/x/framework-chrome-tmux', '/var/folders/x/framework-chrome-unlisted'], 'a browser that raced us to exit still gets its profile removed')
  assert.deepEqual(await closeOrphanedAgentBrowsers({ ...deps, platform: 'win32' }), [], 'no ps on Windows: the sweep is a no-op, not a crash')
})

test('the real sweep kills a browser process init inherited, and spares one a live agent holds (#1719)', { skip: process.platform === 'win32' }, async () => {
  const profiles = await mkdtemp(join(tmpdir(), 'orphan-sweep-'))
  const deadProfile = join(profiles, `${AGENT_PROFILE_PREFIX}dead`)
  const liveProfile = join(profiles, `${AGENT_PROFILE_PREFIX}live`)
  await mkdir(deadProfile)
  // Ours: a "browser" this very process launched, so its parent is a live Node process.
  const live = lingerer(`--user-data-dir=${liveProfile}`)
  // Orphaned: launched through a shell that exits at once, so init inherits it — exactly what a
  // SIGKILLed agent leaves behind.
  const shell = spawn('sh', ['-c', `"$0" -e "setInterval(() => {}, 1000)" -- --user-data-dir="$1" & echo $!`, process.execPath, deadProfile], { stdio: ['ignore', 'pipe', 'ignore'] })
  let out = ''
  shell.stdout.on('data', chunk => (out += chunk))
  await new Promise(r => shell.once('exit', r))
  const orphanPid = Number(out.trim())
  assert.ok(orphanPid > 0 && isPidAlive(orphanPid), 'the orphan is up before the sweep')
  try {
    // Reparenting is not instant everywhere; wait for the process table to show it.
    let closed = await closeOrphanedAgentBrowsers()
    for (let i = 0; i < 20 && !closed.some(b => b.pid === orphanPid); i++) {
      await settle(50)
      closed = await closeOrphanedAgentBrowsers()
    }
    assert.ok(closed.some(b => b.pid === orphanPid), 'the sweep found the browser nobody owns')
    await settle(100)
    assert.equal(isPidAlive(orphanPid), false, 'and killed it')
    assert.ok(!closed.some(b => b.pid === live.pid), "a live agent's browser is not touched")
    assert.equal(live.exitCode, null)
  } finally {
    try {
      process.kill(orphanPid, 'SIGKILL')
    } catch {
      // already reaped, which is the point
    }
    live.kill('SIGKILL')
    await exited(live)
    await rm(profiles, { recursive: true, force: true })
  }
})
