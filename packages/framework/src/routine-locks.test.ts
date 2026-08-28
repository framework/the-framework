import { strict as assert } from 'node:assert'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  ROUTINE_LOCK_TTL_MS,
  acquireRoutineLock,
  releaseDeadRoutineLocks,
  releaseRoutineLock,
  routineLockContent,
  routineLockHolder,
  routineLockPath,
  type RoutineLockDeps,
} from './routine-locks.js'
import { DATA_BRANCH, dataWorktreePath, type withDataBranch } from './data-branch.js'
import { DATA_CHECKOUT_DIR } from './framework-dir.js'
import { nodeGitRunner } from '@gemstack/skill-branches'
const CWD = '/repo'
const DATA = join(CWD, '.the-framework', 'branches', 'agents-data')
const T0 = Date.parse('2026-08-23T10:00:00.000Z')

/** An in-memory data checkout behind a fake funnel, like ticket-locks.test.ts's. */
function checkout(files: Record<string, string> = {}, opts: { runs?: number; host?: string; now?: number } = {}) {
  const disk = new Map(Object.entries(files).map(([file, md]) => [join(DATA, file), md]))
  const messages: string[] = []
  const funnel: typeof withDataBranch = async (_cwd, message, op) => {
    const before = new Map(disk)
    for (let i = 0; i < (opts.runs ?? 1); i++) await op(DATA)
    const changed = disk.size !== before.size || [...disk].some(([key, value]) => before.get(key) !== value)
    if (changed) messages.push(typeof message === 'function' ? message() : message)
    return { ok: true, changed, pushed: true }
  }
  const deps: RoutineLockDeps = {
    funnel,
    host: opts.host ?? 'laptop',
    now: () => opts.now ?? T0,
    write: async (path, content) => void disk.set(path, content),
    read: async path => {
      const md = disk.get(path)
      if (md === undefined) throw new Error('ENOENT')
      return md
    },
    remove: async path => void disk.delete(path),
    list: async dir => [...disk.keys()].filter(key => key.startsWith(`${dir}/`)).map(key => key.slice(dir.length + 1)),
  }
  const lock = (name: string) => disk.get(join(DATA, routineLockPath(name)))
  return { disk, messages, deps, lock }
}

test('the lock file names the machine and the mint time, and reads back (#1659)', () => {
  assert.equal(routineLockPath('triage-quick'), 'routines/triage-quick.lock.md')
  const md = routineLockContent({ host: 'laptop', since: '2026-08-23T10:00:00.000Z' })
  assert.equal(md, 'CLAIMED: laptop\nSINCE: 2026-08-23T10:00:00.000Z\n')
  assert.deepEqual(routineLockHolder(md), { host: 'laptop', since: '2026-08-23T10:00:00.000Z' })
  assert.equal(routineLockHolder('# not a lock\n'), undefined)
})

test('acquire mints the lock through the funnel, and the re-run of a raced push still finds it ours (#1659)', async () => {
  const c = checkout({}, { runs: 2 })
  assert.deepEqual(await acquireRoutineLock(CWD, 'triage-quick', c.deps), { ok: true })
  assert.equal(c.lock('triage-quick'), 'CLAIMED: laptop\nSINCE: 2026-08-23T10:00:00.000Z\n')
  assert.deepEqual(c.messages, ['[The Framework] lock the triage-quick routine'])
})

test("an alive lock stands the caller down naming its holder — another machine's, or this one's own earlier run (#1659)", async () => {
  const theirs = checkout({ 'routines/triage-quick.lock.md': routineLockContent({ host: 'desktop', since: '2026-08-23T09:00:00.000Z' }) })
  assert.deepEqual(await acquireRoutineLock(CWD, 'triage-quick', theirs.deps), {
    ok: false,
    reason: 'triage-quick is already running on desktop (since 2026-08-23T09:00:00.000Z)',
  })
  assert.equal(theirs.messages.length, 0, 'nothing is written when standing down')

  // This machine's, from a run still going (the daemon restarted under it): held all the same.
  const mine = checkout({ 'routines/triage-quick.lock.md': routineLockContent({ host: 'laptop', since: '2026-08-23T09:00:00.000Z' }) })
  assert.equal((await acquireRoutineLock(CWD, 'triage-quick', mine.deps)).ok, false)
})

test('a lock older than four hours is dead, and taken over in the same commit (#1659)', async () => {
  const stale = routineLockContent({ host: 'desktop', since: new Date(T0 - ROUTINE_LOCK_TTL_MS).toISOString() })
  const c = checkout({ 'routines/triage-quick.lock.md': stale })
  assert.deepEqual(await acquireRoutineLock(CWD, 'triage-quick', c.deps), { ok: true })
  assert.equal(c.lock('triage-quick'), 'CLAIMED: laptop\nSINCE: 2026-08-23T10:00:00.000Z\n')

  // A minute younger than that is still alive.
  const fresh = routineLockContent({ host: 'desktop', since: new Date(T0 - ROUTINE_LOCK_TTL_MS + 60_000).toISOString() })
  const held = checkout({ 'routines/triage-quick.lock.md': fresh })
  assert.equal((await acquireRoutineLock(CWD, 'triage-quick', held.deps)).ok, false)
})

