import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { provideTelefuncContext } from 'telefunc'
import { sendStart, sendReleaseTicketLock } from './control.telefunc.js'
import { presets } from '../preset-catalog.js'
import type { StartRunOptions } from '../dashboard/types.js'

// A run started from the dashboard has to name the ticket it is about to implement, the same way
// the sweep's own drain does (#1117). The daemon reads that off the `drains` flag on its job; a
// click arrives with nothing but prompt text, so the resolution happens here.

/** The options `startRun` was handed, plus a workspace with one queued ticket to resolve against. */
async function harness(): Promise<{ cwd: string; started: () => StartRunOptions | undefined }> {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-start-'))
  await writeFile(
    join(cwd, 'TODO_AGENTS.md'),
    ['## Priority 9', '', '- [ ] [Add a login page](tickets/2026-07-25_login.md)', ''].join('\n'),
  )
  let seen: StartRunOptions | undefined
  provideTelefuncContext({
    startRun: async (_text: string, _kind: string, options: StartRunOptions) => {
      seen = options
      return { ok: true, runId: 'r1' }
    },
    projects: { list: async () => [], resolvePath: async () => cwd },
  } as never)
  return { cwd, started: () => seen }
}

test('a drain started from the dashboard carries the ticket it is about to work (#1117)', async () => {
  const { cwd, started } = await harness()
  try {
    const result = await sendStart('p1', presets.drainQueue.render())
    assert.equal(result.ok, true)
    // Without this the run implemented the ticket and the Overview's in-progress lane stayed empty,
    // because only the daemon's own drain was tagging what it took off the queue.
    assert.equal(started()?.ticket, 'tickets/2026-07-25_login.md')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('any other prompt starts without a ticket, however busy the queue is (#1117)', async () => {
  const { cwd, started } = await harness()
  try {
    await sendStart('p1', 'Have a look at the login page')
    // Naming the queue's next entry here would show a ticket as being implemented on the strength
    // of a run that never touched it.
    assert.equal(started()?.ticket, undefined)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a ticket named by the caller is not replaced by the guess (#1117)', async () => {
  const { cwd, started } = await harness()
  try {
    await sendStart('p1', presets.drainQueue.render(), 'build', { ticket: 'tickets/2026-07-20_chosen.md' })
    assert.equal(started()?.ticket, 'tickets/2026-07-20_chosen.md')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

// The manual `.lock.md` release (#1420): the only way a claim lifts besides the agent's own PR
// deleting it, so the RPC has to hold the same line the file readers do about what a ticket
// filename is, and actually land the release as a commit.

/** A real git checkout holding one ticket, optionally locked, registered as project `p1`. */
async function lockedProject(files: Record<string, string>): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-release-'))
  const git = async (...args: string[]) => {
    const { execFile } = await import('node:child_process')
    await new Promise<void>((resolve, reject) =>
      execFile('git', args, { cwd }, error => (error ? reject(error) : resolve())),
    )
  }
  await git('init', '-q', '-b', 'main')
  await git('config', 'user.email', 'test@test')
  await git('config', 'user.name', 'test')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(join(cwd, 'tickets'), { recursive: true })
  for (const [file, md] of Object.entries(files)) await writeFile(join(cwd, file), md)
  await git('add', '-A')
  await git('commit', '-q', '-m', 'seed')
  provideTelefuncContext({
    projects: { list: async () => [], resolvePath: async () => cwd },
  } as never)
  return cwd
}

test('sendReleaseTicketLock deletes the lock and commits the release (#1420)', async () => {
  const cwd = await lockedProject({
    'tickets/2026-07-20_thing.md': '# Thing\n',
    'tickets/2026-07-20_thing.lock.md': 'CLAIMED: spike-1-0\n',
  })
  try {
    const result = await sendReleaseTicketLock('p1', '2026-07-20_thing.md')
    // The push fails (no origin) but the release stands: the commit is the local half, and the
    // push is best-effort exactly like the acquisition's.
    assert.deepEqual(result, { ok: true })
    const { access } = await import('node:fs/promises')
    await assert.rejects(access(join(cwd, 'tickets/2026-07-20_thing.lock.md')), 'the lock file is gone')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('sendReleaseTicketLock answers honestly when there is no lock (#1420)', async () => {
  const cwd = await lockedProject({ 'tickets/2026-07-20_thing.md': '# Thing\n' })
  try {
    const result = await sendReleaseTicketLock('p1', '2026-07-20_thing.md')
    assert.deepEqual(result, { ok: false, error: 'this ticket holds no lock' })
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('sendReleaseTicketLock rejects anything but a bare ticket filename (#1420)', async () => {
  // The filename comes from the browser: a path segment could address another directory, and a
  // sibling name could delete a plan instead of a lock.
  for (const bad of ['../escape.md', 'a/b.md', '2026-07-20_thing.lock.md', '2026-07-20_thing.plan.md', 'thing.txt']) {
    const result = await sendReleaseTicketLock('p1', bad)
    assert.deepEqual(result, { ok: false, error: 'not a ticket filename' }, bad)
  }
})
