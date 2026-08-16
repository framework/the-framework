import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, writeFile, appendFile, rm, mkdir, readFile, realpath, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { FrameworkEvent } from './events.js'
import {
  EventTailer,
  isProcessAlive,
  runDaemon,
  registerHomeProject,
  registerReposDirectory,
  isNestedWithin,
  type DaemonState,
  type RunDaemonOptions,
} from './daemon.js'
import type { PreflightResult } from './preflight.js'

/**
 * A ready agent, injected into every daemon below (#1326). A start now preflights the picked
 * agent's CLI, and these tests are about the daemon's own behavior, not about whether the
 * machine running them happens to have `claude` installed and logged in.
 */
const agentReady = (): Promise<PreflightResult> => Promise.resolve({ ok: true, checks: [] })

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
import { listRuns } from './store/index.js'
import { EVENTS_FILE, FRAMEWORK_DIR, addWorktree } from './store/index.js'
import { controlPath } from './control.js'
import { projectId, listProjects, addProject, writePreferences } from './registry.js'
import { nodeGitRunner } from './project.js'

// The dashboard steers + starts over the daemon's in-process RPC mount (#405/#426), not the
// retired /api/* HTTP routes. Post to `/_rpc/<name>` (same-origin) and return the unwrapped `ret`.
async function callRpc(url: string, name: string, args: unknown[]): Promise<unknown> {
  const res = await fetch(`${url}/_rpc/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: url },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  return text ? (JSON.parse(text) as { ret?: unknown }).ret : undefined
}
type StartResult = { ok: true } | { ok: false; busy?: boolean; error: string }
// The home project's id: what the browser sends for the daemon's own workspace, which the
// daemon resolves back to `cwd` (see `resolveProject`).
const homeId = (cwd: string): string => projectId(resolve(cwd))
const sendStart = (url: string, cwd: string, prompt: string, kind = 'build'): Promise<StartResult> =>
  callRpc(url, 'sendStart', [homeId(cwd), prompt, kind]) as Promise<StartResult>

const logEvent = (message: string): FrameworkEvent => ({ kind: 'log', message })
const line = (message: string): string => JSON.stringify(logEvent(message)) + '\n'
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

async function tmpWorkspace(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-daemon-'))
  await mkdir(join(cwd, FRAMEWORK_DIR), { recursive: true })
  return cwd
}

// Point the registry at a throwaway config dir under the workspace so tests never touch the real
// $HOME and clean up with the workspace. Returns the env the daemon reads it from.
async function configEnv(cwd: string): Promise<NodeJS.ProcessEnv> {
  const dir = join(cwd, 'cfg')
  await mkdir(dir, { recursive: true })
  return { XDG_CONFIG_HOME: dir }
}

test('EventTailer dispatches only events appended since the last pull', async () => {
  const cwd = await tmpWorkspace()
  const path = join(cwd, FRAMEWORK_DIR, EVENTS_FILE)
  try {
    const seen: string[] = []
    const tailer = new EventTailer(path, e => e.kind === 'log' && seen.push(e.message))

    await tailer.pull() // file absent -> no throw, nothing seen
    assert.deepEqual(seen, [])

    await writeFile(path, line('one') + line('two'))
    await tailer.pull()
    assert.deepEqual(seen, ['one', 'two'])

    await appendFile(path, line('three'))
    await tailer.pull()
    assert.deepEqual(seen, ['one', 'two', 'three']) // only the new line was re-read
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('EventTailer buffers a torn trailing line until its newline arrives', async () => {
  const cwd = await tmpWorkspace()
  const path = join(cwd, FRAMEWORK_DIR, EVENTS_FILE)
  try {
    const seen: string[] = []
    const tailer = new EventTailer(path, e => e.kind === 'log' && seen.push(e.message))

    const full = line('complete')
    await writeFile(path, full + '{"kind":"log","mess') // half a second line
    await tailer.pull()
    assert.deepEqual(seen, ['complete']) // the fragment is held back

    await appendFile(path, 'age":"rest"}\n')
    await tailer.pull()
    assert.deepEqual(seen, ['complete', 'rest'])
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('EventTailer resets when the log is truncated by a fresh run', async () => {
  const cwd = await tmpWorkspace()
  const path = join(cwd, FRAMEWORK_DIR, EVENTS_FILE)
  try {
    const seen: string[] = []
    const tailer = new EventTailer(path, e => e.kind === 'log' && seen.push(e.message))

    await writeFile(path, line('old-run'))
    await tailer.pull()
    assert.deepEqual(seen, ['old-run'])

    // Truncate + rewrite to the SAME byte length (both lines are 35 bytes), so this is
    // caught by the mtime check, not by the shrink check.
    await sleep(20) // let mtime advance past the read above
    await writeFile(path, line('new-run'))
    await tailer.pull()
    assert.deepEqual(seen, ['old-run', 'new-run'])
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('isProcessAlive is true for this process and false for a dead pid', () => {
  assert.equal(isProcessAlive(process.pid), true)
  assert.equal(isProcessAlive(2 ** 31 - 1), false) // an impossibly high, unused pid
})

test('runDaemon serves the dashboard, and shuts down when the signal aborts', async () => {
  const cwd = await tmpWorkspace()
  const env = await configEnv(cwd)
  const ac = new AbortController()
  try {
    const { done, state } = await startDaemon(cwd, { agentPreflight: agentReady, port: 0, signal: ac.signal, env })
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
    const { done, state } = await startDaemon(cwd, { agentPreflight: agentReady, port: 0, signal: ac.signal, env })
    assert.equal((await fetch(state.url)).status, 200)
    ac.abort()
    await done
  } finally {
    ac.abort()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a git project starts concurrent runs, each in its own worktree (#736)', async () => {
  // realpath: on macOS tmpdir sits under the /var -> /private/var symlink, and git
  // reports the resolved path (same gotcha as the worktree module's own round-trip test).
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'framework-daemon-git-')))
  const git = nodeGitRunner()
  const ac = new AbortController()
  try {
    await mkdir(join(cwd, FRAMEWORK_DIR), { recursive: true })
    await git(['init'], cwd)
    await git(['config', 'user.email', 't@t'], cwd)
    await git(['config', 'user.name', 't'], cwd)
    await writeFile(join(cwd, 'README.md'), '# t\n')
    await git(['add', '-A'], cwd)
    await git(['commit', '-m', 'init'], cwd)

    // The stub logs to the *repo*, not to its own --cwd: each run now gets a different one.
    const stub = join(cwd, 'stub-cli.cjs')
    await writeFile(
      stub,
      `const fs = require('node:fs')
const argv = process.argv.slice(2)
const spec = JSON.parse(fs.readFileSync(argv[argv.indexOf('--session') + 1], 'utf8'))
fs.appendFileSync(${JSON.stringify(join(cwd, 'started.log'))}, JSON.stringify(spec) + '\\n')
setTimeout(() => {}, 800)
`,
    )
    const env = await configEnv(cwd)
    const { done, state } = await startDaemon(cwd, { agentPreflight: agentReady, port: 0, signal: ac.signal, binPath: stub, env })

    // The whole point of #736: the second Start is no longer refused as busy while the
    // first child is alive, because the two no longer share a working tree.
    const first = await sendStart(state.url, cwd, 'a blog')
    const second = await sendStart(state.url, cwd, 'another app')
    assert.equal(first.ok, true)
    assert.equal(second.ok, true, 'a concurrent run on the same project is allowed')

    let lines: string[] = []
    for (let i = 0; i < 100 && lines.length < 2; i++) {
      await new Promise(r => setTimeout(r, 20))
      lines = await readFile(join(cwd, 'started.log'), 'utf8').then(
        s => s.split('\n').filter(Boolean),
        () => [],
      )
    }
    assert.equal(lines.length, 2, 'both children spawned')

    const runs = lines.map(line => JSON.parse(line) as { cwd: string; runId: string })
    for (const run of runs) {
      assert.equal(run.cwd, join(cwd, FRAMEWORK_DIR, 'worktrees', run.runId), 'ran in the worktree named by its run id')
      assert.equal((await stat(run.cwd)).isDirectory(), true, 'the worktree checkout exists')
      assert.equal((await stat(join(run.cwd, 'README.md'))).isFile(), true, 'with the repo content in it')
    }
    assert.notEqual(runs[0]!.cwd, runs[1]!.cwd, 'the two runs got different checkouts')

    // Each run is on its own `the-framework/run-<id>` branch, and the user's own checkout
    // was never moved off the branch it was sitting on.
    const branches = await git(['branch', '--format=%(refname:short)'], cwd)
    for (const run of runs) assert.ok(branches.includes(`the-framework/run-${run.runId}`), `branch for ${run.runId}`)
    const head = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)).trim()
    assert.equal(head.startsWith('the-framework/run-'), false, 'the main checkout stayed on its own branch')

    ac.abort()
    await done
  } finally {
    ac.abort()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a run loses its worktree once its work is on the remote, whatever the run did (#737/E5)', async () => {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'framework-daemon-teardown-')))
  const git = nodeGitRunner()
  const ac = new AbortController()
  try {
    await mkdir(join(cwd, FRAMEWORK_DIR), { recursive: true })
    await git(['init'], cwd)
    await git(['config', 'user.email', 't@t'], cwd)
    await git(['config', 'user.name', 't'], cwd)
    await writeFile(join(cwd, 'README.md'), '# t\n')
    await git(['add', '-A'], cwd)
    await git(['commit', '-m', 'init'], cwd)
    // A real bare repo for `origin`: the rule this asserts is about the remote, so it is real
    // rather than stubbed.
    await git(['init', '-q', '--bare', join(cwd, 'origin.git')], cwd)
    await git(['remote', 'add', 'origin', join(cwd, 'origin.git')], cwd)

    // The stub plays a run: it writes the meta a real run would leave behind, with the status
    // read from a file the test controls, then exits so the daemon's teardown fires.
    const stub = join(cwd, 'stub-cli.cjs')
    await writeFile(
      stub,
      `const fs = require('node:fs'), path = require('node:path')
const argv = process.argv.slice(2)
const spec = JSON.parse(fs.readFileSync(argv[argv.indexOf('--session') + 1], 'utf8'))
const runCwd = spec.cwd
const runId = spec.runId
const status = fs.readFileSync(${JSON.stringify(join(cwd, 'status.txt'))}, 'utf8').trim()
const dir = path.join(runCwd, '.the-framework')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'events.jsonl'), JSON.stringify({ kind: 'log', message: 'worked' }) + '\\n')
fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ version: 1, status, id: runId, startedAt: runId, updatedAt: runId }))
fs.appendFileSync(${JSON.stringify(join(cwd, 'started.log'))}, runId + '\\n')
`,
    )
    const env = await configEnv(cwd)
    const { done, state } = await startDaemon(cwd, { agentPreflight: agentReady, port: 0, signal: ac.signal, binPath: stub, env })

    /** Start a run whose stub reports `status`, and resolve once its worktree has settled. */
    const runWith = async (status: string, nth: number): Promise<string> => {
      await writeFile(join(cwd, 'status.txt'), status)
      assert.equal((await sendStart(state.url, cwd, `run ${status}`)).ok, true)
      let ids: string[] = []
      for (let i = 0; i < 150 && ids.length < nth; i++) {
        await new Promise(r => setTimeout(r, 20))
        ids = await readFile(join(cwd, 'started.log'), 'utf8').then(s => s.split('\n').filter(Boolean), () => [])
      }
      assert.equal(ids.length, nth, `run ${nth} started`)
      return ids[nth - 1]!
    }

    /**
     * Poll for the archived history to appear, which is the teardown having run. Asked through
     * `listRuns` rather than by stat'ing a path: since #1179 a run is archived under whichever
     * user ran it, and what this test cares about is that the project's history has it.
     */
    const archivedMeta = async (runId: string): Promise<{ branch?: string } | undefined> => {
      for (let i = 0; i < 600; i++) {
        const found = (await listRuns(cwd).catch(() => [])).find(run => run.id === runId)
        if (found) return found
        await new Promise(r => setTimeout(r, 20))
      }
      return undefined
    }
    const archived = async (runId: string): Promise<boolean> => (await archivedMeta(runId)) !== undefined

    /**
     * Poll until the run's checkout is off disk. Generous, because teardown now commits *and
     * pushes* the branch before it can remove anything (E5), and a loaded CI box running the
     * suite's files in parallel makes that several seconds of real git.
     */
    const worktreeGone = async (runId: string): Promise<boolean> => {
      for (let i = 0; i < 600; i++) {
        const gone = await stat(join(cwd, FRAMEWORK_DIR, 'worktrees', runId)).then(() => false, () => true)
        if (gone) return true
        await new Promise(r => setTimeout(r, 20))
      }
      return false
    }

    // A clean finish: history archived into the repo, work pushed, worktree gone.
    const doneId = await runWith('done', 1)
    assert.equal(await archived(doneId), true, "a finished run's history is copied into the project")
    assert.equal(await worktreeGone(doneId), true, 'and its worktree is removed')
    // The branch is the only handle left on the work once the checkout goes, so it is recorded
    // while the worktree still exists (#799) — otherwise the handoff has nothing to read.
    const doneMeta = await archivedMeta(doneId)
    assert.equal(doneMeta?.branch, `the-framework/run-${doneId}`, "the finished run's branch is recorded")
    assert.match(
      await git(['log', '--format=%s', `refs/remotes/origin/the-framework/run-${doneId}`], cwd),
      /\S/,
      'the work reached the remote, which is what let the checkout go',
    )

    // A failure goes the same way (E5): how the run ended is not what decides this, whether its
    // work is recoverable is. It used to be kept "for inspection", which meant one full checkout
    // accumulated per failed session until a human noticed.
    const failedId = await runWith('failed', 2)
    assert.equal(await archived(failedId), true, "a failed run's history is copied too")
    assert.equal(await worktreeGone(failedId), true, 'and its checkout goes too, since the remote has its branch')

    ac.abort()
    await done
  } finally {
    ac.abort()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('sendStart spawns the run child with its session spec, one at a time when the project has no worktree (#345)', async () => {
  // A non-git workspace cannot be given a worktree, so runs share the one checkout and the
  // pre-#736 one-at-a-time guard still applies. tmpWorkspace() is deliberately not a repo.
  const cwd = await tmpWorkspace()
  // A stub CLI standing in for the framework bin: it records the spec it was handed, then
  // stays alive briefly so the one-run-at-a-time guard has a window to trip.
  const stub = join(cwd, 'stub-cli.cjs')
  await writeFile(
    stub,
    `const fs = require('node:fs'), path = require('node:path')
