import { strict as assert } from 'node:assert'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { nodeGitRunner } from './git.js'
import {
  ensureFileBranch,
  fileBranchPath,
  fileBranchRepo,
  listBranchDir,
  pullFileBranch,
  readBranchFile,
  withFileBranch,
  writeFileBranchDetached,
} from './file-branch.js'

const git = nodeGitRunner()
const BRANCH = 'store'

/** Retried rm, the cure for the macOS ENOTEMPTY teardown race. */
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
  const repo = await initRepo('file-branch-repo-')
  const bare = await realpath(await mkdtemp(join(tmpdir(), 'file-branch-bare-')))
  await git(['init', '--bare', bare], bare)
  await git(['remote', 'add', 'origin', bare], repo)
  await git(['push', 'origin', 'main'], repo)
  const otherParent = await realpath(await mkdtemp(join(tmpdir(), 'file-branch-other-')))
  const other = join(otherParent, 'clone')
  await git(['clone', bare, other], otherParent)
  await git(['config', 'user.email', 'o@o'], other)
  await git(['config', 'user.name', 'o'], other)
  const cleanup = async () => {
    for (const dir of [repo, bare, otherParent]) await rm(dir, RETRIED_RM)
  }
  return { repo, bare, other, cleanup }
}

/** Commit a file onto the branch from the second clone and push it, like another machine would. */
async function otherMachineWrites(other: string, file: string, content: string): Promise<void> {
  const onOrigin = await git(['fetch', 'origin', BRANCH], other).then(
    () => true,
    () => false,
  )
  if (onOrigin) await git(['checkout', '-B', BRANCH, `origin/${BRANCH}`], other)
  else {
    const commit = (await git(['commit-tree', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', '-m', 'born elsewhere'], other)).trim()
    await git(['checkout', '-B', BRANCH, commit], other)
  }
  await mkdir(dirname(join(other, file)), { recursive: true })
  await writeFile(join(other, file), content)
  await git(['add', '-A'], other)
  await git(['commit', '-m', `other: ${file}`], other)
  await git(['push', 'origin', `${BRANCH}:${BRANCH}`], other)
}

test('ensure births the branch parentless and checks it out under .branches/, hidden from git', async () => {
  const repo = await initRepo('file-branch-solo-')
  try {
    assert.deepEqual(await ensureFileBranch(repo, BRANCH), { ok: true })
    const wt = fileBranchPath(repo, BRANCH)
    assert.equal(wt, join(repo, '.branches', BRANCH))
    assert.equal((await git(['rev-parse', '--abbrev-ref', 'HEAD'], wt)).trim(), BRANCH)
    // Parentless: the file history shares no commit with the code history.
    await assert.rejects(git(['merge-base', BRANCH, 'main'], repo))
    // The checkout is hidden from the project's git, so no sweeping `git add -A` commits it.
    const status = await git(['status', '--porcelain'], repo)
    assert.ok(!status.includes('.branches'), status)
    // Idempotent: a second ensure changes nothing and still reports ok.
    assert.deepEqual(await ensureFileBranch(repo, BRANCH), { ok: true })
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('ensure adopts the branch origin already has instead of birthing a second history', async () => {
  const { repo, other, cleanup } = await initSyncedRepos()
  try {
    await otherMachineWrites(other, 'a.md', 'from the other machine\n')
    assert.deepEqual(await ensureFileBranch(repo, BRANCH), { ok: true })
    assert.equal(await readFile(join(fileBranchPath(repo, BRANCH), 'a.md'), 'utf8'), 'from the other machine\n')
  } finally {
    await cleanup()
  }
})

test('a write commits on the branch, pushes it, and leaves main untouched', async () => {
  const { repo, bare, cleanup } = await initSyncedRepos()
  try {
    const mainBefore = (await git(['rev-parse', 'main'], repo)).trim()
    const result = await withFileBranch(repo, BRANCH, 'queue a ticket', async dir => {
      await writeFile(join(dir, 'queue.md'), '- queued\n')
    })
    assert.deepEqual(result, { ok: true, changed: true, pushed: true })
    assert.equal(await git(['show', `${BRANCH}:queue.md`], bare), '- queued\n')
    assert.equal((await git(['rev-parse', 'main'], repo)).trim(), mainBefore)
    // The message is the one the caller gave, so the history narrates itself.
    assert.match(await git(['log', '-1', '--format=%s', BRANCH], bare), /queue a ticket/)
  } finally {
    await cleanup()
  }
})

test('an op that writes nothing commits nothing', async () => {
  const repo = await initRepo('file-branch-noop-')
  try {
    await ensureFileBranch(repo, BRANCH)
    const before = (await git(['rev-parse', BRANCH], repo)).trim()
    assert.deepEqual(await withFileBranch(repo, BRANCH, 'noop', async () => {}), { ok: true, changed: false, pushed: false })
    assert.equal((await git(['rev-parse', BRANCH], repo)).trim(), before)
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('a write in a remote-less repo lands locally and reports pushed: false', async () => {
  const repo = await initRepo('file-branch-local-')
  try {
    const result = await withFileBranch(repo, BRANCH, 'local write', async dir => {
      await writeFile(join(dir, 'queue.md'), '- local\n')
    })
    assert.deepEqual(result, { ok: true, changed: true, pushed: false })
    assert.equal(await git(['show', `${BRANCH}:queue.md`], repo), '- local\n')
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('a write syncs in what another machine pushed, and carries an earlier stranded commit out', async () => {
  const { repo, bare, other, cleanup } = await initSyncedRepos()
  try {
    // An earlier cycle that could not push: a local commit only this machine has.
    await ensureFileBranch(repo, BRANCH)
    const wt = fileBranchPath(repo, BRANCH)
    await writeFile(join(wt, 'stranded.md'), 'stranded\n')
    await git(['add', '-A'], wt)
    await git(['commit', '-m', 'stranded local commit'], wt)
    // Meanwhile another machine landed its own file on origin.
    await otherMachineWrites(other, 'theirs.md', 'theirs\n')

    const result = await withFileBranch(repo, BRANCH, 'mine', async dir => {
      await writeFile(join(dir, 'mine.md'), 'mine\n')
    })
    assert.deepEqual(result, { ok: true, changed: true, pushed: true })
    for (const [file, content] of [['theirs.md', 'theirs\n'], ['stranded.md', 'stranded\n'], ['mine.md', 'mine\n']] as const) {
      assert.equal(await git(['show', `${BRANCH}:${file}`], bare), content, file)
    }
  } finally {
    await cleanup()
  }
})

test('a conflicting stranded commit resolves toward origin, and the op re-applies the intent', async () => {
  const { repo, bare, other, cleanup } = await initSyncedRepos()
  try {
    await ensureFileBranch(repo, BRANCH)
    const wt = fileBranchPath(repo, BRANCH)
    await writeFile(join(wt, 'queue.md'), '- stale local view\n')
    await git(['add', '-A'], wt)
    await git(['commit', '-m', 'stale'], wt)
    await otherMachineWrites(other, 'queue.md', '- origin view\n')

    const result = await withFileBranch(repo, BRANCH, 'append', async dir => {
      const queue = await readFile(join(dir, 'queue.md'), 'utf8').catch(() => '')
      await writeFile(join(dir, 'queue.md'), `${queue}- appended\n`)
    })
    assert.deepEqual(result, { ok: true, changed: true, pushed: true })
    assert.equal(await git(['show', `${BRANCH}:queue.md`], bare), '- origin view\n- appended\n')
  } finally {
    await cleanup()
  }
})

test('a push lost to another writer re-applies the intent once, not twice', async () => {
  const { repo, bare, other, cleanup } = await initSyncedRepos()
  try {
    await withFileBranch(repo, BRANCH, 'seed', async dir => {
      await writeFile(join(dir, 'queue.md'), '- first\n')
    })
    let runs = 0
    const result = await withFileBranch(repo, BRANCH, 'append', async dir => {
      runs++
      // The other machine lands between this op's run and its push; the first push is rejected.
      if (runs === 1) await otherMachineWrites(other, 'theirs.md', 'theirs\n')
      const queue = await readFile(join(dir, 'queue.md'), 'utf8').catch(() => '')
      await writeFile(join(dir, 'queue.md'), `${queue}- appended\n`)
    })
    assert.deepEqual(result, { ok: true, changed: true, pushed: true })
    assert.equal(runs, 2, 'the op re-ran against the fresher state')
    // The first run's commit was wound back, so the append is on the branch exactly once.
    assert.equal(await git(['show', `${BRANCH}:queue.md`], bare), '- first\n- appended\n')
    assert.equal(await git(['show', `${BRANCH}:theirs.md`], bare), 'theirs\n')
  } finally {
    await cleanup()
  }
})

test('the eager pull converges a machine on what others pushed, and names a repo with no remote', async () => {
  const { repo, other, cleanup } = await initSyncedRepos()
  try {
    await ensureFileBranch(repo, BRANCH)
    await otherMachineWrites(other, 'queue.md', '- pushed elsewhere\n')
    assert.deepEqual(await pullFileBranch(repo, BRANCH), { ok: true })
    assert.equal(await readFile(join(fileBranchPath(repo, BRANCH), 'queue.md'), 'utf8'), '- pushed elsewhere\n')
  } finally {
    await cleanup()
  }
  const solo = await initRepo('file-branch-pull-solo-')
  try {
    const result = await pullFileBranch(solo, BRANCH)
    assert.ok(!result.ok && /no remote/.test(result.error))
  } finally {
    await rm(solo, RETRIED_RM)
  }
})

test('concurrent writes serialize instead of interleaving', async () => {
  const repo = await initRepo('file-branch-serial-')
  try {
    const order: string[] = []
    await Promise.all(
      ['a', 'b', 'c'].map(name =>
        withFileBranch(repo, BRANCH, name, async dir => {
          order.push(`${name}:start`)
          const queue = await readFile(join(dir, 'queue.md'), 'utf8').catch(() => '')
          await writeFile(join(dir, 'queue.md'), `${queue}- ${name}\n`)
          order.push(`${name}:end`)
        }),
      ),
    )
    assert.deepEqual(order, ['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end'])
    assert.equal(await git(['show', `${BRANCH}:queue.md`], repo), '- a\n- b\n- c\n')
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('reads come off the checkout, the local ref, or origin, from a worktree too; fresh prefers origin', async () => {
  const { repo, other, cleanup } = await initSyncedRepos()
  try {
    await withFileBranch(repo, BRANCH, 'seed', async dir => {
      await writeFile(join(dir, 'queue.md'), '- mine\n')
    })
    // From an agent's worktree of the same repo: the refs are shared, no copy is held.
    const wt = join(repo, '.branches', 'agent-x')
    await git(['worktree', 'add', wt, '-b', 'agent-x'], repo)
    assert.equal(await readBranchFile(wt, BRANCH, 'queue.md'), '- mine\n')
    assert.equal(await fileBranchRepo(wt), repo)
    assert.equal(await readBranchFile(repo, BRANCH, 'missing.md'), undefined)
    // Another machine moved origin on; the plain read still sees the checkout, fresh sees origin.
    await otherMachineWrites(other, 'queue.md', '- theirs\n')
    assert.equal(await readBranchFile(repo, BRANCH, 'queue.md'), '- mine\n')
    assert.equal(await readBranchFile(repo, BRANCH, 'queue.md', { fresh: true }), '- theirs\n')
    // A plain clone that never branched reads origin's copy, and lists a directory off the ref.
    await otherMachineWrites(other, 'tickets/a.md', '# a\n')
    await git(['checkout', 'main'], other)
    await git(['branch', '-D', BRANCH], other)
    assert.equal(await readBranchFile(other, BRANCH, 'tickets/a.md'), '# a\n')
    assert.deepEqual(await listBranchDir(other, BRANCH, 'tickets'), ['a.md'])
    assert.deepEqual(await listBranchDir(other, BRANCH, 'nothing'), [])
  } finally {
    await cleanup()
  }
})

test('a detached write lands on origin from any clone without touching the persistent checkout, and retries a lost race', async () => {
  const { repo, bare, other, cleanup } = await initSyncedRepos()
  try {
    // Born by the write itself when origin has no such branch yet.
    assert.deepEqual(
      await writeFileBranchDetached(other, BRANCH, 'first', async dir => {
        await writeFile(join(dir, 'a.md'), 'a\n')
      }),
      { ok: true, changed: true },
    )
    assert.equal(await git(['show', `${BRANCH}:a.md`], bare), 'a\n')
    assert.match(await git(['log', '-1', '--format=%s', BRANCH], bare), /^first/)
    // The clone holds no local branch of it: the write was a remote writer's.
    await assert.rejects(git(['rev-parse', '--verify', BRANCH], other))
    // The daemon's checkout on the other machine is left where it was until its own pull.
    await ensureFileBranch(repo, BRANCH)
    await pullFileBranch(repo, BRANCH)
    const head = (await git(['rev-parse', BRANCH], repo)).trim()
    let runs = 0
    const result = await writeFileBranchDetached(other, BRANCH, 'second', async dir => {
      runs++
      // A race: someone else pushes between this op's first run and its push.
      if (runs === 1) {
        await withFileBranch(repo, BRANCH, 'raced', async d => {
          await writeFile(join(d, 'raced.md'), 'raced\n')
        })
      }
      await writeFile(join(dir, 'b.md'), 'b\n')
    })
    assert.deepEqual(result, { ok: true, changed: true })
    assert.equal(runs, 2, 'the op re-ran against origin\'s fresher tip')
    assert.equal(await git(['show', `${BRANCH}:b.md`], bare), 'b\n')
    assert.equal(await git(['show', `${BRANCH}:raced.md`], bare), 'raced\n')
    assert.notEqual((await git(['rev-parse', BRANCH], repo)).trim(), head)
    // No throwaway worktree is left registered.
    assert.ok(!(await git(['worktree', 'list'], other)).includes('write-'))
    // Nothing to write is no commit.
    assert.deepEqual(await writeFileBranchDetached(other, BRANCH, 'nothing', async () => {}), { ok: true, changed: false })
  } finally {
    await cleanup()
  }
  const solo = await initRepo('file-branch-detached-solo-')
  try {
    assert.deepEqual(await writeFileBranchDetached(solo, BRANCH, 'x', async () => {}), { ok: false, reason: 'no-remote' })
  } finally {
    await rm(solo, RETRIED_RM)
  }
})
