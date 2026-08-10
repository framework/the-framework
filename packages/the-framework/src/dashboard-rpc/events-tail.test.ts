import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FrameworkEvent } from '../events.js'
import { tailEvents, tailRunEvents } from './events-tail.js'

const line = (message: string): string => JSON.stringify({ kind: 'log', message } satisfies FrameworkEvent) + '\n'
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

async function tmpWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'framework-events-tail-'))
}

test('tailEvents seeds with what is already logged, then follows appends', async () => {
  const cwd = await tmpWorkspace()
  const path = join(cwd, 'events.jsonl')
  await writeFile(path, line('first'))
  const seen: string[] = []
  const stop = tailEvents<FrameworkEvent>(path, e => void (e.kind === 'log' && seen.push(e.message)))
  try {
    await sleep(150)
    assert.deepEqual(seen, ['first'])
    // Append, the way a run writes its log. This used to rewrite the whole file, which truncates
    // it first — and a poll landing in that instant makes the tailer do exactly what it is built
    // to do (#567): treat the log as rewritten, reset, and replay `first`. The rewrite path is
    // covered on purpose by the next test; this one is about following appends (#811).
    await appendFile(path, line('second'))
    await sleep(1400) // fs.watch is unreliable on CI; wait out the poll backstop behind it
    assert.deepEqual(seen, ['first', 'second'])
  } finally {
    stop()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('tailEvents resets when a fresh run rewrites the log to the same length (#567)', async () => {
  const cwd = await tmpWorkspace()
  const path = join(cwd, 'events.jsonl')
  // Both lines are the same byte length, so the shrink check alone cannot see this;
  // it is caught only by the same-length-rewrite detection. That is the whole point.
  assert.equal(Buffer.byteLength(line('old-run')), Buffer.byteLength(line('new-run')))
  await writeFile(path, line('old-run'))
  const seen: string[] = []
  const stop = tailEvents<FrameworkEvent>(path, e => void (e.kind === 'log' && seen.push(e.message)))
  try {
    await sleep(150)
    assert.deepEqual(seen, ['old-run'])
    await sleep(20) // let mtime advance past the seeding read
    await writeFile(path, line('new-run'))
    await sleep(1400) // fs.watch, and the poll backstop behind it
    assert.deepEqual(seen, ['old-run', 'new-run'])
  } finally {
    stop()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('tailEvents stops pulling once stopped, and skips malformed lines', async () => {
  const cwd = await tmpWorkspace()
  const path = join(cwd, 'events.jsonl')
  await writeFile(path, line('kept') + 'not json at all\n')
  const seen: string[] = []
  const stop = tailEvents<FrameworkEvent>(path, e => void (e.kind === 'log' && seen.push(e.message)))
  try {
    await sleep(150)
    assert.deepEqual(seen, ['kept']) // the malformed line never breaks the stream
    stop()
    await writeFile(path, line('kept') + line('after-stop'))
    await sleep(1200)
    assert.deepEqual(seen, ['kept']) // nothing arrives after the stop
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('tailEvents reports the replay boundary after the backlog, before any follow-append (#1383)', async () => {
  const cwd = await tmpWorkspace()
  const path = join(cwd, 'events.jsonl')
  await writeFile(path, line('first') + line('second'))
  const order: string[] = []
  const stop = tailEvents<FrameworkEvent>(
    path,
    e => void (e.kind === 'log' && order.push(e.message)),
    () => order.push('<sync>'),
  )
  try {
    await sleep(150)
    // The marker lands exactly between the replay and anything the follower delivers.
    assert.deepEqual(order, ['first', 'second', '<sync>'])
    await appendFile(path, line('third'))
    await sleep(1400) // fs.watch is unreliable on CI; wait out the poll backstop behind it
    assert.deepEqual(order, ['first', 'second', '<sync>', 'third'])
  } finally {
    stop()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('tailEvents reports the replay boundary even when the log does not exist yet (#1383)', async () => {
  const cwd = await tmpWorkspace()
  const path = join(cwd, 'events.jsonl')
  const order: string[] = []
  const stop = tailEvents<FrameworkEvent>(
    path,
    e => void (e.kind === 'log' && order.push(e.message)),
    () => order.push('<sync>'),
  )
  try {
    await sleep(150)
    // An absent log is an empty replay, not a marker withheld: a client waiting on it
    // forever would freeze its feed.
    assert.deepEqual(order, ['<sync>'])
  } finally {
    stop()
    await rm(cwd, { recursive: true, force: true })
  }
})

// The relocating tail: a run's journal is copied verbatim into the archive at teardown and the
// worktree is removed. tailRunEvents re-resolves the path when the tailed file disappears and
// carries the read offset across the move, so the feed gets exactly the lines the move would
// have swallowed — once, with no replay of what was already delivered.

test('tailRunEvents follows the journal into the archive: missed lines arrive exactly once', async () => {
  const cwd = await tmpWorkspace()
  const live = join(cwd, 'worktree-events.jsonl')
  const archive = join(cwd, 'archived-events.jsonl')
  await writeFile(live, line('one') + line('two'))
  const seen: string[] = []
  let sync = 0
  const { rename } = await import('node:fs/promises')
  const stop = tailRunEvents<FrameworkEvent>(
    async () => ((await import('node:fs')).existsSync(live) ? live : archive),
    e => void (e.kind === 'log' && seen.push(e.message)),
    () => sync++,
  )
  try {
    await sleep(200)
    assert.deepEqual(seen, ['one', 'two'])
    // The retirement, compressed: the final lines land and the journal moves in one breath, so
    // whether the watcher saw the appends before the move is scheduling luck — exactly the
    // window that used to swallow a fast run's `end`. Either way the tail must deliver
    // everything, each line once.
    await appendFile(live, line('three') + line('four'))
    await rename(live, archive)
    await sleep(1600) // fs.watch is unreliable on CI; wait out the poll backstop behind it
    assert.deepEqual(seen, ['one', 'two', 'three', 'four'])
    // A relocation is not a new replay boundary: the marker stays once-per-subscription (#1383).
    assert.equal(sync, 1)
  } finally {
    stop()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('tailRunEvents does not replay a fully-consumed journal after the move', async () => {
  const cwd = await tmpWorkspace()
  const live = join(cwd, 'worktree-events.jsonl')
  const archive = join(cwd, 'archived-events.jsonl')
  await writeFile(live, line('one') + line('two'))
  const seen: string[] = []
  const { copyFile, rm: rmFile } = await import('node:fs/promises')
  const stop = tailRunEvents<FrameworkEvent>(
    async () => ((await import('node:fs')).existsSync(live) ? live : archive),
    e => void (e.kind === 'log' && seen.push(e.message)),
  )
  try {
    await sleep(200)
    assert.deepEqual(seen, ['one', 'two'])
    await sleep(20) // let the copy's mtime land visibly later than the seeding read
    // The archive path: a same-content copy with a NEWER mtime and the SAME length as what was
    // consumed — the exact shape the #567 same-length-rewrite detection resets on. The retarget
    // must adopt the copy's mtime instead, or every line would be delivered twice.
    await copyFile(live, archive)
    await rmFile(live)
    await sleep(1600)
    assert.deepEqual(seen, ['one', 'two'])
  } finally {
    stop()
    await rm(cwd, { recursive: true, force: true })
  }
})

test('tailRunEvents stays put while the resolver has no better answer', async () => {
  const cwd = await tmpWorkspace()
  const live = join(cwd, 'worktree-events.jsonl')
  const archive = join(cwd, 'archived-events.jsonl')
  await writeFile(live, line('one'))
  const seen: string[] = []
  const { copyFile, rm: rmFile } = await import('node:fs/promises')
  let archiveVisible = false
  const stop = tailRunEvents<FrameworkEvent>(
    // The window where the live file is gone but the archive is not resolvable yet: the
    // resolver answers undefined (a deleted session resolves like this forever), and the tail
    // must idle rather than hop somewhere wrong — then catch up once the archive appears.
    async () => ((await import('node:fs')).existsSync(live) ? live : archiveVisible ? archive : undefined),
    e => void (e.kind === 'log' && seen.push(e.message)),
  )
  try {
    await sleep(200)
    assert.deepEqual(seen, ['one'])
    await appendFile(live, line('two'))
    await copyFile(live, archive)
    await rmFile(live)
    await sleep(1300) // a full poll with the resolver still answering undefined
    archiveVisible = true
    await sleep(1600)
    assert.deepEqual(seen, ['one', 'two'])
  } finally {
    stop()
    await rm(cwd, { recursive: true, force: true })
  }
})
