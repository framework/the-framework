import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { ensureBranchesLayout, startBranchesLayoutPass, type LayoutFs } from './branches-layout.js'
import { FRAMEWORK_DIR, BRANCHES_DIR, LEGACY_WORKTREES_DIR } from './store/index.js'
import type { GitRunner } from './project.js'

const CWD = '/repo'
const OLD_ROOT = join(CWD, FRAMEWORK_DIR, LEGACY_WORKTREES_DIR)
const NEW_ROOT = join(CWD, FRAMEWORK_DIR, BRANCHES_DIR)
const LINK = join(CWD, 'branches')

/** An in-memory {@link LayoutFs} seeded with legacy worktree dir names and existing paths. */
function memFs(opts: { legacy?: string[]; exists?: string[] } = {}) {
  const exists = new Set(opts.exists ?? [])
  const legacy = new Set(opts.legacy ?? [])
  const symlinks: Array<{ target: string; path: string }> = []
  const fs: LayoutFs = {
    readdir: async dir => (dir === OLD_ROOT ? [...legacy] : []),
    mkdir: async dir => void exists.add(dir),
    symlink: async (target, path) => {
      symlinks.push({ target, path })
      exists.add(path)
    },
    lexists: async path => exists.has(path),
    rmdir: async dir => {
      // Refuses a non-empty dir, like the real one.
      if (dir === OLD_ROOT && legacy.size > 0) throw new Error('ENOTEMPTY')
      exists.delete(dir)
    },
  }
  return { fs, symlinks, legacy }
}

/** A {@link GitRunner} recording `worktree move` calls; `fail` makes every move reject. */
function fakeGit(opts: { fail?: boolean } = {}) {
  const moves: Array<{ from: string; to: string }> = []
  const git: GitRunner = async args => {
    assert.deepEqual(args.slice(0, 2), ['worktree', 'move'])
    if (opts.fail) throw new Error('worktree is dirty')
    moves.push({ from: args[2]!, to: args[3]! })
    return ''
  }
  return { git, moves }
}

test('a legacy worktree is moved to branches/ under its run-branch name (#1580)', async () => {
  const id = '2026-08-18T15-04-35-570Z'
  const { fs, legacy } = memFs({ legacy: [id] })
  const { git, moves } = fakeGit()
  const lines = await ensureBranchesLayout(CWD, { git, fs, isLive: async () => false })
  assert.deepEqual(moves, [{ from: join(OLD_ROOT, id), to: join(NEW_ROOT, `tf-agent-${id}`) }])
  assert.ok(lines.some(line => line.includes(`tf-agent-${id}`)), 'says where the checkout went')
  legacy.clear() // the real move empties the old root; the fake tracks names, not effects
})

test('a live agent keeps its legacy checkout: moving a running run breaks it', async () => {
  const { fs } = memFs({ legacy: ['r-live', 'r-done'] })
  const { git, moves } = fakeGit()
  await ensureBranchesLayout(CWD, { git, fs, isLive: async path => path.endsWith('r-live') })
  assert.deepEqual(
    moves.map(m => m.from),
    [join(OLD_ROOT, 'r-done')],
    'only the ended run moved',
  )
})

test('a move git refuses is kept and reported, never thrown', async () => {
  const { fs } = memFs({ legacy: ['r1'] })
  const { git } = fakeGit({ fail: true })
  const lines = await ensureBranchesLayout(CWD, { git, fs, isLive: async () => false })
  assert.ok(lines.some(line => line.includes('kept the worktree for session r1')), 'says why it stayed')
})

test('the repo-root branches symlink is created once, relative, and never clobbers', async () => {
  const fresh = memFs()
  await ensureBranchesLayout(CWD, { git: fakeGit().git, fs: fresh.fs, isLive: async () => false })
  assert.deepEqual(fresh.symlinks, [{ target: join(FRAMEWORK_DIR, BRANCHES_DIR), path: LINK }])

  // Anything already at that path — the link from last time, or a user's own file — is left alone.
  const taken = memFs({ exists: [LINK] })
  await ensureBranchesLayout(CWD, { git: fakeGit().git, fs: taken.fs, isLive: async () => false })
  assert.deepEqual(taken.symlinks, [])
})

test('a settled project is a silent no-op', async () => {
  const { fs } = memFs({ exists: [LINK] })
  const lines = await ensureBranchesLayout(CWD, { git: fakeGit().git, fs, isLive: async () => false })
  assert.deepEqual(lines, [])
})

test('the pass covers every registered project and logs what each did', async () => {
  const seen: string[] = []
  const pass = startBranchesLayoutPass({
    projects: async () => [{ path: '/a' }, { path: '/b' }],
    log: line => seen.push(line),
    ensure: async cwd => [`did ${cwd}`],
  })
  await pass.tick()
  assert.deepEqual(seen, ['did /a', 'did /b'])
  pass.stop()
  await pass.tick()
  assert.deepEqual(seen.length, 2, 'a stopped pass does nothing')
})
