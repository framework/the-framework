import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readTickets, readTicket, readTicketsMeta, hasTickets } from './tickets.js'

async function repo(files: Record<string, string> = {}): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'tf-tickets-'))
  if (Object.keys(files).length) await mkdir(join(cwd, 'tickets'), { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(cwd, 'tickets', name), content, 'utf8')
  }
  return cwd
}

test('readTickets is empty when the repo has no tickets directory (#697)', async () => {
  assert.deepEqual(await readTickets(await repo()), [])
})

test('readTickets reads the format: keys above the title, then the TLDR (#697)', async () => {
  const cwd = await repo({
    '2026-07-20_do-the-thing.md': [
      'priority: high',
      'topics: [dx]',
      '',
      '# Do the thing',
      '',
      '## TLDR',
      '',
      'The thing is not done.',
      '',
      '## Why it matters',
      '',
      'Because.',
    ].join('\n'),
  })
  const [ticket, ...rest] = await readTickets(cwd)
  assert.equal(rest.length, 0)
  // `date` comes from the filename (#1144/#1265), so it is exact rather than a moment in the test
  // run to merely check is parseable.
  assert.deepEqual(ticket, {
    file: '2026-07-20_do-the-thing.md',
    title: 'Do the thing',
    summary: 'The thing is not done.',
    priority: 'high',
    topics: ['dx'],
    date: '2026-07-20T00:00:00.000Z',
    planned: false,
  })
})

test('readTickets reads the GitHub: link, split into its label and URL (#1144/#1265)', async () => {
  const cwd = await repo({
    '2026-07-20_thing.md': 'GitHub: [#42](https://github.com/org/repo/issues/42)\n\n# Thing\n',
  })
  const [ticket] = await readTickets(cwd)
  assert.deepEqual(ticket?.github, { label: '#42', url: 'https://github.com/org/repo/issues/42' })
})

test('readTickets leaves github off a ticket that names none (#1144/#1265)', async () => {
  const cwd = await repo({ '2026-07-20_thing.md': '# Thing\n' })
  const [ticket] = await readTickets(cwd)
  assert.equal(ticket?.github, undefined)
})

test('readTickets dates a ticket by its filename, not its mtime, when the filename carries one (#1144/#1265)', async () => {
  const cwd = await repo({ '2026-07-20_thing.md': '# Thing\n' })
  // Editing the file bumps its mtime well past the filename's date; the filename still wins.
  await new Promise(r => setTimeout(r, 1100))
  await writeFile(join(cwd, 'tickets', '2026-07-20_thing.md'), '# Thing, edited\n', 'utf8')
  const [ticket] = await readTickets(cwd)
  assert.equal(ticket?.date, '2026-07-20T00:00:00.000Z')
})

test('readTickets falls back to mtime when the filename carries no date (#1144/#1265)', async () => {
  const cwd = await repo({ 'no-date-prefix.md': '# Thing\n' })
  const [ticket] = await readTickets(cwd)
  assert.equal(Number.isNaN(Date.parse(ticket?.date as string)), false)
  assert.notEqual(ticket?.date, undefined)
})

test('a leftover Status: line is preamble noise, not a field (#1230 retired)', async () => {
  // The format has no status key — a closed ticket is removed from the repo, so everything in
  // `tickets/` is open work by construction. A file still carrying the retired line lists
  // normally; the line is simply not read.
  const cwd = await repo({ 'a.md': 'Status: closed\n\n# Thing\n' })
  const [ticket] = await readTickets(cwd)
  assert.equal(ticket?.title, 'Thing')
  assert.ok(ticket && !('status' in ticket))
})

test('readTickets parses a multi-topic list, brackets and all (#1144)', async () => {
  const cwd = await repo({ '2026-07-20_thing.md': 'topics: [dx, ui, docs]\n\n# Thing\n' })
  const [ticket] = await readTickets(cwd)
  assert.deepEqual(ticket?.topics, ['dx', 'ui', 'docs'])
})

test('readTickets leaves topics off a ticket that names none (#1144)', async () => {
  const cwd = await repo({ '2026-07-20_thing.md': '# Thing\n' })
  const [ticket] = await readTickets(cwd)
  assert.equal(ticket?.topics, undefined)
})

test('readTickets sorts newest-first by file mtime, not by filename (#1144)', async () => {
  // Both alphabetically ahead of "z", so a filename sort would get this backwards.
  const cwd = await repo({ 'a-older.md': '# Older\n', 'b-newer.md': '# Newer\n' })
  // mtime has second resolution on some filesystems; a real gap keeps the order unambiguous.
  await new Promise(r => setTimeout(r, 1100))
  await writeFile(join(cwd, 'tickets', 'b-newer.md'), '# Newer\n', 'utf8')
  const titles = (await readTickets(cwd)).map(t => t.title)
  assert.deepEqual(titles, ['Newer', 'Older'])
})

