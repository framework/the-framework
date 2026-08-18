import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  FLAT_TODO_FILE,
  TICKETS_DIR,
  isTicketPath,
  ticketFromQueueEntry,
  ticketIssueRef,
  todoPriorityForTicket,
} from './tickets.js'
import { findFlatTodo } from './tickets-file.js'
import { TICKETING_FORMAT, TODO_FORMAT } from './prompts.generated.js'

test('the flat backlog lives at the root TODO_AGENTS.md (#674/#682)', () => {
  assert.equal(TICKETS_DIR, 'tickets')
  assert.equal(FLAT_TODO_FILE, 'TODO_AGENTS.md')
})

test('the ticket-format spec ships in the package (not materialized), with priority/topics (#684/#674)', () => {
  // Per the decision (#674) it is not written into the repo, so the format versions with the package.
  // How the agent reads it is system-prompt.ts's job now (#1163): the content rides in the channel.
  // The spec teaches the file shapes and the revised #684 optional priority/topics fields.
  // #1420 folded the spike into the plan (Effort/Uncertainty 0-10) and added the .lock.md claim.
  assert.ok(TICKETING_FORMAT.includes('tickets/<DATE>_<SLUG>.md'))
  assert.ok(TICKETING_FORMAT.includes('tickets/<DATE>_<SLUG>.plan.md'))
  assert.ok(TICKETING_FORMAT.includes('tickets/<DATE>_<SLUG>.lock.md'))
  assert.ok(TICKETING_FORMAT.includes('Priority: 0-10'))
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

test('findFlatTodo reads the root TODO_AGENTS.md and nothing else (#682)', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-tickets-'))
  try {
    assert.equal(await findFlatTodo(cwd), undefined)

    // The pre-#682 spellings are no longer read: one convention, one location.
    await writeFile(join(cwd, 'TODO.md'), '- [ ] oldest\n')
    await writeFile(join(cwd, 'TODO-DRIVERS.md'), '- [ ] hyphen\n')
    await mkdir(join(cwd, TICKETS_DIR))
    await writeFile(join(cwd, TICKETS_DIR, 'TODO.md'), '- [ ] newer\n')
    assert.equal(await findFlatTodo(cwd), undefined)

    await writeFile(join(cwd, FLAT_TODO_FILE), '- [ ] current\n')
    assert.equal(await findFlatTodo(cwd), 'TODO_AGENTS.md')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('findFlatTodo ignores a directory that is not a file', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-tickets-'))
  try {
    // A directory named exactly TODO_AGENTS.md must not be mistaken for the backlog file.
    await mkdir(join(cwd, FLAT_TODO_FILE))
    assert.equal(await findFlatTodo(cwd), undefined)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a ticket priority maps onto the backlog format\'s numbered sections (#1164)', () => {
  // The format's own scale, taken at its word.
  assert.equal(todoPriorityForTicket('8'), 8)
  assert.equal(todoPriorityForTicket(' 2 '), 2, 'the key is read verbatim off the ticket, so it may be padded')
  // The ticket format says `priority:` is optional, so an unmarked ticket has to mean something.
  assert.equal(todoPriorityForTicket(undefined), 5)
  // The word spellings were never the format and are no longer read; like anything else that is
  // not a 0-10 number, they land in the middle rather than being guessed at.
  assert.equal(todoPriorityForTicket('high'), 5)
  assert.equal(todoPriorityForTicket('urgent'), 5)
  // Out-of-range and fractional values are not a priority on this scale.
  assert.equal(todoPriorityForTicket('11'), 5)
  assert.equal(todoPriorityForTicket('2.5'), 5)
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

test('ticketIssueRef reads the issue off the GitHub header line, URL first (#1334)', () => {
  const md = 'Priority: 5\nGitHub: [#42](https://github.com/org/repo/issues/42)\n\n# T\n'
  assert.equal(ticketIssueRef(md), '#42')
  // The URL is the identity: a label that disagrees with it loses.
  assert.equal(ticketIssueRef('GitHub: [gh-7](https://github.com/o/r/issues/99)\n'), '#99')
  // A hand-written line with no URL still counts by its label.
  assert.equal(ticketIssueRef('GitHub: #13\n'), '#13')
  // No header, or one naming no number, fixes nothing.
  assert.equal(ticketIssueRef('# A ticket with no GitHub line\n'), undefined)
  assert.equal(ticketIssueRef('GitHub: none yet\n'), undefined)
})
