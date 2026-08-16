import { describe, expect, test } from 'vitest'
import type { FrameworkEvent, RunMeta } from '../../dist/index.js'
import { agentSettled, agentViews, pendingChoices, isPublishing, isMetaPublishing, isRunActive, currentRunEvents, runOutcome, actionsRunUrl } from './live-state.js'

const view = (id: string, title: string, markdown: string): FrameworkEvent => ({ kind: 'view', id, title, markdown })
const choice = (id: string, title: string): FrameworkEvent => ({
  kind: 'choice',
  id,
  title,
  options: [{ id: 'a', label: 'A' }],
  recommended: 'a',
})
const resolved = (id: string): FrameworkEvent => ({ kind: 'choice-resolved', id, picked: 'a', by: 'user' })

describe('agentViews', () => {
  test('lists views in first-seen order, one entry each', () => {
    const views = agentViews([view('plan', 'Plan', '# one'), view('diff', 'Diff', '# two')])
    expect(views).toEqual([
      { id: 'plan', title: 'Plan', markdown: '# one' },
      { id: 'diff', title: 'Diff', markdown: '# two' },
    ])
  })

  test('re-showing an id updates it in place rather than stacking a duplicate', () => {
    const views = agentViews([view('plan', 'Plan', '# draft'), view('plan', 'Plan', '# final')])
    expect(views).toEqual([{ id: 'plan', title: 'Plan', markdown: '# final' }])
  })

  test('ignores non-view events', () => {
    expect(agentViews([choice('c1', 'Approve?'), { kind: 'log', message: 'hi' }])).toEqual([])
  })

  test('carries a field added to the view event without a code change here', () => {
    // The mapping strips `kind` and keeps the rest, so an extra field flows through.
    // This is what the old hand-listed `{ id, title, markdown }` mapping would have dropped.
    const extended = { kind: 'view', id: 'plan', title: 'Plan', markdown: '# x', pinned: true } as unknown as FrameworkEvent
    expect(agentViews([extended])).toEqual([{ id: 'plan', title: 'Plan', markdown: '# x', pinned: true }])
  })
})

describe('pendingChoices', () => {
  test('an open choice is pending; a resolved one is not', () => {
    expect(pendingChoices([choice('c1', 'Approve?')]).map(c => c.id)).toEqual(['c1'])
    expect(pendingChoices([choice('c1', 'Approve?'), resolved('c1')])).toEqual([])
  })

  test('tracks several gates at once, in fire order', () => {
    const events = [choice('c1', 'One?'), choice('c2', 'Two?')]
    expect(pendingChoices(events).map(c => c.id)).toEqual(['c1', 'c2'])
  })

  test('strips the kind discriminant from the request', () => {
    const [req] = pendingChoices([choice('c1', 'Approve?')])
    expect(req).not.toHaveProperty('kind')
    expect(req).toMatchObject({ id: 'c1', title: 'Approve?' })
  })

  test('an end event expires every open gate (#1359)', () => {
    // A run that died mid-gate never wrote choice-resolved; the store's surrogate end is what
    // says the question's audience is gone. Rendering past it left the panel answerable forever.
    const end: FrameworkEvent = { kind: 'end', ok: false, stopped: true, detail: 'its process died without reporting an end' }
    expect(pendingChoices([choice('c1', 'One?'), choice('c2', 'Two?'), end])).toEqual([])
    // A gate asked after a (continued) run's next leg opens fresh — end only closes what came before.
    expect(pendingChoices([choice('c1', 'One?'), end, choice('c2', 'Two?')]).map(c => c.id)).toEqual(['c2'])
  })
})

describe('isRunActive', () => {
  test('empty is not active; streamed-but-unended is; ended is not', () => {
    expect(isRunActive([])).toBe(false)
    expect(isRunActive([{ kind: 'log', message: 'go' }])).toBe(true)
    expect(isRunActive([{ kind: 'log', message: 'go' }, { kind: 'end', ok: true }])).toBe(false)
  })

  test('a resumed session is active again: the stopped segment\'s end does not count (#762)', () => {
    // A resume appends a second `session` boundary to the SAME journal. "Was there ever an end"
    // read the resumed-live run as inactive — hiding Stop while the agent worked.
    const resumed = [
      { kind: 'session' },
      { kind: 'end', ok: false, stopped: true },
      { kind: 'session' },
      { kind: 'log', message: 'back at it' },
    ] as FrameworkEvent[]
    expect(isRunActive(resumed)).toBe(true)
  })
})

