import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ghPrList, ghPrView } from './gh.js'
import type { GhRunner } from './gh.js'

/** A `gh` that answers with `stdout`, or rejects, and records what it was asked. */
function fakeGh(stdout: string | Error): { gh: GhRunner; calls: string[][] } {
  const calls: string[][] = []
  const gh: GhRunner = async args => {
    calls.push(args)
    if (stdout instanceof Error) throw stdout
    return stdout
  }
  return { gh, calls }
}


// #1334, found by dogfooding: `PR_VIEW_FIELDS` asked for `number,url,state,title` only, and the
// copy-out below it dropped anything else anyway. So every caller of this path got a `LinkedPr`
// with no `createdAt` — and the CI watch reads exactly that to decide whether a check-less PR has
// outlived the window a check suite takes to attach. With the age unknowable, such a PR was never
// merged at all: an armed auto-merge on a repo without CI hung open forever.
//
// Both tests go through the real field list on purpose. The bug survived because every ci-watch
// test injects its own PR lookup, so the one thing that was wrong — what this function asks `gh`
// for, and what it keeps of the answer — was the one thing nothing exercised.
test('the PR read asks gh for every field LinkedPr carries (#1334)', async () => {
  const { gh, calls } = fakeGh('{}')
  await ghPrView('/repo', 'agent-thing', gh)
  const fields = calls[0]?.[calls[0].indexOf('--json') + 1] ?? ''
  for (const field of ['number', 'url', 'state', 'title', 'createdAt', 'headRefOid'])
    assert.ok(fields.split(',').includes(field), `--json must ask for ${field}, got "${fields}"`)
})

test('the PR read keeps the creation time the CI watch decides on (#1334)', async () => {
  const { gh } = fakeGh(
    JSON.stringify({
      number: 2,
      url: 'https://github.com/o/r/pull/2',
      state: 'OPEN',
      title: 'Add a LICENSE file',
      createdAt: '2026-08-21T10:47:50Z',
      headRefOid: 'f1789c5ebaab4cfb79e4ea214508daee147a4092',
    }),
  )
  const pr = await ghPrView('/repo', 'agent-thing', gh)
  assert.equal(pr?.createdAt, '2026-08-21T10:47:50Z')
  assert.equal(pr?.headRefOid, 'f1789c5ebaab4cfb79e4ea214508daee147a4092')
})

test('a field gh does not answer with is absent rather than undefined-valued', async () => {
  // The copy-out stays conditional: a PR read that came back without a creation time must not
  // manufacture the key, or "we do not know" becomes indistinguishable from "it has none".
  const { gh } = fakeGh(JSON.stringify({ number: 2, url: 'u', state: 'OPEN', title: 't' }))
  const pr = await ghPrView('/repo', 'agent-thing', gh)
  assert.ok(pr && !('createdAt' in pr), 'createdAt must not be present when gh did not answer with it')
})

test('ghPrList reports a gh that could not answer, rather than calling it an empty queue (#1623)', async () => {
  // Every other read here forgives its own failure. This one must not: its caller keeps a baseline
  // of what it has already announced, and "no PRs" swallowed from "no answer" makes the next good
  // read announce the entire open backlog as new.
  const { gh } = fakeGh(new Error('gh: not authenticated'))
  await assert.rejects(ghPrList('/repo', gh))
})

test('ghPrList reads the open PRs when gh answers (#1623)', async () => {
  const { gh, calls } = fakeGh(JSON.stringify([{ number: 3, title: 'a fix', url: 'u3', isDraft: false }]))
  assert.deepEqual((await ghPrList('/repo', gh)).map(pr => pr.number), [3])
  assert.ok(calls[0]!.includes('--json'))
})
