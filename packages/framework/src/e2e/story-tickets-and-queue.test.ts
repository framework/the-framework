import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { makeWorld } from './harness.js'
import {
  onTickets,
  onTicket,
  onAllTickets,
  onHotTickets,
  onQueue,
  onAgents,
} from '../dashboard-rpc/reads.js'
import { sendQueueTicket } from '../dashboard-rpc/control.js'

// The roadmap stories (README.md): tickets are proposals, the flat TODO queue holds confirmed
// work — the propose -> decide half of the loop the Tickets and Queue pages drive. Working the
// queue is the daemon's (#1774): it starts an agent when the branch moves, and that agent reads
// the skills itself.

const TICKET_FILE = '2026-08-01_login-page.md'
const TICKET = [
  'priority: 8',
  '',
  '# Login page',
  '',
  '## TLDR',
  '',
  'Add a login page with session cookies.',
  '',
].join('\n')

test('browse the ticket backlog: list, detail, and the cross-project pages (#697/#1144)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject({
      'README.md': '# fixture\n',
      [`tickets/${TICKET_FILE}`]: TICKET,
      'tickets/2026-08-02_dark-mode.md': '# Dark mode\n\n## TLDR\n\nHonor prefers-color-scheme.\n',
    })

    // The project's Tickets page: every ticket with its parsed row fields.
    const tickets = await rpc(onTickets)(project.id)
    assert.equal(tickets.length, 2)
    const login = tickets.find(t => t.file === TICKET_FILE)
    assert.equal(login?.title, 'Login page')
    assert.equal(login?.priority, '8')
    assert.equal(login?.summary, 'Add a login page with session cookies.')

    // The ticket's own page carries the full text; a sibling/path name is refused.
    const detail = await rpc(onTicket)(project.id, TICKET_FILE)
    assert.ok(detail?.content.includes('session cookies'))
    assert.equal(await rpc(onTicket)(project.id, '../escape.md'), null)

    // The cross-project pages see the same backlog under this project.
    const all = await rpc(onAllTickets)()
    const mine = all.find(p => p.projectId === project.id)
    assert.equal(mine?.tickets.length, 2)
  } finally {
    await world.close()
  }
})

test('queue a ticket, and the boards show it queued (#1164)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject({
      'README.md': '# fixture\n',
      [`tickets/${TICKET_FILE}`]: TICKET,
    })

    // The ticket page's Queue action: the entry lands in the flat backlog, linking back to the
    // ticket, and the Queue page counts it as open work.
    const queued = await rpc(sendQueueTicket)(project.id, 'Login page', { file: TICKET_FILE, priority: '8' })
    assert.equal(queued.ok, true, `queueing failed: ${queued.error ?? ''}`)
    assert.equal(queued.file, 'TODO_AGENTS.md')
    const queue = await rpc(onQueue)()
    const projectQueue = queue.find(q => q.projectId === project.id)
    assert.equal(projectQueue?.open, 1)
    assert.ok(projectQueue?.items[0]?.text.includes(`tickets/${TICKET_FILE}`), 'the entry links back to its ticket')

    // The queued ticket shows on the hot-tickets rail.
    const hotQueued = await rpc(onHotTickets)()
    assert.ok(hotQueued.some(h => h.projectId === project.id && h.ticket.file === TICKET_FILE))
  } finally {
    await world.close()
  }
})
