import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
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

test('a Start goes no further than the project can, the commit with no remote, the branch with a remote and no git host; with no pick it goes that far, and with Nothing it is given no level', async () => {
  const PUBLISH = `start: 'printf "%s" "\${PUBLISH-unset}" > started.txt; echo "{\\"id\\":\\"run-8\\"}"'\n`
  const home = await project(PUBLISH)
  const env = { XDG_CONFIG_HOME: join(home, 'cfg') }
  await mkdir(env.XDG_CONFIG_HOME, { recursive: true })
  const runtime = createProjectRuntime({ cwd: home, env })
  try {
    execFileSync('git', ['init', '-q'], { cwd: home })
    assert.deepEqual(await runtime.onStart('Fix it', { publish: 'merge' }), { ok: true, agentId: 'run-8' })
    assert.equal(await readFile(join(home, 'started.txt'), 'utf8'), 'commit', 'no remote: the commit')
    // No pick saved: the daemon starts the run as far as the project goes with no pull request.
    assert.deepEqual(await runtime.onStart('Fix it'), { ok: true, agentId: 'run-8' })
    assert.equal(await readFile(join(home, 'started.txt'), 'utf8'), 'commit', 'no pick, no remote: the commit')
    // Nothing is a pick: the line is given no level.
    assert.deepEqual(await runtime.onStart('Fix it', { publish: 'nothing' }), { ok: true, agentId: 'run-8' })
    assert.equal(await readFile(join(home, 'started.txt'), 'utf8'), 'unset', 'Nothing saved: no level')
    execFileSync('git', ['remote', 'add', 'origin', 'https://example.com/x.git'], { cwd: home })
    assert.deepEqual(await runtime.onStart('Fix it', { publish: 'merge' }), { ok: true, agentId: 'run-8' })
    assert.equal(await readFile(join(home, 'started.txt'), 'utf8'), 'branch', 'a remote and no git host: the branch')
    assert.deepEqual(await runtime.onStart('Fix it'), { ok: true, agentId: 'run-8' })
    assert.equal(await readFile(join(home, 'started.txt'), 'utf8'), 'branch', 'no pick, a remote: the branch')
    assert.deepEqual(await runtime.onStart('Fix it', { publish: 'commit' }), { ok: true, agentId: 'run-8' })
    assert.equal(await readFile(join(home, 'started.txt'), 'utf8'), 'commit', 'Commit saved: the commit, the remote or not')
  } finally {
    await runtime.dispose()
    await rm(home, { recursive: true, force: true })
  }
})

test('a Start hands the line the branch to start from, and refuses a word that is no branch name before the line runs', async () => {
  const BASE = `start: 'printf "%s" "\${BASE-unset}" > started.txt; echo "{\\"id\\":\\"run-9\\"}"'\n`
  const home = await project(BASE)
  const env = { XDG_CONFIG_HOME: join(home, 'cfg') }
  await mkdir(env.XDG_CONFIG_HOME, { recursive: true })
  const runtime = createProjectRuntime({ cwd: home, env })
  try {
    assert.deepEqual(await runtime.onStart('Fix it', { base: 'my/branch' }), { ok: true, agentId: 'run-9' })
    assert.equal(await readFile(join(home, 'started.txt'), 'utf8'), 'my/branch')
    assert.deepEqual(await runtime.onStart('Fix it'), { ok: true, agentId: 'run-9' })
    assert.equal(await readFile(join(home, 'started.txt'), 'utf8'), 'unset', 'no pick: the line is given no branch')
    await rm(join(home, 'started.txt'))
    assert.deepEqual(await runtime.onStart('Fix it', { base: '--upload-pack=x' }), { ok: false, error: 'not a branch name: --upload-pack=x' })
    assert.deepEqual(await runtime.onStart('Fix it', { base: '' }), { ok: false, error: 'not a branch name: ' })
    await assert.rejects(readFile(join(home, 'started.txt'), 'utf8'), 'the line did not run')
  } finally {
    await runtime.dispose()
    await rm(home, { recursive: true, force: true })
  }
})

test('adding a project writes the runner\'s start, resume and check lines, an empty folder included, and keeps a line already there', async () => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'framework-add-')))
  const cfg = await realpath(await mkdtemp(join(tmpdir(), 'framework-add-cfg-')))
  // The add registers through the process's own environment, and its commit needs an author.
  const env = { XDG_CONFIG_HOME: cfg, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' }
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]))
  Object.assign(process.env, env)
  const runtime = createProjectRuntime({ cwd: folder, env })
  try {
    assert.deepEqual(await runtime.onAddProject(folder), { ok: true, alreadyActivated: false })
    const written = await readFile(join(folder, PROJECT_HOOKS_FILE), 'utf8')
    for (const key of ['start', 'resume', 'check']) assert.match(written, new RegExp(`^${key}: agent-runner `, 'm'))

    // The person's own line stays; adding the project again fills only what is missing.
    await writeFile(join(folder, PROJECT_HOOKS_FILE), 'start: my-own-tool "$PROMPT"\n')
    assert.deepEqual(await runtime.onAddProject(folder), { ok: true, alreadyActivated: true })
    const again = await readFile(join(folder, PROJECT_HOOKS_FILE), 'utf8')
    assert.match(again, /^start: my-own-tool "\$PROMPT"$/m)
    assert.match(again, /^resume: agent-runner /m)
  } finally {
    await runtime.dispose()
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(folder, { recursive: true, force: true })
    await rm(cfg, { recursive: true, force: true })
  }
})
