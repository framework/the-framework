import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { resolveAgentEventsPath } from './agent-checkout.js'
import { EVENTS_FILE, ARCHIVE_DIR } from './agent-store.js'
import { FRAMEWORK_DIR } from '@better-skills/branch-management'
import { worktreePath } from '@better-skills/branch-management'
// resolveAgentEventsPath probes the real filesystem (same as resolveAgentCheckout), so these
// tests build a throwaway project directory rather than a memory fs.

const RUN_ID = '2026-07-04T00-00-00-000Z'

async function makeProject(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'tf-run-checkout-'))
  await mkdir(join(cwd, FRAMEWORK_DIR), { recursive: true })
  return cwd
}

const rootJournal = (cwd: string): string => join(cwd, FRAMEWORK_DIR, EVENTS_FILE)

async function seedArchive(cwd: string, agentsDir: string): Promise<string> {
  await mkdir(agentsDir, { recursive: true })
  await writeFile(join(agentsDir, `${RUN_ID}.json`), '{}')
  const events = join(agentsDir, `${RUN_ID}.jsonl`)
  await writeFile(events, '')
  return events
}

test('resolveAgentEventsPath: no run id (and unsafe ids) resolve to the root journal', async () => {
  const cwd = await makeProject()
  try {
    assert.equal(await resolveAgentEventsPath(cwd, undefined), rootJournal(cwd))
    assert.equal(await resolveAgentEventsPath(cwd, '../escape'), rootJournal(cwd))
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveAgentEventsPath: an existing worktree resolves to its own journal', async () => {
  const cwd = await makeProject()
  try {
    const worktree = worktreePath(cwd, RUN_ID)
    await mkdir(worktree, { recursive: true })
    assert.equal(await resolveAgentEventsPath(cwd, RUN_ID), join(worktree, FRAMEWORK_DIR, EVENTS_FILE))
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveAgentEventsPath: an ended run (worktree gone) resolves to its archived log, not the root journal (#1472)', async () => {
  const cwd = await makeProject()
  try {
    const events = await seedArchive(cwd, join(cwd, FRAMEWORK_DIR, ARCHIVE_DIR))
    assert.equal(await resolveAgentEventsPath(cwd, RUN_ID), events)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveAgentEventsPath: finds an archive filed under a user dir on the data branch (#1179/#1582)', async () => {
  const cwd = await makeProject()
  try {
    const events = await seedArchive(cwd, join(cwd, FRAMEWORK_DIR, 'branches', 'tf-data', ARCHIVE_DIR, 'someone'))
    assert.equal(await resolveAgentEventsPath(cwd, RUN_ID), events)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveAgentEventsPath: a live worktree beats a stale archive (a resumed run)', async () => {
  const cwd = await makeProject()
  try {
    await seedArchive(cwd, join(cwd, FRAMEWORK_DIR, ARCHIVE_DIR))
    const worktree = worktreePath(cwd, RUN_ID)
    await mkdir(worktree, { recursive: true })
    assert.equal(await resolveAgentEventsPath(cwd, RUN_ID), join(worktree, FRAMEWORK_DIR, EVENTS_FILE))
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveAgentEventsPath: an unknown id with no archive keeps the root-journal fallback (#766 root runs)', async () => {
  const cwd = await makeProject()
  try {
    assert.equal(await resolveAgentEventsPath(cwd, RUN_ID), rootJournal(cwd))
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
