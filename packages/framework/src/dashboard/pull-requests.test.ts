import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cachedPrView, linkedPrOf, openPrOf, openPrs, prView, prsForBranch, prsForBranchOrThrow } from './pull-requests.js'
import type { ForgeFor, ForgeRequest, RequestsOutcome } from '../store/forge.js'

// The dashboard's pull request reads (#1820), all through the forge provider: what is asked of it,
// what is kept of the answer, and which reads forgive a forge that could not answer and which
// must not.

const REQUEST: ForgeRequest = { number: 2, url: 'https://github.com/o/r/pull/2', state: 'open', title: 'Add a LICENSE file', draft: false, branch: 'agent-thing', head: 'f1789c5ebaab4cfb79e4ea214508daee147a4092', createdAt: '2026-08-21T10:47:50Z' }

/** A forge whose `requests` answers as told and records what it was asked. */
function fakeForge(answer: RequestsOutcome): { forge: ForgeFor; asked: unknown[] } {
  const asked: unknown[] = []
  const forge: ForgeFor = async () => ({
    requests: async opts => {
      asked.push(opts)
      return answer
    },
    open: async () => ({ ok: false, error: 'not here' }),
    merge: async () => ({ ok: false, error: 'not here' }),
    home: async () => undefined,
  })
  return { forge, asked }
}
const noForge: ForgeFor = async () => undefined

test('a request is kept as the framework\'s own shape: the state upper-cased, the head as the commit, and a field the forge did not answer absent rather than undefined-valued', () => {
  assert.deepEqual(linkedPrOf(REQUEST), { number: 2, url: 'https://github.com/o/r/pull/2', state: 'OPEN', title: 'Add a LICENSE file', createdAt: '2026-08-21T10:47:50Z', headRefOid: 'f1789c5ebaab4cfb79e4ea214508daee147a4092' })
  // "We do not know" must stay distinguishable from "it has none": the CI-age decision reads createdAt (#1334).
  const bare = linkedPrOf({ ...REQUEST, createdAt: '', head: '' })
  assert.ok(!('createdAt' in bare) && !('headRefOid' in bare))
  assert.deepEqual(openPrOf({ ...REQUEST, draft: true }), { number: 2, title: 'Add a LICENSE file', url: 'https://github.com/o/r/pull/2', isDraft: true, headRefName: 'agent-thing', createdAt: '2026-08-21T10:47:50Z' })
})

test('a branch\'s history asks the forge for every state of that branch; the newest is the branch\'s PR; a project with no forge has none', async () => {
  const { forge, asked } = fakeForge({ ok: true, requests: [REQUEST, { ...REQUEST, number: 1, state: 'merged' }] })
  assert.deepEqual((await prsForBranch('/repo', 'agent-thing', forge)).map(pr => pr.number), [2, 1])
  assert.deepEqual(asked, [{ branch: 'agent-thing', state: 'all' }])
  assert.equal((await prView('/repo', 'agent-thing', forge))?.number, 2)
  assert.deepEqual(await prsForBranch('/repo', 'agent-thing', noForge), [])
  assert.deepEqual(await prsForBranchOrThrow('/repo', 'agent-thing', noForge), [], 'no forge: truthfully no PRs, not a failure')
  assert.deepEqual(await cachedPrView('/repo'), { value: undefined, pending: false }, 'no branch to ask about answers nothing at once')
})

test('a forge that could not answer reads as no history for the panels, and as a failure for a caller about to open a PR (#1601)', async () => {
  const { forge } = fakeForge({ ok: false, error: 'gh: not authenticated' })
  assert.deepEqual(await prsForBranch('/repo', 'agent-thing', forge), [])
  await assert.rejects(prsForBranchOrThrow('/repo', 'agent-thing', forge), /not authenticated/)
})

test('the open PRs are asked by state; a forge that could not answer is a failure, never an empty queue (#1623); a project with no forge has none open', async () => {
  const { forge, asked } = fakeForge({ ok: true, requests: [{ ...REQUEST, number: 3, title: 'a fix' }] })
  assert.deepEqual((await openPrs('/repo', forge)).map(pr => pr.number), [3])
  assert.deepEqual(asked, [{ state: 'open' }])
  await assert.rejects(openPrs('/repo', fakeForge({ ok: false, error: 'gh: not authenticated' }).forge))
  assert.deepEqual(await openPrs('/repo', noForge), [])
})
