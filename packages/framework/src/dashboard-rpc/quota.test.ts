import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { setSpendOffset } from './quota.js'
import type { ProjectSummary } from '../dashboard/projects.js'

// The slider's write (#960): every registered project's `offset` hook line, the hook itself faked.

const project = (name: string): ProjectSummary => ({ id: name, path: `/${name}`, name, activated: true })

test('the points reach every project whose file has the offset line; a project without it is skipped', async () => {
  const ran: string[] = []
  const answer = await setSpendOffset([project('a'), project('b'), project('c')], 12, async (cwd, points) => {
    ran.push(`${cwd} ${points}`)
    return cwd === '/b' ? { ok: false, error: 'this project has no offset hook', noHook: true } : { ok: true }
  })
  assert.deepEqual(answer, { ok: true })
  assert.deepEqual(ran, ['/a 12', '/b 12', '/c 12'])
})

test('no project with the line, a line that fails, and a value that is not a number are each an error in words', async () => {
  const noHook = async () => ({ ok: false as const, error: 'this project has no offset hook', noHook: true as const })
  assert.deepEqual(await setSpendOffset([project('a')], 3, noHook), { ok: false, error: 'no project has an offset hook in .the-framework/hooks.yml' })
  assert.deepEqual(await setSpendOffset([], 3, noHook), { ok: false, error: 'no project has an offset hook in .the-framework/hooks.yml' })
  const failing = async (cwd: string) => (cwd === '/b' ? { ok: false as const, error: 'the offset hook: exit 1' } : { ok: true as const })
  assert.deepEqual(await setSpendOffset([project('a'), project('b')], 3, failing), { ok: false, error: 'b: the offset hook: exit 1' })
  let ran = false
  assert.deepEqual(await setSpendOffset([project('a')], Number.NaN, async () => ((ran = true), { ok: true })), { ok: false, error: 'the spend offset must be a number' })
  assert.equal(ran, false)
})
