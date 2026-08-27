import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakeDriver } from 'agent-driver'
import type { ChoicePick, ChoiceRequest, FrameworkEvent } from './events.js'
import { appendTodoEntry, appendFlatTodoEntry, checkOffEntry, findTodoBacklog, insertTodoEntry, nextQueuedTicket, parseTodoEntries, runTodoLoop, agentTodoPending, ticketForPrompt } from './todo-loop.js'
import { drainsQueue, presets } from './preset-catalog.js'
import { AUTO_PM_DRAIN_JOB, AUTO_PM_JOBS } from './auto-pm.js'
import { nodeGitRunner } from '@better-skills/branch-management'
import { DATA_BRANCH, dataWorktreePath, withDataBranch } from './data-branch.js'

const git = nodeGitRunner()
const RETRIED_RM = { recursive: true, force: true, maxRetries: 10 } as const

async function tmpWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'framework-todo-'))
}

/** A real repo: the queue lives on its data branch (#1582), so the reads need actual git. */
async function repoWorkspace(): Promise<string> {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'framework-todo-repo-')))
  await git(['init', '-b', 'main'], repo)
  await git(['config', 'user.email', 't@t'], repo)
  await git(['config', 'user.name', 't'], repo)
  await writeFile(join(repo, 'README.md'), '# t\n')
  await git(['add', '-A'], repo)
  await git(['commit', '-m', 'init'], repo)
  return repo
}

/** Put the queue on the data branch, committed, the way every real writer does. */
async function seedQueue(repo: string, md: string): Promise<void> {
  const result = await withDataBranch(repo, 'seed', async dir => {
    await writeFile(join(dir, 'TODO_AGENTS.md'), md, 'utf8')
  })
  assert.ok(result.ok, 'seeding the queue must land')
}

/** The queue as committed on the data branch. */
async function queueOnBranch(repo: string): Promise<string> {
  return git(['show', `${DATA_BRANCH}:TODO_AGENTS.md`], repo)
}

test('parseTodoEntries reads open list items and skips checked/blank/prose lines', () => {
  const md = [
    '# Backlog',
    '',
    'Some prose about the backlog.',
    '- [ ] fix the login redirect',
    '- [x] already done',
    '- [X] also done',
    '- plain bullet entry',
    '* star bullet entry',
    '2. numbered entry',
    '- [ ]   ', // open checkbox with no text
    '-    ', // empty bullet
  ].join('\n')
  assert.deepEqual(parseTodoEntries(md), [
    'fix the login redirect',
    'plain bullet entry',
    'star bullet entry',
    'numbered entry',
  ])
})

test('the priority (#880) sections need no parser support: headings are skipped, so a sorted file drains in priority order', () => {
  const md = [
    '## Priority 10 (critical — act immediately)',
    '- restore checkout',
    '',
    '## Priority 9',
    '- flaky auth test',
    '',
    '## Priority 5',
    '- tidy the config loader',
    '',
    '## Priority 0 (only if capacity)',
    '- rename the legacy flag',
  ].join('\n')
  assert.deepEqual(parseTodoEntries(md), [
    'restore checkout',
    'flaky auth test',
    'tidy the config loader',
    'rename the legacy flag',
  ])
})

test('checkOffEntry retires the named open entry and nothing else (#1582)', () => {
  const md = '- [ ] first\n- [ ] second\n- [x] done already\n- plain bullet\n'
  assert.equal(checkOffEntry(md, 'first'), '- [x] first\n- [ ] second\n- [x] done already\n- plain bullet\n')
  assert.equal(checkOffEntry(md, 'plain bullet'), '- [ ] first\n- [ ] second\n- [x] done already\n- [x] plain bullet\n')
  // An entry nobody has any more (retired meanwhile) changes nothing.
  assert.equal(checkOffEntry(md, 'gone'), md)
  // A checked entry stays checked exactly once.
  assert.equal(checkOffEntry(md, 'done already'), md)
})