// The tickets already in a repo are GitHub imports that predate the format, so nothing about
// the format may be required to list one.
test('readTickets still lists a ticket written before the format (#697)', async () => {
  const cwd = await repo({
    '629-New_root_directory.md': '# New root directory\n\nThe root is crowded.\n\n---\nSource: https://example.com/1\n',
  })
  const [ticket] = await readTickets(cwd)
  assert.equal(ticket?.title, 'New root directory')
  assert.equal(ticket?.summary, 'The root is crowded.')
  assert.equal(ticket?.priority, undefined)
})

test('readTickets falls back to the filename when there is no heading (#697)', async () => {
  const cwd = await repo({ '2026-07-20_no_heading.md': 'just prose\n' })
  const [ticket] = await readTickets(cwd)
  assert.equal(ticket?.title, '2026-07-20 no heading')
})

test('readTickets decodes an escaped filename rather than throwing on a stray % (#697)', async () => {
  const cwd = await repo({ '1-100%_sure.md': 'prose\n', '2-a%20b.md': 'prose\n' })
  // Sorted before comparing: the list itself is newest-first by mtime (#1144), and these two
  // are written close enough together that which one lands "newest" is not this test's concern.
  const titles = (await readTickets(cwd)).map(t => t.title).sort()
  assert.deepEqual(titles, ['1-100% sure', '2-a b'])
})

// A plan is written *about* a ticket, so it marks that ticket instead of becoming a row of its
// own -- otherwise planning a ticket would appear to duplicate it.
test('readTickets folds .plan.md into its ticket (#697)', async () => {
  const cwd = await repo({
    '2026-07-20_thing.md': '# Thing\n\nprose\n',
    '2026-07-20_thing.plan.md': '# [Plan] Thing\n',
    '2026-07-21_other.md': '# Other\n\nprose\n',
  })
  const tickets = await readTickets(cwd)
  // Sorted before comparing: the list itself is newest-first by mtime (#1144), and these two are
  // written close enough together that which one lands "newest" is not this test's concern.
  assert.deepEqual(
    tickets.map(t => [t.file, t.planned]).sort(),
    [
      ['2026-07-20_thing.md', true],
      ['2026-07-21_other.md', false],
    ],
  )
})

test('a .lock.md claim reads as a lock, never as a ticket row of its own (#1420)', async () => {
  // The daemon claims a ticket for an agent by pre-creating `<stem>.lock.md`. It must mark the
  // ticket locked — and name its holder — without becoming a row or counting as work done.
  const cwd = await repo({
    '2026-07-20_thing.md': '# Thing\n\nprose\n',
    '2026-07-20_thing.lock.md': 'CLAIMED: plan-1-0\n',
  })
  const tickets = await readTickets(cwd)
  assert.equal(tickets.length, 1, 'the lock file is a sibling, not a ticket')
  const [ticket] = tickets
  assert.equal(ticket?.planned, false)
  assert.equal(ticket?.locked, true)
  assert.equal(ticket?.lockedBy, 'plan-1-0')
  assert.equal(ticket?.effort, undefined)
  // The detail page answers the same way the list does.
  const detail = await readTicket(cwd, '2026-07-20_thing.md')
  assert.equal(detail?.locked, true)
  assert.equal(detail?.lockedBy, 'plan-1-0')
})

test('a locked ticket with a real plan is planned and locked at once (#1420)', async () => {
  // The lock covers the ticket's whole life: a plan landing does not lift the claim by itself —
  // only deleting the lock file does.
  const cwd = await repo({
    '2026-07-20_thing.md': '# Thing\n\nprose\n',
    '2026-07-20_thing.plan.md': 'Effort: 2\n\n# [Plan] Thing\n',
    '2026-07-20_thing.lock.md': 'CLAIMED: plan-1-0\n',
  })
  const [ticket] = await readTickets(cwd)
  assert.equal(ticket?.planned, true)
  assert.equal(ticket?.locked, true)
  assert.equal(ticket?.effort, 2)
})

test('a malformed lock file still locks, just without a holder (#1420)', async () => {
  // The file's existence is the claim; the CLAIMED line is display sugar for the release button.
  const cwd = await repo({
    '2026-07-20_thing.md': '# Thing\n\nprose\n',
    '2026-07-20_thing.lock.md': 'scribbles\n',
  })
  const [ticket] = await readTickets(cwd)
  assert.equal(ticket?.locked, true)
  assert.equal(ticket?.lockedBy, undefined)
})

