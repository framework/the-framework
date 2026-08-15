import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ciFixMarker,
  ciFixPrompt,
  sweepProjectCi,
  startCiWatch,
  CI_WATCH_WINDOW_MS,
  NO_CHECKS_GRACE_MS,
  type CiFixRequest,
  type CiSweepDeps,
} from './ci-watch.js'
import type { RunMeta } from './store/index.js'
import type { LinkedPr, PrCiStatus } from './dashboard/gh.js'
import type { HandoffResult } from './dashboard/run-handoff.js'

const NOW = Date.parse('2026-08-01T12:00:00Z')

function meta(overrides: Partial<RunMeta> = {}): RunMeta {
  return {
    version: 2,
    status: 'done',
    id: 'run-1',
    startedAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T11:00:00.000Z',
    mergeOutcome: 'watched',
    ...overrides,
  }
}

function openPr(overrides: Partial<LinkedPr> = {}): LinkedPr {
  return { number: 5, url: 'https://x/pull/5', state: 'OPEN', title: 'a change', createdAt: '2026-08-01T10:30:00.000Z', ...overrides }
}

/** Seams for one sweep: a fixed PR + CI answer, recording what was merged and fixed. */
function sweepDeps(
  pr: LinkedPr | undefined,
  ci: PrCiStatus,
  opts: { merge?: HandoffResult; fix?: string; metas?: RunMeta[] } = {},
): { deps: CiSweepDeps; merges: string[]; fixes: CiFixRequest[] } {
  const merges: string[] = []
  const fixes: CiFixRequest[] = []
  const deps: CiSweepDeps = {
    runs: async () => opts.metas ?? [meta()],
    pr: async () => ({ value: pr, pending: false }),
    ci: async () => ci,
    merge: async (_cwd, run) => {
      merges.push(run.id)
      return opts.merge ?? (pr?.url ? { ok: true, url: pr.url } : { ok: true })
    },
    fix: async (_cwd, request) => {
      fixes.push(request)
      return opts.fix
    },
    now: () => NOW,
  }
  return { deps, merges, fixes }
}

test('a watched PR whose checks pass is merged (#1418)', async () => {
  const { deps, merges } = sweepDeps(openPr(), { checks: 'passing', failed: [] })
  const result = await sweepProjectCi('/p', deps)
  assert.deepEqual(merges, ['run-1'])
  assert.deepEqual(result.merged, [{ runId: 'run-1', number: 5, url: 'https://x/pull/5' }])
  assert.deepEqual(result.failed, [])
})

test('an auto-armed PR is never merged here: GitHub holds that promise', async () => {
  const { deps, merges } = sweepDeps(openPr(), { checks: 'passing', failed: [] }, { metas: [meta({ mergeOutcome: 'auto-armed' })] })
  const result = await sweepProjectCi('/p', deps)
  assert.deepEqual(merges, [])
  assert.deepEqual(result.merged, [])
})

test('pending checks wait for the next tick: no merge, no fix', async () => {
  const { deps, merges, fixes } = sweepDeps(openPr(), { checks: 'pending', failed: [] })
  const result = await sweepProjectCi('/p', deps)
  assert.deepEqual(merges, [])
  assert.deepEqual(fixes, [])
  assert.deepEqual(result, { merged: [], failed: [], fixes: [] })
})

test('a check-less PR younger than the attach grace is not merged — the #1406 window', async () => {
  const justOpened = openPr({ createdAt: new Date(NOW - NO_CHECKS_GRACE_MS + 1000).toISOString() })
  const { deps, merges } = sweepDeps(justOpened, { checks: 'none', failed: [] })
  await sweepProjectCi('/p', deps)
  assert.deepEqual(merges, [])
})

test('a check-less PR past the grace merges: the repo genuinely has no CI', async () => {
  const settled = openPr({ createdAt: new Date(NOW - NO_CHECKS_GRACE_MS - 1000).toISOString() })
  const { deps, merges } = sweepDeps(settled, { checks: 'none', failed: [] })
  await sweepProjectCi('/p', deps)
  assert.deepEqual(merges, ['run-1'])
})

test('a check-less PR with no createdAt never merges: age unknowable', async () => {
  const { deps, merges } = sweepDeps(openPr({ createdAt: undefined as unknown as string }), { checks: 'none', failed: [] })
  await sweepProjectCi('/p', deps)
  assert.deepEqual(merges, [])
})

