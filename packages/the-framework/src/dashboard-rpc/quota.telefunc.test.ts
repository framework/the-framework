import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { provideTelefuncContext } from 'telefunc'
import { sendAutoPmSweep } from './quota.telefunc.js'
import type { AutoPmOutcome } from '../auto-pm.js'

// #1433: "Trigger routine now" was fire-and-forget — the RPC returned before the sweep ran, so
// the button flashed and the card showed nothing, with the stand-down reason recoverable only
// from the source. The RPC now awaits the tick and hands back the report's outcome lines.

const OUTCOME: AutoPmOutcome = {
  projectId: 'p1',
  path: '/repo',
  started: false,
  message: 'the queue has work waiting and its routine is switched off',
}

test('sendAutoPmSweep awaits the sweep, then answers with the outcomes it decided (#1433)', async () => {
  let resolved = false
  provideTelefuncContext({
    autoPmSweep: async () => {
      // Awaitable on purpose: the outcomes are only true once the tick has run.
      await Promise.resolve()
      resolved = true
    },
    autoPm: () => ({ nextSweepAt: 0, outcomes: [OUTCOME] }),
  } as never)
  const result = await sendAutoPmSweep()
  assert.equal(resolved, true, 'the RPC must wait for the tick, not fire and forget')
  assert.deepEqual(result, { ok: true, outcomes: [OUTCOME] })
})

test('a host with no loop still answers ok:false — the relay has nothing to trigger (#1210)', async () => {
  provideTelefuncContext({} as never)
  assert.deepEqual(await sendAutoPmSweep(), { ok: false })
})

test('a sweep that throws is a failure; an unreadable report is not (#1433)', async () => {
  provideTelefuncContext({
    autoPmSweep: async () => {
      throw new Error('boom')
    },
  } as never)
  assert.deepEqual(await sendAutoPmSweep(), { ok: false })

  // The sweep itself ran; only the outcome lines are missing. Said as ok without outcomes, so
  // the card can say "the sweep ran" rather than pretending nothing happened.
  provideTelefuncContext({
    autoPmSweep: () => {},
    autoPm: () => {
      throw new Error('no report')
    },
  } as never)
  assert.deepEqual(await sendAutoPmSweep(), { ok: true })
})

test('drainOnly travels to the loop untouched (#1204)', async () => {
  const seen: unknown[] = []
  provideTelefuncContext({
    autoPmSweep: (opts?: { drainOnly?: boolean }) => {
      seen.push(opts)
    },
    autoPm: () => ({ nextSweepAt: 0, outcomes: [] }),
  } as never)
  await sendAutoPmSweep({ drainOnly: true })
  await sendAutoPmSweep()
  assert.deepEqual(seen, [{ drainOnly: true }, undefined])
})