test('readTickets reads the plan preamble\'s Effort: and Uncertainty: keys (#1144/#1265)', async () => {
  // The plan format's two 0-10 keys (`ticketing_format.md`), above the `# [Plan]` heading.
  const cwd = await repo({
    '2026-07-20_thing.md': '# Thing\n',
    '2026-07-20_thing.plan.md': 'Effort: 3\nUncertainty: 4\n\n# [Plan] Thing\n',
  })
  const [ticket] = await readTickets(cwd)
  assert.equal(ticket?.effort, 3)
  assert.equal(ticket?.uncertainty, 4)
})

test('readTickets leaves effort and uncertainty off when the plan names none (#1144/#1265)', async () => {
  const cwd = await repo({
    '2026-07-20_a.md': '# A\n',
    '2026-07-20_b.md': '# B\n',
    '2026-07-20_b.plan.md': '# [Plan] B\n\nNo estimate here.\n',
  })
  const byFile = new Map((await readTickets(cwd)).map(t => [t.file, t.effort]))
  assert.equal(byFile.get('2026-07-20_a.md'), undefined)
  assert.equal(byFile.get('2026-07-20_b.md'), undefined)
})

test('a plan value off the 0-10 scale is not an effort, and prose is not a preamble (#1144/#1265)', async () => {
  const cwd = await repo({
    '2026-07-20_a.md': '# A\n',
    // Out-of-range/fractional values are not clamped into something plausible (see planScale).
    '2026-07-20_a.plan.md': 'Effort: 15\nUncertainty: 2.5\n\n# [Plan] A\n',
    '2026-07-20_b.md': '# B\n',
    // A key-looking line below the heading is the plan's body, not its metadata.
    '2026-07-20_b.plan.md': '# [Plan] B\n\nEffort: 3\n',
  })
  const byFile = new Map((await readTickets(cwd)).map(t => [t.file, t]))
  assert.equal(byFile.get('2026-07-20_a.md')?.effort, undefined)
  assert.equal(byFile.get('2026-07-20_a.md')?.uncertainty, undefined)
  assert.equal(byFile.get('2026-07-20_b.md')?.effort, undefined)
})

test('readTicket reads the plan preamble too, like readTickets (#1144/#1265)', async () => {
  const cwd = await repo({
    '2026-07-20_thing.md': '# Thing\n',
    '2026-07-20_thing.plan.md': 'Effort: 0\nUncertainty: 10\n\n# [Plan] Thing\n',
  })
  const ticket = await readTicket(cwd, '2026-07-20_thing.md')
  assert.equal(ticket?.effort, 0, 'a 0 is a value, not a missing key')
  assert.equal(ticket?.uncertainty, 10)
})

test('readTickets ignores non-markdown files (#697)', async () => {
  const cwd = await repo({ '2026-07-20_thing.md': '# Thing\n', 'notes.txt': 'nope' })
  assert.deepEqual((await readTickets(cwd)).map(t => t.file), ['2026-07-20_thing.md'])
})

test('hasTickets is false with no tickets directory, true with a ticket (#958)', async () => {
  assert.equal(await hasTickets(await repo()), false)
  assert.equal(await hasTickets(await repo({ '2026-07-20_thing.md': '# Thing\n' })), true)
})

test('hasTickets agrees with readTickets: a lone plan or lock is not a ticket (#958)', async () => {
  // The onboarding step asks whether `tickets/` is populated; a `.plan.md` with no ticket beside
  // it is written *about* a ticket, so answering yes there would tick the step off nothing.
  const cwd = await repo({ '2026-07-20_thing.plan.md': '# Plan\n', '2026-07-20_thing.lock.md': 'CLAIMED: x\n' })
  assert.equal(await hasTickets(cwd), false)
  assert.deepEqual(await readTickets(cwd), [])
})

test('hasTickets ignores non-markdown files, like readTickets (#958)', async () => {
  assert.equal(await hasTickets(await repo({ 'notes.txt': 'nope' })), false)
})

