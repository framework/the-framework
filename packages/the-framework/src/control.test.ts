import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { appendFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FRAMEWORK_DIR } from './store/run-store.js'
import {
  appendControl,
  controlPath,
  resetControl,
  watchControl,
  type ControlEntry,
} from './control.js'

async function tmpWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'framework-control-'))
}

/** Poll until the predicate holds or the timeout passes. */
async function until(check: () => boolean, timeoutMs = 3000): Promise<boolean> {
  for (let waited = 0; waited < timeoutMs; waited += 20) {
    if (check()) return true
    await new Promise(r => setTimeout(r, 20))
  }
  return check()
}

test('appendControl + watchControl deliver entries in order', async () => {
  const cwd = await tmpWorkspace()
  const seen: ControlEntry[] = []
  const watcher = watchControl(cwd, e => seen.push(e), 20)
  try {
    await appendControl(cwd, { kind: 'stop' })
    await appendControl(cwd, { kind: 'choice', id: 'plan-approval', pick: 'proceed', by: 'user' })
    await appendControl(cwd, { kind: 'choice', id: 'await-multiselect', pick: ['opt:0', 'opt:2'], by: 'autopilot' })

    assert.ok(await until(() => seen.length === 3), `saw ${seen.length} of 3 entries`)
    assert.deepEqual(seen[0], { kind: 'stop' })
    assert.deepEqual(seen[1], { kind: 'choice', id: 'plan-approval', pick: 'proceed', by: 'user' })
    assert.deepEqual(seen[2], { kind: 'choice', id: 'await-multiselect', pick: ['opt:0', 'opt:2'], by: 'autopilot' })
  } finally {
    watcher.close()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resetControl truncates so a previous run\'s picks never replay', async () => {
  const cwd = await tmpWorkspace()
  try {
    await appendControl(cwd, { kind: 'choice', id: 'plan-approval', pick: 'alt:0', by: 'user' })
    await resetControl(cwd)
    assert.equal(await readFile(controlPath(cwd), 'utf8'), '')

    // A watcher started after the reset (a fresh run) only sees new entries.
    const seen: ControlEntry[] = []
    const watcher = watchControl(cwd, e => seen.push(e), 20)
    try {
      await appendControl(cwd, { kind: 'stop' })
      assert.ok(await until(() => seen.length === 1))
      assert.deepEqual(seen, [{ kind: 'stop' }])
    } finally {
      watcher.close()
    }
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('watchControl skips malformed and unknown lines', async () => {
  const cwd = await tmpWorkspace()
  const seen: ControlEntry[] = []
  const watcher = watchControl(cwd, e => seen.push(e), 20)
  try {
    await resetControl(cwd)
    await appendFile(
      controlPath(cwd),
      'not json\n' +
        JSON.stringify({ kind: 'reboot' }) + '\n' +
        JSON.stringify({ kind: 'choice', id: '', pick: 'x' }) + '\n' + // empty id -> dropped
        JSON.stringify({ kind: 'choice', id: 'g', pick: 42 }) + '\n' + // bad pick -> dropped
        JSON.stringify({ kind: 'choice', id: 'g', pick: [], by: 'user' }) + '\n', // empty multi pick is legit
    )
    assert.ok(await until(() => seen.length === 1), `saw ${seen.length}`)
    assert.deepEqual(seen, [{ kind: 'choice', id: 'g', pick: [], by: 'user' }])
  } finally {
    watcher.close()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('watchControl delivers live-chat messages and drops empty ones (#714)', async () => {
  const cwd = await tmpWorkspace()
  const seen: ControlEntry[] = []
  const watcher = watchControl(cwd, e => seen.push(e), 20)
  try {
    await resetControl(cwd)
    await appendFile(
      controlPath(cwd),
      JSON.stringify({ kind: 'message', text: 'also add dark mode' }) + '\n' +
        JSON.stringify({ kind: 'message', text: '' }) + '\n' + // empty -> dropped
        JSON.stringify({ kind: 'message' }) + '\n', // missing text -> dropped
    )
    assert.ok(await until(() => seen.length === 1), `saw ${seen.length}`)
    assert.deepEqual(seen, [{ kind: 'message', text: 'also add dark mode' }])
  } finally {
    watcher.close()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a message carries the surface it came through, and a forged one is dropped (#917)', async () => {
  const cwd = await tmpWorkspace()
  const seen: ControlEntry[] = []
  const watcher = watchControl(cwd, e => seen.push(e), 20)
  try {
    await resetControl(cwd)
    await appendFile(
      controlPath(cwd),
      JSON.stringify({ kind: 'message', text: 'from discord', via: 'discord' }) + '\n' +
        // An entry written before #917 still parses, and is simply unattributed.
        JSON.stringify({ kind: 'message', text: 'older entry' }) + '\n' +
        // A via carrying the heading separator would forge a conversation heading (#897): dropped.
        JSON.stringify({ kind: 'message', text: 'forged', via: 'discord \u00b7 user \u00b7 x' }) + '\n' +
        JSON.stringify({ kind: 'message', text: 'newline', via: 'a\nb' }) + '\n' +
        JSON.stringify({ kind: 'message', text: 'not a string', via: 7 }) + '\n',
    )
    assert.ok(await until(() => seen.length === 2), `saw ${seen.length}`)
    assert.deepEqual(seen, [
      { kind: 'message', text: 'from discord', via: 'discord' },
      { kind: 'message', text: 'older entry' },
    ])
  } finally {
    watcher.close()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a handoff entry needs both booleans, so a half-written line cannot disarm a session (#1102)', async () => {
  const dir = await tmpWorkspace()
  try {
    await resetControl(dir)
    const seen: ControlEntry[] = []
    const watcher = watchControl(dir, entry => seen.push(entry), 20)
    try {
      // Malformed first: a missing rung, or one that names nothing, must be dropped rather than
      // coerced. Getting this wrong would silently stop a session publishing its work.
      await appendFile(controlPath(dir), JSON.stringify({ kind: 'handoff' }) + '\n')
      await appendFile(controlPath(dir), JSON.stringify({ kind: 'handoff', level: 'publish' }) + '\n')
      // And the pair this replaced (B5) is not a rung either, so a stale writer disarms nothing.
      await appendFile(controlPath(dir), JSON.stringify({ kind: 'handoff', push: true, pr: false }) + '\n')
      await appendControl(dir, { kind: 'handoff', level: 'push' })
      assert.ok(await until(() => seen.length > 0), 'the well-formed entry never arrived')
      assert.deepEqual(seen, [{ kind: 'handoff', level: 'push' }])
    } finally {
      watcher.close()
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

/**
 * The committed half of `.the-framework/` (#313/#857): the ignore file, the session list, the
 * conversations, and each user's session history. Everything else in there is runtime state that
 * belongs to one machine and one moment.
 */
function isCommittedFrameworkFile(path: string): boolean {
  const rest = path.slice(path.indexOf(`${FRAMEWORK_DIR}/`) + FRAMEWORK_DIR.length + 1)
  if (rest === '.gitignore' || rest === 'LOGS.md') return true
  if (rest.startsWith('conversations/')) return true
  const [, sessions] = rest.split('/')
  return sessions === 'sessions'
}

test('no runtime state under .the-framework is tracked in git (#1298/#1311)', async () => {
  // #1311 untracked `control.jsonl` and added nothing to keep it untracked, so eighteen hours
  // later a run's own branch committed an empty one straight back onto main (#1309). The rule is
  // wider than that one file: `.the-framework/` is transient except the committed DB, and a
  // tracked run.json or events.jsonl would churn every checkout the same way.
  const { execFileSync } = await import('node:child_process')
  const git = (args: string[], cwd: string): string => execFileSync('git', args, { cwd, encoding: 'utf8' })

  let root: string
  try {
    root = git(['rev-parse', '--show-toplevel'], process.cwd()).trim()
  } catch {
    return // not a git checkout (an installed package, say): there is nothing to guard here
  }

  const tracked = git(['ls-files'], root)
    .split('\n')
    .filter(path => path.includes(`${FRAMEWORK_DIR}/`))
    .filter(path => !isCommittedFrameworkFile(path))

  assert.deepEqual(tracked, [], `runtime state is tracked:\n${tracked.join('\n')}`)
})

test('a merge entry round-trips the control log (#1391)', async () => {
  const cwd = await tmpWorkspace()
  const seen: ControlEntry[] = []
  const watcher = watchControl(cwd, e => seen.push(e), 20)
  try {
    await appendControl(cwd, { kind: 'merge' })
    assert.ok(await until(() => seen.length === 1), `saw ${seen.length} of 1 entries`)
    assert.deepEqual(seen[0], { kind: 'merge' })
  } finally {
    watcher.close()
    await rm(cwd, { recursive: true, force: true })
  }
})
