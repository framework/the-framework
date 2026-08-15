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
  startOptionFlags,
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

// The new dashboard steers + starts over Telefunc (#405/#426), not the retired /api/* HTTP
// routes. Post an RPC to the daemon's in-process `/_telefunc` mount (same-origin), keyed by
// the client-baked file path, and return the unwrapped `ret`.
async function callTelefunc(url: string, file: string, name: string, args: unknown[]): Promise<unknown> {
  const res = await fetch(`${url}/_telefunc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: url },
    body: JSON.stringify({ file, name, args }),
  })
  const text = await res.text()
  return text ? (JSON.parse(text) as { ret?: unknown }).ret : undefined
}
type StartResult = { ok: true } | { ok: false; busy?: boolean; error: string }
// The home project's id: what the browser sends for the daemon's own workspace, which the
// daemon resolves back to `cwd` (see `resolveProject`).
const homeId = (cwd: string): string => projectId(resolve(cwd))
const sendStart = (url: string, cwd: string, prompt: string, kind = 'build'): Promise<StartResult> =>
  callTelefunc(url, '/server/control.telefunc.ts', 'sendStart', [homeId(cwd), prompt, kind]) as Promise<StartResult>

test('startOptionFlags maps only enabled Global options to CLI flags (#314)', () => {
  assert.deepEqual(startOptionFlags({}), [])
  assert.deepEqual(startOptionFlags({ autopilot: true, technical: true, vanilla: true }), [
    '--autopilot',
    '--technical',
    '--vanilla',
  ])
  assert.deepEqual(startOptionFlags({ eco: { autoPlanning: true, autoMaintenance: true } }), [
    '--eco-auto-planning',
    '--eco-auto-maintenance',
  ])
  // Context (#439): one repeatable --context flag per selected dir; blanks dropped.
  assert.deepEqual(startOptionFlags({ context: ['/work/api', '  ', '/work/ui'] }), [
    '--context',
    '/work/api',
    '--context',
    '/work/ui',
  ])
  // On-before-mergeable prompt (#326): maps to --on-before-mergeable.
  assert.deepEqual(startOptionFlags({ onBeforeMergeable: true }), ['--on-before-mergeable'])
  // Browser via chrome-devtools-mcp (#452): maps to --browser.
  assert.deepEqual(startOptionFlags({ browser: true }), ['--browser'])
  // Transparent (#625): the master off-switch maps to --transparent.
  assert.deepEqual(startOptionFlags({ transparent: true }), ['--transparent'])
})

test('a disarmed handoff travels as the --no-* form, since it defaults on (#1102)', () => {
  // The mirror image of #842's reason: these two are ON unless told otherwise, so an unticked box
  // that sent nothing would be re-armed by the run's own default and the session would publish
  // itself anyway.
  assert.deepEqual(startOptionFlags({ autoPushBranch: false, autoOpenPr: false }), [
    '--no-auto-push-branch',
    '--no-auto-open-pr',
  ])
  assert.deepEqual(startOptionFlags({ autoPushBranch: true, autoOpenPr: true }), [
    '--auto-push-branch',
    '--auto-open-pr',
  ])
})

test('auto-merge is tri-state too: both spellings travel, absence says nothing (#1216)', () => {
  // Defaults OFF, but the repo yml may turn it on, so an explicit launcher false has to travel
  // as --no-auto-merge to win over the file.
  assert.deepEqual(startOptionFlags({ autoMerge: true }), ['--auto-merge'])
  assert.deepEqual(startOptionFlags({ autoMerge: false }), ['--no-auto-merge'])
  assert.deepEqual(startOptionFlags({}), [])
})

test('startOptionFlags spells an explicit off as the --no-* form (#842)', () => {
  // The launcher resolves the repo yml itself now, so a toggle it shows as off has to travel as
  // one: without --no-autopilot the file would turn it back on inside the run (#841).
  assert.deepEqual(startOptionFlags({ autopilot: false, technical: false }), ['--no-autopilot', '--no-technical'])
  assert.deepEqual(startOptionFlags({ vanilla: false, transparent: false }), ['--no-vanilla', '--no-transparent'])
  // Absent still says nothing, so the repo file keeps deciding.
  assert.deepEqual(startOptionFlags({}), [])
  assert.deepEqual(startOptionFlags({ autopilot: true, technical: false }), ['--autopilot', '--no-technical'])
  // Model (#628): maps to --model, trimmed; blank/whitespace is no choice -> no flag.
  assert.deepEqual(startOptionFlags({ model: 'opus' }), ['--model', 'opus'])
  assert.deepEqual(startOptionFlags({ model: '  sonnet  ' }), ['--model', 'sonnet'])
  assert.deepEqual(startOptionFlags({ model: '   ' }), [])
  // Agent (#650): only non-default codex emits --agent; claude is the CLI default -> no flag.
  assert.deepEqual(startOptionFlags({ agent: 'codex' }), ['--agent', 'codex'])
  assert.deepEqual(startOptionFlags({ agent: 'claude' }), [])
  assert.deepEqual(startOptionFlags({ agent: '   ' }), [])
  // Run target (#1050): only `actions` emits --run-on; `local` is the default -> no flag.
  assert.deepEqual(startOptionFlags({ target: 'actions' }), ['--run-on', 'actions'])
  assert.deepEqual(startOptionFlags({ target: 'local' }), [])
  // Unattended (#846): auto PM's own runs, whose gates must not park for an absent human.
  assert.deepEqual(startOptionFlags({ unattended: true }), ['--unattended'])
  assert.deepEqual(startOptionFlags({ unattended: false }), [])
  // Resume a finished run's session (#720): maps to --resume-session, trimmed; blank -> no flag.
  assert.deepEqual(startOptionFlags({ resumeSession: 'sess-42' }), ['--resume-session', 'sess-42'])
  assert.deepEqual(startOptionFlags({ resumeSession: '  sess-7  ' }), ['--resume-session', 'sess-7'])
  assert.deepEqual(startOptionFlags({ resumeSession: '   ' }), [])
})

const logEvent = (message: string): FrameworkEvent => ({ kind: 'log', message })
const line = (message: string): string => JSON.stringify(logEvent(message)) + '\n'
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

async function tmpWorkspace(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-daemon-'))
  await mkdir(join(cwd, FRAMEWORK_DIR), { recursive: true })
  return cwd
}

// The global daemon liveness now lives beside the registry (#393). Point it at a
// throwaway config dir under the workspace so tests never touch the real $HOME and
// clean up with the workspace. Returns the env the daemon fns resolve the path from.
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

    // The new Vike + Telefunc dashboard (its prerendered SPA shell) is served.
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
fs.appendFileSync(${JSON.stringify(join(cwd, 'started.log'))}, JSON.stringify(process.argv.slice(2)) + '\\n')
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

    const runs = lines.map(line => {
      const args = JSON.parse(line) as string[]
      return { cwd: args[args.indexOf('--cwd') + 1]!, runId: args[args.indexOf('--run-id') + 1]! }
    })
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

test('a finished run loses its worktree; a failed one keeps it, history saved either way (#737)', async () => {
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

    // The stub plays a run: it writes the meta a real run would leave behind, with the status
    // read from a file the test controls, then exits so the daemon's teardown fires.
    const stub = join(cwd, 'stub-cli.cjs')
    await writeFile(
      stub,
      `const fs = require('node:fs'), path = require('node:path')
const args = process.argv.slice(2)
const runCwd = args[args.indexOf('--cwd') + 1]
const runId = args[args.indexOf('--run-id') + 1]
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
      for (let i = 0; i < 150; i++) {
        const found = (await listRuns(cwd).catch(() => [])).find(run => run.id === runId)
        if (found) return found
        await new Promise(r => setTimeout(r, 20))
      }
      return undefined
    }
    const archived = async (runId: string): Promise<boolean> => (await archivedMeta(runId)) !== undefined

    // A clean finish: history archived into the repo, worktree gone.
    const doneId = await runWith('done', 1)
    assert.equal(await archived(doneId), true, "a finished run's history is copied into the project")
    let gone = false
    for (let i = 0; i < 150 && !gone; i++) {
      gone = await stat(join(cwd, FRAMEWORK_DIR, 'worktrees', doneId)).then(() => false, () => true)
      if (!gone) await new Promise(r => setTimeout(r, 20))
    }
    assert.equal(gone, true, 'and its worktree is removed')
    // The branch is the only handle left on the work once the checkout goes, so it is recorded
    // while the worktree still exists (#799) — otherwise the handoff has nothing to read.
    const doneMeta = await archivedMeta(doneId)
    assert.equal(doneMeta?.branch, `the-framework/run-${doneId}`, "the finished run's branch is recorded")

    // A failure: history archived too, but the checkout is kept so it can be inspected.
    const failedId = await runWith('failed', 2)
    assert.equal(await archived(failedId), true, "a failed run's history is copied too")
    assert.equal(
      (await stat(join(cwd, FRAMEWORK_DIR, 'worktrees', failedId, 'README.md'))).isFile(),
      true,
      'and its worktree is retained, content and all, for inspection',
    )

    ac.abort()
    await done
  } finally {
    ac.abort()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('sendStart spawns the run child (prompt, --no-dashboard, --cwd) one at a time when the project has no worktree (#345)', async () => {
  // A non-git workspace cannot be given a worktree, so runs share the one checkout and the
  // pre-#736 one-at-a-time guard still applies. tmpWorkspace() is deliberately not a repo.
  const cwd = await tmpWorkspace()
  // A stub CLI standing in for the framework bin: it records its argv, then
  // stays alive briefly so the one-run-at-a-time guard has a window to trip.
  const stub = join(cwd, 'stub-cli.cjs')
  await writeFile(
    stub,
    `const fs = require('node:fs'), path = require('node:path')
const args = process.argv.slice(2)
fs.appendFileSync(path.join(args[args.indexOf('--cwd') + 1], 'started.log'), JSON.stringify(args) + '\\n')
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

    // The child got the prompt as one word plus the headless + workspace flags.
    let lines: string[] = []
    for (let i = 0; i < 100 && lines.length < 1; i++) {
      await new Promise(r => setTimeout(r, 20))
      lines = await readFile(join(cwd, 'started.log'), 'utf8').then(
        s => s.split('\n').filter(Boolean),
        () => [],
      )
    }
    assert.deepEqual(JSON.parse(lines[0]!), ['a blog', '--no-dashboard', '--cwd', cwd])

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

test('sendStart kind=research spawns the research subcommand, defaulting the what (#331)', async () => {
  const cwd = await tmpWorkspace()
  const stub = join(cwd, 'stub-cli.cjs')
  await writeFile(
    stub,
    `const fs = require('node:fs'), path = require('node:path')
const args = process.argv.slice(2)
fs.appendFileSync(path.join(args[args.indexOf('--cwd') + 1], 'started.log'), JSON.stringify(args) + '\\n')
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
    assert.deepEqual(JSON.parse(lines[0]!), ['research', 'the auth flow', '--no-dashboard', '--cwd', cwd])

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
    assert.deepEqual(JSON.parse(lines[1]!), ['research', '--no-dashboard', '--cwd', cwd])

    // kind=prompt (#353): a preset the user reviewed in the textarea runs verbatim
    // through the `prompt` subcommand, never re-rendered.
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
    assert.deepEqual(JSON.parse(lines[2]!), ['prompt', verbatim, '--no-dashboard', '--cwd', cwd])

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

    // The dashboard steers over Telefunc: sendStop / sendChoice append to control.jsonl.
    const id = homeId(cwd)
    await callTelefunc(state.url, '/server/control.telefunc.ts', 'sendStop', [id])
    await callTelefunc(state.url, '/server/control.telefunc.ts', 'sendChoice', [id, 'plan-approval', 'alt:0', 'user'])

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

test('startOptionFlags passes the ticket a run implements, and only a real one (#1117)', () => {
  assert.deepEqual(startOptionFlags({ ticket: 'tickets/2026-07-25_login.md' }), ['--ticket', 'tickets/2026-07-25_login.md'])
  // Nothing said = the run implements no particular ticket, which is every hand-written prompt.
  assert.deepEqual(startOptionFlags({}), [])
  // The value comes off a queue file an agent writes, so it is checked here as well as on the way
  // in: a path that is not a ticket never becomes a flag.
  for (const bad of ['tickets/../etc/passwd', '/etc/passwd', 'TODO_AGENTS.md', '']) {
    assert.deepEqual(startOptionFlags({ ticket: bad }), [], `expected ${bad} to be dropped`)
  }
  // A planning run says so (#1327): the flag is what keeps its PR title from inheriting the
  // ticket's issue as `(fix #42)` and closing it with the work still undone.
  assert.deepEqual(startOptionFlags({ ticket: 'tickets/2026-07-25_login.md', planRun: true }), [
    '--ticket',
    'tickets/2026-07-25_login.md',
    '--plan-run',
  ])
})

test('startOptionFlags forwards the pinned queue entry verbatim, and drops a blank one (#1253)', () => {
  assert.deepEqual(startOptionFlags({ queueEntry: 'Fix the flaky teardown test' }), [
    '--queue-entry',
    'Fix the flaky teardown test',
  ])
  assert.deepEqual(startOptionFlags({ queueEntry: '   ' }), [])
})