// readTicket backs the detail page (#1144): the whole file, not just the head readTickets
// caps at, plus the same metadata a list row shows.
test('readTicket reads the whole file, metadata included (#1144)', async () => {
  const body = ['priority: high', 'topics: [dx]', '', '# Do the thing', '', '## TLDR', '', 'The thing is not done.', '', 'More below the fold.'].join(
    '\n',
  )
  const cwd = await repo({ '2026-07-20_do-the-thing.md': body })
  const ticket = await readTicket(cwd, '2026-07-20_do-the-thing.md')
  assert.deepEqual(ticket, {
    file: '2026-07-20_do-the-thing.md',
    title: 'Do the thing',
    summary: 'The thing is not done.',
    priority: 'high',
    topics: ['dx'],
    date: '2026-07-20T00:00:00.000Z',
    planned: false,
    content: body,
  })
})

test('readTicket reads the GitHub: link too, like readTickets (#1144/#1265)', async () => {
  const cwd = await repo({
    '2026-07-20_thing.md': 'GitHub: [#42](https://github.com/org/repo/issues/42)\n\n# Thing\n',
  })
  const ticket = await readTicket(cwd, '2026-07-20_thing.md')
  assert.deepEqual(ticket?.github, { label: '#42', url: 'https://github.com/org/repo/issues/42' })
})

test('readTicket folds in its .plan.md sibling, like readTickets (#1144)', async () => {
  const cwd = await repo({
    '2026-07-20_thing.md': '# Thing\n',
    '2026-07-20_thing.plan.md': '# [Plan] Thing\n',
  })
  const ticket = await readTicket(cwd, '2026-07-20_thing.md')
  assert.equal(ticket?.planned, true)
})

test('readTicket is null for a missing file (#1144)', async () => {
  assert.equal(await readTicket(await repo(), 'nope.md'), null)
})

test('readTicket is null for a sibling file, which is not a ticket of its own (#1144)', async () => {
  const cwd = await repo({ '2026-07-20_thing.md': '# Thing\n', '2026-07-20_thing.plan.md': '# [Plan] Thing\n' })
  assert.equal(await readTicket(cwd, '2026-07-20_thing.plan.md'), null)
})

test('readTicket refuses a path that escapes tickets/ (#1144)', async () => {
  const cwd = await repo({ '2026-07-20_thing.md': '# Thing\n' })
  assert.equal(await readTicket(cwd, '../thing.md'), null)
  assert.equal(await readTicket(cwd, '/etc/passwd.md'), null)
  assert.equal(await readTicket(cwd, 'sub/thing.md'), null)
})

test('readTicket is null for meta.json, which is not a ticket either (#1144/#1208)', async () => {
  const cwd = await repo({ 'meta.json': '{"lastImportedAt":"2026-07-20T10:00:00.000Z"}' })
  assert.equal(await readTicket(cwd, 'meta.json'), null)
})

test('readTicketsMeta reads the last-import stamp (#1208)', async () => {
  const cwd = await repo({ 'meta.json': JSON.stringify({ lastImportedAt: '2026-07-20T10:00:00.000Z' }) })
  assert.deepEqual(await readTicketsMeta(cwd), { lastImportedAt: '2026-07-20T10:00:00.000Z' })
})

test('readTicketsMeta answers "not known" for every way the file can be unusable (#1208)', async () => {
  // The file is written by an agent and read straight into the UI, so each of these has to land on
  // the same harmless answer rather than throwing at the view or rendering "Invalid Date".
  assert.deepEqual(await readTicketsMeta(await repo()), {}, 'no tickets/ at all')
  assert.deepEqual(await readTicketsMeta(await repo({ 'x.md': '# t' })), {}, 'no meta.json')
  assert.deepEqual(await readTicketsMeta(await repo({ 'meta.json': 'not json' })), {}, 'not JSON')
  assert.deepEqual(await readTicketsMeta(await repo({ 'meta.json': '"a string"' })), {}, 'JSON, but not an object')
  assert.deepEqual(await readTicketsMeta(await repo({ 'meta.json': 'null' })), {}, 'JSON null')
  assert.deepEqual(await readTicketsMeta(await repo({ 'meta.json': '{}' })), {}, 'no stamp in it')
  assert.deepEqual(await readTicketsMeta(await repo({ 'meta.json': '{"lastImportedAt":17}' })), {}, 'not a string')
  assert.deepEqual(await readTicketsMeta(await repo({ 'meta.json': '{"lastImportedAt":"soon"}' })), {}, 'unparseable')
})

test('meta.json is not mistaken for a ticket (#1208)', async () => {
  // It sits inside tickets/, so a reader that took every file would list it as a row.
  const cwd = await repo({ 'meta.json': '{"lastImportedAt":"2026-07-20T10:00:00.000Z"}', 'a.md': '# A ticket' })
  assert.deepEqual((await readTickets(cwd)).map(t => t.file), ['a.md'])
  assert.equal(await hasTickets(cwd), true)
})
