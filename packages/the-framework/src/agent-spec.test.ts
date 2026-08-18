import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { readAgentSpec, removeAgentSpec, writeAgentSpec, type AgentSpec } from './agent-spec.js'

const SPEC: AgentSpec = {
  prompt: 'fix the login bug',
  kind: 'build',
  cwd: '/work/app',
  agentId: '2026-08-15T10-00-00-000Z',
  options: { handoff: 'local', model: 'opus', browser: true },
}

test('a spec round-trips through the file, values intact (D4)', async () => {
  const path = await writeAgentSpec(SPEC)
  assert.deepEqual(await readAgentSpec(path), SPEC)
})

test('an explicit value survives, and so does saying nothing (D4)', async () => {
  // As flags this needed a `--no-*` spelling per boolean, because argv has only "present" and
  // "absent". JSON says the value directly, and says nothing when the session means nothing —
  // which is what leaves the repo's the-framework.yml free to decide.
  const off = await readAgentSpec(await writeAgentSpec(SPEC))
  assert.equal(off.options.handoff, 'local')
  const silent = await readAgentSpec(await writeAgentSpec({ ...SPEC, options: {} }))
  assert.equal(silent.options.handoff, undefined)
})

test('reading a spec consumes it: a device token does not outlive the session (D4)', async () => {
  const path = await writeAgentSpec({ ...SPEC, options: { remote: { url: 'https://box', token: 'secret' } } })
  const spec = await readAgentSpec(path)
  assert.equal(spec.options.remote?.token, 'secret')
  assert.equal(await stat(path).then(() => true, () => false), false, 'the file is gone')
  // The whole mkdtemp directory, not just the file: one spec makes one directory, so removing
  // only session.json left one empty directory behind per session, forever.
  assert.equal(await stat(dirname(path)).then(() => true, () => false), false, 'and so is its directory')
})

test('a hand-written spec loses only the file, never the directory the user keeps it in (D4)', async () => {
  // `--agent <path>` accepts any path. Only the directory writeAgentSpec's own prefix names is
  // this module's to remove whole.
  const dir = await mkdtemp(join(tmpdir(), 'my-specs-'))
  try {
    const path = join(dir, 'session.json')
    await writeFile(path, JSON.stringify(SPEC))
    await readAgentSpec(path)
    assert.equal(await stat(path).then(() => true, () => false), false, 'the file is gone')
    assert.equal((await stat(dir)).isDirectory(), true, 'the directory survives')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a spec whose child never ran is removed by the spawner, directory and all (D4)', async () => {
  const path = await writeAgentSpec(SPEC)
  await removeAgentSpec(path)
  assert.equal(await stat(dirname(path)).then(() => true, () => false), false)
})

test('a file that is not a spec is refused rather than half-run (D4)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'framework-spec-'))
  try {
    const path = join(dir, 'session.json')
    await writeFile(path, 'not json')
    await assert.rejects(readAgentSpec(path))
    await writeFile(path, JSON.stringify({ prompt: 'x' })) // no kind, no cwd
    await assert.rejects(readAgentSpec(path), /not a session spec/)
    await assert.rejects(readAgentSpec(join(dir, 'absent.json')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a spec with no options reads as one with empty options, never undefined (D4)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'framework-spec-'))
  try {
    const path = join(dir, 'session.json')
    await writeFile(path, JSON.stringify({ prompt: 'x', kind: 'prompt', cwd: '/w' }))
    assert.deepEqual(await readAgentSpec(path), { prompt: 'x', kind: 'prompt', cwd: '/w', options: {} })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('specs are written somewhere private, one directory each (D4)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'framework-spec-home-'))
  try {
    const first = await writeAgentSpec(SPEC, { FRAMEWORK_SESSION_SPEC_DIR: dir })
    const second = await writeAgentSpec(SPEC, { FRAMEWORK_SESSION_SPEC_DIR: dir })
    assert.notEqual(first, second, 'two concurrent starts never share a spec file')
    assert.ok(first.startsWith(dir))
    // Written as readable JSON: a spawned session that dies is diagnosed from this file.
    assert.match(await readFile(second, 'utf8'), /^\{\n {2}"prompt"/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
