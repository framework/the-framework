import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { makeWorld, waitFor, withFakeAwait } from './harness.js'
import {
  onTickets,
  onTicket,
  onAllTickets,
  onHotTickets,
  onQueue,
  onAgents,
} from '../dashboard-rpc/reads.js'
import { sendChoice, sendQueueTicket } from '../dashboard-rpc/control.js'
import { presets } from '../preset-catalog.js'

// The roadmap stories (README.md): tickets are proposals, the flat TODO queue holds confirmed
// work, and a drain run claims the queue's next entry — the propose -> decide -> work loop the
// Tickets and Queue pages drive.

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

test('queue a ticket, then a drain run claims it and the boards show it in progress (#1164/#1117)', async () => {
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

    // A hand-fired drain resolves the queue's next entry to its ticket (#1117) — the run's meta
    // names it while the run is live, which is what flips the boards to "implementing".
    const agentId = await withFakeAwait('choices', () => world.startAgent(project, presets.drainQueue.render()))
    const tail = await world.tailAgent(project, agentId)
    const gate = await waitFor(() => tail.events.find(e => e.kind === 'choice'), 'the drain run to park')

    const sent = (await world.spawnedSpecs())[0]!
    assert.equal(sent.options.ticket, `tickets/${TICKET_FILE}`, 'the drain child carries its ticket')

    const running = await waitFor(async () => {
      const agent = (await rpc(onAgents)(project.id)).find(r => r.id === agentId)
      return agent?.ticket ? agent : undefined
    }, 'the run meta to name the claimed ticket')
    assert.equal(running.ticket, `tickets/${TICKET_FILE}`)
    const hot = await rpc(onHotTickets)()
    const implementing = hot.find(h => h.ticket.file === TICKET_FILE && h.agentId === agentId)
    assert.ok(implementing, 'the hot rail links the ticket to the run implementing it')

    if (gate.kind === 'choice') await rpc(sendChoice)(project.id, gate.id, gate.recommended!, 'user', agentId)
    await world.waitAgent(project, agentId, 'done')
  } finally {
    await world.close()
  }
})

test('any other prompt claims nothing: the queue is only worked by a drain (#1117)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject({
      'README.md': '# fixture\n',
      [`tickets/${TICKET_FILE}`]: TICKET,
    })
    await rpc(sendQueueTicket)(project.id, 'Login page', { file: TICKET_FILE, priority: '8' })

    const agentId = await world.startAgent(project, 'Look into the flaky CI job')
    await world.waitAgent(project, agentId, 'done')
    const agent = (await rpc(onAgents)(project.id)).find(r => r.id === agentId)
    assert.equal(agent?.ticket, undefined, 'an unrelated prompt must not wear the queued ticket')
    // The queue entry is still open: nothing consumed it.
    const projectQueue = (await rpc(onQueue)()).find(q => q.projectId === project.id)
    assert.equal(projectQueue?.open, 1)
  } finally {
    await world.close()
  }
})
