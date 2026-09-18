import { describe, expect, test } from 'vitest'
import type { FrameworkEvent } from '../../src/index.js'
import { agentStatusPill, type AgentCardFacts } from './agent-status.js'

const said = { kind: 'driver', event: { type: 'text', text: 'working' } } as FrameworkEvent
const ended = (over: Record<string, unknown>) => ({ kind: 'end', ...over }) as FrameworkEvent
const pr = { number: 7, url: 'https://github.com/o/r/pull/7' }
const card = (over: Partial<AgentCardFacts> = {}): AgentCardFacts => ({ status: 'done', ...over })

describe('agentStatusPill', () => {
  test('says nothing with no line and no card', () => {
    expect(agentStatusPill([])).toBeNull()
  })

  test('pulses while the run is live, settles when it ends', () => {
    expect(agentStatusPill([said])).toMatchObject({ label: 'building…' })
    expect(agentStatusPill([said, ended({ ok: true })])).toMatchObject({ label: 'finished' })
  })

  test('a card alone says the run builds, before its first line lands', () => {
    expect(agentStatusPill([], card({ status: 'running' }))).toMatchObject({ label: 'building…' })
  })

  test('ready for merge, once the run ended clean with a pull request on its card', () => {
    expect(agentStatusPill([said, ended({ ok: true })], card({ pr }))).toMatchObject({ label: 'ready for merge' })
    // Still working, the pull request of an earlier leg is not the word yet.
    expect(agentStatusPill([said], card({ status: 'running', pr }))).toMatchObject({ label: 'building…' })
  })

  // The states are exclusive by construction — one agent, one word. How the run ENDED wins over a
  // pull request it opened on the way: the green would otherwise be a lie (#948).
  test('stopped outranks a pull request', () => {
    expect(agentStatusPill([said, ended({ ok: false, stopped: true })], card({ status: 'stopped', pr }))).toMatchObject({ label: 'stopped' })
  })

  test('failed outranks a pull request, and carries the reason', () => {
    expect(agentStatusPill([said, ended({ ok: false, detail: 'exit 1' })], card({ status: 'failed', pr }))).toMatchObject({
      label: 'failed — exit 1',
    })
  })

  test('publishing… while the daemon marks the ended run publishing, above ready for merge (#1431)', () => {
    const endedClean = [said, ended({ ok: true })]
    expect(agentStatusPill(endedClean, card({ publishing: true }))).toMatchObject({ label: 'publishing…' })
    expect(agentStatusPill(endedClean, card({ publishing: true, pr }))).toMatchObject({ label: 'publishing…' })
    expect(agentStatusPill(endedClean, card({ pr }))).toMatchObject({ label: 'ready for merge' })
    expect(agentStatusPill(endedClean, card())).toMatchObject({ label: 'finished' })
  })

  test('the feed says how the current leg ended, the card when the feed has no ending', () => {
    // The feed is ahead of the 2 s runs poll: a leg that just ended is ended, whatever the card says yet.
    expect(agentStatusPill([said, ended({ ok: false, stopped: true })], card({ status: 'running' }))).toMatchObject({ label: 'stopped' })
    // No feed yet: the card's ending is the pill.
    expect(agentStatusPill([], card({ status: 'failed' }))).toMatchObject({ label: 'failed' })
    expect(agentStatusPill([], card({ status: 'waiting' }))).toMatchObject({ label: 'waiting for an answer' })
    expect(agentStatusPill([], card({ pr }))).toMatchObject({ label: 'ready for merge' })
    // A diary whose process died before its last line: the card's ending still settles the pill.
    expect(agentStatusPill([said], card({ status: 'failed' }))).toMatchObject({ label: 'failed' })
  })

  test('a resumed session builds again — the stopped segment does not hold the pill (#762)', () => {
    // A resume appends a second `session` boundary to the same journal; the yellow "stopped"
    // stuck to a live agent because first-end-wins outranked everything that followed.
    const resumed = [said, ended({ ok: false, stopped: true }), { kind: 'session' } as FrameworkEvent]
    expect(agentStatusPill(resumed)).toMatchObject({ label: 'building…' })
    expect(agentStatusPill([...resumed, ended({ ok: true })])).toMatchObject({ label: 'finished' })
  })

  // A run that asked ends on its question (#1774): not failed, not finished, waiting on you.
  test('a run that ended on its question says it waits for an answer, not that it failed', () => {
    expect(agentStatusPill([said, ended({ ok: false, waiting: true })])).toMatchObject({ label: 'waiting for an answer', tone: 'text-warning' })
  })

  test('answered, the same run builds again: the leg it waited in is behind it', () => {
    const next = { kind: 'driver', event: { type: 'text', text: 'On it.' } } as FrameworkEvent
    const answered = [said, ended({ ok: false, waiting: true }), next]
    expect(agentStatusPill(answered)).toMatchObject({ label: 'building…' })
    expect(agentStatusPill([...answered, ended({ ok: true })])).toMatchObject({ label: 'finished' })
  })
})
