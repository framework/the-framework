import { describe, expect, test } from 'vitest'
import type { FrameworkEvent } from '@gemstack/the-framework'
import { runStatusPill } from './run-status.js'

const named = { kind: 'session-name', name: 'relay smoke test' } as FrameworkEvent
const readyForMerge = { kind: 'ready-for-merge' } as FrameworkEvent
const ended = (over: Record<string, unknown>) => ({ kind: 'end', ...over }) as FrameworkEvent
const armedPush = { kind: 'handoff-armed', push: true, pr: true } as FrameworkEvent
const handoffDone = { kind: 'handoff', outcome: 'done', pushed: true } as FrameworkEvent

describe('runStatusPill', () => {
  test('says nothing until the run has', () => {
    expect(runStatusPill([])).toBeNull()
    expect(runStatusPill([{ kind: 'log', message: 'working' } as FrameworkEvent])).toBeNull()
  })

  test('pulses while the run is live, settles when it ends', () => {
    expect(runStatusPill([named])).toMatchObject({ label: 'building…' })
    expect(runStatusPill([named, ended({ ok: true })])).toMatchObject({ label: 'finished' })
  })

  test('ready for merge, once the run signals it', () => {
    expect(runStatusPill([named, readyForMerge, ended({ ok: true })])).toMatchObject({ label: 'ready for merge' })
  })

  // The states are exclusive by construction — one run, one word. These two hold the facts at the
  // same time (the run said ready-for-merge, then was stopped / then failed), and how it ENDED
  // wins: the green would otherwise be a lie about a run that did not get there (#948).
  test('stopped outranks an earlier ready-for-merge', () => {
    expect(runStatusPill([named, readyForMerge, ended({ ok: false, stopped: true })])).toMatchObject({ label: 'stopped' })
  })

  test('failed outranks an earlier ready-for-merge, and carries the reason', () => {
    expect(runStatusPill([named, readyForMerge, ended({ ok: false, detail: 'exit 1' })])).toMatchObject({
      label: 'failed — exit 1',
    })
  })

  test('publishing… between a clean end and the handoff report, when armed to push (#1431)', () => {
    expect(runStatusPill([armedPush, named, ended({ ok: true })])).toMatchObject({ label: 'publishing…' })
    expect(runStatusPill([armedPush, named, ended({ ok: true }), handoffDone])).toMatchObject({ label: 'finished' })
  })

  test('publishing outranks ready-for-merge — the merge itself is part of the handoff still running (#1431)', () => {
    const armedMerge = { kind: 'handoff-armed', push: true, pr: true, merge: true } as FrameworkEvent
    const run = [armedMerge, named, readyForMerge, ended({ ok: true })]
    expect(runStatusPill(run)).toMatchObject({ label: 'publishing…' })
    expect(runStatusPill([...run, handoffDone])).toMatchObject({ label: 'ready for merge' })
  })

  test('no publishing window when disarmed, never armed, or not cleanly ended (#1431)', () => {
    const disarmed = { kind: 'handoff-armed', push: false, pr: false } as FrameworkEvent
    expect(runStatusPill([disarmed, named, ended({ ok: true })])).toMatchObject({ label: 'finished' })
    // No arming event at all: an archive from before the handoff mechanism must not read as
    // forever-publishing — absent-means-armed defaults do not open the window.
    expect(runStatusPill([named, ended({ ok: true })])).toMatchObject({ label: 'finished' })
    expect(runStatusPill([armedPush, named, ended({ ok: false, stopped: true })])).toMatchObject({ label: 'stopped' })
  })

  test("a resumed run publishes again — the old segment's handoff does not hide the new window (#1450)", () => {
    const firstSegment = [armedPush, named, ended({ ok: true }), handoffDone]
    const resumed = [...firstSegment, { kind: 'session' } as FrameworkEvent]
    expect(runStatusPill(resumed)).toMatchObject({ label: 'building…' })
    expect(runStatusPill([...resumed, ended({ ok: true })])).toMatchObject({ label: 'publishing…' })
    expect(runStatusPill([...resumed, ended({ ok: true }), handoffDone])).toMatchObject({ label: 'finished' })
  })

  test('a resumed session builds again — the stopped segment does not hold the pill (#762)', () => {
    // A resume appends a second `session` boundary to the same journal; the yellow "stopped"
    // stuck to a live run because first-end-wins outranked everything that followed.
    const resumed = [named, ended({ ok: false, stopped: true }), { kind: 'session' } as FrameworkEvent]
    expect(runStatusPill(resumed)).toMatchObject({ label: 'building…' })
    expect(runStatusPill([...resumed, ended({ ok: true })])).toMatchObject({ label: 'finished' })
  })
})
