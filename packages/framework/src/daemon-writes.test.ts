import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { DATA_BRANCH, withFileBranch } from '@gemstack/agent-data'
import { DAEMON_TRAILER, daemonFunnel, dataHead, foreignCommits } from './daemon-writes.js'

const git = promisify(execFile)

// The mark that keeps the daemon from reacting to itself (#1774): every automatic write is a
// commit signed `Daemon: <host>`, and the trigger counts only the commits without it. Real git,
// because what is asserted is what git prints for a trailer.

async function repo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'framework-daemon-writes-'))
  await git('git', ['init', '-q', '-b', 'main'], { cwd: dir })
  await git('git', ['config', 'user.email', 'test@example.com'], { cwd: dir })
  await git('git', ['config', 'user.name', 'Test'], { cwd: dir })
  await git('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir })
  return dir
}

test('a repository with no data branch yet has no head to read', async () => {
  const dir = await repo()
  try {
    assert.equal(await dataHead(dir), undefined)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("the daemon's funnel signs its commits, and only unsigned commits count as moves (#1774)", async () => {
  const dir = await repo()
  try {
    // Someone queued work: a plain write through the skills' own funnel, no trailer.
    const seeded = await withFileBranch(dir, DATA_BRANCH, 'queue add: fix the login page', async d => writeFile(join(d, 'TODO_AGENTS.md'), '- fix the login page\n'))
    assert.ok(seeded.ok)
    const before = await dataHead(dir)
    assert.ok(before, 'the branch exists once written')
    // The daemon recorded a run: signed.
    const recorded = await daemonFunnel('build-box')(dir, 'logs: record run 2026-09-13T10-00-00-000Z', async d => writeFile(join(d, 'agents.json'), '{}\n'))
    assert.ok(recorded.ok)
    const afterRecord = await dataHead(dir)
    assert.notEqual(afterRecord, before, 'the record is a commit')
    const message = (await git('git', ['log', '-1', '--format=%B', `refs/heads/${DATA_BRANCH}`], { cwd: dir })).stdout
    assert.match(message, /^logs: record run 2026-09-13T10-00-00-000Z\n\nDaemon: build-box\n/, 'the trailer is the last line, after a blank one')
    assert.equal(await foreignCommits(dir, before!, afterRecord!), 0, "the daemon's own commit is not a move")
    // Then an agent closed its ticket: unsigned.
    const closed = await withFileBranch(dir, DATA_BRANCH, 'tickets close: login', async d => writeFile(join(d, 'TODO_AGENTS.md'), ''))
    assert.ok(closed.ok)
    const afterClose = await dataHead(dir)
    assert.equal(await foreignCommits(dir, before!, afterClose!), 1, 'one of the two commits since is a move')
    assert.equal(await foreignCommits(dir, afterRecord!, afterClose!), 1)
    // A message whose body mentions the key in prose is not a trailer.
    const prose = await withFileBranch(dir, DATA_BRANCH, `queue add: mention the ${DAEMON_TRAILER} in a sentence`, async d => writeFile(join(d, 'TODO_AGENTS.md'), '- x\n'))
    assert.ok(prose.ok)
    assert.equal(await foreignCommits(dir, afterClose!, (await dataHead(dir))!), 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a range git cannot walk counts as no move: the heartbeat is the belt for it', async () => {
  const dir = await repo()
  try {
    await withFileBranch(dir, DATA_BRANCH, 'seed', async d => writeFile(join(d, 'a'), 'a'))
    assert.equal(await foreignCommits(dir, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', (await dataHead(dir))!), 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
