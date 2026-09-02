import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nodeGitRunner, withFileBranch } from '@gemstack/agent-data'
import { appendQueueEntry, insertQueueEntry, parseQueueEntries, queueAdd, queueDone, readQueue, readQueueEntries, removeQueueEntry } from './queue.js'
import { QUEUE_FILE, TICKETS_BRANCH } from './names.js'

test('parseQueueEntries reads open list items and skips checked, blank and prose lines', () => {
  const md = ['# Backlog', '', 'Some prose about the backlog.', '- [ ] fix the login redirect', '- [x] already done', '- [X] also done', '- plain bullet entry', '* star bullet entry', '2. numbered entry', '- [ ]   ', '-    '].join('\n')
  assert.deepEqual(parseQueueEntries(md), ['fix the login redirect', 'plain bullet entry', 'star bullet entry', 'numbered entry'])
})

test('the priority sections need no parser support: headings are skipped, so a sorted file drains in priority order', () => {
  const md = ['## Priority 10 (critical — act immediately)', '- restore checkout', '', '## Priority 9', '- flaky auth test', '', '## Priority 5', '- tidy the config loader', '', '## Priority 0 (only if capacity)', '- rename the legacy flag'].join('\n')
  assert.deepEqual(parseQueueEntries(md), ['restore checkout', 'flaky auth test', 'tidy the config loader', 'rename the legacy flag'])
})

test('removeQueueEntry deletes the named open entry and nothing else', () => {
  const md = '- first\n- [ ] second\n- [x] done already\n- plain bullet\n'
  assert.equal(removeQueueEntry(md, 'first'), '- [ ] second\n- [x] done already\n- plain bullet\n')
  assert.equal(removeQueueEntry(md, 'second'), '- first\n- [x] done already\n- plain bullet\n')
  // An entry nobody has any more changes nothing; a checked line is not an open entry.
  assert.equal(removeQueueEntry(md, 'gone'), md)
  assert.equal(removeQueueEntry(md, 'done already'), md)
})

test('appendQueueEntry writes a plain bullet at the end', () => {
  assert.equal(appendQueueEntry('', 'x'), '- x\n')
  assert.equal(appendQueueEntry('- a', 'x'), '- a\n- x\n')
  assert.equal(appendQueueEntry('- a\n', 'x'), '- a\n- x\n')
})

test('a queued entry lands in its own priority section, not at the end of the file', () => {
  const md = ['# Backlog', '', '## Priority 7', '', '- an important thing', '', '## Priority 2', '', '- someday', ''].join('\n')
  const out = insertQueueEntry(md, 'a medium thing', 5)
  assert.match(out, /## Priority 5\n\n- a medium thing/)
  assert.ok(out.indexOf('an important thing') < out.indexOf('a medium thing'))
  assert.ok(out.indexOf('a medium thing') < out.indexOf('someday'))
})

test('an entry joins the section it belongs to when there already is one', () => {
  const md = ['## Priority 5', '', '- first', '', '## Priority 2', '', '- later', ''].join('\n')
  const out = insertQueueEntry(md, 'second', 5)
  assert.match(out, /- first\n- second/)
  assert.equal(out.match(/## Priority 5/g)?.length, 1)
})

test('a file with no priority sections gets one above its own headings; prose alone gets a section', () => {
  const md = ['# Backlog', '', 'Some prose.', '', '## MVP v1', '', '- dogfooding', ''].join('\n')
  const out = insertQueueEntry(md, 'queued thing', 5)
  assert.ok(out.indexOf('queued thing') < out.indexOf('dogfooding'))
  assert.ok(out.startsWith('# Backlog\n\nSome prose.\n'), 'the intro stays at the top')
  assert.deepEqual(parseQueueEntries(out), ['queued thing', 'dogfooding'])
  assert.match(insertQueueEntry('# Backlog\n\nSome prose.\n', 'queued thing', 5), /## Priority 5\n\n- queued thing\n$/)
})

test('an entry that outranks everything goes first; one outranked by everything goes last, in its own section', () => {
  const first = insertQueueEntry(['## Priority 2', '', '- someday', ''].join('\n'), 'urgent thing', 9)
  assert.ok(first.indexOf('urgent thing') < first.indexOf('someday'))
  const last = insertQueueEntry(['## Priority 9', '', '- urgent thing', ''].join('\n'), 'someday', 2)
  assert.ok(last.indexOf('urgent thing') < last.indexOf('someday'))
  assert.match(last, /## Priority 2\n\n- someday/)
})

test('a section heading with the format\'s own gloss is still matched', () => {
  const out = insertQueueEntry(['## Priority 10 (critical)', '', '- the fire', ''].join('\n'), 'another fire', 10)
  assert.equal(out.match(/## Priority 10/g)?.length, 1)
  assert.match(out, /- the fire\n- another fire/)
})

// Against real git: the queue lives on the branch, and the edits go through its write cycle.
const git = nodeGitRunner()
const RETRIED_RM = { recursive: true, force: true, maxRetries: 10 } as const

async function repo(): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'tickets-queue-')))
  await git(['init', '-b', 'main'], path)
  await git(['config', 'user.email', 't@t'], path)
  await git(['config', 'user.name', 't'], path)
  await writeFile(join(path, 'README.md'), '# t\n')
  await git(['add', '-A'], path)
  await git(['commit', '-m', 'init'], path)
  return path
}

test('queueAdd and queueDone edit the queue on the branch, from the project and from an agent worktree', async () => {
  const root = await repo()
  try {
    assert.deepEqual(await readQueueEntries(root), [])
    assert.deepEqual(await queueAdd(root, 'ranked', 5), { ok: true, changed: true })
    assert.equal((await queueAdd(root, 'unranked')).ok, true)
    assert.deepEqual(await readQueueEntries(root), ['ranked', 'unranked'])
    // From an agent's worktree: the project root is resolved, the edit lands on the same branch.
    const wt = join(root, '.branches', 'agent-x')
    await git(['worktree', 'add', wt, '-b', 'agent-x'], root)
    assert.equal((await queueAdd(wt, 'from the worktree', 9)).ok, true)
    assert.deepEqual(await readQueueEntries(wt), ['from the worktree', 'ranked', 'unranked'])
    assert.deepEqual(await queueDone(wt, 'ranked'), { ok: true, changed: true })
    assert.deepEqual(parseQueueEntries((await git(['show', `${TICKETS_BRANCH}:${QUEUE_FILE}`], root))), ['from the worktree', 'unranked'])
    assert.match(await git(['log', '--format=%s', TICKETS_BRANCH], root), /queue done: ranked\n.*queue add: from the worktree/)
    // Done means deleted, not checked off.
    assert.ok(!(await readQueue(root))!.includes('[x]'))
    // An entry already gone is a no-op that still lands, changing nothing.
    assert.deepEqual(await queueDone(root, 'ranked'), { ok: true, changed: false })
    // The pure parser and the git read agree on the seam every writer uses.
    await withFileBranch(root, TICKETS_BRANCH, 'by hand', async dir => {
      await writeFile(join(dir, QUEUE_FILE), '## Priority 3\n\n- [ ] by hand\n')
    })
    assert.deepEqual(await readQueueEntries(root), ['by hand'])
  } finally {
    await rm(root, RETRIED_RM)
  }
})
