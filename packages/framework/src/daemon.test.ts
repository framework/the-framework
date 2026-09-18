import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, writeFile, rm, mkdir, readFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import {
  isProcessAlive,
  runDaemon,
  registerHomeProject,
  isNestedWithin,
  type DaemonState,
  type RunDaemonOptions,
} from './daemon.js'

/**
 * Start a daemon and wait until it reports where it bound. The CLI is foreground-only, so there
 * is no liveness file to poll: `onListening` is the only way a caller learns the port.
 *
 * The daemon's own promise comes back too — it resolves on shutdown, so abort the signal and
 * await it before the test removes the workspace underneath it.
 */
async function startDaemon(cwd: string, opts: RunDaemonOptions): Promise<{ done: Promise<void>; state: DaemonState }> {
  let report!: (state: DaemonState) => void
  let fail!: (err: unknown) => void
  const listening = new Promise<DaemonState>((resolvePromise, rejectPromise) => {
    report = resolvePromise
    fail = rejectPromise
  })
  const done = runDaemon(cwd, { ...opts, onListening: state => report(state) })
  // runDaemon only settles on shutdown, so it is never awaited here. Settling *before* it binds
  // means it failed to come up: forward that, or `listening` would hang the test forever.
  void done.then(
    () => fail(new Error('the daemon exited before it bound')),
    (err: unknown) => fail(err),
  )
  return { done, state: await listening }
}
import { THE_FRAMEWORK_DIR } from './framework-dir.js'
import { projectId, listProjects, addProject } from './registry.js'
import { gitignorePath, frameworkGitignore } from './framework-gitignore.js'

