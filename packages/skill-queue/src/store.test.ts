import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nodeGitRunner, fileBranchPath, DATA_BRANCH } from '@gemstack/agent-data'
import { syncQueue } from './store.js'
import { QUEUE_FILE } from './names.js'

const git = nodeGitRunner()
const RETRIED_RM = { recursive: true, force: true, maxRetries: 10 } as const

async function repo(): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'queue-store-')))
  await git(['init', '-b', 'main'], path)
  await git(['config', 'user.email', 't@t'], path)
  await git(['config', 'user.name', 't'], path)
  await writeFile(join(path, 'README.md'), '# t\n')
  await git(['add', '-A'], path)
  await git(['commit', '-m', 'init'], path)
  return path
}

test('sync births the branch, seeds the queue, and names a repo with no remote', async () => {
  const root = await repo()
  try {
    const result = await syncQueue(root)
    assert.ok(!result.ok && /no remote/.test(result.error), 'a repo nothing can reach is an error state, said')
    const wt = fileBranchPath(root, DATA_BRANCH)
    assert.equal((await git(['rev-parse', '--abbrev-ref', 'HEAD'], wt)).trim(), DATA_BRANCH)
    // Seeded and committed, so the checkout is clean between cycles.
    assert.equal(await readFile(join(wt, QUEUE_FILE), 'utf8'), '')
    assert.match(await git(['log', '-1', '--format=%s', `refs/heads/${DATA_BRANCH}`], root), /^seed the queue/)
    assert.equal((await git(['status', '--porcelain'], wt)).trim(), '')
    // Idempotent: a second sync seeds nothing new, and a queue written since is left as it is.
    await writeFile(join(wt, QUEUE_FILE), '- by hand\n')
    await git(['commit', '-am', 'by hand'], wt)
    await syncQueue(root)
    assert.match(await git(['log', '-1', '--format=%s', `refs/heads/${DATA_BRANCH}`], root), /^by hand$/m)
    assert.equal(await readFile(join(wt, QUEUE_FILE), 'utf8'), '- by hand\n')
  } finally {
    await rm(root, RETRIED_RM)
  }
})

test('sync converges with origin: the branch origin has is adopted, and a pushed change is read on the next sync', async () => {
  const root = await repo()
  const bare = await realpath(await mkdtemp(join(tmpdir(), 'queue-store-bare-')))
  const otherParent = await realpath(await mkdtemp(join(tmpdir(), 'queue-store-other-')))
  try {
    await git(['init', '--bare', bare], bare)
    await git(['remote', 'add', 'origin', bare], root)
    await git(['push', 'origin', 'main'], root)
    assert.deepEqual(await syncQueue(root), { ok: true })
    // Another machine clones and pushes an entry straight onto the branch.
    const other = join(otherParent, 'clone')
    await git(['clone', bare, other], otherParent)
    await git(['config', 'user.email', 'o@o'], other)
    await git(['config', 'user.name', 'o'], other)
    await git(['checkout', '-B', DATA_BRANCH, `origin/${DATA_BRANCH}`], other)
    await writeFile(join(other, QUEUE_FILE), '- from elsewhere\n')
    await git(['add', '-A'], other)
    await git(['commit', '-m', 'queue add: from elsewhere'], other)
    await git(['push', 'origin', DATA_BRANCH], other)
    assert.deepEqual(await syncQueue(root), { ok: true })
    assert.equal(await readFile(join(fileBranchPath(root, DATA_BRANCH), QUEUE_FILE), 'utf8'), '- from elsewhere\n')
  } finally {
    for (const dir of [root, bare, otherParent]) await rm(dir, RETRIED_RM)
  }
})
