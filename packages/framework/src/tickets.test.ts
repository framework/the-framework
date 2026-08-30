import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { ticketFromQueueEntry } from '@gemstack/skill-tickets'
import { planAgentFor, planTicketPrompt } from './tickets.js'

test('planTicketPrompt is the one plan ask, and never reads as a queued ticket (#685/#1187)', () => {
  // The exact sentence, pinned: the plan column starts an agent with it, the queue-add writes it
  // as an entry, and the dedupe recognizes a queued copy by this text — one wording for all three.
  assert.equal(planTicketPrompt('2026-07-25_login.md'), 'Create tickets/2026-07-25_login.plan.md')
  // As a queue entry it stays plain text: a leading ticket link means "queued for implementation",
  // which a plan ask must not read as.
  assert.equal(ticketFromQueueEntry(planTicketPrompt('2026-07-25_login.md')), undefined)
})

test('planAgentFor names the newest agent whose ask was this plan (#1511)', () => {
  const agent = (id: string, startedAt: string, intent?: string) => ({ id, status: 'done' as const, startedAt, updatedAt: startedAt, ...(intent ? { intent } : {}) })
  const agents = [
    // The plan column's attended start: the ask verbatim.
    agent('older', '2026-08-01T00:00:00Z', 'Create tickets/2026-07-25_login.plan.md'),
    // A pinned queue drain carries the entry inside a longer prompt.
    agent('newer', '2026-08-02T00:00:00Z', 'Work on this one open task-queue entry only:\n\n- Create tickets/2026-07-25_login.plan.md\n\nDo not start any other entry.'),
    // Another ticket's plan, and an implementation run: neither is this plan's author.
    agent('other', '2026-08-03T00:00:00Z', 'Create tickets/2026-07-26_signup.plan.md'),
    agent('impl', '2026-08-04T00:00:00Z', '[Add a login page](tickets/2026-07-25_login.md)'),
    agent('mute', '2026-08-05T00:00:00Z'),
  ]
  assert.equal(planAgentFor(agents, '2026-07-25_login.md')?.id, 'newer')
  assert.equal(planAgentFor(agents, '2026-07-27_nothing.md'), undefined)
})