test('findTodoBacklog reads the queue off the data branch (#682/#1582)', async () => {
  const repo = await repoWorkspace()
  try {
    assert.equal(await findTodoBacklog(repo), undefined) // nothing yet

    await seedQueue(repo, '- [ ] roadmap entry\n')
    assert.deepEqual(await findTodoBacklog(repo), { name: 'TODO_AGENTS.md', entries: ['roadmap entry'] })

    // The retired session-scoped backlog (#1369) is ignored, even when it has open entries.
    await writeFile(join(repo, 'TODO_feat-x.agent.md'), '- [ ] scoped entry\n')
    assert.equal((await findTodoBacklog(repo))?.name, 'TODO_AGENTS.md')

    // A fully checked-off backlog is no backlog.
    await seedQueue(repo, '- [x] all done\n')
    assert.equal(await findTodoBacklog(repo), undefined)
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('findTodoBacklog no longer reads any checkout file, the retired locations included (#1582)', async () => {
  // One convention, one location — and that location is the data branch, not the working tree.
  const repo = await repoWorkspace()
  try {
    await writeFile(join(repo, 'TODO_AGENTS.md'), '- [ ] root copy nobody reads\n')
    await writeFile(join(repo, 'TODO.md'), '- [ ] old root entry\n')
    await mkdir(join(repo, 'tickets-plain'))
    assert.equal(await findTodoBacklog(repo), undefined)
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('appendTodoEntry creates the queue on the data branch when there is none (#682/#1582)', async () => {
  const repo = await repoWorkspace()
  try {
    const file = await appendTodoEntry(repo, 'Resume the paused run')
    assert.equal(file, 'TODO_AGENTS.md')
    assert.equal(await queueOnBranch(repo), '- [ ] Resume the paused run\n')

    // A second entry appends to the same file, not a new one.
    await appendTodoEntry(repo, 'And another')
    assert.equal(await queueOnBranch(repo), '- [ ] Resume the paused run\n- [ ] And another\n')
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('appendTodoEntry resolves the project root from an agent worktree (#1582)', async () => {
  // A paused agent calls this from its own checkout; the data checkout lives beside the main repo.
  const repo = await repoWorkspace()
  try {
    const worktree = join(repo, '.the-framework', 'branches', 'tf-agent-x')
    await git(['worktree', 'add', '-b', 'tf-agent-x', worktree], repo)
    assert.equal(await appendTodoEntry(worktree, 'from the worktree'), 'TODO_AGENTS.md')
    assert.equal(await queueOnBranch(repo), '- [ ] from the worktree\n')
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('runTodoLoop works the backlog to empty, one entry per turn, checking each off itself (#323/#1582)', async () => {
  const repo = await repoWorkspace()
  await seedQueue(repo, '- [ ] first task\n- [ ] second task\n')
  try {
    const events: FrameworkEvent[] = []
    const prompts: string[] = []
    // The fake driver only answers; the check-off is the framework's own write now.
    const driver = new FakeDriver({
      respond: (prompt, i) => {
        prompts.push(prompt)
        return `completed item ${i + 1}`
      },
    })
    const session = await driver.start({ cwd: repo })
    const result = await runTodoLoop({ session, cwd: repo, emit: e => events.push(e) })

    assert.deepEqual(result, { completed: 2, reason: 'empty', file: 'TODO_AGENTS.md' })
    assert.equal(prompts.length, 2)
    assert.match(prompts[0]!, /first task/)
    assert.match(prompts[0]!, /checks this entry off/)
    assert.match(prompts[1]!, /second task/)
    assert.equal(await queueOnBranch(repo), '- [x] first task\n- [x] second task\n')
    // Narrated: the opening count, each item, and the completion line.
    assert.ok(events.some(e => e.kind === 'log' && /has 2 open item\(s\)/.test(e.message)))
    assert.ok(events.some(e => e.kind === 'log' && /Backlog item 1: first task/.test(e.message)))
    assert.ok(events.some(e => e.kind === 'log' && /Backlog item 2: second task/.test(e.message)))
    assert.ok(events.some(e => e.kind === 'log' && /Backlog done/.test(e.message)))
    // Headless: no per-item gate events.
    assert.equal(events.some(e => e.kind === 'choice'), false)
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('runTodoLoop returns empty without a backlog and emits nothing', async () => {
  const cwd = await tmpWorkspace()
  try {
    const events: FrameworkEvent[] = []
    const session = await new FakeDriver({ turns: [{ text: 'never prompted' }] }).start({ cwd })
    const result = await runTodoLoop({ session, cwd, emit: e => events.push(e) })
    assert.deepEqual(result, { completed: 0, reason: 'empty' })
    assert.deepEqual(events, [])
  } finally {
    await rm(cwd, RETRIED_RM)
  }
})

test('an interactive loop gates before each entry; picking stop ends it (#323)', async () => {
  const repo = await repoWorkspace()
  await seedQueue(repo, '- [ ] task a\n- [ ] task b\n')
  try {
    const events: FrameworkEvent[] = []
    const gates: ChoiceRequest[] = []
    // Accept the first gate, stop at the second.
    const requestChoice = (req: ChoiceRequest): Promise<ChoicePick> => {
      gates.push(req)
      return Promise.resolve({ picked: gates.length === 1 ? 'proceed' : 'stop', by: 'user' })
    }
    const session = await new FakeDriver({ respond: () => 'did task a' }).start({ cwd: repo })
    const result = await runTodoLoop({ session, cwd: repo, emit: e => events.push(e), requestChoice })

    assert.deepEqual(result, { completed: 1, reason: 'stopped', file: 'TODO_AGENTS.md' })
    assert.equal(gates.length, 2)
    assert.equal(gates[0]!.id, 'todo-next')
    assert.equal(gates[1]!.id, 'todo-next-1')
    assert.match(gates[0]!.options[0]!.label, /Work on: task a/)
    assert.equal(gates[0]!.recommended, 'proceed')
    assert.equal(await queueOnBranch(repo), '- [x] task a\n- [ ] task b\n')
    assert.ok(events.some(e => e.kind === 'log' && /stopped by you/.test(e.message)))
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('a check-off that cannot land stops the loop instead of re-working the entry (#1582)', async () => {
  const repo = await repoWorkspace()
  await seedQueue(repo, '- [ ] stubborn task\n- [ ] never reached\n')
  try {
    // Break the data checkout: the branch still reads (git show), but the write funnel cannot
    // have its worktree, so every check-off fails.
    await git(['worktree', 'remove', '--force', dataWorktreePath(repo)], repo)
    await writeFile(dataWorktreePath(repo), 'not a directory\n')
    const events: FrameworkEvent[] = []
    const session = await new FakeDriver({ respond: () => 'worked it' }).start({ cwd: repo })
    const result = await runTodoLoop({ session, cwd: repo, emit: e => events.push(e) })
    assert.deepEqual(result, { completed: 1, reason: 'stalled', file: 'TODO_AGENTS.md' })
    assert.ok(events.some(e => e.kind === 'log' && /could not be written/.test(e.message)))
    // The queue is untouched: better an open entry than a lost check-off.
    assert.equal(await queueOnBranch(repo), '- [ ] stubborn task\n- [ ] never reached\n')
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('runTodoLoop honors the item cap and reports what is left', async () => {
  const repo = await repoWorkspace()
  await seedQueue(repo, '- [ ] a\n- [ ] b\n- [ ] c\n')
  try {
    const events: FrameworkEvent[] = []
    const session = await new FakeDriver({ respond: (_p, i) => `turn ${i + 1}` }).start({ cwd: repo })
    const result = await runTodoLoop({ session, cwd: repo, emit: e => events.push(e), maxItems: 2 })
    assert.deepEqual(result, { completed: 2, reason: 'max-items', file: 'TODO_AGENTS.md' })
    assert.ok(events.some(e => e.kind === 'log' && /2-item cap.*1 item\(s\) left/.test(e.message)))
    assert.equal(await queueOnBranch(repo), '- [x] a\n- [x] b\n- [ ] c\n')
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('an item turn that stops to ask is gated and resumed like any await gate (#337)', async () => {
  const repo = await repoWorkspace()
  await seedQueue(repo, '- [ ] pick a database\n')
  const gateTurn = [
    'Which database?',
    '```await-choices',
    JSON.stringify({ title: 'Which database?', options: [{ label: 'SQLite' }, { label: 'Postgres' }], recommended: 'SQLite' }),
    '```',
  ].join('\n')
  try {
    const events: FrameworkEvent[] = []
    const prompts: string[] = []
    const session = await new FakeDriver({
      respond: (prompt, i) => {
        prompts.push(prompt)
        if (i === 0) return gateTurn // the item turn stops to ask
        return 'picked and done'
      },
    }).start({ cwd: repo })
    const requestChoice = (req: ChoiceRequest): Promise<ChoicePick> =>
      Promise.resolve({ picked: req.id.startsWith('todo-next') ? 'proceed' : 'opt:1', by: 'user' })
    const result = await runTodoLoop({ session, cwd: repo, emit: e => events.push(e), requestChoice })

    assert.deepEqual(result, { completed: 1, reason: 'empty', file: 'TODO_AGENTS.md' })
    assert.equal(prompts.length, 2)
    assert.match(prompts[1]!, /The user chose: Postgres/)
    const ids = events.filter(e => e.kind === 'choice').map(e => (e as { id: string }).id)
    assert.deepEqual(ids, ['todo-next', 'await-choices'])
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('an aborted signal ends the loop before starting another entry', async () => {
  const cwd = await tmpWorkspace()
  try {
    const controller = new AbortController()
    controller.abort()
    const session = await new FakeDriver({ respond: () => 'never' }).start({ cwd })
    const result = await runTodoLoop({ session, cwd, emit: () => {}, signal: controller.signal })
    // Aborted before item 1: nothing worked, reported as a clean stop.
    assert.deepEqual(result, { completed: 0, reason: 'stopped' })
  } finally {
    await rm(cwd, RETRIED_RM)
  }
})

test('a backlog turn emits its signals: views, errors, session name, ready-for-merge', async () => {
  const repo = await repoWorkspace()
  await seedQueue(repo, '- [ ] tidy the login redirect\n')
  try {
    const events: FrameworkEvent[] = []
    // The protocols are unconditional, so the agent is told it can signal on ANY turn,
    // a backlog turn included. Everything it emits has to reach the agent stream.
    const driver = new FakeDriver({
      respond: () =>
        [
          'Done.',
          '```show-markdown',
          '# What I changed',
          'Rewrote the redirect guard.',
          '```',
          '```error',
          'the redirect test fixture is missing',
          '',
          'ran `ls test/fixtures`: No such file or directory',
          '```',
          '```ready-for-merge',
          '```',
        ].join('\n'),
    })
    const session = await driver.start({ cwd: repo })
    await runTodoLoop({ session, cwd: repo, emit: e => events.push(e) })

    const view = events.find(e => e.kind === 'view')
    assert.equal(view?.title, 'What I changed')
    assert.deepEqual(
      events.filter(e => e.kind === 'error'),
      [
        {
          kind: 'error',
          headline: 'the redirect test fixture is missing',
          detail: 'ran `ls test/fixtures`: No such file or directory',
        },
      ],
    )
    assert.equal(events.filter(e => e.kind === 'ready-for-merge').length, 1)
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('ready-for-merge is emitted once across a multi-item backlog', async () => {
  const repo = await repoWorkspace()
  await seedQueue(repo, '- [ ] first task\n- [ ] second task\n')
  try {
    const events: FrameworkEvent[] = []
    // Both items signal ready-for-merge; the loop's one emitter dedupes them.
    const session = await new FakeDriver({ respond: () => 'Done.\n```ready-for-merge\n```' }).start({ cwd: repo })
    const result = await runTodoLoop({ session, cwd: repo, emit: e => events.push(e) })

    assert.equal(result.completed, 2)
    assert.equal(events.filter(e => e.kind === 'ready-for-merge').length, 1)
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

// #697/#1369/#1582: everything lands on the data branch's flat queue — a leftover session-scoped
// backlog in the checkout is retired and never written to.
test('both append helpers write the flat queue even when a session backlog exists (#697/#1369)', async () => {
  const repo = await repoWorkspace()
  try {
    await writeFile(join(repo, 'TODO_a-session.agent.md'), '- [ ] a run\n', 'utf8')

    assert.equal(await appendTodoEntry(repo, 'from the run'), 'TODO_AGENTS.md')
    assert.equal(await appendFlatTodoEntry(repo, 'Do ticket 42'), 'TODO_AGENTS.md')
    assert.equal(await queueOnBranch(repo), '- [ ] from the run\n- [ ] Do ticket 42\n')
    // The leftover session file is untouched.
    assert.equal(await readFile(join(repo, 'TODO_a-session.agent.md'), 'utf8'), '- [ ] a run\n')
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

// The queue is worked front to back (the drain preset takes "the FIRST open entry" and
// parseTodoEntries reads in file order), so where an entry lands *is* its priority. Appending at
// the end, which is what queueing a ticket used to do, meant "work on this" put it last (#1164).

test('a queued entry lands in its own priority section, not at the end of the file (#1164)', () => {
  const md = ['# Backlog', '', '## Priority 7', '', '- [ ] an important thing', '', '## Priority 2', '', '- [ ] someday', ''].join('\n')
  const out = insertTodoEntry(md, 'a medium thing', 5)
  assert.match(out, /## Priority 5\n\n- \[ \] a medium thing/)
  // Between the two it ranks against, and ahead of the low one it outranks.
  assert.ok(out.indexOf('an important thing') < out.indexOf('a medium thing'))
  assert.ok(out.indexOf('a medium thing') < out.indexOf('someday'))
})

test('an entry joins the section it belongs to when there already is one (#1164)', () => {
  const md = ['## Priority 5', '', '- [ ] first', '', '## Priority 2', '', '- [ ] later', ''].join('\n')
  const out = insertTodoEntry(md, 'second', 5)
  assert.match(out, /- \[ \] first\n- \[ \] second/)
  // One section, not a duplicate heading.
  assert.equal(out.match(/## Priority 5/g)?.length, 1)
})

test('a file with no priority sections gets one above its own headings (#1164)', () => {
  // The file's sections are unranked, so burying a deliberate pick beneath them is the bug.
  const md = ['# Backlog', '', 'Some prose.', '', '## MVP v1', '', '- [ ] dogfooding', ''].join('\n')
  const out = insertTodoEntry(md, 'queued thing', 5)
  assert.ok(out.indexOf('queued thing') < out.indexOf('dogfooding'))
  assert.ok(out.startsWith('# Backlog\n\nSome prose.\n'), 'the intro stays at the top')
  assert.deepEqual(parseTodoEntries(out), ['queued thing', 'dogfooding'])
})

test('a backlog with nothing but prose still gets a section (#1164)', () => {
  const out = insertTodoEntry('# Backlog\n\nSome prose.\n', 'queued thing', 5)
  assert.match(out, /## Priority 5\n\n- \[ \] queued thing\n$/)
})

test('an entry that outranks everything in the file goes first (#1164)', () => {
  const md = ['## Priority 2', '', '- [ ] someday', ''].join('\n')
  const out = insertTodoEntry(md, 'urgent thing', 9)
  assert.ok(out.indexOf('urgent thing') < out.indexOf('someday'))
})

test('an entry outranked by everything in the file goes last, in its own section (#1164)', () => {
  const md = ['## Priority 9', '', '- [ ] urgent thing', ''].join('\n')
  const out = insertTodoEntry(md, 'someday', 2)
  assert.ok(out.indexOf('urgent thing') < out.indexOf('someday'))
  assert.match(out, /## Priority 2\n\n- \[ \] someday/)
})

test('a section heading with the format\'s own gloss is still matched (#1164)', () => {
  // `todo_format.md` writes "## Priority 10 (critical — act immediately)".
  const md = ['## Priority 10 (critical)', '', '- [ ] the fire', ''].join('\n')
  const out = insertTodoEntry(md, 'another fire', 10)
  assert.equal(out.match(/## Priority 10/g)?.length, 1)
  assert.match(out, /- \[ \] the fire\n- \[ \] another fire/)
})

test('appendFlatTodoEntry places by priority when given one, and appends when not (#1164)', async () => {
  const repo = await repoWorkspace()
  try {
    await seedQueue(repo, '# Backlog\n\n## MVP v1\n\n- [ ] old\n')
    await appendFlatTodoEntry(repo, 'ranked', 5)
    await appendFlatTodoEntry(repo, 'unranked')
    // The ranked one jumped the unranked backlog; the plain append stayed an append.
    assert.deepEqual(parseTodoEntries(await queueOnBranch(repo)), ['ranked', 'old', 'unranked'])
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('nextQueuedTicket names the ticket the next drain run will pick up (#1117)', async () => {
  const repo = await repoWorkspace()
  try {
    // Nothing queued at all: nothing to name.
    assert.equal(await nextQueuedTicket(repo), undefined)

    // The drain preset works "the FIRST open entry only", so that is the entry this reads --
    // priority order is already the file order the queue is written in (#1164).
    await seedQueue(
      repo,
      [
        '## Priority 9',
        '',
        '- [x] [Already done](tickets/2026-07-01_done.md)',
        '- [ ] [Add a login page](tickets/2026-07-25_login.md)',
        '',
        '## Priority 5',
        '',
        '- [ ] [Later](tickets/2026-07-26_later.md)',
        '',
      ].join('\n'),
    )
    assert.equal(await nextQueuedTicket(repo), 'tickets/2026-07-25_login.md')

    // A queue whose first open entry is plain text: a drain agent there implements no ticket, and
    // saying "the one below it" would label the wrong ticket as being worked.
    await seedQueue(repo, '- [ ] tidy the README\n- [ ] [Login](tickets/2026-07-25_login.md)\n')
    assert.equal(await nextQueuedTicket(repo), undefined)
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('ticketForPrompt names a ticket for a hand-fired drain, and for nothing else (#1117)', async () => {
  const repo = await repoWorkspace()
  try {
    await seedQueue(repo, ['## Priority 9', '', '- [ ] [Add a login page](tickets/2026-07-25_login.md)', ''].join('\n'))

    // The drain preset, whatever its current wording: the sweep's own prompt, arriving by hand.
    assert.equal(await ticketForPrompt(presets.drainQueue.render(), repo), 'tickets/2026-07-25_login.md')
    // Leading/trailing whitespace is what a textarea adds, not a different instruction.
    assert.equal(await ticketForPrompt(`\n${presets.drainQueue.render()}  `, repo), 'tickets/2026-07-25_login.md')

    // Every other prompt implements whatever it likes; naming the queue's next entry for it would
    // put a ticket in the in-progress lane on the strength of an unrelated agent.
    assert.equal(await ticketForPrompt('Work on the queue please', repo), undefined)
    assert.equal(await ticketForPrompt(presets.planTickets.render(), repo), undefined)
    assert.equal(await ticketForPrompt('', repo), undefined)

    // A read that throws is a lane label, not an agent: it must never take the start down with it.
    const boom = async () => {
      throw new Error('unreadable queue')
    }
    assert.equal(await ticketForPrompt(presets.drainQueue.render(), repo, boom), undefined)
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('the drain the sweep fires and the drain a click fires are the same drain (#1117)', () => {
  // The daemon recognises its drain by the `drains` flag on the job; a click has only the text.
  // If those two ever name different prompts, a hand-fired drain silently stops tagging tickets,
  // which shows up as an empty lane rather than as an error.
  assert.equal(AUTO_PM_DRAIN_JOB.drains, true)
  assert.equal(drainsQueue(AUTO_PM_DRAIN_JOB.prompt), true)
  // And nothing that merely puts work ON the queue counts as taking it off.
  for (const job of AUTO_PM_JOBS) assert.equal(drainsQueue(job.prompt), false, `${job.name} is not a drain`)
})

test('agentTodoPending reads only the session-named TODO file (#1363)', async () => {
  const cwd = await tmpWorkspace()
  try {
    // No file: no pendingness known. The global queue must not count — it is decoupled from
    // sessions (#1390), and counting it would mean auto-merge never fires while any backlog exists.
    assert.equal(await agentTodoPending(cwd, 'fix-login'), false)

    // The session's own file with an open entry withholds; all-checked releases.
    await writeFile(join(cwd, 'TODO_fix-login.agent.md'), '- [x] done part\n- [ ] open part\n')
    assert.equal(await agentTodoPending(cwd, 'fix-login'), true)
    await writeFile(join(cwd, 'TODO_fix-login.agent.md'), '- [x] done part\n- [x] open part\n')
    assert.equal(await agentTodoPending(cwd, 'fix-login'), false)

    // No session name, or one that cannot name a file, knows of nothing pending.
    assert.equal(await agentTodoPending(cwd, undefined), false)
    assert.equal(await agentTodoPending(cwd, '../escape'), false)
  } finally {
    await rm(cwd, RETRIED_RM)
  }
})
