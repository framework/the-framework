import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakeDriver } from 'agent-driver'
import type { ChoicePick, ChoiceRequest, FrameworkEvent } from './events.js'
import { nextQueuedTicket, runTodoLoop, agentTodoPending, ticketForPrompt } from './todo-loop.js'
import { drainsQueue, presets } from './preset-catalog.js'
import { AUTO_PM_DRAIN_JOB, AUTO_PM_JOBS } from './auto-pm.js'
import { fileBranchPath, nodeGitRunner, withFileBranch, DATA_BRANCH } from '@gemstack/agent-data'

const git = nodeGitRunner()
const RETRIED_RM = { recursive: true, force: true, maxRetries: 10 } as const

async function tmpWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'framework-todo-'))
}

/** A real repo: the queue lives on the `agent-data` branch (#1582/#1748), so the reads need actual git. */
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

/** Put the queue on the `agent-data` branch, committed, the way every real writer does. */
async function seedQueue(repo: string, md: string): Promise<void> {
  const result = await withFileBranch(repo, DATA_BRANCH, 'seed', async dir => {
    await writeFile(join(dir, 'TODO_AGENTS.md'), md, 'utf8')
  })
  assert.ok(result.ok, 'seeding the queue must land')
}

/** The queue as committed on the `agent-data` branch. */
async function queueOnBranch(repo: string): Promise<string> {
  return git(['show', `${DATA_BRANCH}:TODO_AGENTS.md`], repo)
}

test('runTodoLoop works the backlog to empty, one entry per turn, checking each off itself (#323/#1582)', async () => {
  const repo = await repoWorkspace()
  await seedQueue(repo, '- [ ] first task\n- [ ] second task\n')
  try {
    const events: FrameworkEvent[] = []
    const prompts: string[] = []
    // The fake driver only answers; the removal is the framework's own write.
    const driver = new FakeDriver({
      respond: (prompt, i) => {
        prompts.push(prompt)
        return `completed item ${i + 1}`
      },
    })
    const session = await driver.start({ cwd: repo })
    const result = await runTodoLoop({ session, cwd: repo, emit: e => events.push(e) })

    assert.deepEqual(result, { completed: 2, reason: 'empty' })
    assert.equal(prompts.length, 2)
    assert.match(prompts[0]!, /first task/)
    assert.match(prompts[0]!, /takes this entry off the queue/)
    assert.match(prompts[1]!, /second task/)
    assert.equal(await queueOnBranch(repo), '')
    // Narrated: the opening count, each item, and the completion line.
    assert.ok(events.some(e => e.kind === 'log' && /2 open item\(s\)/.test(e.message)))
    assert.ok(events.some(e => e.kind === 'log' && /Queue item 1: first task/.test(e.message)))
    assert.ok(events.some(e => e.kind === 'log' && /Queue item 2: second task/.test(e.message)))
    assert.ok(events.some(e => e.kind === 'log' && /Queue done/.test(e.message)))
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

    assert.deepEqual(result, { completed: 1, reason: 'stopped' })
    assert.equal(gates.length, 2)
    assert.equal(gates[0]!.id, 'todo-next')
    assert.equal(gates[1]!.id, 'todo-next-1')
    assert.match(gates[0]!.options[0]!.label, /Work on: task a/)
    assert.equal(gates[0]!.recommended, 'proceed')
    assert.equal(await queueOnBranch(repo), '- [ ] task b\n')
    assert.ok(events.some(e => e.kind === 'log' && /stopped by you/.test(e.message)))
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('a removal that cannot land stops the loop instead of re-working the entry (#1582)', async () => {
  const repo = await repoWorkspace()
  await seedQueue(repo, '- [ ] stubborn task\n- [ ] never reached\n')
  try {
    // Break the branch's checkout: the branch still reads (git show), but the write funnel cannot
    // have its worktree, so every removal fails.
    await git(['worktree', 'remove', '--force', fileBranchPath(repo, DATA_BRANCH)], repo)
    await writeFile(fileBranchPath(repo, DATA_BRANCH), 'not a directory\n')
    const events: FrameworkEvent[] = []
    const session = await new FakeDriver({ respond: () => 'worked it' }).start({ cwd: repo })
    const result = await runTodoLoop({ session, cwd: repo, emit: e => events.push(e) })
    assert.deepEqual(result, { completed: 1, reason: 'stalled' })
    assert.ok(events.some(e => e.kind === 'log' && /could not be taken off the queue/.test(e.message)))
    // The queue is untouched: better an open entry than a lost removal.
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
    assert.deepEqual(result, { completed: 2, reason: 'max-items' })
    assert.ok(events.some(e => e.kind === 'log' && /2-item cap.*1 item\(s\) left/.test(e.message)))
    assert.equal(await queueOnBranch(repo), '- [ ] c\n')
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

    assert.deepEqual(result, { completed: 1, reason: 'empty' })
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
