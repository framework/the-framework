import { strict as assert } from 'node:assert'
import { mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { realpath } from 'node:fs/promises'
import { test } from 'node:test'
import { nodeGitRunner } from '@better-skills/branch-management'
import { DATA_BRANCH, dataWorktreePath, ensureDataWorktree, pullDataBranch, withDataBranch } from './data-branch.js'
import { DATA_CHECKOUT_DIR } from './framework-dir.js'

const git = nodeGitRunner()

/** Retried rm, the daemon-workspace suite's cure for the macOS ENOTEMPTY teardown race. */
const RETRIED_RM = { recursive: true, force: true, maxRetries: 10 } as const

/** A committed git repo, path realpath'd so it matches what git reports. */
async function initRepo(prefix: string): Promise<string> {
  const repo = await realpath(await mkdtemp(join(tmpdir(), prefix)))
  await git(['init', '-b', 'main'], repo)
  await git(['config', 'user.email', 't@t'], repo)
  await git(['config', 'user.name', 't'], repo)
  await writeFile(join(repo, 'README.md'), '# t\n')
  await git(['add', '-A'], repo)
  await git(['commit', '-m', 'init'], repo)
  return repo
}

/** A repo wired to a bare origin, plus a second clone acting as "another machine". */
async function initSyncedRepos(): Promise<{ repo: string; bare: string; other: string; cleanup: () => Promise<void> }> {
  const repo = await initRepo('framework-data-repo-')
  const bare = await realpath(await mkdtemp(join(tmpdir(), 'framework-data-bare-')))
  await git(['init', '--bare', bare], bare)
  await git(['remote', 'add', 'origin', bare], repo)
  await git(['push', 'origin', 'main'], repo)
  const otherParent = await realpath(await mkdtemp(join(tmpdir(), 'framework-data-other-')))
  const other = join(otherParent, 'clone')
  await git(['clone', bare, other], otherParent)
  await git(['config', 'user.email', 'o@o'], other)
  await git(['config', 'user.name', 'o'], other)
  const cleanup = async () => {
    for (const dir of [repo, bare, otherParent]) await rm(dir, RETRIED_RM)
  }
  return { repo, bare, other, cleanup }
}

/** Commit a file onto the data branch from the second clone and push it, like another machine would. */
async function otherMachineWrites(other: string, file: string, content: string): Promise<void> {
  const onOrigin = await git(['fetch', 'origin', DATA_BRANCH], other).then(
    () => true,
    () => false,
  )
  if (onOrigin) await git(['checkout', '-B', DATA_BRANCH, `origin/${DATA_BRANCH}`], other)
  else {
    const tree = (await git(['hash-object', '-t', 'tree', '/dev/null'], other).catch(() => '')).trim()
    const empty = tree || '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
    const commit = (await git(['commit-tree', empty, '-m', 'born elsewhere'], other)).trim()
    await git(['checkout', '-B', DATA_BRANCH, commit], other)
  }
  await writeFile(join(other, file), content)
  await git(['add', '-A'], other)
  await git(['commit', '-m', `other: ${file}`], other)
  await git(['push', 'origin', `${DATA_BRANCH}:${DATA_BRANCH}`], other)
}

test('ensure births the branch parentless, checks it out, seeds the queue, links tickets/', async () => {
  const repo = await initRepo('framework-data-solo-')
  try {
    assert.deepEqual(await ensureDataWorktree(repo), { ok: true })
    const wt = dataWorktreePath(repo)
    assert.equal((await git(['rev-parse', '--abbrev-ref', 'HEAD'], wt)).trim(), DATA_BRANCH)
    // Parentless: the data history shares no commit with the code history.
    await assert.rejects(git(['merge-base', DATA_BRANCH, 'main'], repo))
    assert.equal(await readFile(join(wt, 'TODO_AGENTS.md'), 'utf8'), '')
    // The root symlink reaches into the checkout, relatively, so a moved repo keeps working.
    assert.equal(await readlink(join(repo, 'tickets')), join(DATA_CHECKOUT_DIR, 'tickets'))
    // The link is hidden from git, so no sweeping `git add -A` ever commits it onto a code branch.
    const status = await git(['status', '--porcelain'], repo)
    assert.ok(!status.split('\n').some(line => line.trim() === '?? tickets'), status)
    // ...while the data checkout's real tickets/ stays committable — the exclude speaks for every
    // worktree, and it must never swallow the branch's own cargo.
    await mkdir(join(wt, 'tickets'), { recursive: true })
    await writeFile(join(wt, 'tickets', 't.md'), 'x\n')
    await git(['add', '-A'], wt)
    await git(['commit', '-m', 't'], wt)
    assert.equal((await git(['show', `${DATA_BRANCH}:tickets/t.md`], repo)).trim(), 'x')
    // Idempotent: a second ensure changes nothing and still reports ok.
    assert.deepEqual(await ensureDataWorktree(repo), { ok: true })
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('ensure leaves a pre-existing tickets/ path alone', async () => {
  const repo = await initRepo('framework-data-tickets-')
  try {
    await writeFile(join(repo, 'tickets'), 'mine\n')
    assert.deepEqual(await ensureDataWorktree(repo), { ok: true })
    assert.equal(await readFile(join(repo, 'tickets'), 'utf8'), 'mine\n')
    // The user's own path stays theirs all the way: still visible to git, not excluded.
    const status = await git(['status', '--porcelain'], repo)
    assert.ok(status.split('\n').some(line => line.trim() === '?? tickets'), status)
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('ensure adopts the branch origin already has instead of birthing a second history', async () => {
  const { repo, other, cleanup } = await initSyncedRepos()
  try {
    await otherMachineWrites(other, 'TODO_AGENTS.md', '- [ ] from the other machine\n')
    assert.deepEqual(await ensureDataWorktree(repo), { ok: true })
    const wt = dataWorktreePath(repo)
    assert.equal(await readFile(join(wt, 'TODO_AGENTS.md'), 'utf8'), '- [ ] from the other machine\n')
  } finally {
    await cleanup()
  }
})

test('a write commits on the data branch, pushes it, and leaves main untouched', async () => {
  const { repo, bare, cleanup } = await initSyncedRepos()
  try {
    const mainBefore = (await git(['rev-parse', 'main'], repo)).trim()
    const result = await withDataBranch(repo, '[The Framework] queue a ticket', async dir => {
      await writeFile(join(dir, 'TODO_AGENTS.md'), '- [ ] queued\n')
    })
    assert.deepEqual(result, { ok: true, changed: true, pushed: true })
    assert.equal(await git(['show', `${DATA_BRANCH}:TODO_AGENTS.md`], bare), '- [ ] queued\n')
    assert.equal((await git(['rev-parse', 'main'], repo)).trim(), mainBefore)
    // The message is the one the caller gave, so the data history narrates itself.
    assert.match(await git(['log', '-1', '--format=%s', DATA_BRANCH], bare), /queue a ticket/)
  } finally {
    await cleanup()
  }
})

test('an op that writes nothing commits nothing', async () => {
  const repo = await initRepo('framework-data-noop-')
  try {
    await ensureDataWorktree(repo)
    const before = (await git(['rev-parse', DATA_BRANCH], repo)).trim()
    assert.deepEqual(await withDataBranch(repo, 'noop', async () => {}), { ok: true, changed: false, pushed: false })
    assert.equal((await git(['rev-parse', DATA_BRANCH], repo)).trim(), before)
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('a write in a remote-less repo lands locally and reports pushed: false', async () => {
  const repo = await initRepo('framework-data-local-')
  try {
    const result = await withDataBranch(repo, 'local write', async dir => {
      await writeFile(join(dir, 'TODO_AGENTS.md'), '- [ ] local\n')
    })
    assert.deepEqual(result, { ok: true, changed: true, pushed: false })
    assert.equal(await git(['show', `${DATA_BRANCH}:TODO_AGENTS.md`], repo), '- [ ] local\n')
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('a write syncs in what another machine pushed, and carries an earlier stranded commit out', async () => {
  const { repo, bare, other, cleanup } = await initSyncedRepos()
  try {
    // An earlier cycle that could not push: a local commit only this machine has.
    await ensureDataWorktree(repo)
    const wt = dataWorktreePath(repo)
    await writeFile(join(wt, 'stranded.md'), 'stranded\n')
    await git(['add', '-A'], wt)
    await git(['commit', '-m', 'stranded local commit'], wt)
    // Meanwhile another machine landed its own file on origin.
    await otherMachineWrites(other, 'theirs.md', 'theirs\n')

    const result = await withDataBranch(repo, 'mine', async dir => {
      await writeFile(join(dir, 'mine.md'), 'mine\n')
    })
    assert.deepEqual(result, { ok: true, changed: true, pushed: true })
    // All three histories converge on origin: theirs, the stranded commit, and this write.
    for (const [file, content] of [['theirs.md', 'theirs\n'], ['stranded.md', 'stranded\n'], ['mine.md', 'mine\n']] as const) {
      assert.equal(await git(['show', `${DATA_BRANCH}:${file}`], bare), content, file)
    }
  } finally {
    await cleanup()
  }
})

test('a conflicting stranded commit resolves toward origin, and the op re-applies the intent', async () => {
  const { repo, bare, other, cleanup } = await initSyncedRepos()
  try {
    // Both sides rewrote the same file: origin's copy must win, the stranded local commit goes.
    await ensureDataWorktree(repo)
    const wt = dataWorktreePath(repo)
    await writeFile(join(wt, 'TODO_AGENTS.md'), '- [ ] stale local view\n')
    await git(['add', '-A'], wt)
    await git(['commit', '-m', 'stale'], wt)
    await otherMachineWrites(other, 'TODO_AGENTS.md', '- [ ] origin view\n')

    const result = await withDataBranch(repo, 'append', async dir => {
      const queue = await readFile(join(dir, 'TODO_AGENTS.md'), 'utf8').catch(() => '')
      await writeFile(join(dir, 'TODO_AGENTS.md'), `${queue}- [ ] appended\n`)
    })
    assert.deepEqual(result, { ok: true, changed: true, pushed: true })
    // The op read the origin view (not the stale one) and appended to it.
    assert.equal(await git(['show', `${DATA_BRANCH}:TODO_AGENTS.md`], bare), '- [ ] origin view\n- [ ] appended\n')
  } finally {
    await cleanup()
  }
})

test('the eager pull converges a machine on what others pushed', async () => {
  const { repo, other, cleanup } = await initSyncedRepos()
  try {
    await ensureDataWorktree(repo)
    await otherMachineWrites(other, 'TODO_AGENTS.md', '- [ ] pushed elsewhere\n')
    await pullDataBranch(repo)
    assert.equal(await readFile(join(dataWorktreePath(repo), 'TODO_AGENTS.md'), 'utf8'), '- [ ] pushed elsewhere\n')
  } finally {
    await cleanup()
  }
})

test('concurrent writes serialize instead of interleaving', async () => {
  const repo = await initRepo('framework-data-serial-')
  try {
    const order: string[] = []
    await Promise.all(
      ['a', 'b', 'c'].map(name =>
        withDataBranch(repo, name, async dir => {
          order.push(`${name}:start`)
          const queue = await readFile(join(dir, 'TODO_AGENTS.md'), 'utf8').catch(() => '')
          await writeFile(join(dir, 'TODO_AGENTS.md'), `${queue}- [ ] ${name}\n`)
          order.push(`${name}:end`)
        }),
      ),
    )
    // Each op ran whole before the next started, so every append survived.
    assert.deepEqual(order, ['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end'])
    assert.equal(await git(['show', `${DATA_BRANCH}:TODO_AGENTS.md`], repo), '- [ ] a\n- [ ] b\n- [ ] c\n')
  } finally {
    await rm(repo, RETRIED_RM)
  }
})