test('a PR that is no longer open is done: merged and closed both leave the sweep alone', async () => {
  for (const state of ['MERGED', 'CLOSED']) {
    const { deps, merges, fixes } = sweepDeps(openPr({ state }), { checks: 'passing', failed: [] })
    await sweepProjectCi('/p', deps)
    assert.deepEqual(merges, [])
    assert.deepEqual(fixes, [])
  }
})

test('runs still running, without a merge outcome, or older than the window are not candidates', async () => {
  const stale = new Date(NOW - CI_WATCH_WINDOW_MS - 1000).toISOString()
  const { mergeOutcome: _none, ...plain } = meta({ id: 'plain' })
  const metas = [
    meta({ id: 'live', status: 'running' }),
    plain as RunMeta,
    meta({ id: 'merged-directly', mergeOutcome: 'merged' }),
    meta({ id: 'old', updatedAt: stale }),
  ]
  const { deps, merges, fixes } = sweepDeps(openPr(), { checks: 'passing', failed: [] }, { metas })
  const result = await sweepProjectCi('/p', deps)
  assert.deepEqual(merges, [])
  assert.deepEqual(fixes, [])
  assert.deepEqual(result, { merged: [], failed: [], fixes: [] })
})

test('two runs resolving to the same PR cost one read and at most one merge', async () => {
  const metas = [meta({ id: 'a' }), meta({ id: 'b' })]
  const { deps, merges } = sweepDeps(openPr(), { checks: 'passing', failed: [] }, { metas })
  await sweepProjectCi('/p', deps)
  assert.deepEqual(merges, ['a'])
})

test('a failed merge is recorded and not retried while the daemon remembers it', async () => {
  const attempted = new Set<string>()
  const { deps, merges } = sweepDeps(openPr(), { checks: 'passing', failed: [] }, { merge: { ok: false, error: 'review required' } })
  deps.attemptedMerges = attempted
  const first = await sweepProjectCi('/p', deps)
  assert.deepEqual(first.failed, [{ runId: 'run-1', number: 5, error: 'review required' }])
  assert.equal(attempted.size, 1)
  const second = await sweepProjectCi('/p', deps)
  assert.deepEqual(second.failed, [])
  assert.deepEqual(merges, ['run-1'])
})

test('a failed merge re-arms when the PR head changes — a resolved conflict retries (#1484)', async () => {
  const status: PrCiStatus = { checks: 'passing', failed: [], headSha: 'aaa1111' }
  const { deps, merges } = sweepDeps(openPr(), status, { merge: { ok: false, error: 'not mergeable' } })
  deps.attemptedMerges = new Set<string>()
  await sweepProjectCi('/p', deps)
  assert.deepEqual(merges, ['run-1'])
  // Same head: remembered, not retried — the guard still holds against per-tick gh spend.
  await sweepProjectCi('/p', deps)
  assert.deepEqual(merges, ['run-1'])
  // A push changed the head (the conflict was fixed, checks reran green): one more attempt.
  status.headSha = 'bbb2222'
  await sweepProjectCi('/p', deps)
  assert.deepEqual(merges, ['run-1', 'run-1'])
})

const RED: PrCiStatus = { checks: 'failing', failed: ['build'], headSha: 'abc1234', branch: 'the-framework/change' }

test('failing checks start one fix session, told the branch, head sha and failed checks (#1418)', async () => {
  const { deps, merges, fixes } = sweepDeps(openPr(), RED, { fix: 'fix-run-1' })
  const result = await sweepProjectCi('/p', deps)
  assert.deepEqual(merges, [])
  assert.equal(fixes.length, 1)
  assert.deepEqual(fixes[0], {
    number: 5,
    title: 'a change',
    url: 'https://x/pull/5',
    branch: 'the-framework/change',
    headSha: 'abc1234',
    failed: ['build'],
  })
  assert.deepEqual(result.fixes, [{ number: 5, runId: 'fix-run-1' }])
})

test('an auto-armed PR going red still gets a fix: GitHub merges on green, nobody else fixes red', async () => {
  const { deps, fixes } = sweepDeps(openPr(), RED, { fix: 'fix-run-1', metas: [meta({ mergeOutcome: 'auto-armed' })] })
  await sweepProjectCi('/p', deps)
  assert.equal(fixes.length, 1)
})