test("release drops this machine's lock only; another machine's, or none, is left alone (#1659)", async () => {
  const mine = checkout({ 'routines/triage-quick.lock.md': routineLockContent({ host: 'laptop', since: '2026-08-23T09:00:00.000Z' }) })
  assert.equal(await releaseRoutineLock(CWD, 'triage-quick', mine.deps), true)
  assert.equal(mine.lock('triage-quick'), undefined)
  assert.deepEqual(mine.messages, ['[The Framework] release the triage-quick routine'])

  const theirs = checkout({ 'routines/triage-quick.lock.md': routineLockContent({ host: 'desktop', since: '2026-08-23T09:00:00.000Z' }) })
  assert.equal(await releaseRoutineLock(CWD, 'triage-quick', theirs.deps), true)
  assert.ok(theirs.lock('triage-quick'), "someone else's claim outranks the cleanup")

  const none = checkout()
  assert.equal(await releaseRoutineLock(CWD, 'triage-quick', none.deps), true)
  assert.equal(none.messages.length, 0)
})

test("on boot, this machine's locks whose run is gone are released; a run still going keeps its lock (#1659)", async () => {
  const c = checkout({
    'routines/triage-quick.lock.md': routineLockContent({ host: 'laptop', since: '2026-08-23T09:00:00.000Z' }),
    'routines/triage-consensual.lock.md': routineLockContent({ host: 'laptop', since: '2026-08-23T09:30:00.000Z' }),
    'routines/update.lock.md': routineLockContent({ host: 'desktop', since: '2026-08-23T09:00:00.000Z' }),
    'routines/README.md': 'not a lock\n',
  })
  // A run of this machine's started at 09:40 is still going: it is the consensual triage's.
  const released = await releaseDeadRoutineLocks(CWD, since => '2026-08-23T09:40:00.000Z' >= since && since >= '2026-08-23T09:30:00.000Z', c.deps)
  assert.deepEqual(released, ['triage-quick'])
  assert.equal(c.lock('triage-quick'), undefined)
  assert.ok(c.lock('triage-consensual'), 'its run is still going')
  assert.ok(c.lock('update'), "another machine's lock is never this boot's to release")
  assert.deepEqual(c.messages, ['[The Framework] release 1 routine lock left by a previous daemon'])
})

// Against real git: two clones of one bare origin, each with its own data checkout — the
// cross-machine race the lock exists for. No funnel fake: what the other machine sees is what
// origin's `agents-data` holds after the push.

const git = nodeGitRunner()
const RETRIED_RM = { recursive: true, force: true, maxRetries: 10 } as const

async function initRepo(prefix: string, email: string): Promise<string> {
  const repo = await realpath(await mkdtemp(join(tmpdir(), prefix)))
  await git(['init', '-b', 'main'], repo)
  await git(['config', 'user.email', email], repo)
  await git(['config', 'user.name', email], repo)
  await writeFile(join(repo, 'README.md'), '# t\n')
  await git(['add', '-A'], repo)
  await git(['commit', '-m', 'init'], repo)
  return repo
}

test('two machines sharing agents-data: the second finds the first machine\'s lock on origin, and its release frees it (#1659, real git)', async () => {
  const laptop = await initRepo('framework-routine-lock-a-', 'a@a')
  const bare = await realpath(await mkdtemp(join(tmpdir(), 'framework-routine-lock-bare-')))
  await git(['init', '--bare', bare], bare)
  await git(['remote', 'add', 'origin', bare], laptop)
  await git(['push', 'origin', 'main'], laptop)
  const desktopParent = await realpath(await mkdtemp(join(tmpdir(), 'framework-routine-lock-b-')))
  const desktop = join(desktopParent, 'clone')
  await git(['clone', bare, desktop], desktopParent)
  await git(['config', 'user.email', 'b@b'], desktop)
  await git(['config', 'user.name', 'b'], desktop)
  try {
    assert.deepEqual(await acquireRoutineLock(laptop, 'triage-quick', { host: 'laptop' }), { ok: true })
    const onLaptop = await readFile(join(dataWorktreePath(laptop), 'routines', 'triage-quick.lock.md'), 'utf8')
    assert.match(onLaptop, /^CLAIMED: laptop\nSINCE: \d{4}-/)
    // Pushed: origin's agents-data carries it.
    assert.equal((await git(['show', `${DATA_BRANCH}:routines/triage-quick.lock.md`], bare)).trim(), onLaptop.trim())

    const onDesktop = await acquireRoutineLock(desktop, 'triage-quick', { host: 'desktop' })
    assert.equal(onDesktop.ok, false)
    assert.match((onDesktop as { reason: string }).reason, /^triage-quick is already running on laptop \(since /)

    // The desktop cannot release what the laptop holds.
    assert.equal(await releaseRoutineLock(desktop, 'triage-quick', { host: 'desktop' }), true)
    assert.equal(await git(['show', `${DATA_BRANCH}:routines/triage-quick.lock.md`], bare).then(() => true, () => false), true)

    // The laptop's run ends: its release reaches origin, and the desktop's next try takes the lock.
    assert.equal(await releaseRoutineLock(laptop, 'triage-quick', { host: 'laptop' }), true)
    assert.equal(await git(['show', `${DATA_BRANCH}:routines/triage-quick.lock.md`], bare).then(() => true, () => false), false)
    assert.deepEqual(await acquireRoutineLock(desktop, 'triage-quick', { host: 'desktop' }), { ok: true })
    assert.match((await git(['show', `${DATA_BRANCH}:routines/triage-quick.lock.md`], bare)).trim(), /^CLAIMED: desktop/)
  } finally {
    for (const dir of [laptop, bare, desktopParent]) await rm(dir, RETRIED_RM)
  }
})
