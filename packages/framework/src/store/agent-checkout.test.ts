import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { resolveAgentEventsPath } from './agent-checkout.js'
import { worktreePath } from '@gemstack/skill-branches'
import { THE_FRAMEWORK_DIR } from '../framework-dir.js'
import { DATA_BRANCH, fileBranchPath } from '@gemstack/agent-data'
import { RUNS_DIR } from '@gemstack/skill-logs'
// resolveAgentEventsPath probes the real filesystem (same as resolveAgentCheckout), so these
// tests build a throwaway project directory rather than a memory fs.

const RUN_ID = '2026-07-04T00-00-00-000Z'

async function makeProject(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'agent-run-checkout-'))
  await mkdir(join(cwd, THE_FRAMEWORK_DIR), { recursive: true })
  return cwd
}

/** Where the run's diary is while it has a checkout: written there by the run's tool. */
const liveDiary = (cwd: string): string => join(worktreePath(cwd, RUN_ID), THE_FRAMEWORK_DIR, `${RUN_ID}.jsonl`)

async function seedRecord(cwd: string): Promise<string> {
  const agentsDir = join(fileBranchPath(cwd, DATA_BRANCH), RUNS_DIR, 'someone')
  await mkdir(agentsDir, { recursive: true })
  await writeFile(join(agentsDir, `${RUN_ID}.json`), '{}')
  const diary = join(agentsDir, `${RUN_ID}.jsonl`)
  await writeFile(diary, '')
  return diary
}

test('resolveAgentEventsPath: no run id, and an unsafe one, have no diary', async () => {
  const cwd = await makeProject()
  try {
    assert.equal(await resolveAgentEventsPath(cwd, undefined), undefined)
    assert.equal(await resolveAgentEventsPath(cwd, '../escape'), undefined)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveAgentEventsPath: a run with a checkout resolves to the diary in it', async () => {
  const cwd = await makeProject()
  try {
    await mkdir(worktreePath(cwd, RUN_ID), { recursive: true })
    assert.equal(await resolveAgentEventsPath(cwd, RUN_ID), liveDiary(cwd))
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveAgentEventsPath: an ended run (checkout gone) resolves to its recorded diary, under whichever person it is filed (#1472/#1769)', async () => {
  const cwd = await makeProject()
  try {
    const diary = await seedRecord(cwd)
    assert.equal(await resolveAgentEventsPath(cwd, RUN_ID), diary)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveAgentEventsPath: a checkout beats the record (a resumed run)', async () => {
  const cwd = await makeProject()
  try {
    await seedRecord(cwd)
    await mkdir(worktreePath(cwd, RUN_ID), { recursive: true })
    assert.equal(await resolveAgentEventsPath(cwd, RUN_ID), liveDiary(cwd))
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveAgentEventsPath: a run started a moment ago, with no checkout and no diary yet, resolves to where its diary will appear (#1774)', async () => {
  const cwd = await makeProject()
  try {
    assert.equal(await resolveAgentEventsPath(cwd, RUN_ID), liveDiary(cwd))
    // The start's marker may be on the branch already, a card with no diary: still the checkout's.
    const agentsDir = join(fileBranchPath(cwd, DATA_BRANCH), RUNS_DIR, 'someone')
    await mkdir(agentsDir, { recursive: true })
    await writeFile(join(agentsDir, `${RUN_ID}.json`), '{}')
    assert.equal(await resolveAgentEventsPath(cwd, RUN_ID), liveDiary(cwd))
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