describe('isPublishing', () => {
  const armed = (push: boolean): FrameworkEvent => ({ kind: 'handoff-armed', push, pr: push }) as FrameworkEvent
  const handoff = (outcome: string): FrameworkEvent => ({ kind: 'handoff', outcome }) as FrameworkEvent

  test('the window opens on a clean armed end and every handoff report closes it (#1431)', () => {
    const running = [armed(true), { kind: 'log', message: 'go' }] as FrameworkEvent[]
    expect(isPublishing(running)).toBe(false)
    const endedClean = [...running, { kind: 'end', ok: true }] as FrameworkEvent[]
    expect(isPublishing(endedClean)).toBe(true)
    // Done, skipped, and failed all report — any of them means the epilogue has spoken.
    for (const outcome of ['done', 'skipped', 'failed']) {
      expect(isPublishing([...endedClean, handoff(outcome)])).toBe(false)
    }
  })

  test('no window without a real arming event, with the push rung off, or on an unclean end', () => {
    // Absent-means-armed defaults must not count: archives from before the handoff mechanism
    // have no `handoff-armed` event and would otherwise read "publishing…" for ever.
    expect(isPublishing([{ kind: 'end', ok: true }] as FrameworkEvent[])).toBe(false)
    expect(isPublishing([armed(false), { kind: 'end', ok: true }] as FrameworkEvent[])).toBe(false)
    expect(isPublishing([armed(true), { kind: 'end', ok: false, stopped: true }] as FrameworkEvent[])).toBe(false)
    expect(isPublishing([armed(true), { kind: 'end', ok: false, detail: 'exit 1' }] as FrameworkEvent[])).toBe(false)
  })

  test("a resumed run's window is its own — the old segment's handoff does not close it, the old arming still counts (#1450)", () => {
    const firstSegment = [
      { kind: 'session' },
      armed(true),
      { kind: 'end', ok: true },
      handoff('done'),
    ] as FrameworkEvent[]
    const resumedEnded = [...firstSegment, { kind: 'session' }, { kind: 'end', ok: true }] as FrameworkEvent[]
    expect(isPublishing(resumedEnded)).toBe(true)
    expect(isPublishing([...resumedEnded, handoff('done')])).toBe(false)
  })
})

describe('isMetaPublishing', () => {
  const meta = (over: Partial<RunMeta>): RunMeta => ({
    version: 2,
    status: 'done',
    id: 'r1',
    startedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    handoff: { push: true, pr: true },
    ...over,
  })

  test('open between a clean end and the folded handoff report (#1455)', () => {
    expect(isMetaPublishing(meta({}))).toBe(true)
    for (const report of ['done', 'skipped', 'failed'] as const) {
      expect(isMetaPublishing(meta({ handoffReport: report }))).toBe(false)
    }
  })

  test('no window while running, on an unclean end, or with the push rung off', () => {
    expect(isMetaPublishing(meta({ status: 'running' }))).toBe(false)
    expect(isMetaPublishing(meta({ status: 'stopped' }))).toBe(false)
    expect(isMetaPublishing(meta({ status: 'failed' }))).toBe(false)
    expect(isMetaPublishing(meta({ handoff: { push: false, pr: false } }))).toBe(false)
    const { handoff: _handoff, ...unarmed } = meta({})
    expect(isMetaPublishing(unarmed as RunMeta)).toBe(false)
  })

  test('a pre-fold record (version 1) never reads as publishing — its report just never landed', () => {
    expect(isMetaPublishing(meta({ version: 1 }))).toBe(false)
  })
})

describe('currentRunEvents', () => {
  const session = (workspace: string): FrameworkEvent => ({ kind: 'session', driver: 'claude', workspace, fake: false })

  test('returns the feed whole when no run has opened yet', () => {
    const events: FrameworkEvent[] = [{ kind: 'log', message: 'warming up' }]
    expect(currentRunEvents(events)).toEqual(events)
  })

  test('keeps a single run intact, session-first', () => {
    const events: FrameworkEvent[] = [session('/repo'), { kind: 'log', message: 'go' }, { kind: 'end', ok: true }]
    expect(currentRunEvents(events)).toEqual(events)
  })

  test('drops a previous run once a new run opens (the bug)', () => {
    const events: FrameworkEvent[] = [
      session('/repo'),
      { kind: 'log', message: 'run 1' },
      { kind: 'end', ok: true },
      session('/repo'),
      { kind: 'log', message: 'run 2' },
    ]
    expect(currentRunEvents(events)).toEqual([session('/repo'), { kind: 'log', message: 'run 2' }])
  })

  test('a just-finished second run keeps its own end, not the first run', () => {
    const events: FrameworkEvent[] = [
      session('/repo'),
      { kind: 'log', message: 'run 1' },
      { kind: 'end', ok: true },
      session('/repo'),
      { kind: 'log', message: 'run 2' },
      { kind: 'end', ok: false, stopped: true },
    ]
    expect(currentRunEvents(events)).toEqual([
      session('/repo'),
      { kind: 'log', message: 'run 2' },
      { kind: 'end', ok: false, stopped: true },
    ])
  })
})