const argv = process.argv.slice(2)
const spec = JSON.parse(fs.readFileSync(argv[argv.indexOf('--session') + 1], 'utf8'))
fs.appendFileSync(path.join(spec.cwd, 'started.log'), JSON.stringify(spec) + '\\n')
setTimeout(() => {}, 600)
`,
  )
  const env = await configEnv(cwd)
  const ac = new AbortController()
  try {
    const { done, state } = await startDaemon(cwd, { agentPreflight: agentReady, port: 0, signal: ac.signal, binPath: stub, env })

    const post = (prompt: string) => sendStart(state.url, cwd, prompt)

    const first = await post('a blog')
    assert.equal(first.ok, true)

    // The child got one JSON spec naming the prompt, its kind and its checkout (D4).
    let lines: string[] = []
    for (let i = 0; i < 100 && lines.length < 1; i++) {
      await new Promise(r => setTimeout(r, 20))
      lines = await readFile(join(cwd, 'started.log'), 'utf8').then(
        s => s.split('\n').filter(Boolean),
        () => [],
      )
    }
    assert.deepEqual(JSON.parse(lines[0]!), { prompt: 'a blog', kind: 'build', cwd, options: {} })

    // While that child is alive, a second Start is refused (#322 runaway concern).
    const busy = await post('another app')
    assert.ok(busy.ok === false && busy.busy === true, 'a second start is refused as busy')

    // Once the child exits, the guard resets and Start works again.
    let again: StartResult = busy
    for (let i = 0; i < 100 && !again.ok; i++) {
      await new Promise(r => setTimeout(r, 50))
      again = await post('a second run')
    }
    assert.equal(again.ok, true)

    ac.abort()
    await done
  } finally {
    ac.abort()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('sendStart kind=research travels as a kind, with an empty what left to the run to default (#331)', async () => {
  const cwd = await tmpWorkspace()
  const stub = join(cwd, 'stub-cli.cjs')
  await writeFile(
    stub,
    `const fs = require('node:fs'), path = require('node:path')
