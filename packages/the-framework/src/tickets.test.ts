import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  FLAT_TODO_FILE,
  LEGACY_HYPHEN_TODO_FILE,
  LEGACY_TICKETS_TODO_FILE,
  LEGACY_TODO_FILE,
  TICKETS_DIR,
  findFlatTodo,
  isTicketPath,
  ticketFromQueueEntry,
  todoPriorityForTicket,
} from './tickets.js'
import { TICKETING_FORMAT, TODO_FORMAT } from './prompts.generated.js'

test('the flat backlog lives at the root TODO_AGENTS.md, with the legacy locations named (#674/#682)', () => {
  assert.equal(TICKETS_DIR, 'tickets')
  assert.equal(FLAT_TODO_FILE, 'TODO_AGENTS.md')
  assert.equal(LEGACY_HYPHEN_TODO_FILE, 'TODO-AGENTS.md')
  assert.equal(LEGACY_TICKETS_TODO_FILE, 'tickets/TODO.md')
  assert.equal(LEGACY_TODO_FILE, 'TODO.md')
})

test('the ticket-format spec ships in the package (not materialized), with priority/topics (#684/#674)', () => {
  // Per the #674 call it is not written into the repo, so the format versions with the package.
  // How the agent reads it is system-prompt.ts's job now (#1163): the content rides in the channel.
  // The spec teaches both file shapes and the revised #684 optional priority/topics fields.
  assert.ok(TICKETING_FORMAT.includes('tickets/<DATE>_<SLUG>.md'))
  assert.ok(TICKETING_FORMAT.includes('tickets/<DATE>_<SLUG>.spike.md'))
  assert.ok(TICKETING_FORMAT.includes('Priority: 10-0'))
  assert.ok(TICKETING_FORMAT.includes('Topics:'))
  assert.ok(TICKETING_FORMAT.includes('GitHub:'))
})

test('the backlog-format spec ships in the package and teaches the priority sections (#880)', () => {
  // Ships inside the package like the ticket format, so the layout versions with the package.
  assert.ok(TODO_FORMAT.includes(FLAT_TODO_FILE))
  // A numeric 0-10 scale, not named tiers: 10 is act-immediately, 0 is only-if-capacity.
  for (const section of ['## Priority 10 (critical', '## Priority 9', '## Priority 0 (only if capacity)']) {
    assert.ok(TODO_FORMAT.includes(section), `expected the ${section} section`)
  }
  // Priority 10 is the exception, not the default, and the file is priority-sorted.
  assert.ok(TODO_FORMAT.includes('Priority 10 is rarely used'))
  assert.ok(TODO_FORMAT.includes('sorted by priority'))
})

test('findFlatTodo prefers TODO_AGENTS.md, then legacy tickets/TODO.md, then root TODO.md, else undefined (#682)', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-tickets-'))
  try {
    assert.equal(await findFlatTodo(cwd), undefined)

    // Only a pre-#629 root TODO.md -> that is returned (oldest repos keep their backlog).
    await writeFile(join(cwd, 'TODO.md'), '- [ ] oldest\n')
    assert.equal(await findFlatTodo(cwd), 'TODO.md')

    // A #629 tickets/TODO.md wins over the pre-#629 root file.
    await mkdir(join(cwd, TICKETS_DIR))
    await writeFile(join(cwd, LEGACY_TICKETS_TODO_FILE), '- [ ] newer\n')
    assert.equal(await findFlatTodo(cwd), 'tickets/TODO.md')

    // The brief #682 hyphen spelling wins over the older locations.
    await writeFile(join(cwd, LEGACY_HYPHEN_TODO_FILE), '- [ ] hyphen\n')
    assert.equal(await findFlatTodo(cwd), 'TODO-AGENTS.md')

    // The #674 root TODO_AGENTS.md (underscore) wins over every legacy location.
    await writeFile(join(cwd, FLAT_TODO_FILE), '- [ ] current\n')
    assert.equal(await findFlatTodo(cwd), 'TODO_AGENTS.md')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('findFlatTodo ignores a tickets/ directory that is not a file', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-tickets-'))
  try {
    // A directory named exactly TODO.md must not be mistaken for the backlog file.
    await mkdir(join(cwd, 'TODO.md'))
    assert.equal(await findFlatTodo(cwd), undefined)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a ticket priority maps onto the backlog format\'s numbered sections (#1164)', () => {
  assert.equal(todoPriorityForTicket('urgent'), 9)
  assert.equal(todoPriorityForTicket('high'), 7)
  assert.equal(todoPriorityForTicket('medium'), 5)
  assert.equal(todoPriorityForTicket('low'), 2)
  // The ticket format says `priority:` is optional, so an unmarked ticket has to mean something.
  assert.equal(todoPriorityForTicket(undefined), 5)
  assert.equal(todoPriorityForTicket('  HIGH  '), 7, 'the key is read verbatim off the ticket, so it may be shouted or padded')
  // 10 is reserved for critical production bugs and 0 for "only if capacity"; neither is
  // something a click on Queue should be able to claim.
  assert.equal(todoPriorityForTicket('critical'), 5)
})

test('ticketFromQueueEntry reads the ticket a queued entry links back to (#1117/#1164)', () => {
  // The write side (#1164) queues a ticket as a markdown link, so the identity is on the line.
  assert.equal(ticketFromQueueEntry('[Add a login page](tickets/2026-07-25_login.md)'), 'tickets/2026-07-25_login.md')
  // An entry that is just text is exactly what it used to be: work with no ticket behind it.
  assert.equal(ticketFromQueueEntry('Apply the maintainability preset'), undefined)
  assert.equal(ticketFromQueueEntry('see the [docs](README.md)'), undefined)
})

test('only a plain file inside tickets/ counts as a ticket path (#1117)', () => {
  assert.equal(isTicketPath('tickets/2026-07-25_login.md'), true)
  // The result is a path a reader opens and the dashboard renders, so nothing may point out of
  // tickets/, deeper than it, or at something that is not a ticket.
  for (const bad of [
    'tickets/../secrets.md',
    'tickets/nested/deep.md',
    'tickets/.hidden.md',
    'tickets/notes.txt',
    '/etc/passwd',
    'https://example.com/x.md',
    'TODO_AGENTS.md',
    'tickets/',
  ]) {
    assert.equal(isTicketPath(bad), false, `expected ${bad} to be rejected`)
  }
  // A traversal dressed as a link is refused at the same gate.
  assert.equal(ticketFromQueueEntry('[sneaky](tickets/../../etc/passwd)'), undefined)
})