// #948: the overview pill must tell a crash, a user stop, and a clean finish apart.
describe('runOutcome', () => {
  test('undefined while the run is still going', () => {
    expect(runOutcome([{ kind: 'log', message: 'hi' }])).toBeUndefined()
  })

  test('a clean end', () => {
    expect(runOutcome([{ kind: 'end', ok: true }])).toEqual({ ok: true, stopped: false })
  })

  test('a failure carries its detail', () => {
    expect(runOutcome([{ kind: 'end', ok: false, detail: 'driver exited 1' }])).toEqual({
      ok: false,
      stopped: false,
      detail: 'driver exited 1',
    })
  })

  test('a user stop is a stop, not a failure', () => {
    expect(runOutcome([{ kind: 'end', ok: false, stopped: true }])).toEqual({ ok: false, stopped: true })
  })

  test('a resumed session has no outcome until ITS segment ends (#762)', () => {
    // First-end-wins kept a resumed run "stopped" for ever: while it was live again, and even
    // after it later finished clean. The ending is the current segment's, or nothing yet.
    const stopped = { kind: 'end', ok: false, stopped: true }
    const midResume = [{ kind: 'session' }, stopped, { kind: 'session' }, { kind: 'log', message: 'go' }] as FrameworkEvent[]
    expect(runOutcome(midResume)).toBeUndefined()
    const finishedClean = [...midResume, { kind: 'end', ok: true }] as FrameworkEvent[]
    expect(runOutcome(finishedClean)).toEqual({ ok: true, stopped: false })
  })
})

describe('actionsRunUrl', () => {
  const action = (label: string): FrameworkEvent => ({ kind: 'driver', event: { type: 'action', label } })

  test('extracts the html_url from the ActionsDriver run action', () => {
    expect(actionsRunUrl([action('run https://github.com/o/r/actions/runs/42')])).toBe(
      'https://github.com/o/r/actions/runs/42',
    )
  })

  test('undefined before the run action has fired', () => {
    expect(actionsRunUrl([{ kind: 'driver', event: { type: 'start', prompt: 'go' } }])).toBeUndefined()
  })

  test('a plain tool action is not mistaken for a run url', () => {
    expect(actionsRunUrl([action('Edit')])).toBeUndefined()
  })

  test('the most recent run wins across turns', () => {
    expect(
      actionsRunUrl([action('run https://github.com/o/r/actions/runs/1'), action('run https://github.com/o/r/actions/runs/2')]),
    ).toBe('https://github.com/o/r/actions/runs/2')
  })
})

describe('agentSettled (#1173)', () => {
  test('a session parked on you is settled, though its process is still up', () => {
    // The whole bug: this run is `status: running` and will stay that way for as long as the
    // conversation is open (#714), so anything keyed off liveness thinks the agent is still working.
    expect(agentSettled([{ kind: 'log', message: 'go' }, { kind: 'settled' }])).toBe(true)
    expect(agentSettled([{ kind: 'log', message: 'go' }])).toBe(false)
    expect(agentSettled([])).toBe(false)
  })

  test('a new turn un-settles it, so answering a parked session puts it back to work', () => {
    expect(
      agentSettled([
        { kind: 'settled' },
        { kind: 'driver', event: { type: 'start' } } as never,
      ]),
    ).toBe(false)
    // ...and settling again after that turn parks it once more.
    expect(
      agentSettled([
        { kind: 'settled' },
        { kind: 'driver', event: { type: 'start' } } as never,
        { kind: 'settled' },
      ]),
    ).toBe(true)
  })

  test('a run that ended is not "settled" — it is over, which liveness already says', () => {
    expect(agentSettled([{ kind: 'settled' }, { kind: 'end', ok: true }])).toBe(false)
  })
})