const argv = process.argv.slice(2)
const spec = JSON.parse(fs.readFileSync(argv[argv.indexOf('--session') + 1], 'utf8'))
fs.appendFileSync(path.join(spec.cwd, 'started.log'), JSON.stringify(spec) + '\\n')
`,
  )
  const env = await configEnv(cwd)
  const ac = new AbortController()
  try {
    const { done, state } = await startDaemon(cwd, { agentPreflight: agentReady, port: 0, signal: ac.signal, binPath: stub, env })

    const post = (prompt: string, kind: string) => sendStart(state.url, cwd, prompt, kind)

    // With a what -> it is passed through; without -> omitted so the CLI defaults it.
    assert.equal((await post('the auth flow', 'research')).ok, true)
    let lines: string[] = []
    for (let i = 0; i < 100 && lines.length < 1; i++) {
      await new Promise(r => setTimeout(r, 20))
      lines = await readFile(join(cwd, 'started.log'), 'utf8').then(
        s => s.split('\n').filter(Boolean),
        () => [],
      )
    }
    assert.deepEqual(JSON.parse(lines[0]!), { prompt: 'the auth flow', kind: 'research', cwd, options: {} })

    let second = await post('', 'research')
    for (let i = 0; i < 100 && !second.ok; i++) {
      await new Promise(r => setTimeout(r, 50))
      second = await post('', 'research')
    }
    assert.equal(second.ok, true)
    for (let i = 0; i < 100 && lines.length < 2; i++) {
      await new Promise(r => setTimeout(r, 20))
      lines = (await readFile(join(cwd, 'started.log'), 'utf8')).split('\n').filter(Boolean)
    }
    assert.deepEqual(JSON.parse(lines[1]!), { prompt: '', kind: 'research', cwd, options: {} })

    // kind=prompt (#353): a preset the user reviewed in the textarea runs verbatim, never
    // re-rendered.
    const verbatim = 'Measure "problem variability" of this PR\n- List all high-level flows'
    let third = await post(verbatim, 'prompt')
    for (let i = 0; i < 100 && !third.ok; i++) {
      await new Promise(r => setTimeout(r, 50))
      third = await post(verbatim, 'prompt')
    }
    assert.equal(third.ok, true)
    for (let i = 0; i < 100 && lines.length < 3; i++) {
      await new Promise(r => setTimeout(r, 20))
      lines = (await readFile(join(cwd, 'started.log'), 'utf8')).split('\n').filter(Boolean)
    }
    assert.deepEqual(JSON.parse(lines[2]!), { prompt: verbatim, kind: 'prompt', cwd, options: {} })

    ac.abort()
    await done
  } finally {
    ac.abort()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('sendStart refuses to re-exec a test entry as the run (#345)', async () => {
  const cwd = await tmpWorkspace()
  const env = await configEnv(cwd)
  const ac = new AbortController()
  try {
    // No binPath: argv[1] here is this test file — the fork-bomb guard must trip.
    const { done, state } = await startDaemon(cwd, { agentPreflight: agentReady, port: 0, signal: ac.signal, env })
    const result = await sendStart(state.url, cwd, 'a blog')
    assert.ok(result.ok === false && /test entry/.test(result.error), 'the fork-bomb guard refuses a test entry')
    ac.abort()
    await done
  } finally {
    ac.abort()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('runDaemon steers through the control log: sendStop / sendChoice append entries (#344)', async () => {
  const cwd = await tmpWorkspace()
  const env = await configEnv(cwd)
  const ac = new AbortController()
  // sendStop / sendChoice resolve the project through the registry the Telefunc layer reads
  // from `process.env` (not the daemon's injected `env`), so point the config dir there for
  // this test; restore it after. (sendStart uses the daemon's own homeId shortcut instead.)
  const prevXdg = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = env['XDG_CONFIG_HOME']
  try {
    const { done, state } = await startDaemon(cwd, { agentPreflight: agentReady, port: 0, signal: ac.signal, env })

    // The dashboard steers over the RPC mount: sendStop / sendChoice append to control.jsonl.
    const id = homeId(cwd)
    await callRpc(state.url, 'sendStop', [id])
    await callRpc(state.url, 'sendChoice', [id, 'plan-approval', 'alt:0', 'user'])

    // Both landed in the control log (appends are async fire-and-forget: poll).
    let lines: string[] = []
    for (let i = 0; i < 100 && lines.length < 2; i++) {
      await new Promise(r => setTimeout(r, 20))
      lines = await readFile(controlPath(cwd), 'utf8').then(
        s => s.split('\n').filter(Boolean),
        () => [],
      )
    }
    assert.deepEqual(lines.map(l => JSON.parse(l)), [
      { kind: 'stop' },
      { kind: 'choice', id: 'plan-approval', pick: 'alt:0', by: 'user' },
    ])

    ac.abort()
    await done
  } finally {
    ac.abort()
    if (prevXdg === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = prevXdg
    await rm(cwd, { recursive: true, force: true })
  }
})

test('isNestedWithin flags a child path, not equal/sibling/parent (#647)', () => {
  assert.equal(isNestedWithin('/repo/packages/the-framework', '/repo'), true)
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
    // A nested, activated subfolder (like packages/the-framework inside the repo).
    const nested = join(parent, 'packages', 'framework')
    await mkdir(join(nested, FRAMEWORK_DIR), { recursive: true })

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
    await mkdir(join(home, FRAMEWORK_DIR), { recursive: true })
    await registerHomeProject(home, env)
    const projects = await listProjects(undefined, env)
    assert.deepEqual(projects.map(p => p.path), [home])
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('registerReposDirectory auto-adds the git repos when the opt-in is on (#1123)', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-repos-')))
  const env = await configEnv(root)
  try {
    // Two git repos and one plain directory directly inside the repos dir.
    await mkdir(join(root, 'app-a', '.git'), { recursive: true })
    await mkdir(join(root, 'app-b', '.git'), { recursive: true })
    await mkdir(join(root, 'not-a-repo'), { recursive: true })
    await writePreferences({ reposDirectory: root, reposDirectoryAutoGrant: true }, undefined, env)

    await registerReposDirectory(env)

    const projects = (await listProjects(undefined, env)).map(p => p.path).sort()
    assert.deepEqual(projects, [join(root, 'app-a'), join(root, 'app-b')])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('registerReposDirectory adds nothing while the opt-in is off (#1123)', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-repos-off-')))
  const env = await configEnv(root)
  try {
    await mkdir(join(root, 'app-a', '.git'), { recursive: true })
    // reposDirectory is set, but the auto-grant is not: the default must stay hands-off.
    await writePreferences({ reposDirectory: root }, undefined, env)

    await registerReposDirectory(env)

    assert.deepEqual(await listProjects(undefined, env), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
