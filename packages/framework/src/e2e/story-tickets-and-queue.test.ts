import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { makeWorld } from './harness.js'
import { runWidgetCommand } from '../dashboard-rpc/widgets.js'
import { DATA_BRANCH, pullFileBranch } from '@gemstack/agent-data'
import {
  onTickets,
  onTicket,
  onAllTickets,
  onHotTickets,
  onQueue,
} from '../dashboard-rpc/reads.js'

// The roadmap stories (README.md): tickets are proposals, the agent queue holds confirmed work —
// the propose -> decide half of the loop the Tickets page and the AI Queue card drive. The queue
// itself is a project package's (#1774): the framework reads it through the command that package
// declares, and writes it never (the package's own widget does, in the browser). Working the
// queue is the scheduler's: it starts an agent when the branch moves, and that agent reads the
// skills itself.

const TICKET_FILE = '2026-08-01_login-page.md'
/** The fixture's queue package: its widget's "Add to queue" runs this package's command. */
const QUEUE_PACKAGE = '@gemstack/skill-queue'
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

test('the queue is read through the project\'s queue provider, the boards show a queued ticket, and the queue widget\'s action is seen at once (#1164/#1774)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    // The queue as an agent left it: a link back to the ticket in the priority section the
    // ticket's own priority earns, on the `agent-data` branch, on origin and in this machine's
    // copy, as the daemon's data sync keeps them.
    const project = await world.addProject({
      'README.md': '# fixture\n',
      [`tickets/${TICKET_FILE}`]: TICKET,
      'TODO_AGENTS.md': `## Priority 8\n\n- [Login page](tickets/${TICKET_FILE})\n`,
    })
    const synced = await pullFileBranch(project.cwd, DATA_BRANCH)
    assert.equal(synced.ok, true, `the fixture's data branch did not converge: ${synced.ok ? '' : synced.error}`)

    // The framework reads it by running the provider the fixture's package declares (`queue --local`).
    const queue = await rpc(onQueue)()
    const projectQueue = queue.find(q => q.projectId === project.id)
    assert.deepEqual(projectQueue?.entries, [`[Login page](tickets/${TICKET_FILE})`], 'the entry, as the command prints it')

    // The queued ticket shows on the hot-tickets rail, in the AI Queue lane.
    const hotQueued = await rpc(onHotTickets)()
    assert.ok(hotQueued.some(h => h.projectId === project.id && h.ticket.file === TICKET_FILE && h.bucket === 'ai-queue'))

    // The queue package's "Add to queue" action, as the dashboard runs it: the package's own
    // command, marked as an act. The command writes as a remote writer, straight to origin; the
    // framework then converges this machine's copy and re-reads, so the boards show the entry at
    // once, in its own lower section, not at the daemon's next sync.
    const added = await rpc(runWidgetCommand)(project.id, QUEUE_PACKAGE, ['add', '[Dark mode](tickets/2026-08-02_dark-mode.md)', '--priority', '3'], undefined, true)
    assert.equal(added.ok, true, `the add failed: ${added.ok ? '' : added.error}`)
    const after = await rpc(onQueue)()
    assert.deepEqual(after.find(q => q.projectId === project.id)?.entries, [`[Login page](tickets/${TICKET_FILE})`, '[Dark mode](tickets/2026-08-02_dark-mode.md)'])
  } finally {
    await world.close()
  }
})
