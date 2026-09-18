import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProjectRuntime } from './daemon-runtime.js'
import { PROJECT_HOOKS_FILE } from './project-hooks.js'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'
import { addProject } from './registry.js'

// A Start, as the daemon does it (#1774): the project's own start hook line, nothing else. The
// relay half of onStart has its own loopback test (dashboard/remote-run.integration.test.ts).

async function project(hooks?: string): Promise<string> {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'framework-runtime-')))
  await mkdir(join(cwd, THE_FRAMEWORK_DIR), { recursive: true })
  if (hooks !== undefined) await writeFile(join(cwd, PROJECT_HOOKS_FILE), hooks)
  return cwd
}

const START = `start: 'printf "%s|%s|%s" "$PROMPT" "\${DRIVER-unset}" "\${MODEL-unset}" > started.txt; echo "{\\"id\\":\\"run-7\\"}"'\n`

test('onStart runs the start hook of the project addressed, home or registered, and answers the run the hook began', async () => {
  const home = await project(START)
  const other = await project(START)
  const env = { XDG_CONFIG_HOME: join(home, 'cfg') }
  await mkdir(env.XDG_CONFIG_HOME, { recursive: true })
  const record = await addProject(other, new Date().toISOString(), undefined, env)
  const runtime = createProjectRuntime({ cwd: home, env })
  try {
    assert.deepEqual(await runtime.onStart('/work-queue', { driver: 'codex', model: 'gpt-5' }), { ok: true, agentId: 'run-7' })
    assert.equal(await readFile(join(home, 'started.txt'), 'utf8'), '/work-queue|codex|gpt-5')
    // No picks made: the line's own defaults apply, so neither variable is set.
    assert.deepEqual(await runtime.onStart('Read the docs', {}, record.id), { ok: true, agentId: 'run-7' })
    assert.equal(await readFile(join(other, 'started.txt'), 'utf8'), 'Read the docs|unset|unset')
  } finally {
    await runtime.dispose()
    await rm(home, { recursive: true, force: true })
    await rm(other, { recursive: true, force: true })
  }
})

test('onStart refuses in words: an unknown project, a project with no start line, a line that fails', async () => {
  const home = await project('open:\n  - "true"\n')
  const env = { XDG_CONFIG_HOME: join(home, 'cfg') }
  await mkdir(env.XDG_CONFIG_HOME, { recursive: true })
  const runtime = createProjectRuntime({ cwd: home, env })
  try {
    assert.deepEqual(await runtime.onStart('x', {}, 'no-such-project'), { ok: false, error: 'unknown project: no-such-project' })
    assert.deepEqual(await runtime.onStart('x'), { ok: false, error: 'this project has no start hook' })
    await writeFile(join(home, PROJECT_HOOKS_FILE), 'start: echo "codex is not installed" >&2; exit 1\n')
    assert.deepEqual(await runtime.onStart('x'), { ok: false, error: 'the start hook: codex is not installed' })
  } finally {
    await runtime.dispose()
    await rm(home, { recursive: true, force: true })
  }
})