// The dashboard steers + starts over the daemon's in-process RPC mount (#405/#426), not the
// retired per-read HTTP routes. Post to `/_rpc/<name>` (same-origin) and return the unwrapped `ret`.
async function callRpc(url: string, name: string, args: unknown[]): Promise<unknown> {
  const res = await fetch(`${url}/_rpc/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: url },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  return text ? (JSON.parse(text) as { ret?: unknown }).ret : undefined
}
type StartResult = { ok: true; agentId: string } | { ok: false; error: string }
// The home project's id: what the browser sends for the daemon's own workspace, which the
// daemon resolves back to `cwd` (see `resolveProject`).
const homeId = (cwd: string): string => projectId(resolve(cwd))
const sendStart = (url: string, cwd: string, prompt: string, options: Record<string, string> = {}): Promise<StartResult> =>
  callRpc(url, 'sendStart', [homeId(cwd), prompt, options]) as Promise<StartResult>

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/** Fake an activated workspace: the install-written ignore file is the activation marker (#1600). */
async function activate(cwd: string): Promise<void> {
  await mkdir(join(cwd, THE_FRAMEWORK_DIR), { recursive: true })
  await writeFile(gitignorePath(cwd), frameworkGitignore())
}

async function tmpWorkspace(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-daemon-'))
  await activate(cwd)
  return cwd
}

// Point the registry at a throwaway config dir under the workspace so tests never touch the real
// $HOME and clean up with the workspace. Returns the env the daemon reads it from.
async function configEnv(cwd: string): Promise<NodeJS.ProcessEnv> {
  const dir = join(cwd, 'cfg')
  await mkdir(dir, { recursive: true })
  return { XDG_CONFIG_HOME: dir }
}

test('isProcessAlive is true for this process and false for a dead pid', () => {
  assert.equal(isProcessAlive(process.pid), true)
  assert.equal(isProcessAlive(2 ** 31 - 1), false) // an impossibly high, unused pid
})

test('runDaemon serves the dashboard, and shuts down when the signal aborts', async () => {
  const cwd = await tmpWorkspace()
  const env = await configEnv(cwd)
  const ac = new AbortController()
  try {
    const { done, state } = await startDaemon(cwd, { port: 0, signal: ac.signal, env })
    assert.equal(state.pid, process.pid)
    assert.match(state.url, /^http:\/\/127\.0\.0\.1:\d+$/)

    // The dashboard's static shell is served.
    const res = await fetch(state.url)
    assert.equal(res.status, 200)
    assert.match(await res.text(), /id="root"/)

    // Ctrl-C closes everything: the daemon runs in the foreground and owns nothing beyond itself.
    ac.abort()
    await done
    await assert.rejects(fetch(state.url)) // the port is free again
  } finally {
    ac.abort()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('runDaemon comes up on a fresh workspace with no .the-framework yet', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-daemon-')) // deliberately no mkdir
  const env = await configEnv(cwd)
  const ac = new AbortController()
  try {
    const { done, state } = await startDaemon(cwd, { port: 0, signal: ac.signal, env })
    assert.equal((await fetch(state.url)).status, 200)
    ac.abort()
    await done
  } finally {
    ac.abort()
    await rm(cwd, { recursive: true, force: true })
  }
})

test("a project's open hooks run once the dashboard listens, its close hooks at shutdown, each line in the project (#1774)", async () => {
  const cwd = await realpath(await tmpWorkspace())
  const env = await configEnv(cwd)
  await writeFile(
    join(cwd, THE_FRAMEWORK_DIR, 'hooks.yml'),
    'open:\n  - echo open-1 >> hooks.log\n  - pwd -P >> hooks.log\n  - exit 3\n  - echo open-2 >> hooks.log\nclose:\n  - echo close >> hooks.log\n',
  )
  const logged: string[] = []
  const original = console.log
  console.log = (...args: unknown[]) => void logged.push(args.map(String).join(' '))
  const ac = new AbortController()
  try {
    const { done, state } = await startDaemon(cwd, { port: 0, signal: ac.signal, env })
    assert.match(state.url, /^http:\/\/127\.0\.0\.1:\d+$/)
    // The hooks run after the URL is reported, so wait for the last open line to land.
    let log = ''
    for (let i = 0; i < 200 && !log.includes('open-2'); i++) {
      await sleep(25)
      log = await readFile(join(cwd, 'hooks.log'), 'utf8').catch(() => '')
    }
    assert.equal(log, `open-1\n${cwd}\nopen-2\n`, 'every open line ran, in order, in the project, the failing one included')
    ac.abort()
    await done
    assert.equal(await readFile(join(cwd, 'hooks.log'), 'utf8'), `open-1\n${cwd}\nopen-2\nclose\n`)
    const hookLines = logged.filter(l => l.includes(' hook ('))
    assert.deepEqual(hookLines, [
      `[framework] open hook (${basename(cwd)}): echo open-1 >> hooks.log: exit 0`,
      `[framework] open hook (${basename(cwd)}): pwd -P >> hooks.log: exit 0`,
      `[framework] open hook (${basename(cwd)}): exit 3: exit 3`,
      `[framework] open hook (${basename(cwd)}): echo open-2 >> hooks.log: exit 0`,
      `[framework] close hook (${basename(cwd)}): echo close >> hooks.log: exit 0`,
    ])
  } finally {
    console.log = original
    ac.abort()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a Start runs the project\'s own start hook with the prompt and the picks, and answers the id the hook answered (#1774)', async () => {
  const cwd = await realpath(await tmpWorkspace())
  const env = await configEnv(cwd)
  // The daemon names no tool: whatever the line is, it gets the prompt and the picks in its
  // environment, and the id it prints is the run's.
  await writeFile(
    join(cwd, THE_FRAMEWORK_DIR, 'hooks.yml'),
    `start: 'printf "%s|%s|%s" "$PROMPT" "$DRIVER" "\${MODEL-unset}" > started.txt; echo "{\\"id\\":\\"run-42\\"}"'\n`,
  )
  const ac = new AbortController()
  try {
    const { done, state } = await startDaemon(cwd, { port: 0, signal: ac.signal, env })
    assert.deepEqual(await sendStart(state.url, cwd, '/work-queue now', { driver: 'codex' }), { ok: true, agentId: 'run-42' })
    assert.equal(await readFile(join(cwd, 'started.txt'), 'utf8'), '/work-queue now|codex|unset')
    assert.deepEqual(await sendStart(state.url, cwd, '   '), { ok: false, error: 'a non-empty prompt is required' })
    assert.deepEqual(await callRpc(state.url, 'sendStart', ['no-such-project', 'x']), { ok: false, error: 'unknown project: no-such-project' })

    // Without the line there is nothing to start a run with, and the daemon says so.
    await writeFile(join(cwd, THE_FRAMEWORK_DIR, 'hooks.yml'), 'open:\n  - "true"\n')
    assert.deepEqual(await sendStart(state.url, cwd, 'Read the docs'), { ok: false, error: 'this project has no start hook' })
    ac.abort()
    await done
  } finally {
    ac.abort()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('isNestedWithin flags a child path, not equal/sibling/parent (#647)', () => {
  assert.equal(isNestedWithin('/repo/packages/framework', '/repo'), true)
  assert.equal(isNestedWithin('/repo', '/repo'), false) // equal is not nested
  assert.equal(isNestedWithin('/repo', '/repo/packages'), false) // parent is not nested
  assert.equal(isNestedWithin('/other/framework', '/repo'), false) // sibling tree
  assert.equal(isNestedWithin('/repo-x', '/repo'), false) // prefix but not a path child
})

test('registerHomeProject skips a cwd nested inside an already-tracked project (#647)', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'framework-parent-'))
  const env = await configEnv(parent)
  try {
    await addProject(parent, new Date().toISOString(), undefined, env)
    // A nested, activated subfolder (like packages/framework inside the repo).
    const nested = join(parent, 'packages', 'framework')
    await activate(nested)

    await registerHomeProject(nested, env)

    const projects = await listProjects(undefined, env)
    assert.deepEqual(
      projects.map(p => p.path),
      [parent],
      'the nested subfolder must not be added as a second project',
    )
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

test('registerHomeProject still adds an activated cwd that is not nested (#647)', async () => {
  const home = await mkdtemp(join(tmpdir(), 'framework-home-'))
  const env = await configEnv(home)
  try {
    await activate(home)
    await registerHomeProject(home, env)
    const projects = await listProjects(undefined, env)
    assert.deepEqual(projects.map(p => p.path), [home])
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