test('one fix per failing head commit: a recorded attempt for the same sha stands down', async () => {
  const metas = [meta(), meta({ id: 'prior-fix', intent: `${ciFixMarker(5, 'abc1234')}\n\nCI is red…` })]
  const { deps, fixes } = sweepDeps(openPr(), RED, { fix: 'fix-run-2', metas })
  const result = await sweepProjectCi('/p', deps)
  assert.deepEqual(fixes, [])
  assert.deepEqual(result.fixes, [])
})

test('a fix still running holds the next one back, whatever sha it was started for', async () => {
  const metas = [meta(), meta({ id: 'prior-fix', status: 'running', intent: `${ciFixMarker(5, 'older00')}\n…` })]
  const { deps, fixes } = sweepDeps(openPr(), RED, { fix: 'fix-run-2', metas })
  await sweepProjectCi('/p', deps)
  assert.deepEqual(fixes, [])
})

test('the attempts cap stands the sweep down for good, and says so once', async () => {
  const metas = [
    meta(),
    meta({ id: 'fix-1', intent: `${ciFixMarker(5, 'older00')}\n…` }),
    meta({ id: 'fix-2', intent: `${ciFixMarker(5, 'older11')}\n…` }),
  ]
  const { deps, fixes } = sweepDeps(openPr(), RED, { fix: 'fix-run-3', metas })
  const result = await sweepProjectCi('/p', deps)
  assert.deepEqual(fixes, [])
  assert.deepEqual(result.fixes, [{ number: 5, reason: 'attempts-exhausted' }])
})

test('attempts for PR #12 do not count against PR #123: the marker cannot prefix-collide', async () => {
  assert.ok(!ciFixMarker(123, 'abc').startsWith(ciFixMarker(12)))
  const metas = [meta(), meta({ id: 'other-fix', intent: `${ciFixMarker(51, 'abc1234')}\n…` })]
  const { deps, fixes } = sweepDeps(openPr(), RED, { fix: 'fix-run-1', metas })
  await sweepProjectCi('/p', deps)
  assert.equal(fixes.length, 1)
})

test('no head sha or branch on the checks read: stand down rather than guess', async () => {
  const { deps, fixes } = sweepDeps(openPr(), { checks: 'failing', failed: ['build'] }, { fix: 'fix-run-1' })
  const result = await sweepProjectCi('/p', deps)
  assert.deepEqual(fixes, [])
  assert.deepEqual(result.fixes, [])
})

test('a declined fix (gate, quota) is reported as declined, not as started', async () => {
  const { deps } = sweepDeps(openPr(), RED)
  const declined: CiSweepDeps = { ...deps, fix: async () => undefined }
  const result = await sweepProjectCi('/p', declined)
  assert.deepEqual(result.fixes, [{ number: 5, reason: 'declined' }])
})

test('with no fix wiring the red PR is simply left alone', async () => {
  const { deps } = sweepDeps(openPr(), RED)
  delete deps.fix
  const result = await sweepProjectCi('/p', deps)
  assert.deepEqual(result.fixes, [])
})

test('the fix prompt opens with the durable marker and lands the fix on the PR branch', () => {
  const prompt = ciFixPrompt({ number: 7, title: 't', url: 'u', branch: 'the-framework/x', headSha: 'abc', failed: ['build', 'test'] })
  assert.ok(prompt.startsWith(ciFixMarker(7, 'abc')))
  assert.match(prompt, /git push origin HEAD:the-framework\/x/)
  assert.match(prompt, /build, test/)
  assert.match(prompt, /Do NOT open a new PR/)
})

test('startCiWatch sweeps immediately, logs merges every time and repeated refusals once', async () => {
  const lines: string[] = []
  const mergeResult: HandoffResult = { ok: false, error: 'review required' }
  const watch = startCiWatch({
    projects: async () => [{ path: '/p' }],
    log: line => lines.push(line),
    intervalMs: 60_000,
    deps: {
      runs: async () => [meta()],
      pr: async () => ({ value: openPr(), pending: false }),
      ci: async () => ({ checks: 'passing', failed: [] }) as PrCiStatus,
      merge: async () => mergeResult,
      now: () => NOW,
    },
  })
  await watch.tick()
  assert.equal(lines.filter(l => l.includes('could not merge PR #5')).length, 1)
  // The attempted-merge memory holds the retry back; the line is not said again either.
  await watch.tick()
  assert.equal(lines.filter(l => l.includes('could not merge PR #5')).length, 1)
  watch.stop()
})
