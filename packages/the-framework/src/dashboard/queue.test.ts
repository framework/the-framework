import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { parseTodoItems, collectQueue } from './queue.js'
import type { ProjectSummary } from './projects.js'
import type { WorkspaceDoc } from './docs.js'

const project = (id: string, path: string): ProjectSummary => ({ id, path, name: id, activated: true })

test('parseTodoItems extracts task-list entries and their checked state', () => {
  const items = parseTodoItems('# TODO\n- [ ] ship it\n* [x] done thing\n  - [X] nested done\nnot a task\n- [ ]\n')
  assert.deepEqual(items, [
    { text: 'ship it', done: false },
    { text: 'done thing', done: true },
    { text: 'nested done', done: true },
  ])
})

test('collectQueue rolls up open TODO items per project, most-open first, skipping empties', async () => {
  const docs: Record<string, WorkspaceDoc[]> = {
    '/a': [{ name: 'tickets/TODO.md', content: '- [ ] one\n- [ ] two\n- [x] gone\n' }], // #629 location, matched by basename
    '/b': [{ name: 'TODO_main.agent.md', content: '- [ ] only\n' }],
    '/c': [{ name: 'PLAN.md', content: '- [ ] not a todo doc\n' }], // no TODO doc -> skipped
    '/d': [{ name: 'TODO.md', content: '# nothing checkable\n' }], // TODO but no items -> skipped
  }
  const read = async (cwd: string): Promise<WorkspaceDoc[]> => docs[cwd] ?? []
  const queues = await collectQueue(
    [project('a', '/a'), project('b', '/b'), project('c', '/c'), project('d', '/d')],
    read,
  )
  assert.deepEqual(
    queues.map(q => ({ id: q.projectId, open: q.open, total: q.total })),
    [
      { id: 'a', open: 2, total: 3 },
      { id: 'b', open: 1, total: 1 },
    ],
  )
})

test('collectQueue skips a project whose docs read throws', async () => {
  const read = async (cwd: string): Promise<WorkspaceDoc[]> => {
    if (cwd === '/boom') throw new Error('unreadable')
    return [{ name: 'TODO.md', content: '- [ ] fine\n' }]
  }
  const queues = await collectQueue([project('boom', '/boom'), project('ok', '/ok')], read)
  assert.deepEqual(queues.map(q => q.projectId), ['ok'])
})

test('link-style entries with no checkbox are open items, like the sweep reads them (#1296)', () => {
  // The observed blocker: a triage-written queue in the #1164 link style read as "Nothing queued"
  // while the sweep drained it happily.
  const md = [
    '# TODO_AGENTS',
    '',
    '## Priority 8',
    '',
    '- [Settle-moment UX: always offer Open PR](tickets/2026-07-25_unclear-ux.md) — offer the box',
    '  and keep the push setting available.',
    '- [Remove the babysitting paragraph](tickets/2026-07-26_remove-babysitting.md) — steps.ts:62',
    '',
    '## Priority 7',
    '',
    '- [x] already handled',
    'prose that is not an entry',
  ].join('\n')
  const items = parseTodoItems(md)
  assert.deepEqual(
    items.map(i => [i.done, i.text.slice(0, 20)]),
    [
      [false, '[Settle-moment UX: a'],
      [false, '[Remove the babysitt'],
      [true, 'already handled'],
    ],
  )
})

test('parseTodoItems agrees with the sweep parser on which entries are open (#1296)', async () => {
  const { parseTodoEntries } = await import('../todo-loop.js')
  const md = [
    '- [Link entry](tickets/a.md) — do the thing',
    '- [ ] open checkbox entry',
    '- [x] done entry',
    '* starred plain entry',
    '1. numbered entry',
    '  continuation line, not an entry',
    '## a heading',
  ].join('\n')
  const open = parseTodoItems(md).filter(i => !i.done).map(i => i.text)
  assert.deepEqual(open, parseTodoEntries(md))
})
