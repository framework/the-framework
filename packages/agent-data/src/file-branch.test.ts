import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { nodeGitRunner, type GitRunner } from './git.js'
import {
  ensureFileBranch,
  fileBranchPath,
  fileBranchRepo,
  isGitLocked,
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

test('a lost push whose re-sync finds the branch locked by another process still lands, and the checkout ends on the branch', async () => {
  const { repo, bare, other, cleanup } = await initSyncedRepos()
  try {
    await withFileBranch(repo, BRANCH, 'seed', async dir => {
      await writeFile(join(dir, 'queue.md'), '- first\n')
    })
    // Another process on this clone (the daemon's pull, a scheduler's record) holds the branch's ref
    // lock at the instant the re-sync's rebase moves the branch onto origin's tip: git leaves HEAD
    // detached there and fails, and the abort that follows meets the same lock.
    const lock = join(repo, '.git', 'refs', 'heads', `${BRANCH}.lock`)
    let armed = false
    let locked = 0
    const racing: GitRunner = async (args, cwd) => {
      const hold = armed && args[0] === 'rebase'
      if (hold) {
        await writeFile(lock, '')
        locked++
      }
      try {
        return await git(args, cwd)
      } finally {
        if (hold) await rm(lock, { force: true })
      }
    }
    let runs = 0
    const result = await withFileBranch(
      repo,
      BRANCH,
      'append',
      async dir => {
        runs++
        // The other machine lands between this op's first run and its push; the first push is rejected.
        if (runs === 1) {
          await otherMachineWrites(other, 'theirs.md', 'theirs\n')
          armed = true
        }
        const queue = await readFile(join(dir, 'queue.md'), 'utf8').catch(() => '')
        await writeFile(join(dir, 'queue.md'), `${queue}- appended\n`)
      },
      { git: racing },
    )
    assert.ok(locked >= 1, 'the re-sync rebased under the lock')
    assert.deepEqual(result, { ok: true, changed: true, pushed: true })
    assert.equal(runs, 2)
    assert.equal(await git(['show', `${BRANCH}:queue.md`], bare), '- first\n- appended\n')
    assert.equal(await git(['show', `${BRANCH}:theirs.md`], bare), 'theirs\n')
    const wt = fileBranchPath(repo, BRANCH)
    assert.equal((await git(['symbolic-ref', 'HEAD'], wt)).trim(), `refs/heads/${BRANCH}`)
    assert.equal((await git(['rev-parse', BRANCH], repo)).trim(), (await git(['rev-parse', BRANCH], bare)).trim())
    // The next write finds the checkout where it was left, on the branch: it is never made a second time.
    const next = await withFileBranch(repo, BRANCH, 'next', async dir => {
      await writeFile(join(dir, 'next.md'), 'next\n')
    })
    assert.deepEqual(next, { ok: true, changed: true, pushed: true })
  } finally {
    await cleanup()
  }
})

test('a checkout found off its branch is put back on it, keeping what it holds, never made a second time', async () => {
  const { repo, bare, cleanup } = await initSyncedRepos()
  try {
    await withFileBranch(repo, BRANCH, 'seed', async dir => {
      await writeFile(join(dir, 'a.md'), 'a\n')
    })
    const wt = fileBranchPath(repo, BRANCH)
    // The state a cycle interrupted mid-rebase leaves: HEAD detached at the tip, a record committed on
    // it afterwards, the branch itself behind.
    await git(['checkout', '--detach'], wt)
    await writeFile(join(wt, 'held.md'), 'held\n')
    await git(['add', '-A'], wt)
    await git(['commit', '-m', 'committed while detached'], wt)
    const result = await withFileBranch(repo, BRANCH, 'b', async dir => {
      await writeFile(join(dir, 'b.md'), 'b\n')
    })
    assert.deepEqual(result, { ok: true, changed: true, pushed: true })
    assert.equal((await git(['symbolic-ref', 'HEAD'], wt)).trim(), `refs/heads/${BRANCH}`)
    for (const [file, content] of [['held.md', 'held\n'], ['b.md', 'b\n']] as const) {
      assert.equal(await git(['show', `${BRANCH}:${file}`], bare), content, file)
    }
    // On another branch by hand: the branch is checked out again, and neither branch takes the other's tip.
    await git(['checkout', '-b', 'stray'], wt)
    await writeFile(join(wt, 'stray.md'), 'stray\n')
    await git(['add', '-A'], wt)
    await git(['commit', '-m', 'on stray'], wt)
    const stray = (await git(['rev-parse', 'stray'], repo)).trim()
    assert.deepEqual(await ensureFileBranch(repo, BRANCH), { ok: true })
    assert.equal((await git(['symbolic-ref', 'HEAD'], wt)).trim(), `refs/heads/${BRANCH}`)
    assert.equal((await git(['rev-parse', 'stray'], repo)).trim(), stray)
    await assert.rejects(git(['show', `${BRANCH}:stray.md`], repo))
  } finally {
    await cleanup()
  }
})

test('another process holding the index is waited out: the cycle runs again and the write lands once', async () => {
  const { repo, bare, cleanup } = await initSyncedRepos()
  try {
    // git's own refusal, as the daemon and the scheduler hand it to each other on one clone.
    const refusal = new Error("Command failed: git add -A\nfatal: Unable to create '/x/.git/worktrees/store/index.lock': File exists.\n\nAnother git process seems to be running in this repository")
    assert.equal(isGitLocked(refusal), true)
    // The branch's ref lock, held by another process's commit, reset or rebase, reads the same way.
    assert.equal(isGitLocked(new Error("Command failed: git rebase origin/store\nerror: cannot lock ref 'refs/heads/store': Unable to create '/x/.git/refs/heads/store.lock': File exists.")), true)
    assert.equal(isGitLocked(new Error('Command failed: git push')), false)
    let refusals = 2
    const locked: GitRunner = (args, cwd) => {
      if (args[0] === 'add' && refusals-- > 0) return Promise.reject(refusal)
      return git(args, cwd)
    }
    let runs = 0
    const result = await withFileBranch(repo, BRANCH, 'append', async dir => {
      runs++
      await writeFile(join(dir, 'queue.md'), '- once\n')
    }, { git: locked })
    assert.deepEqual(result, { ok: true, changed: true, pushed: true })
    assert.equal(runs, 3, 'the change re-ran after each refusal')
    assert.equal(await git(['show', `${BRANCH}:queue.md`], bare), '- once\n')
    assert.equal((await git(['log', '--oneline', BRANCH], repo)).trim().split('\n').length, 2, 'born, then one commit')
    // A lock that never lifts is reported like any other failure, and the checkout is clean.
    refusals = Number.POSITIVE_INFINITY
    const stuck = await withFileBranch(repo, BRANCH, 'again', async dir => writeFile(join(dir, 'queue.md'), '- twice\n'), { git: locked })
    assert.equal(stuck.ok, false)
    assert.match((stuck as { error: string }).error, /index\.lock/)
    assert.equal(await readFile(join(fileBranchPath(repo, BRANCH), 'queue.md'), 'utf8'), '- once\n')
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

test('two processes on one clone take turns in the checkout: every write of both lands', async () => {
  const { repo, bare, cleanup } = await initSyncedRepos()
  try {
    await ensureFileBranch(repo, BRANCH)
    // Each process writes its own files, slowly, so the other's cycle has every chance to reset
    // the checkout under it: a daemon, a scheduler and a run's end record on one clone.
    const module = new URL('./file-branch.js', import.meta.url).href
    const writer = (name: string) => `
      const { withFileBranch } = await import(${JSON.stringify(module)})
      const { writeFile } = await import('node:fs/promises')
      const { join } = await import('node:path')
      const failed = []
      for (let i = 0; i < 6; i++) {
        const result = await withFileBranch(${JSON.stringify(repo)}, ${JSON.stringify(BRANCH)}, '${name} ' + i, async dir => {
          await writeFile(join(dir, '${name}-' + i + '.md'), 'x')
          await new Promise(resolve => setTimeout(resolve, 30))
        })
        if (!result.ok) failed.push(result.error)
      }
      process.stdout.write(JSON.stringify(failed))
    `
    const run = (name: string) =>
      new Promise<string[]>((resolvePromise, rejectPromise) => {
        const child = spawn(process.execPath, ['--input-type=module', '-e', writer(name)], { stdio: ['ignore', 'pipe', 'inherit'] })
        let out = ''
        child.stdout.on('data', chunk => (out += chunk))
        child.once('error', rejectPromise)
        child.once('exit', () => resolvePromise(JSON.parse(out || '["no output"]') as string[]))
      })
    const [a, b] = await Promise.all([run('a'), run('b')])
    assert.deepEqual([...a, ...b], [], 'no write failed')
    const files = (await git(['ls-tree', '--name-only', BRANCH], bare)).trim().split('\n').sort()
    const want = ['a', 'b'].flatMap(name => Array.from({ length: 6 }, (_, i) => `${name}-${i}.md`)).sort()
    assert.deepEqual(files, want)
  } finally {
    await cleanup()
  }
})

test("the checkout's lock: a live holder is waited for, a dead one's is taken over, a wait past the budget fails untouched", async () => {
  const repo = await initRepo('file-branch-lock-')
  try {
    await ensureFileBranch(repo, BRANCH)
    const lock = join(repo, '.branches', `${BRANCH}.lock`)
    const write = (content: string, deps: Parameters<typeof withFileBranch>[4]) =>
      withFileBranch(repo, BRANCH, content, async dir => writeFile(join(dir, 'queue.md'), content), deps)
    // Held by a live process: the write waits until it lets go.
    await writeFile(lock, '424242 held')
    let alive = true
    setTimeout(() => void rm(lock, { force: true }), 300)
    const started = Date.now()
    assert.deepEqual(await write('- after the wait\n', { lock: { isAlive: () => alive } }), { ok: true, changed: true, pushed: false })
    assert.ok(Date.now() - started >= 250, 'the write waited for the holder')
    // Held by a process that is gone: taken over at once.
    await writeFile(lock, '424242 dead')
    alive = false
    assert.deepEqual(await write('- over a dead holder\n', { lock: { isAlive: () => alive } }), { ok: true, changed: true, pushed: false })
    // Held past the wait: the write fails and the checkout is not touched.
    await writeFile(lock, '424242 held')
    alive = true
    const stuck = await write('- never\n', { lock: { isAlive: () => alive, waitMs: 200 } })
    assert.equal(stuck.ok, false)
    assert.match((stuck as { error: string }).error, /another process has held/)
    assert.equal(await readFile(join(fileBranchPath(repo, BRANCH), 'queue.md'), 'utf8'), '- over a dead holder\n')
    assert.equal(await readFile(lock, 'utf8'), '424242 held', "another holder's lock is never removed")
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
    // A remote by any other name does not count: every push here names `origin`.
    await git(['remote', 'add', 'upstream', solo], solo)
    assert.deepEqual(await writeFileBranchDetached(solo, BRANCH, 'x', async () => {}), { ok: false, reason: 'no-remote' })
  } finally {
    await rm(solo, RETRIED_RM)
  }
})

test('a detached write works for a branch named with a slash: the throwaway checkout takes a flat name (#1762)', async () => {
  const { bare, other, cleanup } = await initSyncedRepos()
  try {
    assert.deepEqual(
      await writeFileBranchDetached(other, 'feature/store', 'slashed', async dir => {
        await writeFile(join(dir, 'a.md'), 'a\n')
      }),
      { ok: true, changed: true },
    )
    assert.equal(await git(['show', 'feature/store:a.md'], bare), 'a\n')
    assert.ok(!(await git(['worktree', 'list'], other)).includes('write-'))
  } finally {
    await cleanup()
  }
})
