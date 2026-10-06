import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { hostname, tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProjectRuntime } from './daemon-runtime.js'
import { PROJECT_HOOKS_FILE } from './project-hooks.js'
import { OPENAGENT_DIR } from './framework-dir.js'
import { addProject, listProjects } from './registry.js'
import { readSharing } from '@openagt/agent-data'

// A Start, as the daemon does it (#1774): the project's own start hook line, nothing else. The
// relay half of onStart has its own loopback test (dashboard/remote-run.integration.test.ts).

async function project(hooks?: string): Promise<string> {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'framework-runtime-')))
  await mkdir(join(cwd, OPENAGENT_DIR), { recursive: true })
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
  // The add registers through the process's own environment, and a new folder's first commit needs an author.
  const env = { XDG_CONFIG_HOME: cfg, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' }
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]))
  Object.assign(process.env, env)
  const runtime = createProjectRuntime({ cwd: folder, env })
  try {
    assert.deepEqual(await runtime.onAddProject(folder, false), { ok: true, alreadyActivated: false })
    // The person's answer on the agents' records is written with the add: kept on this machine.
    assert.equal(await readSharing(folder), false)
    const written = await readFile(join(folder, PROJECT_HOOKS_FILE), 'utf8')
    for (const key of ['start', 'resume', 'check']) assert.match(written, new RegExp(`^${key}: agent-runner `, 'm'))

    // The person's own line stays; adding the project again fills only what is missing.
    await writeFile(join(folder, PROJECT_HOOKS_FILE), 'start: my-own-tool "$PROMPT"\n')
    // A yes is to the remote that is there: this folder has none, so the records stay kept.
    assert.deepEqual(await runtime.onAddProject(folder, true), { ok: true, alreadyActivated: true, noRemote: true })
    assert.equal(await readSharing(folder), false)
    // With a remote, the same answer shares them from now on.
    execFileSync('git', ['remote', 'add', 'origin', join(cfg, 'origin.git')], { cwd: folder })
    assert.deepEqual(await runtime.onAddProject(folder, true), { ok: true, alreadyActivated: true })
    assert.equal(await readSharing(folder), true)
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

test('removing a project runs its close hooks and takes it off the list, and deletes nothing in its folder; an id not on the list is refused', async () => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'framework-remove-')))
  const cfg = await realpath(await mkdtemp(join(tmpdir(), 'framework-remove-cfg-')))
  const env = { XDG_CONFIG_HOME: cfg, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' }
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]))
  Object.assign(process.env, env)
  // The daemon runs elsewhere: the project is not its own start folder.
  const runtime = createProjectRuntime({ cwd: cfg, env })
  try {
    assert.deepEqual(await runtime.onAddProject(folder, false), { ok: true, alreadyActivated: false })
    const [project] = await listProjects(undefined, env)
    assert.equal(project?.path, folder)
    await writeFile(join(folder, PROJECT_HOOKS_FILE), 'close:\n  - echo closed > closed.txt\n')
    await writeFile(join(folder, 'mine.txt'), 'mine\n')
    const kept = execFileSync('git', ['log', '--format=%H'], { cwd: folder, encoding: 'utf8' })

    assert.deepEqual(await runtime.onRemoveProject('nope-123'), { ok: false, error: 'no project with that id is on the list' })
    assert.equal((await listProjects(undefined, env)).length, 1)

    assert.deepEqual(await runtime.onRemoveProject(project!.id), { ok: true })
    assert.deepEqual(await listProjects(undefined, env), [])
    assert.equal(await readFile(join(folder, 'closed.txt'), 'utf8'), 'closed\n', 'the close line ran, in the project')
    // Nothing of the folder is deleted: the person's file, OpenAgent's directory, the commits.
    assert.equal(await readFile(join(folder, 'mine.txt'), 'utf8'), 'mine\n')
    assert.match(await readFile(join(folder, PROJECT_HOOKS_FILE), 'utf8'), /^close:/)
    assert.equal(execFileSync('git', ['log', '--format=%H'], { cwd: folder, encoding: 'utf8' }), kept)

    // Removed twice: the second time there is no such project.
    assert.deepEqual(await runtime.onRemoveProject(project!.id), { ok: false, error: 'no project with that id is on the list' })
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

test('a project with an agent at work is not removed, a card left "running" by a dead process does not count, and a project whose folder is gone is removed', async () => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'framework-remove-busy-')))
  const cfg = await realpath(await mkdtemp(join(tmpdir(), 'framework-remove-busy-cfg-')))
  const env = { XDG_CONFIG_HOME: cfg, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' }
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]))
  Object.assign(process.env, env)
  const runtime = createProjectRuntime({ cwd: cfg, env })
  try {
    assert.deepEqual(await runtime.onAddProject(folder, false), { ok: true, alreadyActivated: false })
    const [project] = await listProjects(undefined, env)
    // A run's checkout with its live card: this process stands in for the agent at work.
    const id = '2026-10-06T10-00-00-000Z'
    const checkout = join(folder, '.branches', `agent-${id}`)
    execFileSync('git', ['worktree', 'add', '-q', '-b', `agent-${id}`, checkout], { cwd: folder })
    await mkdir(join(checkout, '.openagent'), { recursive: true })
    const card = (pid: number): string => JSON.stringify({ id, status: 'running', startedAt: '2026-10-06T10:00:00.000Z', intent: 'x', caller: { pid, host: hostname() } })
    await writeFile(join(checkout, '.openagent', `${id}.json`), card(process.pid))

    assert.deepEqual(await runtime.onRemoveProject(project!.id), { ok: false, error: 'An agent is working in this project. Stop it, then remove the project.' })
    assert.equal((await listProjects(undefined, env)).length, 1, 'still on the list')

    // The process died and nothing healed the card: nothing is working there.
    await writeFile(join(checkout, '.openagent', `${id}.json`), card(2 ** 31 - 1))
    assert.deepEqual(await runtime.onRemoveProject(project!.id), { ok: true })
    assert.deepEqual(await listProjects(undefined, env), [])

    // A project whose folder was deleted by hand can still be taken off the list.
    assert.deepEqual(await runtime.onAddProject(folder, false), { ok: true, alreadyActivated: true })
    await rm(folder, { recursive: true, force: true })
    assert.deepEqual(await runtime.onRemoveProject(project!.id), { ok: true })
    assert.deepEqual(await listProjects(undefined, env), [])
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
