import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileBranchPath, withFileBranch } from '@gemstack/agent-data'
import { LOGS_BRANCH } from './framework-dir.js'
import { patchArchivedAgentOnDataBranch } from './archived-agent-patch.js'

const git = promisify(execFile)

/** A real repo with a bare origin and one archived run seeded on the data branch. */
async function repoWithArchive(): Promise<{ project: string; cleanup: () => Promise<void> }> {
  const project = await mkdtemp(join(tmpdir(), 'framework-archive-patch-'))
  const origin = await mkdtemp(join(tmpdir(), 'framework-archive-patch-origin-'))
  await git('git', ['init', '-q', '--bare'], { cwd: origin })
  await git('git', ['init', '-q', '-b', 'main'], { cwd: project })
  await git('git', ['config', 'user.email', 'test@example.com'], { cwd: project })
  await git('git', ['config', 'user.name', 'Test'], { cwd: project })
  await git('git', ['config', 'commit.gpgsign', 'false'], { cwd: project })
  await git('git', ['remote', 'add', 'origin', origin], { cwd: project })
  const seeded = await withFileBranch(project, LOGS_BRANCH, 'seed', async dir => {
    await mkdir(join(dir, 'agents', 'u'), { recursive: true })
    const meta = { version: 1, status: 'done', id: 'r1', startedAt: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T10:00:00.000Z', branch: 'agent-r1' }
    await writeFile(join(dir, 'agents', 'u', 'r1.json'), JSON.stringify(meta))
    await writeFile(join(dir, 'agents', 'u', 'r1.jsonl'), '')
  })
  assert.ok(seeded.ok && seeded.pushed, 'the fixture archive must land on origin')
  return {
    project,
    cleanup: async () => {
      await rm(project, { recursive: true, force: true })
      await rm(origin, { recursive: true, force: true })
    },
  }
}

test('an archive patch lands as a commit on the data branch, pushed, leaving the checkout clean (#1601)', async () => {
  const { project, cleanup } = await repoWithArchive()
  try {
    const dir = fileBranchPath(project, LOGS_BRANCH)
    assert.equal(
      await patchArchivedAgentOnDataBranch(project, 'r1', { branch: 'claude/fix-it', pr: { number: 7, url: 'https://x/pull/7' } }, '[The Framework] adopt r1'),
      true,
    )
    const meta = JSON.parse(await readFile(join(dir, 'agents', 'u', 'r1.json'), 'utf8')) as { branch: string; pr: { number: number } }
    assert.equal(meta.branch, 'claude/fix-it')
    assert.equal(meta.pr.number, 7)
    // Committed, not merely written: a dirty checkout is what the next sync hard-resets.
    assert.equal((await git('git', ['status', '--porcelain'], { cwd: dir })).stdout.trim(), '')
    assert.equal((await git('git', ['log', '-1', '--format=%s'], { cwd: dir })).stdout.trim(), '[The Framework] adopt r1')
    assert.equal((await git('git', ['rev-list', '--count', `origin/${LOGS_BRANCH}..${LOGS_BRANCH}`], { cwd: dir })).stdout.trim(), '0', 'and pushed')
    // The sync the daemon runs a minute later keeps it.
    await withFileBranch(project, LOGS_BRANCH, 'sync', async () => {})
    const after = JSON.parse(await readFile(join(dir, 'agents', 'u', 'r1.json'), 'utf8')) as { branch: string }
    assert.equal(after.branch, 'claude/fix-it')
  } finally {
    await cleanup()
  }
})

test('a run with no archive is reported as not patched, and nothing is committed (#1601)', async () => {
  const { project, cleanup } = await repoWithArchive()
  try {
    const dir = fileBranchPath(project, LOGS_BRANCH)
    const before = (await git('git', ['rev-parse', 'HEAD'], { cwd: dir })).stdout.trim()
    assert.equal(await patchArchivedAgentOnDataBranch(project, 'nope', { branch: 'claude/x' }, '[The Framework] adopt nope'), false)
    assert.equal((await git('git', ['rev-parse', 'HEAD'], { cwd: dir })).stdout.trim(), before)
  } finally {
    await cleanup()
  }
})
