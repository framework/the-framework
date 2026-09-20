import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { holderAgent, planAgentFor, planLink, planPath, planTicketPrompt, readListed, readMeta, readShown, routeOf, ticketLink, workOnTicketPrompt } from './widget.js'

const FILE = '2026-08-30_login-page.md'

test('the prompts and paths are one wording each, made from the ticket\'s filename', () => {
  assert.equal(planTicketPrompt(FILE), 'Create tickets/2026-08-30_login-page.plan.md')
  assert.equal(workOnTicketPrompt(FILE), 'Work on tickets/2026-08-30_login-page.md. Do not start any other ticket.')
  assert.equal(planPath(FILE), 'tickets/2026-08-30_login-page.plan.md')
})

test('planAgentFor picks the newest run whose ask names the plan; holderAgent the run the lock names', () => {
  const agents = [
    { id: 'a1', ask: 'Create tickets/2026-08-30_login-page.plan.md', status: 'done', startedAt: '2026-09-01T00:00:00Z' },
    { id: 'a2', ask: 'Plan it: Create tickets/2026-08-30_login-page.plan.md please', status: 'running', startedAt: '2026-09-02T00:00:00Z' },
    { id: 'a3', ask: 'Work on tickets/2026-08-30_login-page.md. Do not start any other ticket.', status: 'done', startedAt: '2026-09-03T00:00:00Z' },
    { id: 'a4', status: 'done', startedAt: '2026-09-04T00:00:00Z' },
  ]
  assert.equal(planAgentFor(agents, FILE)?.id, 'a2')
  assert.equal(planAgentFor(agents, '2026-01-01_other.md'), undefined)
  assert.equal(holderAgent(agents, 'a3')?.id, 'a3')
  assert.equal(holderAgent(agents, 'feature/x'), undefined)
  assert.equal(holderAgent(agents, undefined), undefined)
})

test('routeOf reads the list, a ticket, its plan, and nothing else', () => {
  assert.deepEqual(routeOf([]), { view: 'list' })
  assert.deepEqual(routeOf(['p1', FILE]), { view: 'ticket', projectId: 'p1', file: FILE })
  assert.deepEqual(routeOf(['p1', FILE, 'plan']), { view: 'plan', projectId: 'p1', file: FILE })
  assert.deepEqual(routeOf(['p1']), { view: 'unknown' })
  assert.deepEqual(routeOf(['p1', '../x.md']), { view: 'unknown' })
  assert.deepEqual(routeOf(['p1', '2026-08-30_login-page.plan.md']), { view: 'unknown' })
  assert.deepEqual(routeOf(['p1', FILE, 'diff']), { view: 'unknown' })
  assert.deepEqual(routeOf(['p1', FILE, 'plan', 'x']), { view: 'unknown' })
})

test('a ticket as a link points at its file at its own priority; a plan ask points nowhere', () => {
  assert.deepEqual(ticketLink({ file: FILE, title: 'Login page', priority: '8' }), { text: 'Login page', href: `tickets/${FILE}`, priority: 8 })
  assert.deepEqual(ticketLink({ file: FILE, title: 'Login page' }), { text: 'Login page', href: `tickets/${FILE}`, priority: 5 })
  assert.deepEqual(planLink({ file: FILE, title: 'Login page', priority: '0' }), { text: planTicketPrompt(FILE), priority: 0 })
})

test('the command\'s answers are read back: a list, one ticket or its refusal, the import stamp', () => {
  const row = { file: FILE, title: 'Login page', summary: '', date: '2026-08-30T00:00:00.000Z', planned: false }
  assert.deepEqual(readListed({ ok: true, output: [row, { file: 'x' }, 'no'] }), { tickets: [row] })
  assert.deepEqual(readListed({ ok: true, output: { ok: false } }), { error: 'the tickets command did not print a list' })
  assert.deepEqual(readListed({ ok: false, error: 'tickets took too long' }), { error: 'tickets took too long' })
  const detail = { ...row, content: '# Login page\n' }
  assert.deepEqual(readShown({ ok: true, output: { ok: true, ticket: detail, plan: 'Effort: 1\n', holder: 'a1' } }), { shown: { ticket: detail, plan: 'Effort: 1\n', holder: 'a1' } })
  assert.deepEqual(readShown({ ok: true, output: { ok: true, ticket: detail } }), { shown: { ticket: detail } })
  assert.deepEqual(readShown({ ok: true, output: { ok: false, reason: 'no-ticket', file: FILE } }), { shown: null })
  assert.deepEqual(readShown({ ok: true, output: { ok: true, ticket: row } }), { error: 'the tickets command did not print a ticket' })
  assert.deepEqual(readShown({ ok: false, error: 'boom' }), { error: 'boom' })
  assert.deepEqual(readMeta({ ok: true, output: { lastImportedAt: '2026-09-01T00:00:00Z' } }), { lastImportedAt: '2026-09-01T00:00:00Z' })
  assert.deepEqual(readMeta({ ok: true, output: {} }), {})
  assert.deepEqual(readMeta({ ok: false, error: 'x' }), {})
})
