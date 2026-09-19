import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { resolveAgentDiary } from './agent-checkout.js'
import { worktreePath } from '@gemstack/skill-branches'
import { THE_FRAMEWORK_DIR } from '../framework-dir.js'
import { noRuns } from './runs.js'
import { testRuns } from './test-runs.js'
// resolveAgentDiary probes the real filesystem for the checkout (same as resolveAgentCheckout), so
// these tests build a throwaway project directory; the finished runs come from a test provider.

const RUN_ID = '2026-07-04T00-00-00-000Z'
const DIARY = [{ kind: 'said', text: 'Reading.' }, { kind: 'ended', status: 'done' }]

async function makeProject(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'agent-run-checkout-'))
  await mkdir(join(cwd, THE_FRAMEWORK_DIR), { recursive: true })
  return cwd
}

/** Where the run's diary is while it has a checkout: written there by the run's tool. */
const liveDiary = (cwd: string): string => join(worktreePath(cwd, RUN_ID), THE_FRAMEWORK_DIR, `${RUN_ID}.jsonl`)

const finishedRun = (cwd: string, status: 'done' | 'running' = 'done') => testRuns({ [cwd]: [{ card: { id: RUN_ID, status }, diary: status === 'done' ? DIARY : [] }] })

test('resolveAgentDiary: no run id, and an unsafe one, have no diary', async () => {
  const cwd = await makeProject()
  try {
    assert.equal(await resolveAgentDiary(cwd, undefined, finishedRun(cwd)), undefined)
    assert.equal(await resolveAgentDiary(cwd, '../escape', finishedRun(cwd)), undefined)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveAgentDiary: a run with a checkout resolves to the diary file in it, even when it has a record (a resumed run)', async () => {
  const cwd = await makeProject()
  try {
    await mkdir(worktreePath(cwd, RUN_ID), { recursive: true })
    assert.deepEqual(await resolveAgentDiary(cwd, RUN_ID, noRuns), { file: liveDiary(cwd) })
    assert.deepEqual(await resolveAgentDiary(cwd, RUN_ID, finishedRun(cwd)), { file: liveDiary(cwd) })
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveAgentDiary: an ended run (checkout gone) resolves to the finished run\'s lines, from the runs provider (#1472/#1769)', async () => {
  const cwd = await makeProject()
  try {
    assert.deepEqual(await resolveAgentDiary(cwd, RUN_ID, finishedRun(cwd)), { finished: DIARY })
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('resolveAgentDiary: a run started a moment ago, with no checkout and no finished record, resolves to where its diary will appear (#1774)', async () => {
  const cwd = await makeProject()
  try {
    assert.deepEqual(await resolveAgentDiary(cwd, RUN_ID, noRuns), { file: liveDiary(cwd) })
    // The start's marker may be recorded already, a card still `running`: not finished, still the checkout's.
    assert.deepEqual(await resolveAgentDiary(cwd, RUN_ID, finishedRun(cwd, 'running')), { file: liveDiary(cwd) })
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
