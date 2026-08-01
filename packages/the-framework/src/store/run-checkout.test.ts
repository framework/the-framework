import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { resolveRunEventsPath } from './run-checkout.js'
import { FRAMEWORK_DIR, EVENTS_FILE, WORKTREES_DIR, RUNS_DIR, SESSIONS_DIR } from './run-store.js'

// resolveRunEventsPath probes the real filesystem (same as resolveRunCheckout), so these
// tests build a throwaway project directory rather than a memory fs.

const RUN_ID = '2026-07-04T00-00-00-000Z'

async function makeProject(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'tf-run-checkout-'))
  await mkdir(join(cwd, FRAMEWORK_DIR), { recursive: true })
  return cwd
}

const rootJournal = (cwd: string): string => join(cwd, FRAMEWORK_DIR, EVENTS_FILE)

async function seedArchive(cwd: string, runsDir: string): Promise<string> {
  await mkdir(runsDir, { recursive: true })
  await writeFile(join(runsDir, `${RUN_ID}.json`), '{}')
  const events = join(runsDir, `${RUN_ID}.jsonl`)
  await writeFile(events, '')
  return events
}

test('resolveRunEventsPath: no run id (and unsafe ids) resolve to the root journal', async () => {
  const cwd = await makeProject()
  try {
    assert.equal(await resolveRunEventsPath(cwd, undefined), rootJournal(cwd))
    assert.equal(await resolveRunEventsPath(cwd, '../escape'), rootJournal(cwd))
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveRunEventsPath: an existing worktree resolves to its own journal', async () => {
  const cwd = await makeProject()
  try {
    const worktree = join(cwd, FRAMEWORK_DIR, WORKTREES_DIR, RUN_ID)
    await mkdir(worktree, { recursive: true })
    assert.equal(await resolveRunEventsPath(cwd, RUN_ID), join(worktree, FRAMEWORK_DIR, EVENTS_FILE))
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveRunEventsPath: an ended run (worktree gone) resolves to its archived log, not the root journal (#1472)', async () => {
  const cwd = await makeProject()
  try {
    const events = await seedArchive(cwd, join(cwd, FRAMEWORK_DIR, RUNS_DIR))
    assert.equal(await resolveRunEventsPath(cwd, RUN_ID), events)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveRunEventsPath: finds an archive filed under a user sessions dir (#1179)', async () => {
  const cwd = await makeProject()
  try {
    const events = await seedArchive(cwd, join(cwd, FRAMEWORK_DIR, 'someone', SESSIONS_DIR))
    assert.equal(await resolveRunEventsPath(cwd, RUN_ID), events)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveRunEventsPath: a live worktree beats a stale archive (a resumed run)', async () => {
  const cwd = await makeProject()
  try {
    await seedArchive(cwd, join(cwd, FRAMEWORK_DIR, RUNS_DIR))
    const worktree = join(cwd, FRAMEWORK_DIR, WORKTREES_DIR, RUN_ID)
    await mkdir(worktree, { recursive: true })
    assert.equal(await resolveRunEventsPath(cwd, RUN_ID), join(worktree, FRAMEWORK_DIR, EVENTS_FILE))
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveRunEventsPath: an unknown id with no archive keeps the root-journal fallback (#766 root runs)', async () => {
  const cwd = await makeProject()
  try {
    assert.equal(await resolveRunEventsPath(cwd, RUN_ID), rootJournal(cwd))
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
